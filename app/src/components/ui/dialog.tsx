"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { useVisualViewportLayout } from "@/hooks/use-visual-viewport-layout";
import { cn } from "@/lib/utils";
import {
  dialogSurfaceMotionClassName,
  overlayBackdropMotionClassName,
} from "@/components/ui/overlay-motion";

/** Matches DialogContent's closed-state animation duration. */
const DIALOG_EXIT_MS = 150;

function Dialog({
  open,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const isControlled = open !== undefined;
  const [renderOpen, setRenderOpen] = React.useState(open ?? false);
  const closeTimerRef = React.useRef<number | null>(null);

  const clearCloseTimer = React.useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    if (!isControlled) return;

    // Keep the internal visual state aligned when a caller changes `open`
    // itself (rather than through Radix's dismissal event).
    /* eslint-disable react-hooks/set-state-in-effect */
    if (open) {
      clearCloseTimer();
      setRenderOpen(true);
    } else {
      setRenderOpen(false);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [clearCloseTimer, isControlled, open]);

  React.useEffect(
    () => () => {
      clearCloseTimer();
    },
    [clearCloseTimer]
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isControlled) {
      onOpenChange?.(nextOpen);
      return;
    }

    clearCloseTimer();
    setRenderOpen(nextOpen);

    if (nextOpen) {
      onOpenChange?.(true);
      return;
    }

    const closeDelay = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? 0
      : DIALOG_EXIT_MS;

    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      onOpenChange?.(false);
    }, closeDelay);
  };

  return (
    <DialogPrimitive.Root
      data-slot="dialog"
      open={isControlled ? renderOpen : undefined}
      onOpenChange={isControlled ? handleOpenChange : onOpenChange}
      {...props}
    />
  );
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-[var(--z-dialog-overlay)] bg-black/50 backdrop-blur-sm",
        overlayBackdropMotionClassName,
        className
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  size = "default",
  overlayClassName,
  style,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  size?: "default" | "sm";
  overlayClassName?: string;
}) {
  const { centerY } = useVisualViewportLayout();

  return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        data-size={size}
        className={cn(
          "fixed left-1/2 z-[var(--z-dialog)] grid max-h-[min(90dvh,100svh-1rem)] w-full max-w-[calc(100%-2rem)] gap-4 overflow-y-auto rounded-xl border bg-background p-6 shadow-lg data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-lg",
          dialogSurfaceMotionClassName,
          className
        )}
        style={{
          ...style,
          top: centerY,
          // `translate` composes with the animation's `transform`; using
          // `transform` here would be overwritten by animate-in/out and make
          // the dialog jump away from its visual-viewport center.
          translate: "-50% -50%",
        }}
        {...props}
      />
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex flex-col gap-1.5 text-center sm:text-left",
        className
      )}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogPortal,
  DialogOverlay,
};
