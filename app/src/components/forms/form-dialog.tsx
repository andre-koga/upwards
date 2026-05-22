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
  /** Renders at the top right of the dialog header (e.g. icon-only actions). */
  headerEnd?: ReactNode;
  children: ReactNode;
  size?: "default" | "sm";
  contentClassName?: string;
  overlayClassName?: string;
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
  headerEnd,
  children,
  size = "sm",
  contentClassName,
  overlayClassName,
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
        overlayClassName={overlayClassName}
        onPointerDownOutside={onContentPointerDownOutside}
      >
        {headerEnd ? (
          <div className="flex items-start justify-between gap-3">
            <DialogHeader
              className={cn(
                headerClassName,
                "flex-1 min-w-0 text-left sm:text-left"
              )}
            >
              <DialogTitle className={titleClassName}>{title}</DialogTitle>
              {description ? (
                <DialogDescription className={descriptionClassName}>
                  {description}
                </DialogDescription>
              ) : null}
            </DialogHeader>
            <div className="flex shrink-0 items-center pt-0.5">{headerEnd}</div>
          </div>
        ) : (
          <DialogHeader className={headerClassName}>
            <DialogTitle className={titleClassName}>{title}</DialogTitle>
            {description ? (
              <DialogDescription className={descriptionClassName}>
                {description}
              </DialogDescription>
            ) : null}
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}
