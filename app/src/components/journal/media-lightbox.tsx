import type {
  ComponentProps,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
} from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Keyboard navigation must not steal arrows from media controls or form fields. */
const INTERACTIVE_SELECTOR =
  "video, audio, button, input, textarea, select, a[href], [contenteditable]";

const controlButtonClass =
  "absolute z-10 h-11 w-11 rounded-full bg-black/60 text-white hover:bg-black/80 hover:text-white";

interface MediaLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible name, rendered as a visually-hidden DialogTitle. */
  title: string;
  /** Media content (img / video / map surface). */
  children: ReactNode;
  /** Optional gallery navigation. */
  index?: number;
  count?: number;
  onPrevious?: () => void;
  onNext?: () => void;
  previousLabel?: string;
  nextLabel?: string;
  closeLabel?: string;
  /** Visually-hidden description; defaults to the title. */
  description?: string;
  /** Extra classes for the media wrapper (sizing, chrome around the media). */
  contentClassName?: string;
  onPointerDownOutside?: ComponentProps<
    typeof DialogContent
  >["onPointerDownOutside"];
}

export default function MediaLightbox({
  open,
  onOpenChange,
  title,
  children,
  index,
  count,
  onPrevious,
  onNext,
  previousLabel = "Previous",
  nextLabel = "Next",
  closeLabel = "Close",
  description,
  contentClassName,
  onPointerDownOutside,
}: MediaLightboxProps) {
  const showGalleryControls = (count ?? 0) > 1 && Boolean(onPrevious || onNext);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!showGalleryControls) return;
    const target = event.target as HTMLElement | null;
    if (
      target &&
      target !== event.currentTarget &&
      target.closest(INTERACTIVE_SELECTOR)
    ) {
      return;
    }
    if (event.key === "ArrowLeft" && onPrevious) {
      event.preventDefault();
      onPrevious();
    } else if (event.key === "ArrowRight" && onNext) {
      event.preventDefault();
      onNext();
    }
  };

  const stopClick = (event: MouseEvent) => event.stopPropagation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        tabIndex={-1}
        overlayClassName="z-[100] bg-black/80 motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none"
        className="z-[100] flex h-full max-h-full w-full max-w-none items-center justify-center gap-0 overflow-x-hidden overflow-y-hidden rounded-none border-0 bg-transparent p-0 shadow-none motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none data-[size=default]:sm:max-w-none"
        onOpenAutoFocus={(event) => {
          // Keep focus on the dialog surface rather than a control so
          // arrow-key gallery navigation works immediately after opening.
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
        }}
        onClick={(event) => {
          event.stopPropagation();
          onOpenChange(false);
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
        onPointerDownOutside={onPointerDownOutside}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">
          {description ?? title}
        </DialogDescription>

        <div
          className={cn(
            "relative flex max-h-[90dvh] max-w-[90dvw] items-center justify-center",
            contentClassName
          )}
          onClick={stopClick}
        >
          {children}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="smIcon"
          onClick={(event) => {
            event.stopPropagation();
            onOpenChange(false);
          }}
          className={cn(controlButtonClass, "right-4 top-4")}
          aria-label={closeLabel}
        >
          <X aria-hidden />
          <span className="sr-only">{closeLabel}</span>
        </Button>

        {showGalleryControls && onPrevious ? (
          <Button
            type="button"
            variant="ghost"
            size="smIcon"
            onClick={(event) => {
              event.stopPropagation();
              onPrevious();
            }}
            className={cn(
              controlButtonClass,
              "left-3 top-1/2 -translate-y-1/2"
            )}
            aria-label={previousLabel}
          >
            <ChevronLeft aria-hidden />
            <span className="sr-only">{previousLabel}</span>
          </Button>
        ) : null}

        {showGalleryControls && onNext ? (
          <Button
            type="button"
            variant="ghost"
            size="smIcon"
            onClick={(event) => {
              event.stopPropagation();
              onNext();
            }}
            className={cn(
              controlButtonClass,
              "right-3 top-1/2 -translate-y-1/2"
            )}
            aria-label={nextLabel}
          >
            <ChevronRight aria-hidden />
            <span className="sr-only">{nextLabel}</span>
          </Button>
        ) : null}

        {showGalleryControls && typeof index === "number" ? (
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs tabular-nums text-white">
            {index + 1} / {count}
          </span>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
