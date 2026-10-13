import { useMemo, useState } from "react";
import { ImageOff, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { JournalEntry, Memory } from "@/lib/db/types";
import MediaLightbox from "@/components/journal/media-lightbox";
import { Button } from "@/components/ui/button";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { getJournalPhotoUrl, getJournalVideoPlaybackUrl } from "@/lib/journal";
import {
  formatArchiveMonthLabel,
  rememberJournalJumpDate,
} from "@/lib/journal/archive";
import {
  buildGalleryMemoryGroups,
  buildGalleryMonths,
  type GalleryItem,
} from "@/lib/journal/view-modes";
import { formatWeekdayShortDate, fromDateString } from "@/lib/time-utils";

interface JournalArchiveGalleryProps {
  /** The days the current search and filters leave in. */
  entries: readonly JournalEntry[];
  /** Photos from memories follow the months, grouped by the year they name. */
  memories: readonly Memory[];
  /** Clips appear only when the daily clip is on. */
  includeVideo: boolean;
  /** Show a memory in the feed, where it can be read and edited. */
  onShowMemory: (memoryId: string) => void;
}

function dayLabel(entryDate: string): string {
  const date = fromDateString(entryDate);
  return `${formatWeekdayShortDate(date)} ${date.getFullYear()}`;
}

/** Where an item sits in the record: its date, or a memory's own words. */
function itemWhen(item: GalleryItem, memoryFallback: string): string {
  if (item.entryDate) return dayLabel(item.entryDate);
  return item.caption ?? memoryFallback;
}

/**
 * The Gallery view of the record: every photo (and clip, when the daily clip is
 * on) by month, so media that was captured stays reachable in aggregate. Each
 * one opens large, with the day it belongs to and a way to read that day.
 */
export default function JournalArchiveGallery({
  entries,
  memories,
  includeVideo,
  onShowMemory,
}: JournalArchiveGalleryProps) {
  const { t } = useTranslation("journal");
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const months = useMemo(
    () => buildGalleryMonths(entries, { includeVideo }),
    [entries, includeVideo]
  );
  const memoryGroups = useMemo(
    () => buildGalleryMemoryGroups(memories),
    [memories]
  );
  const items = useMemo(
    () => [
      ...months.flatMap((m) => m.items),
      ...memoryGroups.flatMap((g) => g.items),
    ],
    [months, memoryGroups]
  );
  const [openKey, setOpenKey] = useState<string | null>(null);

  const openIndex = openKey ? items.findIndex((i) => i.key === openKey) : -1;
  const open = openIndex >= 0 ? items[openIndex] : null;

  const step = (delta: number) => {
    if (items.length === 0 || openIndex < 0) return;
    setOpenKey(items[(openIndex + delta + items.length) % items.length].key);
  };

  if (items.length === 0) {
    return (
      <div className="space-y-2 py-12 text-center">
        <p className="font-display text-xl font-semibold">
          {t("archive.gallery.empty")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("archive.gallery.emptyHelper")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {months.map((month) => {
        const headingId = `gallery-${month.key}`;
        return (
          <section key={month.key} aria-labelledby={headingId}>
            <h2
              id={headingId}
              className="pb-2 font-display text-lg font-semibold tracking-tight"
            >
              {formatArchiveMonthLabel(month.year, month.month)}
            </h2>
            <ul className="grid grid-cols-3 gap-1 sm:grid-cols-4 lg:grid-cols-5">
              {month.items.map((item) => (
                <li key={item.key}>
                  <GalleryTile
                    item={item}
                    onOpen={() => setOpenKey(item.key)}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {memoryGroups.map((group) => {
        const headingId = `gallery-${group.key}`;
        return (
          <section key={group.key} aria-labelledby={headingId}>
            <h2
              id={headingId}
              className="pb-2 font-display text-lg font-semibold tracking-tight"
            >
              {group.year === null
                ? t("archive.memory.groupUndated")
                : t("archive.memory.groupYear", { year: group.year })}
            </h2>
            <ul className="grid grid-cols-3 gap-1 sm:grid-cols-4 lg:grid-cols-5">
              {group.items.map((item) => (
                <li key={item.key}>
                  <GalleryTile
                    item={item}
                    onOpen={() => setOpenKey(item.key)}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <MediaLightbox
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) setOpenKey(null);
        }}
        title={
          open
            ? t(
                open.kind === "video"
                  ? "archive.gallery.clipOf"
                  : "archive.gallery.photoOf",
                { date: itemWhen(open, t("archive.memory.untitled")) }
              )
            : t("archive.title")
        }
        index={openIndex}
        count={items.length}
        onPrevious={() => step(-1)}
        onNext={() => step(1)}
        previousLabel={t("archive.gallery.previous")}
        nextLabel={t("archive.gallery.next")}
        closeLabel={t("archive.closePhoto")}
      >
        {open ? (
          <div className="flex max-h-[90dvh] max-w-[90dvw] flex-col items-center gap-3">
            <GalleryMedia item={open} isOnline={isOnline} />
            <div className="flex flex-wrap items-center justify-center gap-3 rounded-xl bg-black/60 px-4 py-2 text-white">
              <p className="text-sm">
                {open.emoji ? <span aria-hidden>{open.emoji} </span> : null}
                {open.entryDate && open.caption ? `${open.caption} · ` : ""}
                {itemWhen(open, t("archive.memory.untitled"))}
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-11 md:h-8"
                onClick={() => {
                  setOpenKey(null);
                  if (open.memoryId) {
                    onShowMemory(open.memoryId);
                    return;
                  }
                  if (open.entryDate) {
                    rememberJournalJumpDate(open.entryDate);
                    navigate("/");
                  }
                }}
              >
                {open.memoryId
                  ? t("archive.gallery.showMemory")
                  : t("archive.gallery.openDay")}
              </Button>
            </div>
          </div>
        ) : null}
      </MediaLightbox>
    </div>
  );
}

function GalleryTile({
  item,
  onOpen,
}: {
  item: GalleryItem;
  onOpen: () => void;
}) {
  const { t } = useTranslation("journal");
  const date = itemWhen(item, t("archive.memory.untitled"));
  const src =
    item.kind === "photo" ? getJournalPhotoUrl(item.path) : item.poster;

  return (
    <Button
      type="button"
      variant="bare"
      onClick={onOpen}
      aria-label={t(
        item.kind === "video"
          ? "archive.gallery.clipOf"
          : "archive.gallery.photoOf",
        { date }
      )}
      className="relative block aspect-square w-full overflow-hidden rounded-md bg-muted"
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          draggable={false}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-muted-foreground">
          <ImageOff className="h-5 w-5" aria-hidden />
        </span>
      )}
      {item.kind === "video" ? (
        <span
          className="absolute inset-0 flex items-center justify-center"
          aria-hidden
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white">
            <Play className="h-4 w-4 fill-current" />
          </span>
        </span>
      ) : null}
    </Button>
  );
}

function GalleryMedia({
  item,
  isOnline,
}: {
  item: GalleryItem;
  isOnline: boolean;
}) {
  const { t } = useTranslation("journal");

  if (item.kind === "video") {
    const src = getJournalVideoPlaybackUrl(item.path);
    return isOnline && src ? (
      <video
        key={item.key}
        className="aspect-[2/1] w-[min(90dvw,40rem)] rounded-xl bg-black object-contain"
        src={src}
        controls
        autoPlay
        playsInline
      />
    ) : (
      <div className="flex h-48 w-[min(90dvw,24rem)] items-center justify-center rounded-xl bg-muted px-4 text-center text-sm text-muted-foreground">
        {t("archive.gallery.clipOffline")}
      </div>
    );
  }

  const url = getJournalPhotoUrl(item.path);
  return url ? (
    <img
      key={item.key}
      src={url}
      alt={t("archive.gallery.photoOf", {
        date: itemWhen(item, t("archive.memory.untitled")),
      })}
      className="max-h-[75dvh] max-w-[90dvw] rounded-lg object-contain shadow-2xl"
      draggable={false}
    />
  ) : (
    <div className="flex h-64 w-64 items-center justify-center rounded-lg bg-muted text-muted-foreground">
      {t("archive.photoUnavailable")}
    </div>
  );
}
