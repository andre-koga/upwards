import { useState } from "react";
import { Lock, Share2 } from "lucide-react";
import { db, now } from "@/lib/db";
import type { Activity } from "@/lib/db/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ShareCompletionsToggleProps {
  activity: Activity;
  className?: string;
  onUpdated?: (activity: Activity) => void;
}

export function ShareCompletionsToggle({
  activity,
  className,
  onUpdated,
}: ShareCompletionsToggleProps) {
  const [busy, setBusy] = useState(false);
  const shared = activity.share_completions_with_friends ?? false;

  const setShared = async (next: boolean) => {
    if (busy || next === shared) return;
    setBusy(true);
    try {
      const ts = now();
      await db.activities.update(activity.id, {
        share_completions_with_friends: next,
        updated_at: ts,
      });
      const updated: Activity = {
        ...activity,
        share_completions_with_friends: next,
        updated_at: ts,
      };
      onUpdated?.(updated);
    } catch (error) {
      console.error("Failed to update share setting:", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <Button
        type="button"
        variant={shared ? "default" : "outline"}
        size="sm"
        disabled={busy}
        className="gap-2 rounded-full px-4"
        onClick={() => void setShared(!shared)}
        aria-pressed={shared}
      >
        {shared ? (
          <>
            <Share2 className="h-4 w-4 shrink-0" aria-hidden />
            Sharing
          </>
        ) : (
          <>
            <Lock className="h-4 w-4 shrink-0" aria-hidden />
            Private
          </>
        )}
      </Button>
      <p className="max-w-sm text-center text-xs text-muted-foreground">
        {shared
          ? "Friends see your streak upon completion."
          : "Only you see this habit’s streak and milestones."}
      </p>
    </div>
  );
}
