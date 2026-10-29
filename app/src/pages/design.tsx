import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";

import { QuietButton } from "@/components/quiet/button";
import { QuietChoice } from "@/components/quiet/choice";
import { QuietField, QuietWriting } from "@/components/quiet/field";
import { QuietNav } from "@/components/quiet/nav";
import {
  QuietActions,
  QuietCheckRow,
  QuietCountRow,
  QuietMetaRow,
  QuietSlipRow,
  QuietTimerRow,
} from "@/components/quiet/row";
import { QuietSwitch } from "@/components/quiet/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import i18n from "@/lib/i18n";
import { setStoredLocale, type LocaleValue } from "@/lib/i18n/locale-storage";

const READ_TARGET = 5;

function localeNow(): LocaleValue {
  return i18n.language?.toLowerCase().startsWith("pt") ? "pt" : "en";
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-20">
      <h2 className="font-preview text-sm text-ink-muted">{title}</h2>
      <div className="mt-8">{children}</div>
    </section>
  );
}

export default function DesignLibraryPage() {
  const { t } = useTranslation("design");
  const { theme, setTheme } = useTheme();
  const nameId = useId();
  const draftId = useId();
  const clipId = useId();

  const [pagesDone, setPagesDone] = useState(false);
  const [walkDone, setWalkDone] = useState(true);
  const [readCount, setReadCount] = useState(2);
  const [slips, setSlips] = useState(0);
  const [running, setRunning] = useState(true);
  const [clip, setClip] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [traitAside, setTraitAside] = useState(false);
  const [tab, setTab] = useState("today");

  const shownName = name ?? t("nameValue");
  const themes = [
    { value: "system", label: t("themes.system") },
    { value: "light", label: t("themes.light") },
    { value: "dark", label: t("themes.dark") },
  ] as const;
  const languages = [
    { value: "en", label: t("languages.en") },
    { value: "pt", label: t("languages.pt") },
  ] as const;

  const openEdit = () => {
    setDraft(shownName);
    setEditing(true);
  };

  const saveName = () => {
    setName(draft);
    setEditing(false);
  };

  return (
    <div className="quiet-library flex min-h-dvh flex-col bg-canvas font-preview text-ink">
      <h1 className="sr-only">{t("title")}</h1>
      <div
        data-app-scroll
        className="min-h-0 flex-1 overflow-y-auto px-8 pb-28 pt-16"
      >
        <Group title={t("groups.type")}>
          <p className="font-display text-[2.5rem] leading-[1.05] tracking-[-0.03em]">
            {t("day")}
          </p>
          <p className="mt-3 text-sm text-ink-muted">{t("dayLine")}</p>
          <p className="mt-10 font-display text-xl font-normal leading-relaxed">
            {t("sentence")}
          </p>
          <p className="mt-10 font-mono text-sm tabular-nums text-ink-muted">
            {t("figure")}
          </p>
        </Group>

        <Group title={t("groups.list")}>
          <QuietCheckRow
            label={t("habits.pages")}
            done={pagesDone}
            doneLabel={t("done")}
            notDoneLabel={t("notDone")}
            onDone={() => setPagesDone((value) => !value)}
          />
          <QuietCheckRow
            label={t("habits.walk")}
            done={walkDone}
            doneLabel={t("done")}
            notDoneLabel={t("notDone")}
            onDone={() => setWalkDone((value) => !value)}
          />
          <QuietCountRow
            label={t("habits.read")}
            count={readCount}
            countLabel={t("countOf", {
              label: t("habits.read"),
              count: readCount,
              target: READ_TARGET,
            })}
            onIncrement={() =>
              setReadCount((value) => (value >= READ_TARGET ? 0 : value + 1))
            }
          />
          <QuietSlipRow
            label={t("habits.sugar")}
            action={t("slip")}
            count={slips}
            onAction={() => setSlips((value) => value + 1)}
          />
          <QuietMetaRow label={t("memo")} meta={t("memoWhen")} />
        </Group>

        <Group title={t("groups.time")}>
          {running ? (
            <QuietTimerRow
              label={t("session")}
              elapsed={t("elapsed")}
              action={t("stop")}
              onAction={() => setRunning(false)}
            />
          ) : (
            <QuietTimerRow
              label={t("session")}
              elapsed={t("elapsed")}
              action={t("start")}
              onAction={() => setRunning(true)}
            />
          )}
          <QuietMetaRow label={t("past")} meta={t("pastTime")} />
        </Group>

        <Group title={t("groups.writing")}>
          <QuietWriting rows={4} placeholder={t("placeholder")} />
        </Group>

        <Group title={t("groups.choice")}>
          <QuietChoice
            label={t("appearance")}
            value={theme ?? "system"}
            onValueChange={setTheme}
            options={themes}
          />
          <div className="mt-4">
            <QuietChoice
              label={t("language")}
              value={localeNow()}
              onValueChange={(value) => {
                const next = value === "pt" ? "pt" : "en";
                setStoredLocale(next);
                void i18n.changeLanguage(next);
              }}
              options={languages}
            />
          </div>
          <div className="mt-6">
            <QuietSwitch
              id={clipId}
              label={t("clip")}
              checked={clip}
              onCheckedChange={setClip}
            />
          </div>
        </Group>

        <Group title={t("groups.field")}>
          <QuietField
            id={nameId}
            label={t("name")}
            value={shownName}
            onChange={(event) => setName(event.target.value)}
          />
          <QuietActions className="mt-8">
            <QuietButton tone="ink">{t("save")}</QuietButton>
            <QuietButton>{t("cancel")}</QuietButton>
            <QuietButton tone="ink" onClick={openEdit}>
              {t("edit")}
            </QuietButton>
            <QuietButton className="ml-auto" onClick={() => setName("")}>
              {t("delete")}
            </QuietButton>
          </QuietActions>
        </Group>

        <Group title={t("groups.you")}>
          <p
            className={
              traitAside
                ? "font-display text-xl font-normal leading-relaxed text-ink-muted"
                : "font-display text-xl font-normal leading-relaxed text-ink"
            }
          >
            {t("trait")}
          </p>
          <p className="mt-4 text-sm text-ink-muted">{t("evidence")}</p>
          <QuietButton
            tone="ink"
            className="mt-6"
            aria-pressed={traitAside}
            onClick={() => setTraitAside((value) => !value)}
          >
            {t("correct")}
          </QuietButton>
        </Group>
      </div>

      <QuietNav
        label={t("nav")}
        value={tab}
        onValueChange={setTab}
        items={[
          { id: "today", label: t("tabs.today") },
          { id: "journal", label: t("tabs.journal") },
          { id: "you", label: t("tabs.you") },
        ]}
      />

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent
          overlayClassName="bg-foreground/10 backdrop-blur-none"
          className="gap-0 rounded-none border-0 bg-canvas p-8 shadow-none"
        >
          <DialogTitle className="font-display text-2xl font-normal tracking-[-0.03em]">
            {t("name")}
          </DialogTitle>
          <DialogDescription className="sr-only">{t("name")}</DialogDescription>
          <div className="mt-10">
            <QuietField
              id={draftId}
              label={t("name")}
              labelHidden
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </div>
          <QuietActions>
            <QuietButton tone="ink" className="mt-10" onClick={saveName}>
              {t("save")}
            </QuietButton>
            <QuietButton className="mt-10" onClick={() => setEditing(false)}>
              {t("cancel")}
            </QuietButton>
          </QuietActions>
        </DialogContent>
      </Dialog>
    </div>
  );
}
