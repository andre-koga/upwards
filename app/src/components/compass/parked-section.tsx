import { useTranslation } from "react-i18next";
import { deleteCompassItem, restoreCompassItem } from "@/lib/compass/compass";
import type { CompassItem, CompassKind } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { useCompassDelete } from "./use-compass-delete";

const KINDS: readonly CompassKind[] = [
  "north_star",
  "identity",
  "goal",
  "knowledge",
];

function kindLabel(kind: string): CompassKind {
  return KINDS.includes(kind as CompassKind) ? (kind as CompassKind) : "goal";
}

/** Set aside and deleted stay on the page, with a way back. */
export function ParkedSection({
  archived,
  deleted,
}: {
  archived: CompassItem[];
  deleted: CompassItem[];
}) {
  const { ask, dialog } = useCompassDelete();
  if (archived.length === 0 && deleted.length === 0) return null;

  return (
    <div className="space-y-3">
      {archived.length > 0 ? (
        <ParkedList
          titleKey="aside.label"
          hintKey="aside.hint"
          items={archived}
          restoreKey="aside.restore"
          secondLabelKey="aside.delete"
          onRestore={(item) => void restoreCompassItem(item.id)}
          onSecond={(item) => ask(item.text, () => deleteCompassItem(item.id))}
        />
      ) : null}
      {deleted.length > 0 ? (
        <ParkedList
          titleKey="deleted.label"
          items={deleted}
          restoreKey="deleted.restore"
          onRestore={(item) => void restoreCompassItem(item.id)}
        />
      ) : null}
      {dialog}
    </div>
  );
}

function ParkedList({
  titleKey,
  hintKey,
  items,
  restoreKey,
  secondLabelKey,
  onRestore,
  onSecond,
}: {
  titleKey: string;
  hintKey?: string;
  items: CompassItem[];
  restoreKey: string;
  secondLabelKey?: string;
  onRestore: (item: CompassItem) => void;
  onSecond?: (item: CompassItem) => void;
}) {
  const { t } = useTranslation("you");

  return (
    <details className="rounded-xl border border-border bg-card">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-3 font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground [&::-webkit-details-marker]:hidden">
        <span>{t(titleKey)}</span>
        <span className="tabular-nums">{items.length}</span>
      </summary>
      {hintKey ? (
        <p className="px-4 pb-2 text-xs text-muted-foreground">{t(hintKey)}</p>
      ) : null}
      <ul className="divide-y divide-border border-t border-border">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground">
                {t(`aside.kinds.${kindLabel(item.kind)}`)}
              </p>
              <p className="truncate text-sm">{item.text}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 px-3 sm:h-8"
                onClick={() => onRestore(item)}
              >
                {t(restoreKey, { name: item.text })}
              </Button>
              {onSecond && secondLabelKey ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-11 px-3 sm:h-8"
                  onClick={() => onSecond(item)}
                >
                  {t(secondLabelKey, { name: item.text })}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}
