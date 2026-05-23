import { useState } from "react";
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
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5",
        className
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">Share with friends</p>
        <p className="text-xs text-muted-foreground">
          When you complete this habit, friends see your streak and milestone
          progress.
        </p>
      </div>
      <Button
        type="button"
        variant={shared ? "default" : "outline"}
        size="sm"
        disabled={busy}
        className="shrink-0 rounded-full px-3"
        onClick={() => void setShared(!shared)}
        aria-pressed={shared}
      >
        {shared ? "On" : "Off"}
      </Button>
    </div>
  );
}
