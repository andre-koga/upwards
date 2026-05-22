import type { Goal, GoalShare, GoalWithShares } from "@/lib/db/types";

/** Map Supabase promises row (legacy column names may still exist in older envs). */
export function mapGoalRow(row: Record<string, unknown>): Goal {
  return {
    id: row.id as string,
    user_id: (row.user_id ?? row.creator_id) as string,
    name: (row.name ?? row.title ?? "Goal") as string,
    description: (row.description ?? row.objective ?? "") as string,
    activity_id: (row.activity_id ?? row.creator_activity_id) as string,
    activity_name: (row.activity_name ?? row.creator_activity_name ?? null) as
      | string
      | null,
    status: row.status as Goal["status"],
    target_kind: (row.target_kind as Goal["target_kind"]) ?? null,
    target_streak: (row.target_streak as number | null) ?? null,
    target_end_date: (row.target_end_date as string | null) ?? null,
    created_at: row.created_at as string,
    completed_at: (row.completed_at as string | null) ?? null,
  };
}

export function mapShareRow(row: Record<string, unknown>): GoalShare {
  return {
    id: row.id as string,
    goal_id: row.goal_id as string,
    owner_user_id: row.owner_user_id as string,
    viewer_user_id: row.viewer_user_id as string,
    status: row.status as GoalShare["status"],
    created_at: row.created_at as string,
    responded_at: (row.responded_at as string | null) ?? null,
    username: (row.username as string | null | undefined) ?? null,
    display_name: (row.display_name as string | null | undefined) ?? null,
  };
}

export function attachShares(goal: Goal, shares: GoalShare[]): GoalWithShares {
  return { ...goal, shares };
}
