import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function CompassErrorText({ code }: { code: string | null }) {
  const { t } = useTranslation("you");
  if (!code) return null;
  return (
    <p role="alert" className="text-xs text-destructive">
      {t(`errors.${code}`, { defaultValue: t("errors.save") })}
    </p>
  );
}

const ROW_BUTTON = "h-11 px-3 sm:h-8";

export function CompassRowActions({
  editLabel,
  setAsideLabel,
  deleteLabel,
  onEdit,
  onSetAside,
  onDelete,
}: {
  editLabel: string;
  setAsideLabel: string;
  deleteLabel: string;
  onEdit?: () => void;
  onSetAside: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("you");
  return (
    <div className="flex flex-wrap gap-1">
      {onEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={ROW_BUTTON}
          aria-label={editLabel}
          onClick={onEdit}
        >
          {t("actions.edit")}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={ROW_BUTTON}
        aria-label={setAsideLabel}
        onClick={onSetAside}
      >
        {t("actions.setAside")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={ROW_BUTTON}
        aria-label={deleteLabel}
        onClick={onDelete}
      >
        {t("actions.delete")}
      </Button>
    </div>
  );
}
