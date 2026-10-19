import { useTranslation } from "react-i18next";
import {
  ChoiceButton,
  ConflictFrame,
  type ConflictBusy,
} from "@/components/settings/conflict-card-parts";
import { formatWhen } from "@/components/settings/conflict-format";
import type { SyncIssue } from "@/lib/db/types";
import type { ConflictChoice } from "@/lib/sync/field-diff";
import type { JournalConflictPayload } from "@/lib/sync/journal-conflict-resolution";

type Fields = Record<string, unknown>;

interface JournalConflictCardProps {
  issue: SyncIssue;
  payload: JournalConflictPayload;
  busy: ConflictBusy;
  error: string | null;
  onResolve: (choice: ConflictChoice) => void;
  onDefer: () => void;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function places(fields: Fields): string[] {
  const list = (fields.location as { locations?: unknown[] } | null)?.locations;
  return Array.isArray(list)
    ? list
        .map((place) => str((place as { displayName?: unknown }).displayName))
        .filter(Boolean)
    : [];
}

function photos(fields: Fields): number {
  const list = fields.photo_paths;
  return Array.isArray(list) ? list.length : 0;
}

/**
 * A journal day in conflict: the two versions side by side, with what differs
 * marked in words, and the three ways out of product-scope.md §2.10: keep this
 * device's, keep the other, or keep both. The words are the person's own, so
 * the register is editorial: serif, with room.
 */
export function JournalConflictCard({
  issue,
  payload,
  busy,
  error,
  onResolve,
  onDefer,
}: JournalConflictCardProps) {
  const { t } = useTranslation("settings");
  const fromBackup = payload.source === "backup";
  const hasOther = payload.remote != null;
  const differing = new Set(payload.differing_fields);

  const title =
    payload.entity_label?.trim() ||
    (payload.entry_date
      ? t("syncIssues.conflict.journal.untitledWithDate", {
          date: payload.entry_date,
        })
      : issue.title) ||
    t("syncIssues.conflict.journal.untitled");

  return (
    <ConflictFrame
      title={
        <>
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="text-sm text-muted-foreground">
            {fromBackup
              ? t("syncIssues.conflict.journal.backupSummary")
              : t("syncIssues.conflict.journal.summary")}
          </p>
          <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            {payload.entry_date ? (
              <span>
                {t("syncIssues.conflict.journal.entryDate", {
                  date: payload.entry_date,
                })}
              </span>
            ) : null}
            {issue.status === "deferred" ? (
              <span>{t("syncIssues.conflict.deferredBadge")}</span>
            ) : null}
            <span>{formatWhen(issue.updated_at)}</span>
          </p>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <VersionPanel
          heading={t("syncIssues.conflict.journal.mine")}
          when={payload.local.updated_at}
          fields={payload.local.fields}
          differing={differing}
        />
        {payload.remote ? (
          <VersionPanel
            heading={
              fromBackup
                ? t("syncIssues.conflict.journal.backup")
                : t("syncIssues.conflict.journal.theirs")
            }
            when={payload.remote.updated_at}
            fields={payload.remote.fields}
            differing={differing}
          />
        ) : (
          <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
            {t("syncIssues.conflict.unknownRemote")}
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {t("syncIssues.conflict.journal.consequence")}
      </p>
      <p className="text-xs text-muted-foreground">
        {t("syncIssues.conflict.journal.bothHint")}
      </p>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <ChoiceButton
          busy={busy}
          mine="keep_local"
          variant="default"
          onClick={() => onResolve("keep_local")}
        >
          {t("syncIssues.conflict.actions.keepMine")}
        </ChoiceButton>
        <ChoiceButton
          busy={busy}
          mine="keep_remote"
          disabled={!hasOther}
          onClick={() => onResolve("keep_remote")}
        >
          {fromBackup
            ? t("syncIssues.conflict.actions.keepBackup")
            : t("syncIssues.conflict.actions.keepTheirs")}
        </ChoiceButton>
        <ChoiceButton
          busy={busy}
          mine="keep_both"
          disabled={!hasOther}
          onClick={() => onResolve("keep_both")}
        >
          {t("syncIssues.conflict.actions.keepBoth")}
        </ChoiceButton>
        <ChoiceButton
          busy={busy}
          mine="defer"
          variant="ghost"
          onClick={onDefer}
        >
          {t("syncIssues.conflict.actions.defer")}
        </ChoiceButton>
      </div>
    </ConflictFrame>
  );
}

function VersionPanel({
  heading,
  when,
  fields,
  differing,
}: {
  heading: string;
  when: string | null;
  fields: Fields;
  differing: ReadonlySet<string>;
}) {
  const { t } = useTranslation("settings");
  const emoji = str(fields.day_emoji);
  const heading2 = str(fields.title);
  const text = str(fields.text_content);
  const placeNames = places(fields);
  const photoCount = photos(fields);
  const hearted = fields.is_bookmarked === true;
  const hasClip = Boolean(str(fields.video_path));
  const deleted = Boolean(str(fields.deleted_at));

  const marker = (...keys: string[]) =>
    keys.some((key) => differing.has(key)) ? (
      <span className="ml-1.5 rounded-full border border-border px-1.5 py-px font-sans text-[0.64rem] uppercase tracking-wide text-gold-text">
        {t("syncIssues.conflict.differs")}
      </span>
    ) : null;

  return (
    <section
      aria-label={heading}
      className="min-w-0 space-y-2 rounded-lg border border-border bg-background p-3"
    >
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{heading}</span>
        {" · "}
        {t("syncIssues.conflict.journal.changed", { when: formatWhen(when) })}
      </p>

      <p className="font-display text-lg leading-snug">
        {emoji ? <span aria-hidden>{emoji} </span> : null}
        {heading2 || (
          <span className="text-muted-foreground">
            {t("syncIssues.conflict.journal.untitled")}
          </span>
        )}
        {marker("title", "day_emoji")}
      </p>

      <p
        className={
          text
            ? "whitespace-pre-wrap font-display text-base leading-relaxed"
            : "font-display text-base italic leading-relaxed text-muted-foreground"
        }
      >
        {text || t("syncIssues.conflict.journal.noText")}
        {marker("text_content")}
      </p>

      <dl className="space-y-0.5 text-xs text-muted-foreground">
        <Row label={t("syncIssues.conflict.journal.fields.photo_paths")}>
          {t("syncIssues.conflict.journal.photoCount", { count: photoCount })}
          {marker("photo_paths")}
        </Row>
        <Row label={t("syncIssues.conflict.journal.fields.location")}>
          {placeNames.length > 0
            ? placeNames.join(", ")
            : t("syncIssues.conflict.journal.none")}
          {marker("location")}
        </Row>
        {hearted || differing.has("is_bookmarked") ? (
          <Row label={t("syncIssues.conflict.journal.fields.is_bookmarked")}>
            {hearted
              ? t("syncIssues.conflict.journal.yes")
              : t("syncIssues.conflict.journal.no")}
            {marker("is_bookmarked")}
          </Row>
        ) : null}
        {hasClip || differing.has("video_path") ? (
          <Row label={t("syncIssues.conflict.journal.fields.video_path")}>
            {hasClip
              ? t("syncIssues.conflict.journal.yes")
              : t("syncIssues.conflict.journal.none")}
            {marker("video_path", "video_thumbnail")}
          </Row>
        ) : null}
        {deleted || differing.has("deleted_at") ? (
          <Row label={t("syncIssues.conflict.journal.fields.deleted_at")}>
            {deleted
              ? t("syncIssues.conflict.journal.yes")
              : t("syncIssues.conflict.journal.no")}
            {marker("deleted_at")}
          </Row>
        ) : null}
      </dl>
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="font-medium">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
