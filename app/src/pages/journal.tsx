import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Heart, Search, X } from "lucide-react";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { AppPageShell } from "@/components/layout/app-page-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useJournalArchive } from "@/hooks/use-journal-archive";
import JournalArchiveEntry from "@/components/journal/journal-archive-entry";
import JournalArchiveBanner from "@/components/journal/journal-archive-banner";
import { formatArchiveMonthLabel } from "@/lib/journal/archive";
import type { JournalArchiveItem } from "@/lib/journal/archive";
import { scrollAppToTop } from "@/lib/scroll-app-to-top";
import { cn } from "@/lib/utils";
import { fromDateString } from "@/lib/time-utils";
import { getActiveLocaleTag } from "@/lib/i18n";

export default function JournalPage() {
  const { t } = useTranslation("journal");
  const { t: tNav } = useTranslation("nav");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
    }, 250);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const {
    loading,
    visibleItems,
    hasMore,
    loadMore,
    totalMatching,
    totalEntries,
  } = useJournalArchive(debouncedQuery);

  const entryItems = useMemo(
    () =>
      visibleItems.filter(
        (item): item is Extract<JournalArchiveItem, { kind: "entry" }> =>
          item.kind === "entry"
      ),
    [visibleItems]
  );

  const selectedEntry =
    entryItems.find((item) => item.entry.id === selectedId)?.entry ??
    entryItems[0]?.entry ??
    null;

  useEffect(() => {
    if (
      selectedId &&
      !entryItems.some((item) => item.entry.id === selectedId)
    ) {
      setSelectedId(entryItems[0]?.entry.id ?? null);
    } else if (!selectedId && entryItems[0]) {
      setSelectedId(entryItems[0].entry.id);
    }
  }, [entryItems, selectedId]);

  useLayoutEffect(() => {
    scrollAppToTop();
  }, []);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;

    const root =
      document.querySelector<HTMLElement>("[data-app-scroll]") ?? null;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          loadMore();
        }
      },
      { root: root?.clientHeight ? root : null, rootMargin: "240px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore, visibleItems.length]);

  const listBody = loading ? (
    <p className="py-10 text-center text-sm text-muted-foreground">
      {t("archive.loading")}
    </p>
  ) : totalEntries === 0 ? (
    <div className="space-y-2 py-12 text-center">
      <p className="font-crimson text-xl font-semibold">{t("archive.empty")}</p>
      <p className="text-sm text-muted-foreground">
        {t("archive.emptyHelper")}
      </p>
    </div>
  ) : totalMatching === 0 ? (
    <div className="space-y-2 py-12 text-center">
      <p className="font-crimson text-xl font-semibold">
        {t("archive.noResults")}
      </p>
      <p className="text-sm text-muted-foreground">
        {t("archive.noResultsHelper")}
      </p>
    </div>
  ) : (
    <div className="space-y-5">
      {debouncedQuery ? (
        <p className="text-xs text-muted-foreground">
          {t("archive.resultCount", { count: totalMatching })}
        </p>
      ) : null}

      {/* Mobile / narrow: full archive stream */}
      <div className="space-y-5 lg:hidden">
        {visibleItems.map((item) => {
          if (item.kind === "month") {
            return (
              <JournalArchiveBanner
                key={item.key}
                variant="month"
                month={item.month}
                label={formatArchiveMonthLabel(item.year, item.month)}
              />
            );
          }
          if (item.kind === "holiday") {
            return (
              <JournalArchiveBanner
                key={item.key}
                variant="holiday"
                label={item.name}
              />
            );
          }
          return <JournalArchiveEntry key={item.entry.id} entry={item.entry} />;
        })}
      </div>

      {/* Desktop: compact selectable list */}
      <div className="hidden space-y-1 lg:block">
        {entryItems.map(({ entry }) => {
          const date = fromDateString(entry.entry_date);
          const label = date.toLocaleDateString(getActiveLocaleTag(), {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
          const isActive = selectedEntry?.id === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setSelectedId(entry.id)}
              className={cn(
                "flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "border-primary/40 bg-accent"
                  : "border-transparent hover:bg-muted/60"
              )}
              aria-current={isActive ? "true" : undefined}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {entry.title?.trim() || t("untitled")}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {label}
                </span>
              </span>
              {entry.is_bookmarked ? (
                <Heart
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-red-500 text-red-500"
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div ref={sentinelRef} className="h-8" aria-hidden />

      {hasMore ? (
        <p className="pb-4 text-center text-xs text-muted-foreground">
          {t("archive.loadingMore")}
        </p>
      ) : (
        <p className="pb-4 text-center text-xs text-muted-foreground lg:hidden">
          {t("archive.end")}
        </p>
      )}
    </div>
  );

  return (
    <AppPageShell
      title={t("archive.title")}
      subtitle={t("archive.subtitle")}
      titleIcon={<BookOpen className="h-6 w-6" />}
      className="space-y-5 md:max-w-5xl"
      breadcrumbs={[
        { label: tNav("today"), to: "/" },
        { label: t("archive.title") },
      ]}
    >
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t("archive.searchPlaceholder")}
          className="h-11 rounded-xl pl-9 pr-10"
          aria-label={t("archive.searchPlaceholder")}
        />
        {searchInput ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full"
            onClick={() => setSearchInput("")}
            title={t("archive.clearSearch")}
            aria-label={t("archive.clearSearch")}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <div className="min-w-0">{listBody}</div>
        <div className="hidden min-w-0 lg:sticky lg:top-4 lg:block">
          {selectedEntry ? (
            <JournalArchiveEntry key={selectedEntry.id} entry={selectedEntry} />
          ) : !loading && totalMatching > 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {t("archive.noResults")}
            </p>
          ) : null}
        </div>
      </div>

      <FloatingBackButton to="/" title={tNav("home")} />
    </AppPageShell>
  );
}
