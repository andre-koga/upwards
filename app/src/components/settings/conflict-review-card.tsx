import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { GitMerge, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SyncIssue } from "@/lib/db/types";
import { formatRoutineDisplay } from "@/lib/activity/utils";
import { getEffectiveToday } from "@/lib/session/day-reset";
import {
  deferDefinitionConflict,
  formatConflictFieldValue,
  isDefinitionConflictPayload,
  refreshDefinitionConflictPayload,
  resolveDefinitionConflict,
  type ConflictResolutionChoice,
  type DefinitionConflictPayload,
} from "@/lib/sync/conflict-resolution";
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

function displayFieldValue(field: string, value: unknown): string {
  if (field === "routine" && typeof value === "string") {
    try {
      return formatRoutineDisplay(value);
    } catch {
      return value;
    }
  }
  return formatConflictFieldValue(value);
}

function fieldLabel(
  field: string,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  return t(`syncIssues.conflict.fields.${field}`, {
    defaultValue: field,
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
  const [busy, setBusy] = useState<ConflictResolutionChoice | "defer" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState(getEffectiveToday);
  const [payload, setPayload] = useState<DefinitionConflictPayload | null>(
    () => (isDefinitionConflictPayload(issue.payload) ? issue.payload : null)
  );

  useEffect(() => {
    if (!isDefinitionConflictPayload(issue.payload)) {
      setPayload(null);
      return;
    }
    let cancelled = false;
    const initial = issue.payload;
    setPayload(initial);
    void refreshDefinitionConflictPayload(initial).then((next) => {
      if (!cancelled) setPayload(next);
    });
    return () => {
      cancelled = true;
    };
  }, [issue]);

  const handleResolve = async (choice: ConflictResolutionChoice) => {
    setBusy(choice);
    setError(null);
    try {
      await resolveDefinitionConflict(issue, choice, {
        effectiveFrom: effectiveFrom || getEffectiveToday(),
      });
      onResolved();
    } catch (err) {
      console.error("Conflict resolution failed", err);
      setError(t("syncIssues.conflict.resolveFailed"));
    } finally {
      setBusy(null);
    }
  };

  const handleDefer = async () => {
    setBusy("defer");
    setError(null);
    try {
      if (payload) {
        await deferDefinitionConflict({ ...issue, payload });
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
      await resolveSyncIssue(issue.id);
      onResolved();
    } catch (err) {
      console.error("Conflict dismiss failed", err);
      setError(t("syncIssues.conflict.resolveFailed"));
    } finally {
      setBusy(null);
    }
  };

  if (!payload) {
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

  return (
    <DefinitionConflictCard
      issue={issue}
      payload={payload}
      busy={busy}
      error={error}
      effectiveFrom={effectiveFrom}
      onEffectiveFromChange={setEffectiveFrom}
      onResolve={(choice) => void handleResolve(choice)}
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

function DefinitionConflictCard({
  issue,
  payload,
  busy,
  error,
  effectiveFrom,
  onEffectiveFromChange,
  onResolve,
  onDefer,
}: {
  issue: SyncIssue;
  payload: DefinitionConflictPayload;
  busy: string | null;
  error: string | null;
  effectiveFrom: string;
  onEffectiveFromChange: (value: string) => void;
  onResolve: (choice: ConflictResolutionChoice) => void;
  onDefer: () => void;
}) {
  const { t } = useTranslation("settings");
  const entityKind =
    payload.entity_type === "group_definition"
      ? t("syncIssues.conflict.entity.group")
      : t("syncIssues.conflict.entity.activity");
  const title =
    payload.entity_label?.trim() ||
    issue.title ||
    t("syncIssues.conflict.untitled");
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
            {t("syncIssues.conflict.summary", { entity: entityKind })}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {payload.local.effective_from ? (
              <span>
                {t("syncIssues.conflict.effectiveFrom", {
                  date: payload.local.effective_from,
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
              {payload.base ? (
                <th className="px-2 py-1.5 font-medium">
                  {t("syncIssues.conflict.columns.base")}
                </th>
              ) : null}
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
                    {fieldLabel(field, t)}
                  </td>
                  <td className="px-2 py-1.5">
                    {displayFieldValue(field, payload.local.fields[field])}
                  </td>
                  <td className="px-2 py-1.5">
                    {payload.remote
                      ? displayFieldValue(field, payload.remote.fields[field])
                      : t("syncIssues.conflict.unknownRemote")}
                  </td>
                  {payload.base ? (
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {displayFieldValue(field, payload.base.fields[field])}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("syncIssues.conflict.consequence")}
      </p>

      <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{t("syncIssues.conflict.applyFromLabel")}</span>
        <input
          type="date"
          className="rounded-md border border-border bg-background px-2 py-1 text-foreground"
          value={effectiveFrom}
          onChange={(event) => onEffectiveFromChange(event.target.value)}
          disabled={busy != null}
        />
      </label>

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
