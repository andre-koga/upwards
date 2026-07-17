import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Search, X } from "lucide-react";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useJournalArchive } from "@/hooks/use-journal-archive";
import JournalArchiveEntry from "@/components/journal/journal-archive-entry";
import JournalArchiveBanner from "@/components/journal/journal-archive-banner";
import { formatArchiveMonthLabel } from "@/lib/journal/archive";

function scrollAppToTop() {
  window.scrollTo(0, 0);
  document.querySelector<HTMLElement>("[data-app-scroll]")?.scrollTo(0, 0);
}

export default function JournalPage() {
  const { t } = useTranslation("journal");
  const { t: tNav } = useTranslation("nav");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
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

  return (
    <div className="space-y-5 p-4 pb-24">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <BookOpen className="h-6 w-6" />
          {t("archive.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("archive.subtitle")}</p>
      </header>

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

      {loading ? (
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
            return (
              <JournalArchiveEntry
                key={item.entry.id}
                entry={item.entry}
              />
            );
          })}

          <div ref={sentinelRef} className="h-8" aria-hidden />

          {hasMore ? (
            <p className="pb-4 text-center text-xs text-muted-foreground">
              {t("archive.loadingMore")}
            </p>
          ) : (
            <p className="pb-4 text-center text-xs text-muted-foreground">
              {t("archive.end")}
            </p>
          )}
        </div>
      )}

      <FloatingBackButton to="/" title={tNav("home")} />
    </div>
  );
}
