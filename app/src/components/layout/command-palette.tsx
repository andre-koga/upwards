import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  filterCommands,
  type SearchableCommand,
} from "@/lib/navigation/filter-commands";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShortcutChip } from "@/components/layout/shortcut-chip";
import { useRecordCommands } from "@/components/layout/use-record-commands";

export type PaletteGroup = "go" | "record" | "actions" | "appearance";

const GROUP_ORDER: readonly PaletteGroup[] = [
  "go",
  "record",
  "actions",
  "appearance",
];

export interface PaletteCommand extends SearchableCommand {
  id: string;
  group: PaletteGroup;
  icon: LucideIcon;
  /** Digit of the ⌘/Ctrl shortcut, shown as a hint. */
  shortcut?: string;
  /** Quiet text after the label: where a journal result sits in the record. */
  detail?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: readonly PaletteCommand[];
}

export function CommandPalette({
  open,
  onOpenChange,
  commands,
}: CommandPaletteProps) {
  const { t } = useTranslation("nav");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">{t("palette.title")}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("palette.description")}
        </DialogDescription>
        <PaletteBody
          commands={commands}
          onRun={(command) => {
            onOpenChange(false);
            command.run();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function PaletteBody({
  commands,
  onRun,
}: {
  commands: readonly PaletteCommand[];
  onRun: (command: PaletteCommand) => void;
}) {
  const { t } = useTranslation("nav");
  const listId = useId();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Pages and commands are ranked by what was typed; journal results are
  // already the matches, so they are added after ranking, not filtered again.
  const { commands: recordCommands, searching } = useRecordCommands(query);
  const sections = useMemo(() => {
    const all = [...filterCommands(commands, query), ...recordCommands];
    return GROUP_ORDER.map((group) => ({
      group,
      items: all.filter((c) => c.group === group),
    })).filter((section) => section.items.length > 0);
  }, [commands, query, recordCommands]);

  const flat = useMemo(
    () => sections.flatMap((section) => section.items),
    [sections]
  );
  const active = flat[Math.min(activeIndex, flat.length - 1)];

  useEffect(() => {
    if (!active) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-command-id="${active.id}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const move = (delta: number) => {
    if (flat.length === 0) return;
    setActiveIndex((index) => (index + delta + flat.length) % flat.length);
  };

  return (
    <div>
      <input
        id="command-palette-input"
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active ? `${listId}-${active.id}` : undefined}
        aria-label={t("palette.inputLabel")}
        placeholder={t("palette.placeholder")}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            move(1);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            move(-1);
          } else if (event.key === "Home") {
            event.preventDefault();
            setActiveIndex(0);
          } else if (event.key === "End") {
            event.preventDefault();
            setActiveIndex(Math.max(flat.length - 1, 0));
          } else if (event.key === "Enter" && active) {
            event.preventDefault();
            onRun(active);
          }
        }}
        className="h-12 w-full select-text border-b border-border bg-transparent px-4 text-base outline-none placeholder:text-muted-foreground"
      />
      <p role="status" className="sr-only">
        {query.trim() && !searching
          ? t("palette.resultCount", { count: flat.length })
          : ""}
      </p>
      <div
        id={listId}
        ref={listRef}
        role="listbox"
        aria-label={t("palette.title")}
        className="h-72 overflow-y-auto p-2"
      >
        {flat.length === 0 ? (
          <p
            role="status"
            className="px-3 py-6 text-center text-sm text-muted-foreground"
          >
            {searching
              ? t("palette.searching")
              : t("palette.empty", { query: query.trim() })}
          </p>
        ) : (
          sections.map((section) => {
            const headingId = `${listId}-group-${section.group}`;
            return (
              <div
                key={section.group}
                role="group"
                aria-labelledby={headingId}
                className="mb-1"
              >
                <p
                  id={headingId}
                  className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {t(`palette.groups.${section.group}`)}
                </p>
                {section.items.map((command) => {
                  const Icon = command.icon;
                  const isActive = command === active;
                  return (
                    <div
                      key={command.id}
                      id={`${listId}-${command.id}`}
                      data-command-id={command.id}
                      role="option"
                      aria-selected={isActive}
                      onMouseMove={() => {
                        const index = flat.indexOf(command);
                        if (index !== activeIndex) setActiveIndex(index);
                      }}
                      onClick={() => onRun(command)}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm",
                        isActive ? "bg-sage text-green-deep" : "text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="flex-1 truncate">{command.label}</span>
                      {command.detail ? (
                        <span className="shrink-0 text-xs opacity-80">
                          {command.detail}
                        </span>
                      ) : null}
                      {command.shortcut ? (
                        <ShortcutChip keys={command.shortcut} />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
