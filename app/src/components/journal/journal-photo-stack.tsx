import { useState, type MouseEvent } from "react";
import { getJournalPhotoUrl } from "@/lib/journal";
import MediaLightbox from "@/components/journal/media-lightbox";

interface JournalPhotoStackProps {
  photoPaths: string[];
}

// Deterministic but irregular per-slot transforms so the stack looks like
// carelessly tossed photos rather than a neat fan.
const SLOT_TRANSFORMS: { rotate: number; tx: number; ty: number }[] = [
  { rotate: -7, tx: -3, ty: 2 }, // bottom of pile
  { rotate: 5, tx: 4, ty: -3 }, // middle
  { rotate: -2, tx: -1, ty: -1 }, // top (frontmost)
];

interface LightboxState {
  key: string;
  index: number;
  open: boolean;
}

export default function JournalPhotoStack({
  photoPaths,
}: JournalPhotoStackProps) {
  const pathsKey = photoPaths.join("\0");
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  // Treat the lightbox as closed when the photo set changes (e.g. navigating
  // to a different day) without resetting state during render or in an effect.
  // `open` is kept separate so the closing animation still shows the last photo.
  const isStale = lightbox !== null && lightbox.key !== pathsKey;
  const lightboxOpen = lightbox !== null && !isStale && lightbox.open;
  const lightboxIndex = lightbox !== null && !isStale ? lightbox.index : 0;

  if (photoPaths.length === 0) return null;

  const visibleCount = Math.min(photoPaths.length, 3);
  const stackedPaths = photoPaths.slice(0, visibleCount);

  const openLightbox = (e: MouseEvent) => {
    e.stopPropagation();
    setLightbox({ key: pathsKey, index: 0, open: true });
  };

  const showPreviousPhoto = () =>
    setLightbox((current) =>
      current
        ? {
            ...current,
            index: (current.index - 1 + photoPaths.length) % photoPaths.length,
          }
        : current
    );

  const showNextPhoto = () =>
    setLightbox((current) =>
      current
        ? { ...current, index: (current.index + 1) % photoPaths.length }
        : current
    );

  const lightboxUrl = getJournalPhotoUrl(photoPaths[lightboxIndex]);

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

      <MediaLightbox
        open={lightboxOpen}
        onOpenChange={(open) => {
          if (!open) {
            setLightbox((current) =>
              current ? { ...current, open: false } : current
            );
          }
        }}
        title={`Photo ${lightboxIndex + 1} of ${photoPaths.length}`}
        index={lightboxIndex}
        count={photoPaths.length}
        onPrevious={showPreviousPhoto}
        onNext={showNextPhoto}
        previousLabel="Previous photo"
        nextLabel="Next photo"
      >
        {lightboxUrl ? (
          <img
            src={lightboxUrl}
            alt={`Photo ${lightboxIndex + 1} of ${photoPaths.length}`}
            className="max-h-[90dvh] max-w-[90dvw] rounded-lg object-contain shadow-2xl"
            draggable={false}
          />
        ) : (
          <div className="flex h-64 w-64 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            Photo unavailable
          </div>
        )}
      </MediaLightbox>
    </>
  );
}
