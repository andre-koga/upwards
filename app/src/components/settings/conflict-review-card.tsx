import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import {
  ChoiceButton,
  ConflictFrame,
  type ConflictBusy,
} from "@/components/settings/conflict-card-parts";
import { formatWhen } from "@/components/settings/conflict-format";
import { JournalConflictCard } from "@/components/settings/journal-conflict-card";
import { ProjectionConflictCard } from "@/components/settings/projection-conflict-card";
import { db } from "@/lib/db";
import type { SyncIssue } from "@/lib/db/types";
import { rememberJournalJumpDate } from "@/lib/journal/archive";
import { requestJournalEdit } from "@/lib/journal/edit-request";
import type { ConflictChoice } from "@/lib/sync/field-diff";
import {
  deferJournalConflict,
  isJournalConflictPayload,
  refreshJournalConflictPayload,
  resolveJournalConflict,
  type JournalConflictPayload,
} from "@/lib/sync/journal-conflict-resolution";
import {
  deferProjectionConflict,
  isProjectionConflictPayload,
  refreshProjectionConflictPayload,
  resolveGenericProjectionConflictKeepLocal,
  resolveProjectionConflict,
  type ProjectionConflictPayload,
} from "@/lib/sync/projection-conflict-resolution";
import { deferSyncIssue, resolveSyncIssue } from "@/lib/sync/sync-issues-store";

interface ConflictReviewCardProps {
  issue: SyncIssue;
  onResolved: () => void;
}

interface Refreshed {
  issueId: string;
  journal: JournalConflictPayload | null;
  projection: ProjectionConflictPayload | null;
}

/**
 * One conflict on the Sync issues page, in the shape its kind calls for
 * (product-scope.md §2.10): a journal day is kept as mine, theirs or both; an
 * activity, group, memo or session is kept as one whole version or the other.
 * Anything with no usable payload falls back to a plain card that can keep this
 * device's version.
 */
export function ConflictReviewCard({
  issue,
  onResolved,
}: ConflictReviewCardProps) {
  const { t } = useTranslation("settings");
  const navigate = useNavigate();
  const [busy, setBusy] = useState<ConflictBusy>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshed, setRefreshed] = useState<Refreshed | null>(null);

  const storedJournal = isJournalConflictPayload(issue.payload)
    ? issue.payload
    : null;
  const storedProjection = isProjectionConflictPayload(issue.payload)
    ? issue.payload
    : null;

  // Show what is stored at once, then swap in the freshest this device can
  // read. State is set only when the read finishes, never in the effect body.
  useEffect(() => {
    let cancelled = false;
    if (storedJournal) {
      void refreshJournalConflictPayload(storedJournal).then((next) => {
        if (!cancelled) {
          setRefreshed({ issueId: issue.id, journal: next, projection: null });
        }
      });
    } else if (storedProjection) {
      void refreshProjectionConflictPayload(storedProjection).then((next) => {
        if (!cancelled) {
          setRefreshed({ issueId: issue.id, journal: null, projection: next });
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [issue.id, storedJournal, storedProjection]);

  const current = refreshed?.issueId === issue.id ? refreshed : null;
  const journalPayload = storedJournal
    ? (current?.journal ?? storedJournal)
    : null;
  const projectionPayload = storedProjection
    ? (current?.projection ?? storedProjection)
    : null;

  const run = async (
    working: ConflictBusy,
    action: () => Promise<void>
  ): Promise<void> => {
    setBusy(working);
    setError(null);
    try {
      await action();
    } catch (err) {
      console.error("Conflict resolution failed", err);
      setError(t("syncIssues.conflict.resolveFailed"));
    } finally {
      setBusy(null);
    }
  };

  const resolveJournal = (choice: ConflictChoice) =>
    run(choice, async () => {
      await resolveJournalConflict(issue, choice);
      onResolved();
      if (choice !== "keep_both" || !journalPayload) return;
      // The joined day is saved. Open it for editing, so it can be trimmed.
      const day = await db.journalEntries.get(journalPayload.entity_id);
      if (!day) return;
      requestJournalEdit(day);
      rememberJournalJumpDate(day.entry_date);
      navigate("/");
    });

  const resolveProjection = (choice: Exclude<ConflictChoice, "keep_both">) =>
    run(choice, async () => {
      await resolveProjectionConflict(issue, choice);
      onResolved();
    });

  const defer = () =>
    run("defer", async () => {
      if (journalPayload) {
        await deferJournalConflict({ ...issue, payload: journalPayload });
      } else if (projectionPayload) {
        await deferProjectionConflict({ ...issue, payload: projectionPayload });
      } else {
        await deferSyncIssue(issue.id);
      }
      onResolved();
    });

  if (journalPayload) {
    return (
      <JournalConflictCard
        issue={issue}
        payload={journalPayload}
        busy={busy}
        error={error}
        onResolve={(choice) => void resolveJournal(choice)}
        onDefer={() => void defer()}
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
        onResolve={(choice) => void resolveProjection(choice)}
        onDefer={() => void defer()}
      />
    );
  }

  return (
    <ConflictFrame
      title={
        <>
          <h3 className="text-sm font-medium">{issue.title}</h3>
          {issue.detail ? (
            <p className="text-sm text-muted-foreground">{issue.detail}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {formatWhen(issue.updated_at)}
          </p>
        </>
      }
    >
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <ChoiceButton
          busy={busy}
          mine="keep_local"
          onClick={() =>
            void run("keep_local", async () => {
              if (issue.entity_type) {
                await resolveGenericProjectionConflictKeepLocal(issue);
              } else {
                await resolveSyncIssue(issue.id);
              }
              onResolved();
            })
          }
        >
          {t("syncIssues.conflict.actions.keepThisDevice")}
        </ChoiceButton>
        <ChoiceButton
          busy={busy}
          mine="defer"
          variant="ghost"
          onClick={() => void defer()}
        >
          {t("syncIssues.conflict.actions.defer")}
        </ChoiceButton>
      </div>
    </ConflictFrame>
  );
}
