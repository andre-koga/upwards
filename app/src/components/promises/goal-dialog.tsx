/**
 * Manage an existing Goal — view progress, invite friends, extend, or cancel.
 */
import { useState, useEffect, useMemo } from "react";
import { Users, Target, Plus, Clock, Flame, CalendarCheck } from "lucide-react";

import { FormDialog, FormDialogActions } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { useGoals } from "@/lib/promises/use-goals";
import { computeGoalProgress, getGoalLinkedActivityId } from "@/lib/promises/use-goal-progress";
import { GoalTargetForm } from "@/components/promises/goal-target-form";
import { useFriends } from "@/lib/friends/use-friends";
import { useUserProfile } from "@/lib/use-user-profile";
import type { Activity, ActivityGroup, GoalMember, GoalTargetInput, GoalWithMembers } from "@/lib/db/types";
import { getGoalLinkedActivityName, memberDisplayLabel } from "@/lib/promises/goal-display";
import { enrichGoalMemberStatuses } from "@/lib/promises/goal-member-day-status";
import type { GoalMemberDayStatus } from "@/lib/promises/use-goal-member-status";
import { GoalMemberDayStatusIcon } from "@/components/promises/goal-member-status-icon";
import { getCachedUserId } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

interface GoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goalId: string | null;
  activities: Activity[];
  groups: ActivityGroup[];
  activityStreaks: Record<string, number>;
  memberStatuses: GoalMemberDayStatus[];
  taskCounts: Record<string, number>;
  pausedTaskIds: string[];
  isBreakDay: boolean;
  currentDate: Date;
  isToday: boolean;
  onChanged?: () => void;
}

type DialogView = "main" | "invite" | "extend" | "confirm-cancel";

function formatMemberLabel(
  member: GoalMember,
  currentUserId: string | null | undefined
): string {
  return memberDisplayLabel(
    member.display_name ?? member.username ?? null,
    member.user_id === currentUserId
  );
}

function formatTargetLabel(goal: GoalWithMembers): string {
  if (goal.target_kind === "streak_count" && goal.target_streak != null) {
    return `Reach a ${goal.target_streak}-day streak`;
  }
  if (goal.target_kind === "streak_until" && goal.target_end_date != null) {
    const d = new Date(goal.target_end_date + "T00:00:00");
    return `Keep streak until ${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  }
  return "No target set";
}

interface ActiveGoalSectionProps {
  goal: GoalWithMembers;
  currentUserId: string | null | undefined;
  activities: Activity[];
  activityStreaks: Record<string, number>;
  memberStatuses: GoalMemberDayStatus[];
  taskCounts: Record<string, number>;
  pausedTaskIds: string[];
  isBreakDay: boolean;
  currentDate: Date;
  isToday: boolean;
  onNavigate: (view: DialogView) => void;
  onEnd: (status: "completed" | "cancelled") => void;
  ending: boolean;
}

function ActiveGoalSection({
  goal,
  currentUserId,
  activities,
  activityStreaks,
  memberStatuses,
  taskCounts,
  pausedTaskIds,
  isBreakDay,
  currentDate,
  isToday,
  onNavigate,
  onEnd,
  ending,
}: ActiveGoalSectionProps) {
  const linkedActivityId = getGoalLinkedActivityId(goal, currentUserId);
  const currentStreak = linkedActivityId
    ? (activityStreaks[linkedActivityId] ?? 0)
    : 0;
  const { targetReached, periodEnded } = computeGoalProgress(
    goal,
    currentStreak,
    currentDate
  );
  const isDone = targetReached || periodEnded;

  const memberActivityIds = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const member of goal.members) {
      if (member.invite_status !== "accepted") continue;
      map.set(member.user_id, member.member_activity_id);
    }
    return map;
  }, [goal.members]);

  const enrichedByUserId = useMemo(() => {
    const enriched = enrichGoalMemberStatuses({
      goal,
      members: memberStatuses,
      activityStreaks,
      taskCounts,
      pausedTaskIds,
      isBreakDay,
      isEditableDate: isToday,
      viewDate: currentDate,
      activities,
      memberActivityIds,
    });
    return new Map(enriched.map((member) => [member.userId, member]));
  }, [
    goal,
    memberStatuses,
    activityStreaks,
    taskCounts,
    pausedTaskIds,
    isBreakDay,
    isToday,
    currentDate,
    activities,
    memberActivityIds,
  ]);

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
        <Target className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-medium">{formatTargetLabel(goal)}</span>
      </div>

      {isDone && (
        <div className="rounded-xl border border-green-500/30 bg-green-50/60 px-4 py-3 dark:bg-green-950/30">
          <div className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-400">
            <CalendarCheck className="h-4 w-4 shrink-0" />
            {targetReached ? "Target reached!" : "Period ended!"}
          </div>
          <p className="mt-1 text-xs text-green-700/80 dark:text-green-400/70">
            {targetReached
              ? "You hit your streak goal. Mark it complete or extend the challenge."
              : "The goal period is over. Mark it complete or push the date further out."}
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" className="flex-1" onClick={() => onEnd("completed")} disabled={ending}>
              Mark complete
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => onNavigate("extend")}
              disabled={ending}
            >
              Extend
            </Button>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {goal.members.map((member) => {
          const enriched = enrichedByUserId.get(member.user_id);

          if (member.invite_status === "pending") {
            return (
              <li
                key={member.id}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm odd:bg-muted/30"
              >
                <span className="font-medium">
                  {formatMemberLabel(member, currentUserId)}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Invited
                </span>
              </li>
            );
          }

          if (!enriched) return null;

          const showProgress =
            enriched.hasLinkedHabit && enriched.progressPercent != null;

          return (
            <li
              key={member.id}
              className="space-y-1.5 rounded-lg px-3 py-2 odd:bg-muted/30"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {formatMemberLabel(member, currentUserId)}
                </span>
                <GoalMemberDayStatusIcon status={enriched.dayStatus} />
              </div>
              {showProgress && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Flame className="h-3 w-3" />
                      {enriched.currentStreak}d
                    </span>
                    <span>{enriched.progressPercent}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-300"
                      style={{ width: `${enriched.progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => onNavigate("invite")}
      >
        <Plus className="h-4 w-4 mr-1" />
        Invite a friend (optional)
      </Button>

      {!isDone && (
        <div className="pt-2">
          <Button
            type="button"
            variant="destructive"
            className="w-full"
            disabled={ending}
            onClick={() => onNavigate("confirm-cancel")}
          >
            Cancel Goal
          </Button>
        </div>
      )}
    </div>
  );
}

export function GoalDialog({
  open,
  onOpenChange,
  goalId,
  activities,
  groups,
  activityStreaks,
  memberStatuses,
  taskCounts,
  pausedTaskIds,
  isBreakDay,
  currentDate,
  isToday,
  onChanged,
}: GoalDialogProps) {
  const navigate = useNavigate();
  const currentUserId = getCachedUserId();
  const { goals, loading, updateGoalTarget, inviteFriend, endGoal, isSignedIn } = useGoals();
  const { friends } = useFriends();
  const { username, loading: profileLoading } = useUserProfile();
  const [inviting, setInviting] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [view, setView] = useState<DialogView>("main");

  useEffect(() => {
    if (!open) setView("main");
  }, [open]);

  const goal = goalId ? goals.find((g) => g.id === goalId) : undefined;
  const activityName = goal
    ? getGoalLinkedActivityName(goal, currentUserId, activities, groups)
    : "Goal";

  const invitableFriends = friends.filter((f) => {
    if (!goal) return false;
    const otherId = f.profile?.userId;
    if (!otherId) return false;
    return !goal.members.some((m) => m.user_id === otherId);
  });

  const handleExtend = async (target: GoalTargetInput) => {
    if (!goal) return;
    await updateGoalTarget(goal.id, target);
    setView("main");
    onChanged?.();
  };

  const handleInvite = async (friendUserId: string) => {
    if (!goal) return;
    setInviting(friendUserId);
    try {
      await inviteFriend({ goalId: goal.id, friendUserId });
      setView("main");
      onChanged?.();
    } finally {
      setInviting(null);
    }
  };

  const handleEnd = async (status: "completed" | "cancelled") => {
    if (!goal) return;
    setEnding(true);
    try {
      await endGoal(goal.id, status);
      onOpenChange(false);
      onChanged?.();
    } finally {
      setEnding(false);
    }
  };

  const titleMap: Record<DialogView, string> = {
    main: activityName,
    invite: `Add a friend — ${activityName}`,
    extend: `Extend your Goal — ${activityName}`,
    "confirm-cancel": "Cancel Goal?",
  };

  const descriptionMap: Record<DialogView, string> = {
    main: "Your Goal for this habit.",
    invite: "Optional — invite a friend for extra accountability.",
    extend: "Raise the bar — pick a higher target.",
    "confirm-cancel": "This will end your current goal. Your streak is not affected.",
  };

  return (
    <FormDialog
      open={open && goalId !== null}
      onOpenChange={onOpenChange}
      title={titleMap[view]}
      description={descriptionMap[view]}
    >
      {view === "confirm-cancel" && (
        <FormDialogActions
          onConfirm={() => void handleEnd("cancelled")}
          confirmLabel={ending ? "Cancelling…" : "Cancel Goal"}
          confirmDisabled={ending}
          confirmClassName="bg-destructive text-destructive-foreground shadow-md hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_88%,black)] dark:hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_88%,white)] focus-visible:ring-destructive"
          secondaryAction={{
            label: "Keep Goal",
            onClick: () => setView("main"),
            disabled: ending,
          }}
        />
      )}

      {view === "extend" && goal?.target_kind && (
        <GoalTargetForm
          lockedKind={goal.target_kind}
          initial={
            goal.target_kind === "streak_count" && goal.target_streak != null
              ? { kind: "streak_count", streak: goal.target_streak }
              : goal.target_kind === "streak_until" && goal.target_end_date != null
                ? { kind: "streak_until", endDate: goal.target_end_date }
                : undefined
          }
          minStreak={
            goal.target_kind === "streak_count" && goal.target_streak != null
              ? goal.target_streak + 1
              : undefined
          }
          minEndDate={
            goal.target_kind === "streak_until" && goal.target_end_date != null
              ? (() => {
                  const d = new Date(goal.target_end_date + "T00:00:00");
                  d.setDate(d.getDate() + 1);
                  return d.toISOString().slice(0, 10);
                })()
              : undefined
          }
          submitLabel="Extend Goal"
          onSubmit={handleExtend}
          onCancel={() => setView("main")}
        />
      )}

      {view === "invite" && (
        <div className="space-y-3">
          {!profileLoading && !username && (
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              Set a{" "}
              <button
                type="button"
                className="underline"
                onClick={() => { onOpenChange(false); navigate("/settings"); }}
              >
                username in Settings
              </button>{" "}
              before you can invite friends.
            </div>
          )}
          {invitableFriends.length === 0 ? (
            <div className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
              <Users className="mx-auto mb-2 h-6 w-6 opacity-40" />
              <p>No friends to invite</p>
              <button
                type="button"
                className="mt-1 text-xs underline"
                onClick={() => { onOpenChange(false); navigate("/friends"); }}
              >
                Add friends first
              </button>
            </div>
          ) : (
            <ul className="space-y-2">
              {invitableFriends.map((f) => {
                const uid = f.profile?.userId ?? (f.user_a === "" ? f.user_b : f.user_a);
                const label = f.profile?.displayName ?? f.profile?.username
                  ? `${f.profile.displayName ?? ""} (@${f.profile.username ?? ""})`
                  : "Unknown";
                return (
                  <li key={uid} className="flex items-center justify-between rounded-lg border p-3">
                    <span className="text-sm font-medium">{label}</span>
                    <Button
                      size="sm"
                      disabled={inviting === uid}
                      onClick={() => void handleInvite(uid)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Invite
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          <FormDialogActions
            onConfirm={() => setView("main")}
            confirmLabel="Back"
          />
        </div>
      )}

      {view === "main" && (
        <>
          {!isSignedIn ? (
            <div className="space-y-3 py-2 text-sm text-muted-foreground">
              <p>Sign in to view Goals.</p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { onOpenChange(false); navigate("/settings"); }}
              >
                Go to Settings
              </Button>
            </div>
          ) : loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : !goal ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Goal not found.</p>
          ) : (
            <ActiveGoalSection
              goal={goal}
              currentUserId={currentUserId}
              activities={activities}
              activityStreaks={activityStreaks}
              memberStatuses={memberStatuses}
              taskCounts={taskCounts}
              pausedTaskIds={pausedTaskIds}
              isBreakDay={isBreakDay}
              currentDate={currentDate}
              isToday={isToday}
              onNavigate={setView}
              onEnd={handleEnd}
              ending={ending}
            />
          )}
        </>
      )}
    </FormDialog>
  );
}
