import type { ComponentProps, ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type DialogContentPointerDownOutside = ComponentProps<
  typeof DialogContent
>["onPointerDownOutside"];

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  size?: "default" | "sm";
  contentClassName?: string;
  headerClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  /** Fires when the user presses outside dialog content (e.g. overlay); use to absorb click-through after close. */
  onContentPointerDownOutside?: DialogContentPointerDownOutside;
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = "sm",
  contentClassName,
  headerClassName,
  titleClassName,
  descriptionClassName,
  onContentPointerDownOutside,
}: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size={size}
        className={cn("p-4", contentClassName)}
        onPointerDownOutside={onContentPointerDownOutside}
      >
        <DialogHeader className={headerClassName}>
          <DialogTitle className={titleClassName}>{title}</DialogTitle>
          {description ? (
            <DialogDescription className={descriptionClassName}>
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
