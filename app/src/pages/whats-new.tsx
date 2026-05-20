import { useLayoutEffect } from "react";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { FEATURE_RELEASES } from "@/lib/feature-releases";

function scrollAppToTop() {
  window.scrollTo(0, 0);
  document.querySelector<HTMLElement>("[data-app-scroll]")?.scrollTo(0, 0);
}

function formatReleaseDate(isoDate: string) {
  const d = new Date(`${isoDate}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function WhatsNewPage() {
  useLayoutEffect(() => {
    scrollAppToTop();
  }, []);

  return (
    <div className="space-y-6 p-4 pb-24">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">What’s new</h1>
        <p className="text-sm text-muted-foreground">
          Recent updates and improvements to Upwards
        </p>
      </header>

      <ol className="space-y-8 border-l border-border pl-4">
        {FEATURE_RELEASES.map((release) => (
          <li key={release.date} className="relative">
            <span
              className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary"
              aria-hidden
            />
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {formatReleaseDate(release.date)}
            </p>
            <h2 className="mt-1 text-base font-semibold text-foreground">
              {release.title}
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {release.bullets.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {release.fixes != null && release.fixes.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Bug fixes
                </p>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs leading-relaxed text-muted-foreground">
                  {release.fixes.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ol>

      <FloatingBackButton to="/" title="Home" />
    </div>
  );
}
