import { supabase } from "@/lib/supabase-client";
import serverDebug from "@/lib/server-debug";

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
    serverDebug.error(`[rewardService] Failed to fetch user gender:`, error);
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
async function isMilestoneAlreadyAwarded(userId: string, milestoneId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("member_milestone_rewards")
    .select("id")
    .eq("member_id", userId)
    .eq("milestone_id", milestoneId)
    .limit(1);

  if (error) {
    serverDebug.error(`[rewardService] Failed to check milestone history:`, error);
    return false;
  }

  return data && data.length > 0;
}

async function isPodiumAlreadyAwarded(userId: string, podiumConfigId: string, raceResultId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("member_podium_rewards")
    .select("id")
    .eq("member_id", userId)
    .eq("podium_config_id", podiumConfigId)
    .eq("race_result_id", raceResultId)
    .limit(1);

  if (error) {
    serverDebug.error(`[rewardService] Failed to check podium history:`, error);
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
  serverDebug.debug(`[rewardService] Checking race reward for user ${userId}, race ${raceResult.race_id}`);

  // 1) Determine race category (HM/FM)
  const category = getRaceCategory(raceResult.distance);
  if (!category) {
    serverDebug.warn(
      `[rewardService] Race distance "${raceResult.distance}" not eligible for time-based rewards`
    );
    return { awarded: false, reason: "Distance not eligible (only HM/FM)" };
  }

  // 2) Get user's gender
  const gender = await getUserGender(userId);
  if (!gender) {
    serverDebug.warn(`[rewardService] Could not determine user gender`);
    return { awarded: false, reason: "Gender not found in profile" };
  }

  // 3) Fetch matching milestone configs from reward_milestones
  const { data: milestones, error: milestoneErr } = await supabase
    .from('reward_milestones')
    .select('id, reward_description, cash_amount, priority, time_seconds')
    .eq('race_type', category)
    .in('gender', [gender, null])
    .eq('is_active', true)
    .order('priority', { ascending: false });

  if (milestoneErr) {
    serverDebug.error(`[rewardService] Failed to fetch milestones:`, milestoneErr);
    return { awarded: false, reason: 'Could not fetch milestones' };
  }

  if (!milestones || milestones.length === 0) {
    serverDebug.debug(`[rewardService] No milestones configured for ${category}/${gender}`);
    return { awarded: false, reason: 'No milestones configured' };
  }

  // Find highest-priority milestone that the user achieved (priority desc)
  let awardedMilestone: Record<string, unknown> | null = null;
  for (const m of milestones) {
    if (raceResult.chip_time_seconds <= m.time_seconds) {
      awardedMilestone = m;
      break;
    }
  }

  if (!awardedMilestone) {
    serverDebug.debug(`[rewardService] User did not achieve any milestone`);
    return { awarded: false, reason: 'Did not meet any milestone threshold' };
  }

  // Check if member already has this milestone
  const milestoneId = awardedMilestone ? String(awardedMilestone.id) : null;
  const already = milestoneId ? await isMilestoneAlreadyAwarded(userId, milestoneId) : false;
  if (already) {
    serverDebug.debug('[rewardService] Milestone already awarded for this member');
    return { awarded: false, reason: 'Milestone already awarded' };
  }

  // Create transaction first if cash amount
  let relatedTxnId: string | null = null;
  const cashAmount = awardedMilestone ? Number(awardedMilestone.cash_amount ?? 0) : 0;
  if (cashAmount > 0) {
    const { data: txnIns, error: txnErr } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'reward_payout',
        amount: cashAmount,
        description: `Race milestone reward: ${String(awardedMilestone?.reward_description ?? '')} (${category})`,
        transaction_date: new Date().toISOString().slice(0, 10),
        payment_status: 'pending'
      })
      .select('id')
      .maybeSingle();

    if (txnErr) {
      serverDebug.error('[rewardService] Failed to create transaction:', txnErr);
    } else {
      relatedTxnId = txnIns?.id ?? null;
    }
  }
  const { error: insertErr } = await supabase
    .from('member_milestone_rewards')
    .insert({
      member_id: userId,
      race_id: raceResult.race_id,
      race_result_id: raceResult.id,
      milestone_id: milestoneId,
      achieved_time_seconds: raceResult.chip_time_seconds,
      reward_description: String(awardedMilestone?.reward_description ?? ''),
      cash_amount: cashAmount,
      status: 'pending',
      related_transaction_id: relatedTxnId,
    })
    .select('id')
    .maybeSingle();

  if (insertErr) {
    serverDebug.error('[rewardService] Failed to insert member_milestone_rewards:', insertErr);
    return { awarded: false, reason: 'Failed to record milestone' };
  }

  serverDebug.debug(`[rewardService] Milestone awarded: ${awardedMilestone.reward_description}`);

  return {
    awarded: true,
    rewardId: awardedMilestone.id,
    prize: awardedMilestone.reward_description,
    cashAmount: awardedMilestone.cash_amount,
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
  serverDebug.debug(
    `[rewardService] Checking podium reward for user ${userId}, rank_type=${rankType}`
  );

  const rank = rankType === "overall" ? raceResult.official_rank : raceResult.age_group_rank;

  // Only ranks 1-3 eligible
  if (!rank || rank < 1 || rank > 3) {
    serverDebug.debug(`[rewardService] Rank ${rank} not in podium (1-3)`);
    return { awarded: false, reason: "Rank not in top 3" };
  }

  // 2) Fetch podium config from reward_podium_config
  const { data: podiumConfigs, error: podiumErr } = await supabase
    .from('reward_podium_config')
    .select('id, reward_description, cash_amount')
    .eq('podium_type', rankType)
    .eq('rank', rank)
    .eq('is_active', true)
    .limit(1);

    if (podiumErr) {
    serverDebug.error('[rewardService] Failed to fetch podium config:', podiumErr);
    return { awarded: false, reason: 'Could not fetch podium config' };
  }

  if (!podiumConfigs || podiumConfigs.length === 0) {
    serverDebug.debug('[rewardService] No podium reward configured for this rank');
    return { awarded: false, reason: 'No reward configured for this rank' };
  }

  const podiumConfig = podiumConfigs[0];

  // Check existing podium award for same race result
  const alreadyPod = await isPodiumAlreadyAwarded(userId, podiumConfig.id, raceResult.id);
  if (alreadyPod) {
    serverDebug.debug('[rewardService] Podium reward already awarded for this race result');
    return { awarded: false, reason: 'Podium already awarded for this race' };
  }

  // Create transaction first if needed
  let relatedTxnId: string | null = null;
  if (podiumConfig.cash_amount && podiumConfig.cash_amount > 0) {
    const { data: txnIns, error: txnErr } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'reward_payout',
        amount: podiumConfig.cash_amount,
        description: `Podium reward: ${rankType} rank ${rank} - ${podiumConfig.reward_description}`,
        transaction_date: new Date().toISOString().slice(0, 10),
        payment_status: 'pending'
      })
      .select('id')
      .maybeSingle();

    if (txnErr) serverDebug.error('[rewardService] Failed to create transaction for podium:', txnErr);
    else relatedTxnId = txnIns?.id ?? null;
  }

  const { error: insertErr } = await supabase
    .from('member_podium_rewards')
    .insert({
      member_id: userId,
      race_id: raceResult.race_id,
      race_result_id: raceResult.id,
      podium_config_id: podiumConfig.id,
      podium_type: rankType,
      rank: rank,
      reward_description: podiumConfig.reward_description,
      cash_amount: podiumConfig.cash_amount,
      status: 'pending',
      related_transaction_id: relatedTxnId,
    })
    .select('id')
    .maybeSingle();
  if (insertErr) {
    serverDebug.error('[rewardService] Failed to insert member_podium_rewards:', insertErr);
    return { awarded: false, reason: 'Failed to record podium reward' };
  }

  serverDebug.debug('[rewardService] Podium reward awarded:', podiumConfig.reward_description);

  return {
    awarded: true,
    rewardId: podiumConfig.id,
    prize: podiumConfig.reward_description,
    cashAmount: podiumConfig.cash_amount,
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
  serverDebug.debug(`[rewardService] Checking challenge penalties for challenge ${challengeId}`);

  // 1) Get challenge
  const { error: chErr } = await supabase
    .from("challenges")
    .select("id, end_date")
    .eq("id", challengeId)
    .single();

  if (chErr) {
    serverDebug.error(`[rewardService] Failed to fetch challenge:`, chErr);
    return { processed: false, reason: "Could not fetch challenge" };
  }

  // 2) Get all active members
  const { data: allMembers, error: membErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_active", true);

  if (membErr) {
    serverDebug.error(`[rewardService] Failed to fetch members:`, membErr);
    return { processed: false, reason: "Could not fetch members" };
  }

  if (!allMembers || allMembers.length === 0) {
    serverDebug.debug(`[rewardService] No active members found`);
    return { processed: true, penaltiesApplied: 0 };
  }

  let penaltiesApplied = 0;

  for (const member of allMembers) {
    if (excludeUserIds.includes(member.id)) {
      serverDebug.debug(`[rewardService] Skipping penalty for ${member.id} (excused)`);
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
      serverDebug.debug(`[rewardService] Member ${member.id} penalty: ${reason}`);

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
      } else {
        serverDebug.error('[rewardService] Failed to create fine transaction for member', member.id, txnErr);
      }
    }
  }

  serverDebug.debug(`[rewardService] Challenge penalties processed: ${penaltiesApplied} fines applied`);

  return {
    processed: true,
    challengeId,
    penaltiesApplied,
  };
}

const rewardService = {
  checkRaceReward,
  checkPodiumReward,
  checkChallengePenalty,
};

export default rewardService;
