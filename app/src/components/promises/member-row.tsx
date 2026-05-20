import { Heart, UserCircle2 } from "lucide-react";
import type { PromiseMember } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MemberRowProps {
  member: PromiseMember;
  isMe: boolean;
  onReact?: () => void;
}

export function MemberRow({ member, isMe, onReact }: MemberRowProps) {
  const name = member.display_name ?? (isMe ? "You" : "Member");
  const roleBadge = {
    owner: "Owner",
    member: "Member",
    witness: "Witness",
  }[member.role];

  const statusColor =
    member.invite_status === "accepted"
      ? "text-green-600 dark:text-green-400"
      : member.invite_status === "pending"
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground";

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <UserCircle2 className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <span className={cn("text-sm font-medium", isMe && "text-primary")}>
          {name}
        </span>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{roleBadge}</span>
          <span>·</span>
          <span className={statusColor}>
            {member.invite_status === "accepted"
              ? "Active"
              : member.invite_status === "pending"
                ? "Invite pending"
                : "Declined"}
          </span>
        </div>
      </div>
      {onReact && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-full"
          onClick={onReact}
          title="Send reaction"
          aria-label="Send reaction"
        >
          <Heart className="h-4 w-4 text-muted-foreground" />
        </Button>
      )}
    </div>
  );
}
