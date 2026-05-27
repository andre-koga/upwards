import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Paperclip, Trash2, X } from "lucide-react";
import {
  FormCharacterCount,
  FormControlButton,
  FormDialog,
  FormDialogActions,
  FormField,
  FormStack,
  FormTextareaField,
} from "@/components/forms";
import { getFirstEmoji } from "@/lib/emoji-utils";
import {
  JournalPhotoUploadError,
  JournalVideoUploadError,
  getJournalPhotoUrl,
  uploadJournalPhoto,
  uploadJournalVideo,
} from "@/lib/journal";
import {
  clearJournalEditSessionDraft,
  getJournalEditSessionDraft,
  setJournalEditSessionDraft,
} from "@/lib/dialog-session-drafts";

const TITLE_LIMIT = 30;
const TEXT_LIMIT = 300;
const MAX_PHOTOS = 5;

interface JournalEditDialogProps {
  open: boolean;
  canEdit: boolean;
  initialEmoji: string;
  initialTitle: string;
  initialText: string;
  initialVideoPath: string;
  initialPhotoPaths: string[];
  entryDate: string;
  canUploadVideo: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: {
    emoji: string;
    title: string;
    text: string;
    videoPath: string;
    photoPaths: string[];
  }) => void;
}

export default function JournalEditDialog({
  open,
  canEdit,
  initialEmoji,
  initialTitle,
  initialText,
  initialVideoPath,
  initialPhotoPaths,
  entryDate,
  canUploadVideo,
  onOpenChange,
  onSave,
}: JournalEditDialogProps) {
  const [emoji, setEmoji] = useState(initialEmoji);
  const [title, setTitle] = useState(initialTitle);
  const [text, setText] = useState(initialText);
  const [videoPath, setVideoPath] = useState(initialVideoPath);
  const [photoPaths, setPhotoPaths] = useState<string[]>(initialPhotoPaths);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const prevOpenRef = useRef(open);
  const closeReasonRef = useRef<"save" | "cancel" | null>(null);
  /** Journal day this form session is for; used as stash key on dismiss. */
  const entryDateSessionRef = useRef(entryDate);

  useEffect(() => {
    if (open) {
      entryDateSessionRef.current = entryDate;
    }
  }, [open, entryDate]);

  useEffect(() => {
    if (!open) return;
    const draft = getJournalEditSessionDraft(entryDate);
    if (draft) {
      setEmoji(draft.emoji);
      setTitle(draft.title);
      setText(draft.text);
      setVideoPath(draft.videoPath);
      setPhotoPaths(draft.photoPaths);
    } else {
      setEmoji(initialEmoji);
      setTitle(initialTitle);
      setText(initialText);
      setVideoPath(initialVideoPath);
      setPhotoPaths(initialPhotoPaths);
    }
    setUploadError(null);
  }, [open, entryDate, initialEmoji, initialTitle, initialText, initialVideoPath, initialPhotoPaths]);

  useEffect(() => {
    if (prevOpenRef.current && !open) {
      if (closeReasonRef.current === "save" || closeReasonRef.current === "cancel") {
        closeReasonRef.current = null;
      } else {
        setJournalEditSessionDraft(entryDateSessionRef.current, {
          emoji,
          title,
          text,
          videoPath,
          photoPaths,
        });
      }
    }
    prevOpenRef.current = open;
  }, [open, emoji, title, text, videoPath, photoPaths]);

  const handleSave = () => {
    closeReasonRef.current = "save";
    clearJournalEditSessionDraft(entryDateSessionRef.current);
    onSave({
      emoji: getFirstEmoji(emoji),
      title: title.trim(),
      text: text.trim(),
      videoPath: videoPath.trim(),
      photoPaths,
    });
    onOpenChange(false);
  };

  const handleVideoFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadingVideo(true);
    try {
      const path = await uploadJournalVideo(file, entryDate);
      setVideoPath(path);
    } catch (error) {
      let message = "Failed to upload video.";
      if (error instanceof JournalVideoUploadError) {
        message = error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      setUploadError(message);
    } finally {
      setUploadingVideo(false);
      const input = event.target;
      if (input) input.value = "";
    }
  };

  const handlePhotoFilesChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setUploadError(null);
    setUploadingPhotos(true);

    try {
      // Determine how many slots remain
      const currentCount = photoPaths.length;
      const remaining = MAX_PHOTOS - currentCount;
      const filesToUpload = files.slice(0, remaining);

      if (filesToUpload.length === 0) {
        setUploadError(`You can only attach up to ${MAX_PHOTOS} photos per day.`);
        return;
      }

      const results = await Promise.allSettled(
        filesToUpload.map((file) => uploadJournalPhoto(file, entryDate))
      );

      const newPaths: string[] = [];
      const errors: string[] = [];
      for (const result of results) {
        if (result.status === "fulfilled") {
          newPaths.push(result.value);
        } else {
          const err = result.reason;
          if (err instanceof JournalPhotoUploadError) {
            errors.push(err.message);
          } else {
            errors.push("Failed to upload photo.");
          }
        }
      }

      if (newPaths.length > 0) {
        setPhotoPaths((prev) => [...prev, ...newPaths]);
      }
      if (errors.length > 0) {
        setUploadError(errors[0]);
      }
    } finally {
      setUploadingPhotos(false);
      const input = event.target;
      if (input) input.value = "";
    }
  };

  const removePhoto = (index: number) => {
    setUploadError(null);
    setPhotoPaths((prev) => prev.filter((_, i) => i !== index));
  };

  const photoCount = photoPaths.length;
  const canAddMorePhotos = photoCount < MAX_PHOTOS;

  if (!canEdit) return null;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit journal"
      contentClassName="w-[22rem]"
    >
      <FormStack>
        <div className="flex items-center justify-center">
          <input
            autoFocus
            type="text"
            value={emoji}
            maxLength={4}
            onChange={(e) => setEmoji(getFirstEmoji(e.target.value))}
            placeholder="🙂"
            className="h-16 w-16 rounded-full border bg-background text-center text-3xl placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <FormField
          id="journal-title"
          label="Journal title"
          labelClassName="sr-only"
          value={title}
          maxLength={TITLE_LIMIT}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Give this day a title..."
          message={
            <FormCharacterCount current={title.length} max={TITLE_LIMIT} />
          }
        />

        <FormTextareaField
          id="journal-reflection"
          label="Journal reflection"
          labelClassName="sr-only"
          value={text}
          maxLength={TEXT_LIMIT}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write your thoughts for the day..."
          rows={4}
          className="leading-relaxed"
          message={
            <FormCharacterCount current={text.length} max={TEXT_LIMIT} />
          }
        />

        <div className="space-y-2">
          {uploadError ? (
            <p className="text-xs text-destructive">{uploadError}</p>
          ) : null}

          {canUploadVideo && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleVideoFileChange}
              />
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoFilesChange}
              />
              <div className="flex gap-2">
                <FormControlButton
                  className="min-w-0 flex-1"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingVideo || uploadingPhotos}
                  title={
                    videoPath.trim().length > 0
                      ? "Replace video"
                      : "Attach video"
                  }
                >
                  {uploadingVideo ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <Paperclip aria-hidden />
                  )}
                  {videoPath.trim().length > 0
                    ? "Replace video"
                    : "Attach video"}
                </FormControlButton>
                {videoPath.trim().length > 0 ? (
                  <FormControlButton
                    className="w-10 shrink-0 justify-center px-0 text-destructive"
                    onClick={() => {
                      setUploadError(null);
                      setVideoPath("");
                    }}
                    title="Remove video"
                    aria-label="Remove video"
                  >
                    <Trash2 aria-hidden />
                  </FormControlButton>
                ) : null}

                <FormControlButton
                  className="min-w-0 flex-1"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingVideo || uploadingPhotos || !canAddMorePhotos}
                  title={
                    !canAddMorePhotos
                      ? "Maximum 5 photos reached"
                      : photoCount > 0
                      ? `${photoCount}/${MAX_PHOTOS} photos`
                      : "Add photos"
                  }
                >
                  {uploadingPhotos ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <ImagePlus aria-hidden />
                  )}
                  {photoCount > 0
                    ? `${photoCount}/${MAX_PHOTOS} photos`
                    : "Add photos"}
                </FormControlButton>
              </div>

              {photoPaths.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {photoPaths.map((path, index) => {
                    const url = getJournalPhotoUrl(path);
                    return (
                      <div key={path} className="relative h-16 w-16 shrink-0">
                        {url ? (
                          <img
                            src={url}
                            alt={`Photo ${index + 1}`}
                            className="h-full w-full rounded-md object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                            {index + 1}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
                          title={`Remove photo ${index + 1}`}
                          aria-label={`Remove photo ${index + 1}`}
                        >
                          <X className="h-2.5 w-2.5" aria-hidden />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </FormStack>

      <FormDialogActions
        onConfirm={handleSave}
        confirmLabel="Save"
        secondaryAction={{
          label: "Cancel",
          onClick: () => {
            closeReasonRef.current = "cancel";
            clearJournalEditSessionDraft(entryDateSessionRef.current);
            onOpenChange(false);
          },
        }}
      />
    </FormDialog>
  );
}
