import { useTranslation } from "react-i18next";
import {
  ChoiceButton,
  ConflictFrame,
  type ConflictBusy,
} from "@/components/settings/conflict-card-parts";
import { formatWhen } from "@/components/settings/conflict-format";
import type { SyncIssue } from "@/lib/db/types";
import type { ConflictChoice } from "@/lib/sync/field-diff";
import {
  formatProjectionConflictFieldValue,
  type ProjectionConflictPayload,
} from "@/lib/sync/projection-conflict-resolution";

interface ProjectionConflictCardProps {
  issue: SyncIssue;
  payload: ProjectionConflictPayload;
  busy: ConflictBusy;
  error: string | null;
  onResolve: (choice: Exclude<ConflictChoice, "keep_both">) => void;
  onDefer: () => void;
}

/**
 * An activity, group, memo or session in conflict: both whole versions, with
 * the fields that differ listed, and one choice between them
 * (product-scope.md §2.10). There is no per-field picking: a conflict here is
 * rare and low-stakes, and choosing field by field would cost more than it
 * could save. The instrument register: a dense, ruled table.
 */
export function ProjectionConflictCard({
  issue,
  payload,
  busy,
  error,
  onResolve,
  onDefer,
}: ProjectionConflictCardProps) {
  const { t } = useTranslation("settings");
  const entity = t(
    `syncIssues.conflict.projection.entity.${payload.entity_type}`,
    { defaultValue: payload.entity_type.replace(/_/g, " ") }
  );
  const hasOther = payload.remote != null;
  const fields =
    payload.differing_fields.length > 0
      ? payload.differing_fields
      : Object.keys(payload.local.fields);

  return (
    <ConflictFrame
      title={
        <>
          <h3 className="text-sm font-medium">
            {payload.entity_label?.trim() || issue.title || entity}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("syncIssues.conflict.projection.summary", { entity })}
          </p>
          <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            {issue.status === "deferred" ? (
              <span>{t("syncIssues.conflict.deferredBadge")}</span>
            ) : null}
            <span>{formatWhen(issue.updated_at)}</span>
          </p>
        </>
      }
    >
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[20rem] text-left text-xs">
          <caption className="sr-only">
            {t("syncIssues.conflict.projection.tableCaption", { entity })}
          </caption>
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th scope="col" className="px-2 py-1.5 font-medium">
                {t("syncIssues.conflict.columns.field")}
              </th>
              <th scope="col" className="px-2 py-1.5 font-medium">
                {t("syncIssues.conflict.columns.yours")}
              </th>
              <th scope="col" className="px-2 py-1.5 font-medium">
                {t("syncIssues.conflict.columns.theirs")}
              </th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field} className="border-t border-border">
                <th scope="row" className="px-2 py-1.5 font-medium">
                  {t(`syncIssues.conflict.projection.fields.${field}`, {
                    defaultValue: field,
                  })}
                </th>
                <td className="whitespace-pre-wrap px-2 py-1.5 font-mono tabular-nums">
                  {formatProjectionConflictFieldValue(
                    field,
                    payload.local.fields[field]
                  )}
                </td>
                <td className="whitespace-pre-wrap px-2 py-1.5 font-mono tabular-nums">
                  {payload.remote
                    ? formatProjectionConflictFieldValue(
                        field,
                        payload.remote.fields[field]
                      )
                    : t("syncIssues.conflict.unknownRemote")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("syncIssues.conflict.projection.consequence")}
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
          {t("syncIssues.conflict.actions.keepThisDevice")}
        </ChoiceButton>
        <ChoiceButton
          busy={busy}
          mine="keep_remote"
          disabled={!hasOther}
          onClick={() => onResolve("keep_remote")}
        >
          {t("syncIssues.conflict.actions.keepTheOther")}
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
