import { useState } from "react";
import { ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InboxNotification } from "@/lib/notifications/use-notifications";
import { FriendRecapDialog } from "@/components/notifications/friend-recap-dialog";

export function DailySummaryDetails({ n }: { n: InboxNotification }) {
  const [open, setOpen] = useState(false);
  if (n.kind !== "daily_summary") return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-1 h-7 gap-1.5 rounded-full px-3 text-xs"
        onClick={() => setOpen(true)}
      >
        <ScrollText className="h-3 w-3" />
        View recap
      </Button>
      <FriendRecapDialog open={open} onOpenChange={setOpen} n={n} />
    </>
  );
}
