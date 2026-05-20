import { CheckCircle2, Flame, Heart } from "lucide-react";
import type { PromiseProgressEvent } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

interface ProgressEventRowProps {
  event: PromiseProgressEvent;
  displayName: string | null;
  isMe: boolean;
  onReact?: () => void;
}

export function ProgressEventRow({
  event,
  displayName,
  isMe,
  onReact,
}: ProgressEventRowProps) {
  const name = displayName ?? (isMe ? "You" : "Partner");
  const isMilestone = event.kind === "streak_milestone";

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      {isMilestone ? (
        <Flame className="h-4 w-4 shrink-0 text-orange-500" />
      ) : (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          <span className="font-medium">{isMe ? "You" : name}</span>{" "}
          {isMilestone
            ? `hit a ${event.payload.streak}-day streak`
            : "completed today"}
          {event.payload.activityName ? (
            <span className="text-muted-foreground">
              {" "}
              — {event.payload.activityName}
            </span>
          ) : null}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
        </p>
      </div>
      {onReact && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-full"
          onClick={onReact}
          title="React to this"
          aria-label="React to this"
        >
          <Heart className="h-4 w-4 text-muted-foreground" />
        </Button>
      )}
    </div>
  );
}
