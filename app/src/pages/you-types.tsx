import { useLayoutEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AppPageShell } from "@/components/layout/app-page-shell";
import { AnimalPicture } from "@/components/you/animal-picture";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { usePersonality } from "@/hooks/use-personality";
import {
  ANIMAL_GROUPS,
  TRAIT_LETTERS,
  allAnimalTypes,
  animalType,
  groupColor,
  oppositeType,
  type AnimalType,
} from "@/lib/personality/animal-type";
import { TRAITS } from "@/lib/personality/items";
import { traitColor } from "@/lib/personality/trait-colors";
import { scrollAppToTop } from "@/lib/scroll-app-to-top";
import { cn } from "@/lib/utils";

/**
 * Every result the test can give: the 32 animals in their four habitats, each
 * with its picture, name, five letters and description. The letters are
 * explained once at the top, and the person's own type is marked.
 */
export default function YouTypesPage() {
  const { t } = useTranslation("personality");
  const { data } = usePersonality();
  const types = useMemo(() => allAnimalTypes(), []);

  useLayoutEffect(() => {
    scrollAppToTop();
  }, []);

  const scores = data?.completed[0]?.scores ?? null;
  const own = scores ? animalType(scores) : null;
  const ownId = own?.id ?? null;
  const oppositeId = own ? oppositeType(own).id : null;

  return (
    <AppPageShell
      title={t("types.title")}
      subtitle={t("types.subtitle")}
      align="center"
    >
      <section aria-labelledby="types-letters" className="px-2">
        <h2
          id="types-letters"
          className="text-center text-xs text-muted-foreground"
        >
          {t("type.letters")}
        </h2>
        <ul className="mt-2 space-y-1.5 rounded-3xl border border-foreground/15 bg-foreground/5 px-4 py-3">
          {TRAITS.map((trait) => (
            <li
              key={trait}
              className="flex items-center gap-2 text-[0.8125rem]"
            >
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: traitColor(trait) }}
              />
              <span className="w-28 shrink-0 text-muted-foreground">
                {t(`traits.${trait}.name`)}
              </span>
              <span>
                <span className="font-medium">{TRAIT_LETTERS[trait].high}</span>{" "}
                {t(`type.poles.${trait}.high`)}
              </span>
              <span aria-hidden="true" className="text-muted-foreground">
                /
              </span>
              <span>
                <span className="font-medium">{TRAIT_LETTERS[trait].low}</span>{" "}
                {t(`type.poles.${trait}.low`)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="space-y-8 px-2 pb-24">
        {ANIMAL_GROUPS.map((group) => (
          <section key={group} aria-labelledby={`types-${group}`}>
            <h2
              id={`types-${group}`}
              className="flex items-center gap-2 px-1 font-display text-[1.375rem] text-foreground"
            >
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: groupColor(group) }}
              />
              {t(`type.groups.${group}.name`)}
            </h2>
            <p className="mt-0.5 px-1 text-[0.875rem] leading-relaxed text-muted-foreground">
              {t(`type.groups.${group}.tagline`)}
            </p>
            <ul className="mt-3 space-y-3">
              {types
                .filter((type) => type.group === group)
                .map((type) => (
                  <TypeRow
                    key={type.id}
                    type={type}
                    mark={
                      type.id === ownId
                        ? "you"
                        : type.id === oppositeId
                          ? "opposite"
                          : null
                    }
                  />
                ))}
            </ul>
          </section>
        ))}
      </div>

      <FloatingBackButton to="/you" title={t("types.back")} />
    </AppPageShell>
  );
}

/** "you" is your own type; "opposite" has the other pole on every letter. */
type Mark = "you" | "opposite";

function TypeRow({ type, mark }: { type: AnimalType; mark: Mark | null }) {
  const { t } = useTranslation("personality");
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-3xl border px-3.5 py-3.5",
        mark === "opposite" && "border-dashed"
      )}
      style={{
        borderColor: groupColor(type.group, mark ? 0.95 : 0.35),
        background: `linear-gradient(135deg, ${groupColor(type.group, mark ? 0.3 : 0.16)}, transparent 75%)`,
        boxShadow: mark
          ? `0 0 0 1px ${groupColor(type.group, 0.95)}, 0 8px 24px -12px ${groupColor(type.group, 0.7)}`
          : undefined,
      }}
    >
      <div className="flex h-16 w-20 shrink-0 items-center justify-center">
        <AnimalPicture
          id={type.id}
          className="max-h-full max-w-full"
          fallback={
            <span
              aria-hidden="true"
              className="size-12 rounded-full"
              style={{ background: groupColor(type.group, 0.18) }}
            />
          }
        />
      </div>
      <div className="min-w-0">
        <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 font-display text-[1.5rem] italic leading-tight tracking-[-0.01em] text-foreground">
          {t(`type.names.${type.id}.name`)}
          {mark && (
            <span className="rounded-full border border-foreground/25 bg-foreground/10 px-2 py-0.5 font-sans text-[0.6875rem] not-italic leading-none tracking-normal">
              {t(mark === "you" ? "types.you" : "types.opposite")}
            </span>
          )}
        </h3>
        <p className="mt-0.5">
          <span className="sr-only">
            {t("types.codeLabel")}: {type.code}
          </span>
          <span
            aria-hidden="true"
            className="font-display text-[0.9375rem] leading-none tracking-[0.08em] text-muted-foreground"
          >
            {type.code}
          </span>
        </p>
        <p className="mt-1.5 text-[0.875rem] leading-relaxed text-foreground/80">
          {t(`type.names.${type.id}.blurb`)}
        </p>
      </div>
    </li>
  );
}
