import { useEffect, useRef, useState } from "react";
import { Loader2, Paperclip, Trash2 } from "lucide-react";
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
import { JournalVideoUploadError, uploadJournalVideo } from "@/lib/journal";

const TITLE_LIMIT = 30;
const TEXT_LIMIT = 300;

interface JournalEditDialogProps {
  open: boolean;
  canEdit: boolean;
  initialEmoji: string;
  initialTitle: string;
  initialText: string;
  initialVideoPath: string;
  entryDate: string;
  canUploadVideo: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: {
    emoji: string;
    title: string;
    text: string;
    videoPath: string;
  }) => void;
}

export default function JournalEditDialog({
  open,
  canEdit,
  initialEmoji,
  initialTitle,
  initialText,
  initialVideoPath,
  entryDate,
  canUploadVideo,
  onOpenChange,
  onSave,
}: JournalEditDialogProps) {
  const [emoji, setEmoji] = useState(initialEmoji);
  const [title, setTitle] = useState(initialTitle);
  const [text, setText] = useState(initialText);
  const [videoPath, setVideoPath] = useState(initialVideoPath);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmoji(initialEmoji);
    setTitle(initialTitle);
    setText(initialText);
    setVideoPath(initialVideoPath);
    setUploadError(null);
  }, [open, initialEmoji, initialTitle, initialText, initialVideoPath]);

  const handleSave = () => {
    onSave({
      emoji: getFirstEmoji(emoji),
      title: title.trim(),
      text: text.trim(),
      videoPath: videoPath.trim(),
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
            className="h-16 w-16 rounded-full border bg-background text-center text-3xl placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary"
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
          rows={6}
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
              <div className="flex gap-2">
                <FormControlButton
                  className="min-w-0 flex-1"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingVideo}
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
                    className="w-10 shrink-0 justify-center px-0 text-destructive hover:text-destructive"
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
              </div>
            </>
          )}
        </div>
      </FormStack>

      <FormDialogActions
        onConfirm={handleSave}
        confirmLabel="Save"
        secondaryAction={{
          label: "Cancel",
          onClick: () => onOpenChange(false),
        }}
      />
    </FormDialog>
  );
}
