import { useParams, useNavigate } from "react-router-dom";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { Button } from "@/components/ui/button";
import { usePromiseDetail } from "@/lib/promises/use-promise-detail";
import { useAuth } from "@/lib/use-auth";
import { getCachedUserId } from "@/lib/supabase";
import { ProgressEventRow } from "@/components/promises/progress-event-row";
import { MemberRow } from "@/components/promises/member-row";
import { ReactionDialog } from "@/components/promises/reaction-dialog";
import { usePromises } from "@/lib/promises/use-promises";
import { HandshakeIcon, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import type { PromiseMember, ReactionKind } from "@/lib/db/types";

export default function PromiseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthed } = useAuth();
  const userId = getCachedUserId();
  const { detail, loading, error, sendReaction } = usePromiseDetail(
    id ?? null
  );
  const { endPromise } = usePromises();
  const [reactionTarget, setReactionTarget] = useState<PromiseMember | null>(
    null
  );
  const [reactionEventId, setReactionEventId] = useState<string | undefined>();

  if (!isAuthed) {
    return (
      <div className="p-4 pb-24">
        <p className="text-sm text-muted-foreground">
          Sign in to view this promise.
        </p>
        <FloatingBackButton to="/promises" title="Promises" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 pb-24">
        <p className="py-12 text-center text-sm text-muted-foreground">
          Loading…
        </p>
        <FloatingBackButton to="/promises" title="Promises" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="p-4 pb-24">
        <p className="text-sm text-destructive">{error ?? "Promise not found."}</p>
        <FloatingBackButton to="/promises" title="Promises" />
      </div>
    );
  }

  const { promise, members, events } = detail;
  const myMembership = members.find((m) => m.user_id === userId);
  const isOwner = myMembership?.role === "owner";

  const handleReact = async (kind: ReactionKind) => {
    if (!reactionTarget) return;
    await sendReaction(reactionTarget.user_id, kind, reactionEventId);
    setReactionTarget(null);
    setReactionEventId(undefined);
  };

  const statusBadge = {
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    cancelled: "bg-muted text-muted-foreground",
  }[promise.status];

  return (
    <div className="space-y-4 p-4 pb-24">
      <header className="space-y-2">
        <div className="flex items-start gap-3">
          <HandshakeIcon className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold tracking-tight leading-tight">
              {promise.title}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge}`}
              >
                {promise.status}
              </span>
              <span className="text-xs text-muted-foreground capitalize">
                {promise.mode === "mutual" ? "Mutual commitment" : "You're the witness"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Members */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Members</h2>
        <div className="space-y-1 rounded-xl border border-border overflow-hidden">
          {members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              isMe={m.user_id === userId}
              onReact={
                m.user_id !== userId && promise.status === "active"
                  ? () => {
                      setReactionTarget(m);
                      setReactionEventId(undefined);
                    }
                  : undefined
              }
            />
          ))}
        </div>
      </section>

      {/* Recent progress */}
      {events.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Recent progress
          </h2>
          <div className="space-y-1 rounded-xl border border-border overflow-hidden">
            {events.slice(0, 20).map((ev) => {
              const member = members.find((m) => m.user_id === ev.user_id);
              return (
                <ProgressEventRow
                  key={ev.id}
                  event={ev}
                  displayName={member?.display_name ?? null}
                  isMe={ev.user_id === userId}
                  onReact={
                    ev.user_id !== userId && promise.status === "active"
                      ? () => {
                          const m = members.find(
                            (mem) => mem.user_id === ev.user_id
                          );
                          if (m) {
                            setReactionTarget(m);
                            setReactionEventId(ev.id);
                          }
                        }
                      : undefined
                  }
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Owner actions */}
      {isOwner && promise.status === "active" && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Manage promise
          </h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-2 text-sm"
              onClick={async () => {
                await endPromise(promise.id, "completed");
                navigate("/promises");
              }}
            >
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Mark fulfilled
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2 text-sm text-destructive"
              onClick={async () => {
                await endPromise(promise.id, "cancelled");
                navigate("/promises");
              }}
            >
              <XCircle className="h-4 w-4" />
              Cancel
            </Button>
          </div>
        </section>
      )}

      <ReactionDialog
        open={Boolean(reactionTarget)}
        memberName={reactionTarget?.display_name ?? "them"}
        onOpenChange={(v) => {
          if (!v) {
            setReactionTarget(null);
            setReactionEventId(undefined);
          }
        }}
        onReact={handleReact}
      />

      <FloatingBackButton to="/promises" title="Promises" />
    </div>
  );
}
