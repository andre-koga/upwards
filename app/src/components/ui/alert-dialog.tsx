"use client";

import * as React from "react";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";

import { Button } from "@/components/ui/button";
import {
  dialogSurfaceMotionClassName,
  overlayBackdropMotionClassName,
} from "@/components/ui/overlay-motion";
import { useVisualViewportLayout } from "@/hooks/use-visual-viewport-layout";
import { cn } from "@/lib/utils";

/**
 * Modal confirmation. Unlike Dialog it cannot be dismissed by clicking outside,
 * focus starts on the cancel action, and Escape cancels. Use it for anything
 * that asks "are you sure?" before changing or destroying data.
 */
const AlertDialog = AlertDialogPrimitive.Root;

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        "fixed inset-0 z-[var(--z-dialog-overlay)] bg-black/50 backdrop-blur-sm",
        overlayBackdropMotionClassName,
        className
      )}
      {...props}
    />
  );
}

function AlertDialogContent({
  className,
  style,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  const { centerY } = useVisualViewportLayout();

  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          "fixed left-1/2 z-[var(--z-dialog)] grid max-h-[min(90dvh,100svh-1rem)] w-full max-w-[calc(100%-2rem)] gap-4 overflow-y-auto rounded-xl border bg-background p-6 shadow-lg sm:max-w-md",
          dialogSurfaceMotionClassName,
          className
        )}
        style={{ ...style, top: centerY, translate: "-50% -50%" }}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  );
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-1.5 text-left", className)}
      {...props}
    />
  );
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  );
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  );
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function AlertDialogAction({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action>) {
  return (
    <AlertDialogPrimitive.Action asChild {...props}>
      <Button className={className}>{children}</Button>
    </AlertDialogPrimitive.Action>
  );
}

function AlertDialogCancel({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel asChild {...props}>
      <Button variant="outline" className={className}>
        {children}
      </Button>
    </AlertDialogPrimitive.Cancel>
  );
}

export {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
