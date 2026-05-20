/**
 * Single entry point for all Goal interactions tied to a specific activity.
 *
 * Views:
 *  "main"      – dispatcher: no-goal state, or active-goal summary
 *  "configure" – target-form for a brand-new goal (before creating the DB row)
 *  "invite"    – friend picker
 *  "extend"    – target-form to raise an existing goal's target
 */
import { useState, useEffect } from "react";
import { Users, Target, Plus, CheckCircle2, XCircle, Clock, Flame, CalendarCheck } from "lucide-react";

import { FormDialog } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { useGoals } from "@/lib/promises/use-goals";
import { useGoalProgress } from "@/lib/promises/use-goal-progress";
import { GoalTargetForm } from "@/components/promises/goal-target-form";
import { useFriends } from "@/lib/friends/use-friends";
import { useUserProfile } from "@/lib/use-user-profile";
import type { Activity, ActivityGroup, GoalMember, GoalTargetInput, GoalWithMembers } from "@/lib/db/types";
import { getActivityDisplayName } from "@/lib/activity";
import { useNavigate } from "react-router-dom";

interface ActivityPromiseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: Activity | null;
  group?: ActivityGroup;
}

type DialogView = "main" | "configure" | "invite" | "extend" | "confirm-cancel";

function memberStatusLabel(m: GoalMember) {
  if (m.invite_status === "pending") return "Invited";
  if (m.invite_status === "declined") return "Declined";
  if (!m.member_activity_id) return "Witness";
  return "Active";
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

// ── Inner component so hooks can see the resolved goal ──────────────────────

interface ActiveGoalSectionProps {
  goal: GoalWithMembers;
  activityId: string;
  onNavigate: (view: DialogView) => void;
  onEnd: (status: "completed" | "cancelled") => void;
  ending: boolean;
}

function ActiveGoalSection({ goal, activityId, onNavigate, onEnd, ending }: ActiveGoalSectionProps) {
  const { currentStreak, targetReached, periodEnded, progressPercent } = useGoalProgress(goal);
  const isDone = targetReached || periodEnded;

  return (
    <div className="space-y-4 py-2">
      {/* Target line */}
      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
        <Target className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-medium">{formatTargetLabel(goal)}</span>
      </div>

      {/* Progress */}
      {progressPercent != null && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Flame className="h-3.5 w-3.5" />
              Current streak: <strong className="text-foreground">&nbsp;{currentStreak} {currentStreak === 1 ? "day" : "days"}</strong>
            </span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Target-reached / period-ended banner */}
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

      {/* Members */}
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          People on this Goal
        </p>
        <ul className="space-y-1">
          {goal.members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm odd:bg-muted/30"
            >
              <span className="font-medium">
                {m.member_activity_id === activityId ? "You" : "Member"}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {m.invite_status === "pending" && <Clock className="h-3 w-3" />}
                {m.invite_status === "accepted" && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                {m.invite_status === "declined" && <XCircle className="h-3 w-3 text-destructive" />}
                {memberStatusLabel(m)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => onNavigate("invite")}
      >
        <Plus className="h-4 w-4 mr-1" />
        Invite a friend (optional)
      </Button>

      {/* Cancel goal — only shown while goal is still in progress */}
      {!isDone && (
        <div className="pt-2">
          <Button
            type="button"
            variant="ghost"
            className="w-full text-destructive hover:text-destructive"
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

// ── Main dialog ──────────────────────────────────────────────────────────────

export function ActivityPromiseDialog({
  open,
  onOpenChange,
  activity,
  group,
}: ActivityPromiseDialogProps) {
  const navigate = useNavigate();
  const { goals, loading, createGoal, updateGoalTarget, inviteFriend, endGoal, isSignedIn } = useGoals();
  const { friends } = useFriends();
  const { username, loading: profileLoading } = useUserProfile();
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [view, setView] = useState<DialogView>("main");

  useEffect(() => {
    if (!open) setView("main");
  }, [open]);

  const activityName = activity ? getActivityDisplayName(activity, group) : "Activity";

  const activeGoal: GoalWithMembers | undefined = activity
    ? goals.find(
        (g) =>
          g.status === "active" &&
          g.members.some(
            (m) => m.member_activity_id === activity.id && m.invite_status === "accepted"
          )
      )
    : undefined;

  const invitableFriends = friends.filter((f) => {
    if (!activeGoal) return false;
    const otherId = f.profile?.userId;
    if (!otherId) return false;
    return !activeGoal.members.some((m) => m.user_id === otherId);
  });

  const handleCreate = async (target: GoalTargetInput) => {
    if (!activity) return;
    setCreating(true);
    try {
      await createGoal(activity.id, target);
      setView("main");
    } finally {
      setCreating(false);
    }
  };

  const handleExtend = async (target: GoalTargetInput) => {
    if (!activeGoal) return;
    await updateGoalTarget(activeGoal.id, target);
    setView("main");
  };

  const handleInvite = async (friendUserId: string) => {
    if (!activeGoal) return;
    setInviting(friendUserId);
    try {
      await inviteFriend({ goalId: activeGoal.id, friendUserId });
      setView("main");
    } finally {
      setInviting(null);
    }
  };

  const handleEnd = async (status: "completed" | "cancelled") => {
    if (!activeGoal) return;
    setEnding(true);
    try {
      await endGoal(activeGoal.id, status);
    } finally {
      setEnding(false);
    }
  };

  const titleMap: Record<DialogView, string> = {
    main: activityName,
    configure: `Set your Goal — ${activityName}`,
    invite: `Add a friend — ${activityName}`,
    extend: `Extend your Goal — ${activityName}`,
    "confirm-cancel": "Cancel Goal?",
  };

  const descriptionMap: Record<DialogView, string> = {
    main: activeGoal ? "Your Goal for this habit." : "Commit to this habit with a personal Goal.",
    configure: "Choose a streak target to aim for.",
    invite: "Optional — invite a friend for extra accountability.",
    extend: "Raise the bar — pick a higher target.",
    "confirm-cancel": "This will end your current goal. Your streak is not affected.",
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={titleMap[view]}
      description={descriptionMap[view]}
    >
      {/* ── Confirm cancel ── */}
      {view === "confirm-cancel" && (
        <div className="space-y-4">
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={ending}
              onClick={() => setView("main")}
            >
              Keep Goal
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="flex-1"
              disabled={ending}
              onClick={() => void handleEnd("cancelled")}
            >
              {ending ? "Cancelling…" : "Cancel Goal"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Configure (new goal) ── */}
      {view === "configure" && (
        <GoalTargetForm
          submitLabel="Start Goal"
          onSubmit={handleCreate}
          onCancel={() => setView("main")}
        />
      )}

      {/* ── Extend ── */}
      {view === "extend" && activeGoal?.target_kind && (
        <GoalTargetForm
          lockedKind={activeGoal.target_kind}
          initial={
            activeGoal.target_kind === "streak_count" && activeGoal.target_streak != null
              ? { kind: "streak_count", streak: activeGoal.target_streak }
              : activeGoal.target_kind === "streak_until" && activeGoal.target_end_date != null
                ? { kind: "streak_until", endDate: activeGoal.target_end_date }
                : undefined
          }
          minStreak={
            activeGoal.target_kind === "streak_count" && activeGoal.target_streak != null
              ? activeGoal.target_streak + 1
              : undefined
          }
          minEndDate={
            activeGoal.target_kind === "streak_until" && activeGoal.target_end_date != null
              ? (() => {
                  const d = new Date(activeGoal.target_end_date + "T00:00:00");
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

      {/* ── Invite friend ── */}
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
          <Button type="button" variant="outline" className="w-full" onClick={() => setView("main")}>
            Back
          </Button>
        </div>
      )}

      {/* ── Main view ── */}
      {view === "main" && (
        <>
          {!isSignedIn ? (
            <div className="space-y-3 py-2 text-sm text-muted-foreground">
              <p>Sign in to set a Goal for this habit.</p>
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
          ) : !activeGoal ? (
            /* No goal */
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-dashed py-8 text-center">
                <Target className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium">No Goal yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Set a streak target to stay accountable.
                </p>
                <Button
                  className="mt-4"
                  disabled={creating}
                  onClick={() => setView("configure")}
                >
                  Start a Goal
                </Button>
              </div>
            </div>
          ) : (
            /* Active goal */
            <ActiveGoalSection
              goal={activeGoal}
              activityId={activity?.id ?? ""}
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
