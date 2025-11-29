import { supabase } from "@/lib/supabase-client";

/**
 * Check milestone rewards and award if appropriate.
 * - `raceResult` should include: { id?: string, chip_time_seconds: number, distance?: string }
 * - Determines category from `distance` (21km -> 'HM', 42km -> 'FM').
 * - Finds milestone reward_definitions for that category.
 * - If user has already received an equal-or-better milestone (condition_value <= candidate), skip.
 * - Otherwise insert a new member_rewards record linking to the reward_definition and race_result.
 */
export async function checkAndAwardMilestone(
  userId: string,
  raceResult: { id?: string; chip_time_seconds: number; distance?: string }
) {
  if (!userId) throw new Error("userId is required");
  if (!raceResult || typeof raceResult.chip_time_seconds !== "number")
    throw new Error("raceResult.chip_time_seconds is required");

  // derive category
  const dist = (raceResult.distance || "").toLowerCase();
  let category: string | null = null;
  if (dist.includes("21") || dist.includes("half") || dist.includes("hm")) category = "HM";
  if (dist.includes("42") || dist.includes("full") || dist.includes("fm")) category = "FM";
  if (!category) {
    // try by numeric distance if provided (e.g., '21km')
    if (dist.match(/21/)) category = "HM";
    if (dist.match(/42/)) category = "FM";
  }

  if (!category) throw new Error("Unable to determine race category (HM/FM) from distance");

  // 1) load milestone reward definitions for category, ordered best (lowest condition_value) first
  const { data: defs, error: defsError } = await supabase
    .from("reward_definitions")
    .select("id, condition_value, condition_label, cash_amount")
    .eq("category", category)
    .eq("type", "milestone")
    .order("condition_value", { ascending: true });

  if (defsError) throw new Error(`Failed to load reward definitions: ${defsError.message}`);
  if (!Array.isArray(defs) || defs.length === 0) return { awarded: false, reason: "no-milestones" };

  // 2) find the best milestone the user achieved (smallest condition_value where chip_time <= condition_value)
  const time = raceResult.chip_time_seconds;
  const qualified = defs.filter((d: any) => time <= Number(d.condition_value));
  if (qualified.length === 0) return { awarded: false, reason: "no-qualify" };

  // pick the best (smallest condition_value)
  const candidate = qualified[0];

  // 3) check member_rewards for any equal-or-better previous milestone in same category
  // that means any reward_definition with condition_value <= candidate.condition_value
  const { data: existingRewards, error: existingError } = await supabase
    .from("member_rewards")
    .select(`id, reward_definition_id, awarded_date`)
    .eq("user_id", userId)
    .in(
      "reward_definition_id",
      defs.filter((d: any) => Number(d.condition_value) <= Number(candidate.condition_value)).map((d: any) => d.id)
    );

  if (existingError) throw new Error(`Failed to query member rewards: ${existingError.message}`);

  if (Array.isArray(existingRewards) && existingRewards.length > 0) {
    // user has an equal-or-better milestone already
    return { awarded: false, reason: "already-awarded-equal-or-better" };
  }

  // 4) award: insert into member_rewards
  const insertPayload: any = {
    user_id: userId,
    reward_definition_id: candidate.id,
    awarded_date: new Date().toISOString().slice(0, 10),
    status: "pending",
    created_at: new Date().toISOString(),
  };

  if (raceResult.id) insertPayload.race_result_id = raceResult.id;

  const { error: insertError, data: insertData } = await supabase.from("member_rewards").insert(insertPayload).select().single();
  if (insertError) throw new Error(`Failed to insert member reward: ${insertError.message}`);

  return { awarded: true, reward: insertData };
}

/**
 * Check podium reward and record it.
 * - `category` should be 'HM' or 'FM'.
 * - `rank` is the user's overall rank (1,2,3...).
 * - This function allows multiple awards (one per race), optionally link to a `raceResultId` to avoid duplicates per race.
 */
export async function checkPodiumReward(
  userId: string,
  rank: number,
  category: string,
  raceResultId?: string
) {
  if (!userId) throw new Error("userId is required");
  if (!rank || !category) throw new Error("rank and category are required");

  // find matching podium reward definition (podium_overall)
  const { data: defs, error: defsError } = await supabase
    .from("reward_definitions")
    .select("id, condition_value, condition_label, cash_amount, type")
    .eq("category", category)
    .eq("type", "podium_overall")
    .eq("condition_value", rank)
    .limit(1);

  if (defsError) throw new Error(`Failed to load podium definitions: ${defsError.message}`);
  if (!Array.isArray(defs) || defs.length === 0) return { awarded: false, reason: "no-definition" };

  const def = defs[0];

  // If raceResultId provided, avoid duplicate award for same race/result
  if (raceResultId) {
    const { data: existing, error: existingError } = await supabase
      .from("member_rewards")
      .select("id")
      .eq("user_id", userId)
      .eq("reward_definition_id", def.id)
      .eq("race_result_id", raceResultId)
      .limit(1)
      .maybeSingle();

    if (existingError) throw new Error(`Failed to check existing podium rewards: ${existingError.message}`);
    if (existing) return { awarded: false, reason: "already-awarded-for-this-race" };
  }

  const insertPayload: any = {
    user_id: userId,
    reward_definition_id: def.id,
    awarded_date: new Date().toISOString().slice(0, 10),
    status: "pending",
    created_at: new Date().toISOString(),
  };
  if (raceResultId) insertPayload.race_result_id = raceResultId;

  const { data: inserted, error: insertError } = await supabase.from("member_rewards").insert(insertPayload).select().single();
  if (insertError) throw new Error(`Failed to insert podium reward: ${insertError.message}`);

  return { awarded: true, reward: inserted };
}

export default {
  checkAndAwardMilestone,
  checkPodiumReward,
};
