import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  COMPASS_LIMITS,
  addKnowledge,
  archiveCompassItem,
  deleteCompassItem,
  editCompassItem,
} from "@/lib/compass/compass";
import type { CompassItem } from "@/lib/db/types";
import { getActiveLocaleTag } from "@/lib/i18n";
import {
  FormDialog,
  FormDialogActions,
  FormField,
  FormStack,
  FormTextareaField,
} from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CompassHeading } from "./compass-heading";
import { CompassRowActions } from "./compass-actions";
import { compassErrorCode } from "./compass-save";
import { useCompassDelete } from "./use-compass-delete";

function formatNotedOn(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(getActiveLocaleTag(), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function KnowledgeSection({ entries }: { entries: CompassItem[] }) {
  const { t } = useTranslation("you");
  const { ask, dialog } = useCompassDelete();
  const [editing, setEditing] = useState<CompassItem | null>(null);

  return (
    <section aria-labelledby="compass-knowledge">
      <CompassHeading
        id="compass-knowledge"
        title={t("knowledge.label")}
        aside={
          entries.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {t("knowledge.count", { count: entries.length })}
            </span>
          ) : null
        }
      />
      <TellMeSomething />
      {entries.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {t("knowledge.empty")}
        </p>
      ) : (
        <ol className="mt-4 space-y-4">
          {entries.map((entry, index) => (
            <li key={entry.id} className="relative pl-6">
              <span
                className="absolute left-0 top-1.5 size-2.5 rounded-full bg-green"
                aria-hidden
              />
              {index < entries.length - 1 ? (
                <span
                  className="absolute bottom-[-1.1rem] left-[4.5px] top-4 w-px bg-border"
                  aria-hidden
                />
              ) : null}
              <p className="text-xs text-muted-foreground">
                <time dateTime={entry.created_at}>
                  {formatNotedOn(entry.created_at)}
                </time>
              </p>
              {entry.question ? (
                <p className="mt-1 text-sm font-medium">{entry.question}</p>
              ) : null}
              <p className="mt-1 font-display text-base leading-relaxed">
                {t("knowledge.quote", { text: entry.text })}
              </p>
              <div className="mt-2">
                <CompassRowActions
                  editLabel={t("knowledge.edit")}
                  setAsideLabel={t("knowledge.setAside")}
                  deleteLabel={t("knowledge.delete")}
                  onEdit={() => setEditing(entry)}
                  onSetAside={() => void archiveCompassItem(entry.id)}
                  onDelete={() =>
                    ask(entry.text, () => deleteCompassItem(entry.id))
                  }
                />
              </div>
            </li>
          ))}
        </ol>
      )}
      {editing ? (
        <KnowledgeDialog
          key={editing.id}
          entry={editing}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      ) : null}
      {dialog}
    </section>
  );
}

function TellMeSomething() {
  const { t } = useTranslation("you");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-3 rounded-[1.25rem] bg-muted px-4 py-4"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        void addKnowledge(answer, question)
          .then(() => {
            setQuestion("");
            setAnswer("");
            setError(null);
          })
          .catch((caught) => setError(compassErrorCode(caught)))
          .finally(() => setPending(false));
      }}
    >
      <div>
        <p className="font-display text-lg leading-snug">
          {t("knowledge.promptTitle")}
        </p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {t("knowledge.promptHint")}
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="compass-knowledge-question" className="text-xs">
          {t("knowledge.questionLabel")}
        </Label>
        <Textarea
          id="compass-knowledge-question"
          value={question}
          rows={2}
          maxLength={COMPASS_LIMITS.question}
          placeholder={t("knowledge.questionPlaceholder")}
          onChange={(event) => setQuestion(event.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="compass-knowledge-answer" className="text-xs">
          {t("knowledge.answerLabel")}
        </Label>
        <Textarea
          id="compass-knowledge-answer"
          value={answer}
          rows={3}
          required
          maxLength={COMPASS_LIMITS.knowledge}
          placeholder={t("knowledge.answerPlaceholder")}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            setAnswer(event.target.value);
            setError(null);
          }}
        />
        <p
          className={
            error
              ? "text-xs text-destructive"
              : "text-right text-xs text-muted-foreground"
          }
          role={error ? "alert" : undefined}
        >
          {error
            ? t(`errors.${error}`, { defaultValue: t("errors.save") })
            : `${answer.trim().length}/${COMPASS_LIMITS.knowledge}`}
        </p>
      </div>
      <Button
        type="submit"
        className="h-11"
        disabled={pending || answer.trim().length === 0}
      >
        {t("knowledge.save")}
      </Button>
    </form>
  );
}

function KnowledgeDialog({
  entry,
  open,
  onOpenChange,
}: {
  entry: CompassItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("you");
  const [question, setQuestion] = useState(entry.question ?? "");
  const [answer, setAnswer] = useState(entry.text);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("knowledge.dialogEdit")}
      description={t("knowledge.promptHint")}
    >
      <FormStack>
        <FormField
          id="compass-knowledge-edit-question"
          label={t("knowledge.questionLabel")}
          value={question}
          maxLength={COMPASS_LIMITS.question}
          placeholder={t("knowledge.questionPlaceholder")}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <FormTextareaField
          id="compass-knowledge-edit-answer"
          label={t("knowledge.answerLabel")}
          value={answer}
          rows={4}
          maxLength={COMPASS_LIMITS.knowledge}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            setAnswer(event.target.value);
            setError(null);
          }}
          message={
            error
              ? t(`errors.${error}`, { defaultValue: t("errors.save") })
              : `${answer.trim().length}/${COMPASS_LIMITS.knowledge}`
          }
          messageClassName={error ? "text-destructive" : undefined}
        />
        <FormDialogActions
          confirmLabel={t("goals.save")}
          confirmDisabled={pending || answer.trim().length === 0}
          onConfirm={() => {
            setPending(true);
            void editCompassItem(entry.id, {
              text: answer,
              question,
            })
              .then(() => onOpenChange(false))
              .catch((caught) => setError(compassErrorCode(caught)))
              .finally(() => setPending(false));
          }}
        />
      </FormStack>
    </FormDialog>
  );
}
