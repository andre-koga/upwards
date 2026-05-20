import { HandshakeIcon, Users } from "lucide-react";
import type { PromiseWithMembers } from "@/lib/promises/use-promises";
import { cn } from "@/lib/utils";

interface PromiseCardProps {
  promise: PromiseWithMembers;
  onClick: () => void;
  muted?: boolean;
}

export function PromiseCard({ promise, onClick, muted }: PromiseCardProps) {
  const accepted = promise.members.filter(
    (m) => m.invite_status === "accepted"
  );
  const pending = promise.members.filter(
    (m) => m.invite_status === "pending"
  );

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted/50",
        muted && "opacity-60"
      )}
    >
      <div className="flex items-start gap-3">
        <HandshakeIcon
          className={cn(
            "mt-0.5 h-5 w-5 shrink-0",
            muted ? "text-muted-foreground" : "text-primary"
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium leading-snug">{promise.title}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="capitalize">
              {promise.mode === "mutual" ? "Mutual" : "Witness"}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {accepted.length} member{accepted.length !== 1 ? "s" : ""}
              {pending.length > 0 && (
                <span className="ml-1 text-amber-600 dark:text-amber-400">
                  ({pending.length} pending)
                </span>
              )}
            </span>
            {promise.status !== "active" && (
              <>
                <span>·</span>
                <span className="capitalize">{promise.status}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
