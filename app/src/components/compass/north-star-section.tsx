import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  COMPASS_LIMITS,
  setNorthStar,
  archiveCompassItem,
} from "@/lib/compass/compass";
import type { CompassItem } from "@/lib/db/types";
import {
  FormDialog,
  FormDialogActions,
  FormStack,
  FormTextareaField,
} from "@/components/forms";
import { Button } from "@/components/ui/button";
import { CompassHeading } from "./compass-heading";
import { compassErrorCode } from "./compass-save";

export function NorthStarSection({
  northStar,
}: {
  northStar: CompassItem | null;
}) {
  const { t } = useTranslation("you");
  const [editing, setEditing] = useState(false);
  const [session, setSession] = useState(0);
  const openEditor = () => {
    setSession((value) => value + 1);
    setEditing(true);
  };

  return (
    <section aria-labelledby="compass-north-star">
      <CompassHeading id="compass-north-star" title={t("northStar.label")} />
      <div className="rounded-[1.5rem] bg-muted px-5 py-5">
        {northStar ? (
          <>
            <p className="font-display text-xl leading-snug tracking-tight">
              {t("northStar.quote", { text: northStar.text })}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={openEditor}
              >
                {t("northStar.edit")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-11"
                onClick={() => void archiveCompassItem(northStar.id)}
              >
                {t("northStar.setAside")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="font-display text-lg leading-snug text-muted-foreground">
              {t("northStar.empty")}
            </p>
            <Button type="button" className="mt-4 h-11" onClick={openEditor}>
              {t("northStar.write")}
            </Button>
          </>
        )}
      </div>
      <NorthStarDialog
        key={session}
        open={editing}
        initial={northStar?.text ?? ""}
        onOpenChange={setEditing}
      />
    </section>
  );
}

function NorthStarDialog({
  open,
  initial,
  onOpenChange,
}: {
  open: boolean;
  initial: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("you");
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("northStar.dialogTitle")}
      description={t("northStar.empty")}
      titleClassName="font-display text-2xl font-normal tracking-tight"
    >
      <FormStack>
        <FormTextareaField
          id="compass-north-star-text"
          label={t("northStar.field")}
          value={text}
          maxLength={COMPASS_LIMITS.north_star}
          placeholder={t("northStar.placeholder")}
          rows={3}
          onChange={(event) => {
            setText(event.target.value);
            setError(null);
          }}
          message={
            error
              ? t(`errors.${error}`, { defaultValue: t("errors.save") })
              : `${text.trim().length}/${COMPASS_LIMITS.north_star}`
          }
          messageClassName={error ? "text-destructive" : undefined}
          aria-invalid={error ? true : undefined}
        />
        <FormDialogActions
          confirmLabel={t("northStar.save")}
          confirmDisabled={pending || text.trim().length === 0}
          onConfirm={() => {
            setPending(true);
            void setNorthStar(text)
              .then(() => onOpenChange(false))
              .catch((caught) => setError(compassErrorCode(caught)))
              .finally(() => setPending(false));
          }}
        />
      </FormStack>
    </FormDialog>
  );
}
