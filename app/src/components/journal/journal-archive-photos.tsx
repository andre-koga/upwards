import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getJournalPhotoUrl } from "@/lib/journal";
import MediaLightbox from "@/components/journal/media-lightbox";
import { cn } from "@/lib/utils";

interface LightboxState {
  key: string;
  index: number;
  open: boolean;
}

export default function JournalArchivePhotoGrid({
  photoPaths,
}: {
  photoPaths: string[];
}) {
  const { t } = useTranslation("journal");
  const pathsKey = photoPaths.join("\0");
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  // Derive closed state when the photo set changes instead of calling
  // setState during render or in a reset effect.
  const isStale = lightbox !== null && lightbox.key !== pathsKey;
  const lightboxOpen = lightbox !== null && !isStale && lightbox.open;
  const lightboxIndex = lightbox !== null && !isStale ? lightbox.index : 0;

  if (photoPaths.length === 0) return null;

  const previewLimit = 2;
  const previewPaths = photoPaths.slice(0, previewLimit);
  const hiddenCount = Math.max(0, photoPaths.length - previewLimit);
  const singlePreview = previewPaths.length === 1;

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
      <div
        className={cn(
          "grid gap-1.5",
          singlePreview ? "grid-cols-1" : "grid-cols-2"
        )}
      >
        {previewPaths.map((path, index) => {
          const url = getJournalPhotoUrl(path);
          const isOverflowTile =
            hiddenCount > 0 && index === previewPaths.length - 1;
          return (
            <button
              key={path}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                // Overflow tile jumps to the first hidden photo in the lightbox.
                const openIndex = isOverflowTile ? previewLimit : index;
                setLightbox({ key: pathsKey, index: openIndex, open: true });
              }}
              className={cn(
                "relative overflow-hidden rounded-lg bg-muted",
                singlePreview ? "aspect-[2/1]" : "aspect-square"
              )}
              aria-label={
                isOverflowTile
                  ? t("archive.morePhotos", { count: hiddenCount })
                  : t("upload.photoAlt", { index: index + 1 })
              }
            >
              {url ? (
                <img
                  src={url}
                  alt=""
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              ) : null}
              {isOverflowTile ? (
                <span
                  className="absolute inset-0 flex items-center justify-center bg-black/55"
                  aria-hidden
                >
                  <span className="font-crimson text-3xl font-semibold tracking-tight text-white drop-shadow-sm">
                    +{hiddenCount}
                  </span>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

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
