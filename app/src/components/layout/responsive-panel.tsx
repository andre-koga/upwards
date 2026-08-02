import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";

interface ResponsivePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** Optional trigger; click opens the panel. */
  trigger?: ReactNode;
  children: ReactNode;
  /** Mobile sheet edge. Desktop always uses a centered dialog. */
  mobileSide?: "bottom" | "right" | "left" | "top";
  sheetClassName?: string;
  dialogClassName?: string;
  /** Hide the visible title (still required for a11y via sr-only). */
  titleSrOnly?: boolean;
}

/**
 * Shared overlay that presents as a Sheet on mobile and a Dialog on `md+`.
 * Content and open state are shared — do not fork feature implementations.
 */
export function ResponsivePanel({
  open,
  onOpenChange,
  title,
  trigger,
  children,
  mobileSide = "bottom",
  sheetClassName,
  dialogClassName,
  titleSrOnly = false,
}: ResponsivePanelProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const triggerNode =
    trigger && isValidElement(trigger)
      ? cloneElement(
          trigger as ReactElement<{ onClick?: (e: unknown) => void }>,
          {
            onClick: (event: unknown) => {
              const original = (
                trigger as ReactElement<{ onClick?: (e: unknown) => void }>
              ).props.onClick;
              original?.(event);
              onOpenChange(true);
            },
          }
        )
      : trigger;

  if (isDesktop) {
    return (
      <>
        {triggerNode}
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className={cn("sm:max-w-lg", dialogClassName)}>
            <DialogTitle className={titleSrOnly ? "sr-only" : undefined}>
              {title}
            </DialogTitle>
            {children}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      {triggerNode}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={mobileSide}
          showCloseButton={!titleSrOnly}
          className={cn(
            mobileSide === "bottom" &&
              "gap-0 rounded-t-2xl border-t border-border px-4 pb-8 pt-3 shadow-xl",
            sheetClassName
          )}
        >
          <SheetTitle className={titleSrOnly ? "sr-only" : undefined}>
            {title}
          </SheetTitle>
          {Children.count(children) > 0 ? children : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
