import { supabase } from "@/lib/supabase-client";

/**
 * Reward Service: Handle complex reward logic for HLR Running Club
 * - Time-based rewards (Sub 3:00, 3:15, etc. for races) [Ref: 29, 30-36]
 * - Podium rewards (Top 1-3 overall and age-group) [Ref: 37-46]
 * - Monthly challenge penalties for incomplete/unregistered challenges [Ref: 7, 50]
 */

interface RaceResult {
  id: string;
  user_id: string;
  race_id: string;
  distance: "5km" | "10km" | "21km" | "42km";
  chip_time_seconds: number;
  official_rank: number;
  age_group_rank: number;
}

/**
 * Helper: Get user's gender from profile
 */
async function getUserGender(userId: string): Promise<"Male" | "Female" | null> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("gender")
    .eq("id", userId)
    .single();

  if (error) {
    console.error(`[rewardService] Failed to fetch user gender:`, error);
    return null;
  }

  return profile?.gender || null;
}

/**
 * Helper: Determine race category (HM/FM) from distance
 */
function getRaceCategory(distance: string): "HM" | "FM" | null {
  const dist = (distance || "").toLowerCase();
  if (dist.includes("21")) return "HM";
  if (dist.includes("42")) return "FM";
  return null;
}

/**
 * Helper: Check if reward already awarded
 */
async function isRewardAlreadyAwarded(
  userId: string,
  raceResultId: string,
  rewardDefinitionId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("member_rewards")
    .select("id")
    .eq("user_id", userId)
    .eq("race_result_id", raceResultId)
    .eq("reward_definition_id", rewardDefinitionId)
    .limit(1);

  if (error) {
    console.error(`[rewardService] Failed to check reward history:`, error);
    return false;
  }

  return data && data.length > 0;
}

/**
 * Main Reward Check: Time-based rewards for race results [Ref: 29, 30-36]
 *
 * Logic:
 * - Input: userId, raceResult (with distance, chip_time_seconds, gender from profile)
 * - Fetch applicable rewards from reward_matrix (matching category + gender + condition_type='Time')
 * - Find highest priority (best) tier that user achieved
 * - Check if already awarded (prevent duplicates per race)
 * - If not awarded: insert member_rewards + create transaction
 * - Rule [Ref: 21]: Only 1 time per highest tier in sequence (checked via history)
 *
 * Example:
 * - FM Male Sub 3:00 → 1.5M + KNC
 * - FM Male Sub 3:15 → 1M + KNC
 * - FM Male Sub 3:30 → 500K + Bảng gỗ
 */
export async function checkRaceReward(userId: string, raceResult: RaceResult) {
  console.log(`[rewardService] Checking race reward for user ${userId}, race ${raceResult.race_id}`);

  // 1) Determine race category (HM/FM)
  const category = getRaceCategory(raceResult.distance);
  if (!category) {
    console.warn(
      `[rewardService] Race distance "${raceResult.distance}" not eligible for time-based rewards`
    );
    return { awarded: false, reason: "Distance not eligible (only HM/FM)" };
  }

  // 2) Get user's gender
  const gender = await getUserGender(userId);
  if (!gender) {
    console.warn(`[rewardService] Could not determine user gender`);
    return { awarded: false, reason: "Gender not found in profile" };
  }

  // 3) Fetch applicable rewards (time-based, matching category + gender, active)
  const { data: rewards, error: rewardErr } = await supabase
    .from("reward_matrix")
    .select("id, condition_value, prize_desc, cash_amount, priority")
    .eq("category", category)
    .eq("gender", gender)
    .eq("condition_type", "Time")
    .eq("active", true)
    .order("priority", { ascending: true });

  if (rewardErr) {
    console.error(`[rewardService] Failed to fetch rewards:`, rewardErr);
    return { awarded: false, reason: "Could not fetch rewards from DB" };
  }

  if (!rewards || rewards.length === 0) {
    console.log(`[rewardService] No time-based rewards configured for ${category}/${gender}`);
    return { awarded: false, reason: "No rewards configured" };
  }

  // 4) Find highest tier (best/fastest) that user achieved
  // condition_value is time in seconds (e.g., 10800 = 3:00)
  let awardedReward: any = null;
  for (const reward of rewards) {
    if (raceResult.chip_time_seconds <= reward.condition_value) {
      awardedReward = reward;
      break;
    }
  }

  if (!awardedReward) {
    console.log(`[rewardService] User did not achieve any tier`);
    return { awarded: false, reason: "Did not meet any reward threshold" };
  }

  // 5) Check if already awarded
  const alreadyAwarded = await isRewardAlreadyAwarded(userId, raceResult.id, awardedReward.id);
  if (alreadyAwarded) {
    console.log(`[rewardService] Reward already awarded for this race`);
    return { awarded: false, reason: "Reward already awarded for this race" };
  }

  // 6) Insert member_rewards
  const { error: insertErr } = await supabase.from("member_rewards").insert({
    user_id: userId,
    race_result_id: raceResult.id,
    reward_definition_id: awardedReward.id,
    awarded_date: new Date().toISOString().slice(0, 10),
    status: "pending",
  });

  if (insertErr) {
    console.error(`[rewardService] Failed to insert member_reward:`, insertErr);
    return { awarded: false, reason: "Failed to record reward" };
  }

  // 7) Create transaction for cash reward
  if (awardedReward.cash_amount > 0) {
    const { error: txnErr } = await supabase.from("transactions").insert({
      user_id: userId,
      type: "reward_payout",
      amount: awardedReward.cash_amount,
      description: `Race reward: ${awardedReward.prize_desc} (${category} - ${gender})`,
      transaction_date: new Date().toISOString().slice(0, 10),
      payment_status: "pending",
      related_challenge_id: null,
    });

    if (txnErr) {
      console.error(`[rewardService] Failed to create transaction:`, txnErr);
    }
  }

  console.log(`[rewardService] Reward awarded: ${awardedReward.prize_desc}`);

  return {
    awarded: true,
    rewardId: awardedReward.id,
    prize: awardedReward.prize_desc,
    cashAmount: awardedReward.cash_amount,
  };
}

/**
 * Podium Reward Check [Ref: 37-46]
 *
 * Awards for Top 1-3 finishes (overall and age-group)
 * - Can be awarded multiple times (different races)
 * - rankType: 'overall' (official_rank) or 'age_group' (age_group_rank)
 * - Ranks 1, 2, 3 are eligible
 */
export async function checkPodiumReward(
  userId: string,
  raceResult: RaceResult,
  rankType: "overall" | "age_group" = "overall"
) {
  console.log(
    `[rewardService] Checking podium reward for user ${userId}, rank_type=${rankType}`
  );

  const rank = rankType === "overall" ? raceResult.official_rank : raceResult.age_group_rank;

  // Only ranks 1-3 eligible
  if (!rank || rank < 1 || rank > 3) {
    console.log(`[rewardService] Rank ${rank} not in podium (1-3)`);
    return { awarded: false, reason: "Rank not in top 3" };
  }

  // 2) Fetch podium reward from reward_matrix (condition_type='Rank', condition_value=rank)
  const { data: podiumRewards, error: rewardErr } = await supabase
    .from("reward_matrix")
    .select("id, prize_desc, cash_amount")
    .eq("condition_type", "Rank")
    .eq("condition_value", rank)
    .eq("active", true)
    .limit(1);

  if (rewardErr) {
    console.error(`[rewardService] Failed to fetch podium reward:`, rewardErr);
    return { awarded: false, reason: "Could not fetch rewards from DB" };
  }

  if (!podiumRewards || podiumRewards.length === 0) {
    console.log(`[rewardService] No podium reward configured for rank ${rank}`);
    return { awarded: false, reason: "No reward configured for this rank" };
  }

  const podiumReward = podiumRewards[0];

  // 3) Check if already awarded for this specific race
  const alreadyAwarded = await isRewardAlreadyAwarded(userId, raceResult.id, podiumReward.id);
  if (alreadyAwarded) {
    console.log(`[rewardService] Podium reward already awarded for this race`);
    return { awarded: false, reason: "Reward already awarded for this race" };
  }

  // 4) Insert member_rewards
  const { error: insertErr } = await supabase.from("member_rewards").insert({
    user_id: userId,
    race_result_id: raceResult.id,
    reward_definition_id: podiumReward.id,
    awarded_date: new Date().toISOString().slice(0, 10),
    status: "pending",
  });

  if (insertErr) {
    console.error(`[rewardService] Failed to insert member_reward:`, insertErr);
    return { awarded: false, reason: "Failed to record reward" };
  }

  // 5) Create transaction
  if (podiumReward.cash_amount > 0) {
    const { error: txnErr } = await supabase.from("transactions").insert({
      user_id: userId,
      type: "reward_payout",
      amount: podiumReward.cash_amount,
      description: `Podium reward: ${rankType} rank ${rank} - ${podiumReward.prize_desc}`,
      transaction_date: new Date().toISOString().slice(0, 10),
      payment_status: "pending",
      related_challenge_id: null,
    });

    if (txnErr) {
      console.error(`[rewardService] Failed to create transaction:`, txnErr);
    }
  }

  console.log(`[rewardService] Podium reward awarded: ${podiumReward.prize_desc}`);

  return {
    awarded: true,
    rewardId: podiumReward.id,
    prize: podiumReward.prize_desc,
    cashAmount: podiumReward.cash_amount,
    rank,
    rankType,
  };
}

/**
 * Challenge Penalty Check [Ref: 7, 50]
 *
 * End of month: Apply 100k VND fine for:
 * - Members who failed to reach challenge target
 * - Members who were not registered (without valid excuse)
 *
 * Params:
 * - challengeId: the challenge to process
 * - excludeUserIds: (optional) list of user IDs with valid excuses
 */
export async function checkChallengePenalty(challengeId: string, excludeUserIds: string[] = []) {
  console.log(`[rewardService] Checking challenge penalties for challenge ${challengeId}`);

  // 1) Get challenge
  const { data: challenge, error: chErr } = await supabase
    .from("challenges")
    .select("id, end_date")
    .eq("id", challengeId)
    .single();

  if (chErr) {
    console.error(`[rewardService] Failed to fetch challenge:`, chErr);
    return { processed: false, reason: "Could not fetch challenge" };
  }

  // 2) Get all active members
  const { data: allMembers, error: membErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_active", true);

  if (membErr) {
    console.error(`[rewardService] Failed to fetch members:`, membErr);
    return { processed: false, reason: "Could not fetch members" };
  }

  if (!allMembers || allMembers.length === 0) {
    console.log(`[rewardService] No active members found`);
    return { processed: true, penaltiesApplied: 0 };
  }

  let penaltiesApplied = 0;

  for (const member of allMembers) {
    if (excludeUserIds.includes(member.id)) {
      console.log(`[rewardService] Skipping penalty for ${member.id} (excused)`);
      continue;
    }

    // Check participation
    const { data: participation, error: partErr } = await supabase
      .from("challenge_participants")
      .select("id, status, actual_km, target_km")
      .eq("challenge_id", challengeId)
      .eq("user_id", member.id)
      .single();

    let shouldPenalize = false;
    let reason = "";

    if (partErr) {
      // Not registered
      shouldPenalize = true;
      reason = "unregistered";
    } else if (participation.status === "failed") {
      // Failed to complete
      shouldPenalize = true;
      reason = `failed (${participation.actual_km}/${participation.target_km} km)`;
    }

    if (shouldPenalize) {
      console.log(`[rewardService] Member ${member.id} penalty: ${reason}`);

      const { error: txnErr } = await supabase.from("transactions").insert({
        user_id: member.id,
        type: "fine",
        amount: 100000, // 100k VND
        description: `Challenge ${reason === "unregistered" ? "registration" : "completion"} fine`,
        transaction_date: new Date().toISOString().slice(0, 10),
        payment_status: "pending",
        related_challenge_id: challengeId,
      });

      if (!txnErr) {
        penaltiesApplied++;
      }
    }
  }

  console.log(`[rewardService] Challenge penalties processed: ${penaltiesApplied} fines applied`);

  return {
    processed: true,
    challengeId,
    penaltiesApplied,
  };
}

export default {
  checkRaceReward,
  checkPodiumReward,
  checkChallengePenalty,
};
