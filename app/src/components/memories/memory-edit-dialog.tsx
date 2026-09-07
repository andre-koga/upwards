import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus, Loader2, X } from "lucide-react";
import {
  FormCharacterCount,
  FormControlButton,
  FormDialog,
  FormDialogActions,
  FormField,
  FormStack,
  FormTextareaField,
} from "@/components/forms";
import type { Memory } from "@/lib/db/types";
import { MEMORY_PHOTO_LIMIT, MEMORY_TEXT_LIMIT } from "@/lib/memories";
import {
  deleteMemoryPhoto,
  getMemoryPhotoUrl,
  uploadMemoryPhoto,
} from "@/lib/memory-photo-storage";

interface Props {
  open: boolean;
  memory: Memory | null;
  onOpenChange: (open: boolean) => void;
  onSave: (
    values: Pick<Memory, "text_content" | "photo_paths" | "time_label">
  ) => Promise<void>;
}

export function MemoryEditDialog({
  open,
  memory,
  onOpenChange,
  onSave,
}: Props) {
  const { t } = useTranslation("memories");
  const [text, setText] = useState("");
  const [label, setLabel] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [originalPhotoPaths, setOriginalPhotoPaths] = useState<string[]>([]);
  const [hasSaved, setHasSaved] = useState(false);
  const [previousOpen, setPreviousOpen] = useState(open);

  // Initialize only when the dialog opens; background sync must not erase an
  // in-progress edit by changing the memory prop.
  if (previousOpen !== open) {
    setPreviousOpen(open);
    if (open) {
      setText(memory?.text_content ?? "");
      setLabel(memory?.time_label ?? "");
      setPhotos(memory?.photo_paths ?? []);
      setOriginalPhotoPaths(memory?.photo_paths ?? []);
      setHasSaved(false);
      setError(null);
    }
  }

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(
      0,
      MEMORY_PHOTO_LIMIT - photos.length
    );
    event.target.value = "";
    if (!files.length) return;
    if (!memory) {
      setError(t("dialog.saveBeforePhotos"));
      return;
    }
    setBusy(true);
    setError(null);
    const results = await Promise.allSettled(
      files.map((file) => uploadMemoryPhoto(file, memory.id))
    );
    const added = results
      .filter(
        (result): result is PromiseFulfilledResult<string> =>
          result.status === "fulfilled"
      )
      .map((result) => result.value);
    setPhotos((current) => [...current, ...added]);
    if (results.some((result) => result.status === "rejected"))
      setError(t("dialog.somePhotosFailed"));
    setBusy(false);
  };
  const remove = (path: string) => {
    setPhotos((current) => current.filter((value) => value !== path));
  };
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !hasSaved) {
      const original = originalPhotoPaths;
      void Promise.all(
        photos
          .filter((path) => !original.includes(path))
          .map((path) => deleteMemoryPhoto(path).catch(() => undefined))
      );
    }
    onOpenChange(nextOpen);
  };
  const save = async () => {
    if (!text.trim() && !photos.length) {
      setError(t("dialog.needsContent"));
      return;
    }
    setBusy(true);
    await onSave({
      text_content: text.trim() || null,
      photo_paths: photos.length ? photos : null,
      time_label: label.trim() || null,
    });
    setBusy(false);
    await Promise.all(
      originalPhotoPaths
        .filter((path) => !photos.includes(path))
        .map((path) => deleteMemoryPhoto(path).catch(() => undefined))
    );
    setHasSaved(true);
    onOpenChange(false);
  };
  const photoCount = photos.length;
  const canAddMorePhotos = photoCount < MEMORY_PHOTO_LIMIT;
  const addPhotosLabel = !canAddMorePhotos
    ? t("dialog.upload.maxPhotosReached", { count: MEMORY_PHOTO_LIMIT })
    : photoCount > 0
      ? t("dialog.upload.photoCount", {
          current: photoCount,
          max: MEMORY_PHOTO_LIMIT,
        })
      : t("dialog.upload.addPhotos");
  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={memory ? t("dialog.editTitle") : t("dialog.newTitle")}
    >
      <FormStack>
        <FormTextareaField
          id="memory-note"
          label={t("dialog.memoryLabel")}
          labelClassName="sr-only"
          value={text}
          maxLength={MEMORY_TEXT_LIMIT}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder={t("dialog.memoryPlaceholder")}
          message={
            <FormCharacterCount current={text.length} max={MEMORY_TEXT_LIMIT} />
          }
        />
        <FormField
          id="memory-time-label"
          label={t("dialog.whenLabel")}
          labelClassName="sr-only"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("dialog.whenPlaceholder")}
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={upload}
        />
        <FormControlButton
          onClick={() => inputRef.current?.click()}
          disabled={busy || !canAddMorePhotos || !memory}
          title={addPhotosLabel}
        >
          {busy ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <ImagePlus aria-hidden />
          )}
          {addPhotosLabel}
        </FormControlButton>
        {photos.length ? (
          <div className="flex flex-wrap gap-2">
            {photos.map((path, index) => (
              <div key={path} className="relative h-16 w-16">
                <img
                  src={getMemoryPhotoUrl(path) ?? ""}
                  alt={t("photoAlt", { index: index + 1 })}
                  className="h-full w-full rounded-md object-cover"
                />
                <FormControlButton
                  className="absolute -right-2 -top-2 h-6 w-6 rounded-full p-0"
                  onClick={() => remove(path)}
                  aria-label={t("dialog.upload.removePhoto", {
                    index: index + 1,
                  })}
                >
                  <X className="h-3 w-3" />
                </FormControlButton>
              </div>
            ))}
          </div>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </FormStack>
      <FormDialogActions
        onConfirm={() => void save()}
        confirmLabel={memory ? t("dialog.save") : t("dialog.create")}
        confirmDisabled={busy}
        secondaryAction={{
          label: t("dialog.cancel"),
          onClick: () => handleOpenChange(false),
        }}
      />
    </FormDialog>
  );
}
