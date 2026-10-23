import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import {
  COMPASS_LIMITS,
  addIdentityWord,
  archiveCompassItem,
} from "@/lib/compass/compass";
import type { CompassItem } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CompassHeading } from "./compass-heading";
import { CompassErrorText } from "./compass-actions";
import { compassErrorCode } from "./compass-save";

export function IdentitySection({ words }: { words: CompassItem[] }) {
  const { t } = useTranslation("you");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = () => {
    setPending(true);
    void addIdentityWord(draft)
      .then(() => {
        setDraft("");
        setError(null);
      })
      .catch((caught) => setError(compassErrorCode(caught)))
      .finally(() => setPending(false));
  };

  return (
    <section aria-labelledby="compass-identity">
      <CompassHeading id="compass-identity" title={t("identity.label")} />
      {words.length === 0 ? (
        <p className="mb-3 text-sm leading-6 text-muted-foreground">
          {t("identity.empty")}
        </p>
      ) : (
        <ul className="mb-3 flex flex-wrap gap-2">
          {words.map((word) => (
            <li key={word.id}>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full px-4"
                aria-label={t("identity.remove", { word: word.text })}
                onClick={() => void archiveCompassItem(word.id)}
              >
                {word.text}
                <X className="size-3.5" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-start"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor="compass-identity-word" className="sr-only">
            {t("identity.add")}
          </Label>
          <Input
            id="compass-identity-word"
            value={draft}
            maxLength={COMPASS_LIMITS.identity}
            placeholder={t("identity.placeholder")}
            className="h-11"
            aria-invalid={error ? true : undefined}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
            }}
          />
          <CompassErrorText code={error} />
        </div>
        <Button
          type="submit"
          variant="outline"
          className="h-11"
          disabled={pending || draft.trim().length === 0}
        >
          {t("identity.add")}
        </Button>
      </form>
    </section>
  );
}
