import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  COMPASS_LIMITS,
  addGoal,
  archiveCompassItem,
  deleteCompassItem,
  editCompassItem,
} from "@/lib/compass/compass";
import type { CompassItem } from "@/lib/db/types";
import {
  goalEvidence,
  type EvidenceActivity,
  type EvidenceGroup,
  type EvidenceLine,
  type EvidenceWeek,
  type GoalEvidence,
} from "@/lib/compass/goal-evidence";
import {
  FormDialog,
  FormDialogActions,
  FormField,
  FormSelectField,
  FormStack,
} from "@/components/forms";
import { Button } from "@/components/ui/button";
import { CompassHeading } from "./compass-heading";
import { CompassRowActions } from "./compass-actions";
import { compassErrorCode } from "./compass-save";
import { useCompassDelete } from "./use-compass-delete";

function encodeLink(activityId: string | null, groupId: string | null) {
  if (activityId) return `activity:${activityId}`;
  if (groupId) return `group:${groupId}`;
  return "none";
}

function decodeLink(value: string) {
  if (value.startsWith("activity:")) {
    return { activityId: value.slice("activity:".length), groupId: null };
  }
  if (value.startsWith("group:")) {
    return { activityId: null, groupId: value.slice("group:".length) };
  }
  return { activityId: null, groupId: null };
}

function shownEvidence(
  goal: CompassItem,
  activities: readonly EvidenceActivity[],
  groups: readonly EvidenceGroup[],
  weeks: readonly EvidenceWeek[] | null
): GoalEvidence | null {
  if (!goal.activity_id && !goal.group_id) return null;
  const evidence = goalEvidence(goal, activities, groups, weeks ?? []);
  if (weeks !== null) return evidence;
  if (evidence.kind === "archived" || evidence.kind === "missing") {
    return evidence;
  }
  const activity = activities.find((item) => item.id === goal.activity_id);
  if (activity?.avoid) return evidence;
  return null;
}

export function GoalsSection({
  goals,
  activities,
  groups,
  weeks,
}: {
  goals: CompassItem[];
  activities: EvidenceActivity[];
  groups: EvidenceGroup[];
  weeks: EvidenceWeek[] | null;
}) {
  const { t } = useTranslation("you");
  const { ask, dialog } = useCompassDelete();
  const [editor, setEditor] = useState<CompassItem | "new" | null>(null);

  return (
    <section aria-labelledby="compass-goals">
      <CompassHeading
        id="compass-goals"
        title={t("goals.label")}
        aside={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 px-3"
            onClick={() => setEditor("new")}
          >
            {t("goals.add")}
          </Button>
        }
      />
      {goals.length === 0 ? (
        <p className="text-sm leading-6 text-muted-foreground">
          {t("goals.empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {goals.map((goal) => (
            <li key={goal.id} className="rounded-[1.25rem] bg-muted px-4 py-4">
              <p className="font-display text-lg leading-snug">{goal.text}</p>
              <GoalEvidenceText
                evidence={shownEvidence(goal, activities, groups, weeks)}
              />
              <div className="mt-3">
                <CompassRowActions
                  editLabel={t("goals.edit", { name: goal.text })}
                  setAsideLabel={t("goals.setAside", { name: goal.text })}
                  deleteLabel={t("goals.delete", { name: goal.text })}
                  onEdit={() => setEditor(goal)}
                  onSetAside={() => void archiveCompassItem(goal.id)}
                  onDelete={() =>
                    ask(goal.text, () => deleteCompassItem(goal.id))
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {editor ? (
        <GoalDialog
          key={editor === "new" ? "new" : editor.id}
          goal={editor === "new" ? null : editor}
          activities={activities}
          groups={groups}
          open
          onOpenChange={(open) => {
            if (!open) setEditor(null);
          }}
        />
      ) : null}
      {dialog}
    </section>
  );
}

function GoalEvidenceText({ evidence }: { evidence: GoalEvidence | null }) {
  const { t } = useTranslation("you");
  if (!evidence || evidence.kind === "unlinked") return null;

  if (evidence.kind === "archived") {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        {evidence.subject === "habit"
          ? t("goals.archivedHabit")
          : t("goals.archivedGroup")}
      </p>
    );
  }
  if (evidence.kind === "missing") {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        {evidence.subject === "habit"
          ? t("goals.missingHabit")
          : t("goals.missingGroup")}
      </p>
    );
  }
  if (evidence.kind === "uncounted") {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        {t("goals.uncounted", { name: evidence.name })}
      </p>
    );
  }

  return (
    <ul className="mt-3 space-y-1 border-t border-border pt-3">
      {evidence.lines.map((line) => (
        <li
          key={`${line.name}-${line.measure}`}
          className="font-mono text-xs tabular-nums text-muted-foreground"
        >
          {lineSentence(t, line)}
        </li>
      ))}
    </ul>
  );
}

function lineSentence(t: TFunction, line: EvidenceLine) {
  const name = line.name || "—";
  if (line.daysActive <= 0) {
    return t("goals.evidenceQuiet", { name });
  }
  return t(
    line.measure === "tracked" ? "goals.evidenceTracked" : "goals.evidenceDone",
    { name, done: line.daysDone, active: line.daysActive }
  );
}

function GoalDialog({
  goal,
  activities,
  groups,
  open,
  onOpenChange,
}: {
  goal: CompassItem | null;
  activities: EvidenceActivity[];
  groups: EvidenceGroup[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("you");
  const [text, setText] = useState(goal?.text ?? "");
  const [link, setLink] = useState(
    encodeLink(goal?.activity_id ?? null, goal?.group_id ?? null)
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const options = linkOptions(t, activities, groups, link);

  const save = () => {
    setPending(true);
    const nextLink = decodeLink(link);
    const write = goal
      ? editCompassItem(goal.id, { text, link: nextLink })
      : addGoal(text, nextLink);
    void write
      .then(() => onOpenChange(false))
      .catch((caught) => setError(compassErrorCode(caught)))
      .finally(() => setPending(false));
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={goal ? t("goals.dialogEdit") : t("goals.dialogNew")}
      description={t("goals.linkHint")}
    >
      <FormStack>
        <FormField
          id="compass-goal-text"
          label={t("goals.textLabel")}
          value={text}
          maxLength={COMPASS_LIMITS.goal}
          placeholder={t("goals.textPlaceholder")}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            setText(event.target.value);
            setError(null);
          }}
          message={
            error
              ? t(`errors.${error}`, { defaultValue: t("errors.save") })
              : `${text.trim().length}/${COMPASS_LIMITS.goal}`
          }
          messageClassName={error ? "text-destructive" : undefined}
        />
        <FormSelectField
          id="compass-goal-link"
          label={t("goals.linkLabel")}
          value={
            options.some((option) => option.value === link) ? link : "none"
          }
          onValueChange={setLink}
          options={options}
        />
        <FormDialogActions
          confirmLabel={t("goals.save")}
          confirmDisabled={pending || text.trim().length === 0}
          onConfirm={save}
        />
      </FormStack>
    </FormDialog>
  );
}

function linkOptions(
  t: TFunction,
  activities: readonly EvidenceActivity[],
  groups: readonly EvidenceGroup[],
  current: string
) {
  const byName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name);
  const options = [
    { value: "none", label: t("goals.linkNone") },
    ...groups
      .filter((group) => group.name && !group.archived && !group.deleted)
      .sort(byName)
      .map((group) => ({
        value: `group:${group.id}`,
        label: t("goals.groupOption", { name: group.name }),
      })),
    ...activities
      .filter(
        (activity) => activity.name && !activity.archived && !activity.deleted
      )
      .sort(byName)
      .map((activity) => ({
        value: `activity:${activity.id}`,
        label: t("goals.habitOption", { name: activity.name }),
      })),
  ];
  if (
    current !== "none" &&
    !options.some((option) => option.value === current)
  ) {
    const decoded = decodeLink(current);
    const name =
      activities.find((activity) => activity.id === decoded.activityId)?.name ||
      groups.find((group) => group.id === decoded.groupId)?.name ||
      current;
    options.push({ value: current, label: name });
  }
  return options;
}
