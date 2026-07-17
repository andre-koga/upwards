import { useState, useEffect, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { getJournalPhotoUrl } from "@/lib/journal";

interface JournalPhotoStackProps {
  photoPaths: string[];
}

// Deterministic but irregular per-slot transforms so the stack looks like
// carelessly tossed photos rather than a neat fan.
const SLOT_TRANSFORMS: { rotate: number; tx: number; ty: number }[] = [
  { rotate: -7,  tx: -3, ty:  2 }, // bottom of pile
  { rotate:  5,  tx:  4, ty: -3 }, // middle
  { rotate: -2,  tx: -1, ty: -1 }, // top (frontmost)
];

export default function JournalPhotoStack({ photoPaths }: JournalPhotoStackProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Close lightbox when photos change (e.g., when navigating to a different day)
  useEffect(() => {
    setLightboxIndex(null);
  }, [photoPaths]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxIndex(null);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxIndex]);

  if (photoPaths.length === 0) return null;

  const visibleCount = Math.min(photoPaths.length, 3);
  const stackedPaths = photoPaths.slice(0, visibleCount);

  const openLightbox = (e: MouseEvent) => {
    e.stopPropagation();
    setLightboxIndex(0);
  };

  const closeLightbox = (e: MouseEvent) => {
    e.stopPropagation();
    setLightboxIndex(null);
  };

  const prev = (e: MouseEvent) => {
    e.stopPropagation();
    setLightboxIndex((i) =>
      i === null ? 0 : (i - 1 + photoPaths.length) % photoPaths.length
    );
  };

  const next = (e: MouseEvent) => {
    e.stopPropagation();
    setLightboxIndex((i) =>
      i === null ? 0 : (i + 1) % photoPaths.length
    );
  };

  // Portal out of transformed ancestors (animate-in / translateZ) so
  // `position: fixed` is relative to the viewport, not the media card.
  const lightbox =
    lightboxIndex !== null && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={`Photo ${lightboxIndex + 1} of ${photoPaths.length}`}
            onClick={closeLightbox}
          >
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div
              className="relative flex max-h-[90dvh] max-w-[90dvw] items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const url = getJournalPhotoUrl(photoPaths[lightboxIndex]);
                return url ? (
                  <img
                    src={url}
                    alt={`Photo ${lightboxIndex + 1} of ${photoPaths.length}`}
                    className="max-h-[90dvh] max-w-[90dvw] rounded-lg object-contain shadow-2xl"
                    draggable={false}
                  />
                ) : (
                  <div className="flex h-64 w-64 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    Photo unavailable
                  </div>
                );
              })()}
            </div>

            {photoPaths.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prev}
                  className="absolute left-3 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={next}
                  className="absolute right-3 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  aria-label="Next photo"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>

                <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs tabular-nums text-white">
                  {lightboxIndex + 1} / {photoPaths.length}
                </span>
              </>
            )}

            <button
              type="button"
              onClick={closeLightbox}
              className="absolute bottom-4 right-4 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={openLightbox}
        className="pointer-events-auto relative h-[4.5rem] w-[4.5rem] shrink-0"
        aria-label={`View ${photoPaths.length} photo${photoPaths.length !== 1 ? "s" : ""}`}
        title={`View ${photoPaths.length} photo${photoPaths.length !== 1 ? "s" : ""}`}
      >
        {stackedPaths.map((path, i) => {
          const url = getJournalPhotoUrl(path);
          // i=0 is bottom of pile, i=visibleCount-1 is top
          const slot = SLOT_TRANSFORMS[i] ?? SLOT_TRANSFORMS[0];
          return (
            <span
              key={path}
              className="absolute inset-0 overflow-hidden rounded-md border-2 border-background shadow"
              style={{
                transform: `rotate(${slot.rotate}deg) translate(${slot.tx}px, ${slot.ty}px)`,
                zIndex: i,
              }}
            >
              {url ? (
                <img
                  src={url}
                  alt=""
                  className="block h-full w-full object-cover"
                  draggable={false}
                />
              ) : (
                <span className="block h-full w-full bg-muted" />
              )}
            </span>
          );
        })}
        {photoPaths.length > 1 && (
          <span className="absolute -bottom-1 -right-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-background text-[9px] font-semibold tabular-nums shadow">
            {photoPaths.length}
          </span>
        )}
      </button>

      {lightbox}
    </>
  );
}
