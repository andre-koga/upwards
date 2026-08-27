import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { GitMerge, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SyncIssue } from "@/lib/db/types";
import { db } from "@/lib/db";
import type { ConflictResolutionChoice } from "@/lib/sync/field-diff";
import {
  deferJournalConflict,
  formatJournalConflictFieldValue,
  isJournalConflictPayload,
  refreshJournalConflictPayload,
  resolveJournalConflict,
  type JournalConflictPayload,
} from "@/lib/sync/journal-conflict-resolution";
import {
  deferProjectionConflict,
  formatProjectionConflictFieldValue,
  isProjectionConflictPayload,
  refreshProjectionConflictPayload,
  resolveProjectionConflict,
  resolveGenericProjectionConflictKeepLocal,
  type ProjectionConflictPayload,
} from "@/lib/sync/projection-conflict-resolution";
import {
  deferDailyEntryCountReconciliation,
  isDailyEntryCountReconciliationPayload,
  resolveDailyEntryCountReconciliation,
  type DailyEntryCountReconciliationPayload,
} from "@/lib/sync/daily-entry-reconciliation";
import { deferSyncIssue, resolveSyncIssue } from "@/lib/sync/sync-issues-store";
import { cn } from "@/lib/utils";

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function fieldLabel(
  field: string,
  t: (key: string, options?: Record<string, unknown>) => string,
  namespace: "journal" | "projection"
): string {
  const prefix =
    namespace === "journal"
      ? "syncIssues.conflict.journal.fields"
      : "syncIssues.conflict.projection.fields";
  return t(`${prefix}.${field}`, {
    defaultValue: field,
  });
}

function projectionEntityLabel(
  entityType: string,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  return t(`syncIssues.conflict.projection.entity.${entityType}`, {
    defaultValue: entityType.replace(/_/g, " "),
  });
}

interface ConflictReviewCardProps {
  issue: SyncIssue;
  onResolved: () => void;
}

export function ConflictReviewCard({
  issue,
  onResolved,
}: ConflictReviewCardProps) {
  const { t } = useTranslation("settings");
  const [busy, setBusy] = useState<
    ConflictResolutionChoice | "defer" | "use_suggested" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [journalPayload, setJournalPayload] =
    useState<JournalConflictPayload | null>(() =>
      isJournalConflictPayload(issue.payload) ? issue.payload : null
    );
  const [projectionPayload, setProjectionPayload] =
    useState<ProjectionConflictPayload | null>(() =>
      isProjectionConflictPayload(issue.payload) ? issue.payload : null
    );
  const [dailyCountPayload, setDailyCountPayload] =
    useState<DailyEntryCountReconciliationPayload | null>(() =>
      isDailyEntryCountReconciliationPayload(issue.payload)
        ? issue.payload
        : null
    );

  useEffect(() => {
    if (isJournalConflictPayload(issue.payload)) {
      setProjectionPayload(null);
      setDailyCountPayload(null);
      let cancelled = false;
      const initial = issue.payload;
      setJournalPayload(initial);
      void refreshJournalConflictPayload(initial).then((next) => {
        if (!cancelled) setJournalPayload(next);
      });
      return () => {
        cancelled = true;
      };
    }

    if (isProjectionConflictPayload(issue.payload)) {
      setJournalPayload(null);
      setDailyCountPayload(null);
      let cancelled = false;
      const initial = issue.payload;
      setProjectionPayload(initial);
      void refreshProjectionConflictPayload(initial).then((next) => {
        if (!cancelled) setProjectionPayload(next);
      });
      return () => {
        cancelled = true;
      };
    }

    if (isDailyEntryCountReconciliationPayload(issue.payload)) {
      setJournalPayload(null);
      setProjectionPayload(null);
      setDailyCountPayload(issue.payload);
      return;
    }

    setJournalPayload(null);
    setProjectionPayload(null);
    setDailyCountPayload(null);
  }, [issue]);

  const handleResolveJournal = async (choice: ConflictResolutionChoice) => {
    setBusy(choice);
    setError(null);
    try {
      await resolveJournalConflict(issue, choice);
      onResolved();
    } catch (err) {
      console.error("Journal conflict resolution failed", err);
      setError(t("syncIssues.conflict.resolveFailed"));
    } finally {
      setBusy(null);
    }
  };

  const handleResolveProjection = async (choice: ConflictResolutionChoice) => {
    setBusy(choice);
    setError(null);
    try {
      await resolveProjectionConflict(issue, choice);
      onResolved();
    } catch (err) {
      console.error("Projection conflict resolution failed", err);
      setError(t("syncIssues.conflict.resolveFailed"));
    } finally {
      setBusy(null);
    }
  };

  const handleResolveDailyCounts = async (
    choice: "keep_local" | "keep_remote" | "use_suggested"
  ) => {
    setBusy(choice);
    setError(null);
    try {
      await resolveDailyEntryCountReconciliation(issue, choice);
      onResolved();
    } catch (err) {
      console.error("Daily count reconciliation failed", err);
      setError(t("syncIssues.conflict.resolveFailed"));
    } finally {
      setBusy(null);
    }
  };

  const handleDefer = async () => {
    setBusy("defer");
    setError(null);
    try {
      if (journalPayload) {
        await deferJournalConflict({ ...issue, payload: journalPayload });
      } else if (projectionPayload) {
        await deferProjectionConflict({ ...issue, payload: projectionPayload });
      } else if (dailyCountPayload) {
        await deferDailyEntryCountReconciliation(issue);
      } else {
        await deferSyncIssue(issue.id);
      }
      onResolved();
    } catch (err) {
      console.error("Conflict defer failed", err);
      setError(t("syncIssues.conflict.resolveFailed"));
    } finally {
      setBusy(null);
    }
  };

  const handleKeepMineGeneric = async () => {
    setBusy("keep_local");
    setError(null);
    try {
      if (projectionPayload || issue.entity_type) {
        await resolveGenericProjectionConflictKeepLocal(issue);
      } else {
        await resolveSyncIssue(issue.id);
      }
      onResolved();
    } catch (err) {
      console.error("Conflict resolution failed", err);
      setError(t("syncIssues.conflict.resolveFailed"));
    } finally {
      setBusy(null);
    }
  };

  if (dailyCountPayload) {
    return (
      <DailyEntryCountReconciliationCard
        issue={issue}
        payload={dailyCountPayload}
        busy={busy}
        error={error}
        onResolve={(choice) => void handleResolveDailyCounts(choice)}
        onDefer={() => void handleDefer()}
      />
    );
  }

  if (journalPayload) {
    return (
      <JournalConflictCard
        issue={issue}
        payload={journalPayload}
        busy={busy}
        error={error}
        onResolve={(choice) => void handleResolveJournal(choice)}
        onDefer={() => void handleDefer()}
      />
    );
  }

  if (projectionPayload) {
    return (
      <ProjectionConflictCard
        issue={issue}
        payload={projectionPayload}
        busy={busy}
        error={error}
        onResolve={(choice) => void handleResolveProjection(choice)}
        onDefer={() => void handleDefer()}
      />
    );
  }

  return (
    <GenericConflictCard
      issue={issue}
      busy={busy}
      error={error}
      onKeepMine={() => void handleKeepMineGeneric()}
      onDefer={() => void handleDefer()}
    />
  );
}

function GenericConflictCard({
  issue,
  busy,
  error,
  onKeepMine,
  onDefer,
}: {
  issue: SyncIssue;
  busy: string | null;
  error: string | null;
  onKeepMine: () => void;
  onDefer: () => void;
}) {
  const { t } = useTranslation("settings");
  return (
    <div className="space-y-3 rounded-lg border border-amber-500/40 bg-background p-3">
      <div className="flex items-start gap-2">
        <GitMerge className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{issue.title}</p>
          {issue.detail ? (
            <p className="mt-1 text-sm text-muted-foreground">{issue.detail}</p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            {formatWhen(issue.updated_at)}
          </p>
        </div>
      </div>
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={busy != null}
          onClick={onKeepMine}
        >
          {busy === "keep_local" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
          {t("syncIssues.conflict.actions.keepMine")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy != null}
          onClick={onDefer}
        >
          {t("syncIssues.conflict.actions.defer")}
        </Button>
      </div>
    </div>
  );
}

function JournalConflictCard({
  issue,
  payload,
  busy,
  error,
  onResolve,
  onDefer,
}: {
  issue: SyncIssue;
  payload: JournalConflictPayload;
  busy: string | null;
  error: string | null;
  onResolve: (choice: ConflictResolutionChoice) => void;
  onDefer: () => void;
}) {
  const { t } = useTranslation("settings");
  const title =
    payload.entity_label?.trim() ||
    (payload.entry_date
      ? t("syncIssues.conflict.journal.untitledWithDate", {
          date: payload.entry_date,
        })
      : issue.title) ||
    t("syncIssues.conflict.journal.untitled");
  const fieldsToShow =
    payload.differing_fields.length > 0
      ? payload.differing_fields
      : Object.keys(payload.local.fields);
  const canCombine =
    payload.remote != null && payload.both_changed_fields.length === 0;
  const hasBothChanged = payload.both_changed_fields.length > 0;
  const isDeferred = issue.status === "deferred";

  return (
    <div className="space-y-3 rounded-lg border border-amber-500/40 bg-background p-3">
      <div className="flex items-start gap-2">
        <GitMerge className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">
            {t("syncIssues.conflict.journal.summary")}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {payload.entry_date ? (
              <span>
                {t("syncIssues.conflict.journal.entryDate", {
                  date: payload.entry_date,
                })}
              </span>
            ) : null}
            {isDeferred ? (
              <span>{t("syncIssues.conflict.deferredBadge")}</span>
            ) : null}
            <span>{formatWhen(issue.updated_at)}</span>
          </div>
          {hasBothChanged ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t("syncIssues.conflict.bothChangedHint")}
            </p>
          ) : canCombine ? (
            <p className="text-xs text-muted-foreground">
              {t("syncIssues.conflict.combinableHint")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[20rem] text-left text-xs">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 font-medium">
                {t("syncIssues.conflict.columns.field")}
              </th>
              <th className="px-2 py-1.5 font-medium">
                {t("syncIssues.conflict.columns.yours")}
              </th>
              <th className="px-2 py-1.5 font-medium">
                {t("syncIssues.conflict.columns.theirs")}
              </th>
            </tr>
          </thead>
          <tbody>
            {fieldsToShow.map((field) => {
              const isHot = payload.both_changed_fields.includes(field);
              return (
                <tr
                  key={field}
                  className={cn(
                    "border-t border-border",
                    isHot && "bg-amber-500/10"
                  )}
                >
                  <td className="px-2 py-1.5 font-medium">
                    {fieldLabel(field, t, "journal")}
                  </td>
                  <td className="px-2 py-1.5 whitespace-pre-wrap">
                    {formatJournalConflictFieldValue(
                      field,
                      payload.local.fields[field]
                    )}
                  </td>
                  <td className="px-2 py-1.5 whitespace-pre-wrap">
                    {payload.remote
                      ? formatJournalConflictFieldValue(
                          field,
                          payload.remote.fields[field]
                        )
                      : t("syncIssues.conflict.unknownRemote")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("syncIssues.conflict.journal.consequence")}
      </p>

      {error ? <p className="text-xs text-red-500">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="default"
          size="sm"
          disabled={busy != null}
          onClick={() => onResolve("keep_local")}
        >
          {busy === "keep_local" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
          {t("syncIssues.conflict.actions.keepMine")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy != null || !payload.remote}
          onClick={() => onResolve("keep_remote")}
        >
          {busy === "keep_remote" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
          {t("syncIssues.conflict.actions.keepTheirs")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy != null || !payload.remote}
          onClick={() => onResolve("combine")}
          title={
            hasBothChanged
              ? t("syncIssues.conflict.combineWithPreferenceHint")
              : undefined
          }
        >
          {busy === "combine" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
          {t("syncIssues.conflict.actions.combine")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy != null}
          onClick={onDefer}
        >
          {t("syncIssues.conflict.actions.defer")}
        </Button>
      </div>
    </div>
  );
}

function ProjectionConflictCard({
  issue,
  payload,
  busy,
  error,
  onResolve,
  onDefer,
}: {
  issue: SyncIssue;
  payload: ProjectionConflictPayload;
  busy: string | null;
  error: string | null;
  onResolve: (choice: ConflictResolutionChoice) => void;
  onDefer: () => void;
}) {
  const { t } = useTranslation("settings");
  const entityKind = projectionEntityLabel(payload.entity_type, t);
  const title = payload.entity_label?.trim() || issue.title || entityKind;
  const fieldsToShow =
    payload.differing_fields.length > 0
      ? payload.differing_fields
      : Object.keys(payload.local.fields);
  const canCombine =
    payload.remote != null && payload.both_changed_fields.length === 0;
  const hasBothChanged = payload.both_changed_fields.length > 0;
  const isDeferred = issue.status === "deferred";

  return (
    <div className="space-y-3 rounded-lg border border-amber-500/40 bg-background p-3">
      <div className="flex items-start gap-2">
        <GitMerge className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">
            {t("syncIssues.conflict.projection.summary", { entity: entityKind })}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {isDeferred ? (
              <span>{t("syncIssues.conflict.deferredBadge")}</span>
            ) : null}
            <span>{formatWhen(issue.updated_at)}</span>
          </div>
          {hasBothChanged ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t("syncIssues.conflict.bothChangedHint")}
            </p>
          ) : canCombine ? (
            <p className="text-xs text-muted-foreground">
              {t("syncIssues.conflict.combinableHint")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[20rem] text-left text-xs">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 font-medium">
                {t("syncIssues.conflict.columns.field")}
              </th>
              <th className="px-2 py-1.5 font-medium">
                {t("syncIssues.conflict.columns.yours")}
              </th>
              <th className="px-2 py-1.5 font-medium">
                {t("syncIssues.conflict.columns.theirs")}
              </th>
            </tr>
          </thead>
          <tbody>
            {fieldsToShow.map((field) => {
              const isHot = payload.both_changed_fields.includes(field);
              return (
                <tr
                  key={field}
                  className={cn(
                    "border-t border-border",
                    isHot && "bg-amber-500/10"
                  )}
                >
                  <td className="px-2 py-1.5 font-medium">
                    {fieldLabel(field, t, "projection")}
                  </td>
                  <td className="px-2 py-1.5 whitespace-pre-wrap">
                    {formatProjectionConflictFieldValue(
                      field,
                      payload.local.fields[field]
                    )}
                  </td>
                  <td className="px-2 py-1.5 whitespace-pre-wrap">
                    {payload.remote
                      ? formatProjectionConflictFieldValue(
                          field,
                          payload.remote.fields[field]
                        )
                      : t("syncIssues.conflict.unknownRemote")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("syncIssues.conflict.projection.consequence")}
      </p>

      {error ? <p className="text-xs text-red-500">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="default"
          size="sm"
          disabled={busy != null}
          onClick={() => onResolve("keep_local")}
        >
          {busy === "keep_local" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
          {t("syncIssues.conflict.actions.keepMine")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy != null || !payload.remote}
          onClick={() => onResolve("keep_remote")}
        >
          {busy === "keep_remote" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
          {t("syncIssues.conflict.actions.keepTheirs")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy != null || !payload.remote}
          onClick={() => onResolve("combine")}
          title={
            hasBothChanged
              ? t("syncIssues.conflict.combineWithPreferenceHint")
              : undefined
          }
        >
          {busy === "combine" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
          {t("syncIssues.conflict.actions.combine")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy != null}
          onClick={onDefer}
        >
          {t("syncIssues.conflict.actions.defer")}
        </Button>
      </div>
    </div>
  );
}

function DailyEntryCountReconciliationCard({
  issue,
  payload,
  busy,
  error,
  onResolve,
  onDefer,
}: {
  issue: SyncIssue;
  payload: DailyEntryCountReconciliationPayload;
  busy: string | null;
  error: string | null;
  onResolve: (choice: "keep_local" | "keep_remote" | "use_suggested") => void;
  onDefer: () => void;
}) {
  const { t } = useTranslation("settings");
  const [activityNames, setActivityNames] = useState<Record<string, string>>(
    {}
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ids = payload.differing_activities;
      const entries = await Promise.all(
        ids.map(async (id) => {
          const activity = await db.activities.get(id);
          return [id, activity?.name?.trim() || id] as const;
        })
      );
      if (!cancelled) {
        setActivityNames(Object.fromEntries(entries));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [payload.differing_activities]);

  const isDeferred = issue.status === "deferred";

  return (
    <div className="space-y-3 rounded-lg border border-amber-500/40 bg-background p-3">
      <div className="flex items-start gap-2">
        <GitMerge className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">{issue.title}</p>
          <p className="text-sm text-muted-foreground">
            {t("syncIssues.conflict.dailyCounts.summary", {
              date: payload.date,
            })}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {isDeferred ? (
              <span>{t("syncIssues.conflict.deferredBadge")}</span>
            ) : null}
            <span>{formatWhen(issue.updated_at)}</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[20rem] text-left text-xs">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 font-medium">
                {t("syncIssues.conflict.dailyCounts.columns.habit")}
              </th>
              <th className="px-2 py-1.5 font-medium">
                {t("syncIssues.conflict.columns.yours")}
              </th>
              <th className="px-2 py-1.5 font-medium">
                {t("syncIssues.conflict.columns.theirs")}
              </th>
              <th className="px-2 py-1.5 font-medium">
                {t("syncIssues.conflict.dailyCounts.columns.suggested")}
              </th>
            </tr>
          </thead>
          <tbody>
            {payload.differing_activities.map((activityId) => (
              <tr key={activityId} className="border-t border-border">
                <td className="px-2 py-1.5 font-medium">
                  {activityNames[activityId] ?? activityId}
                </td>
                <td className="px-2 py-1.5">
                  {payload.local_counts[activityId] ?? 0}
                </td>
                <td className="px-2 py-1.5">
                  {payload.remote_counts[activityId] ?? 0}
                </td>
                <td className="px-2 py-1.5">
                  {payload.suggested_counts[activityId] ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("syncIssues.conflict.dailyCounts.consequence")}
      </p>

      {error ? <p className="text-xs text-red-500">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="default"
          size="sm"
          disabled={busy != null}
          onClick={() => onResolve("keep_local")}
        >
          {busy === "keep_local" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
          {t("syncIssues.conflict.actions.keepMine")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy != null}
          onClick={() => onResolve("keep_remote")}
        >
          {busy === "keep_remote" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
          {t("syncIssues.conflict.actions.keepTheirs")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy != null}
          onClick={() => onResolve("use_suggested")}
        >
          {busy === "use_suggested" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
          {t("syncIssues.conflict.dailyCounts.useSuggested")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy != null}
          onClick={onDefer}
        >
          {t("syncIssues.conflict.actions.defer")}
        </Button>
      </div>
    </div>
  );
}
