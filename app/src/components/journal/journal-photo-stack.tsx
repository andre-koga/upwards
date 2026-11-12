import { useState, type MouseEvent } from "react";
import { getJournalPhotoUrl } from "@/lib/journal";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("journal");
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
        className="pointer-events-auto relative h-[6.5rem] w-[6.5rem] shrink-0"
        aria-label={t("archive.photoCount", { count: photoPaths.length })}
        title={t("archive.photoCount", { count: photoPaths.length })}
      >
        {stackedPaths.map((path, i) => {
          const url = getJournalPhotoUrl(path);
          // i=0 is bottom of pile, i=visibleCount-1 is top
          const slot = SLOT_TRANSFORMS[i] ?? SLOT_TRANSFORMS[0];
          return (
            <span
              key={path}
              className="absolute inset-0 overflow-hidden rounded-lg border-[3px] border-background shadow-lg"
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
          <span className="absolute -bottom-1.5 -right-1.5 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-background px-1.5 text-[0.6875rem] font-semibold tabular-nums shadow">
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
        title={t("upload.photoAlt", { index: lightboxIndex + 1 })}
        index={lightboxIndex}
        count={photoPaths.length}
        onPrevious={showPreviousPhoto}
        onNext={showNextPhoto}
        previousLabel={t("archive.previousPhoto")}
        nextLabel={t("archive.nextPhoto")}
        closeLabel={t("archive.closePhoto")}
      >
        {lightboxUrl ? (
          <img
            src={lightboxUrl}
            alt={t("upload.photoAlt", { index: lightboxIndex + 1 })}
            className="max-h-[90dvh] max-w-[90dvw] rounded-lg object-contain shadow-2xl"
            draggable={false}
          />
        ) : (
          <div className="flex h-64 w-64 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            {t("archive.photoUnavailable")}
          </div>
        )}
      </MediaLightbox>
    </>
  );
}
