import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DigestItem } from "@/lib/home/digest";

interface HomeDigestProps {
  items: readonly DigestItem[];
  /** How many habits the digest read; tells "nothing to act on" from "nothing yet". */
  trackedHabits: number;
  /** The activity whose pin is being saved, if any. */
  pendingId: string | null;
  onPin: (activityId: string) => void;
}

/**
 * "Worth acting on today": what the last week's own numbers say, with no AI and
 * no key. It is the instrument register: dense rows, hairline rules, tabular
 * figures. Each row gives its evidence and something to do, because a number
 * with nothing to do about it does not belong here (design-and-branding.md §4.4).
 */
export default function HomeDigest({
  items,
  trackedHabits,
  pendingId,
  onPin,
}: HomeDigestProps) {
  const { t } = useTranslation("home");

  return (
    <section
      aria-labelledby="home-digest-heading"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="border-b border-border px-4 py-2.5">
        <h2
          id="home-digest-heading"
          className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground"
        >
          {t("digest.title")}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("digest.subtitle")}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="space-y-2 px-4 py-4">
          <p className="text-sm">
            {trackedHabits > 0 ? t("digest.allClear") : t("digest.nothingYet")}
          </p>
          {trackedHabits === 0 ? (
            <Button asChild size="sm" variant="outline">
              <Link to="/">{t("digest.openToday")}</Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li
              key={
                item.kind === "journal-streak"
                  ? "journal-streak"
                  : `${item.kind}-${item.activityId}`
              }
              className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
            >
              <div className="min-w-0 flex-1 basis-56">
                <DigestRowText item={item} />
              </div>
              <DigestAction
                item={item}
                pending={
                  item.kind !== "journal-streak" &&
                  pendingId === item.activityId
                }
                onPin={onPin}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DigestRowText({ item }: { item: DigestItem }) {
  const { t } = useTranslation("home");

  if (item.kind === "journal-streak") {
    return (
      <>
        <p className="text-sm font-medium">
          {t("digest.journalStreak.title", { count: item.streak })}
        </p>
        <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
          {t("digest.journalStreak.evidence", { count: item.streak })}
        </p>
      </>
    );
  }
  if (item.kind === "streak-at-risk") {
    return (
      <>
        <p className="text-sm font-medium">
          {t("digest.streakAtRisk.title", {
            name: item.name,
            count: item.streak,
          })}
        </p>
        <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
          {t("digest.streakAtRisk.evidence", {
            streak: item.streak,
            done: item.doneToday,
            target: item.target,
          })}
        </p>
      </>
    );
  }
  return (
    <>
      <p className="text-sm font-medium">
        {t("digest.slipping.title", { name: item.name })}
      </p>
      <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
        {t("digest.slipping.evidence", {
          done: item.daysDone,
          total: item.daysActive,
        })}
      </p>
    </>
  );
}

function DigestAction({
  item,
  pending,
  onPin,
}: {
  item: DigestItem;
  pending: boolean;
  onPin: (activityId: string) => void;
}) {
  const { t } = useTranslation("home");

  if (item.kind === "journal-streak") {
    return (
      <Button asChild size="sm" variant="outline" className="h-11 md:h-8">
        <Link to="/">{t("digest.journalStreak.action")}</Link>
      </Button>
    );
  }
  if (item.pinned) {
    // Pinned already (or just now): the next step is to go and do it.
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Check className="size-3.5" aria-hidden />
          {t("digest.pinned")}
        </span>
        <Button asChild size="sm" variant="outline" className="h-11 md:h-8">
          <Link to="/">{t("digest.openToday")}</Link>
        </Button>
      </div>
    );
  }
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-11 md:h-8"
      disabled={pending}
      onClick={() => onPin(item.activityId)}
      aria-label={t("digest.pinLabel", { name: item.name })}
    >
      <Pin className="size-3.5" aria-hidden />
      {t("digest.pin")}
    </Button>
  );
}
