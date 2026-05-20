import { FormDialog } from "@/components/forms";
import { Button } from "@/components/ui/button";
import type { ReactionKind } from "@/lib/db/types";

interface ReactionDialogProps {
  open: boolean;
  memberName: string;
  onOpenChange: (open: boolean) => void;
  onReact: (kind: ReactionKind) => void;
}

export function ReactionDialog({
  open,
  memberName,
  onOpenChange,
  onReact,
}: ReactionDialogProps) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Send a reaction"
      description={`A private message to ${memberName}. Only they will see it — no public count.`}
      contentClassName="sm:max-w-sm"
    >
      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <Button
            className="flex-1 gap-2 text-base"
            variant="outline"
            onClick={() => {
              onReact("motivate");
              onOpenChange(false);
            }}
          >
            💪 Motivate
          </Button>
          <Button
            className="flex-1 gap-2 text-base"
            variant="outline"
            onClick={() => {
              onReact("congratulate");
              onOpenChange(false);
            }}
          >
            🎉 Congrats
          </Button>
        </div>
        <Button
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
      </div>
    </FormDialog>
  );
}
