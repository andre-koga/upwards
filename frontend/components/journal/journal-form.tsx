"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import emojiRegex from "emoji-regex";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BookmarkIcon,
  Smile,
  Image as ImageIcon,
  Video,
  Save,
  X,
  Upload,
  Pencil,
  ArrowLeft,
  Check,
  Trash2,
} from "lucide-react";

interface JournalFormProps {
  userId: string;
  date: string;
  existingEntry: any | null;
  canEdit?: boolean;
  initialMode?: "view" | "edit";
}

const QUALITY_OPTIONS = [
  { value: 1, label: "😞 Bad", emoji: "😞" },
  { value: 2, label: "😕 Poor", emoji: "😕" },
  { value: 3, label: "😐 Okay", emoji: "😐" },
  { value: 4, label: "😊 Good", emoji: "😊" },
  { value: 5, label: "🤩 Great", emoji: "🤩" },
];

const COMMON_EMOJIS = [
  "😊",
  "😔",
  "😤",
  "🤗",
  "😴",
  "💪",
  "🎉",
  "📚",
  "💼",
  "🏃",
  "🎨",
  "🎮",
  "🍕",
  "☕",
  "🌟",
  "❤️",
  "🔥",
  "✨",
  "🌈",
  "⭐",
];

export default function JournalForm({
  userId,
  date,
  existingEntry,
  canEdit = true,
  initialMode = "edit",
}: JournalFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"view" | "edit">(initialMode);
  const [title, setTitle] = useState(existingEntry?.title || "");
  const [textContent, setTextContent] = useState(
    existingEntry?.text_content || "",
  );
  const [dayQuality, setDayQuality] = useState<number | null>(
    existingEntry?.day_quality || null,
  );
  const [isBookmarked, setIsBookmarked] = useState(
    existingEntry?.is_bookmarked || false,
  );
  const [dayEmoji, setDayEmoji] = useState(existingEntry?.day_emoji || "");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<string[]>(
    existingEntry?.photo_urls || [],
  );
  const [existingVideoUrl, setExistingVideoUrl] = useState<string | null>(
    existingEntry?.video_url || null,
  );
  const [saving, setSaving] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [photoSignedUrls, setPhotoSignedUrls] = useState<
    Record<string, string>
  >({});
  const [videoSignedUrl, setVideoSignedUrl] = useState<string | null>(null);

  // Generate signed URLs for private storage objects whenever media paths change
  useEffect(() => {
    const generateSignedUrls = async () => {
      const newUrls: Record<string, string> = {};
      for (const path of existingPhotoUrls) {
        const { data } = await supabase.storage
          .from("journal-photos")
          .createSignedUrl(path, 3600);
        if (data?.signedUrl) newUrls[path] = data.signedUrl;
      }
      setPhotoSignedUrls(newUrls);
    };
    if (existingPhotoUrls.length > 0) generateSignedUrls();
  }, [existingPhotoUrls]);

  useEffect(() => {
    const generateVideoSignedUrl = async () => {
      if (!existingVideoUrl) {
        setVideoSignedUrl(null);
        return;
      }
      const { data } = await supabase.storage
        .from("journal-videos")
        .createSignedUrl(existingVideoUrl, 3600);
      setVideoSignedUrl(data?.signedUrl ?? null);
    };
    generateVideoSignedUrl();
  }, [existingVideoUrl]);

  const characterCount = textContent.length;
  const characterLimit = 300;
  const titleCharacterCount = title.length;
  const titleCharacterLimit = 30;
  const isViewMode = mode === "view";

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPhotoFiles((prev) => [...prev, ...files].slice(0, 10)); // Max 10 photos
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setVideoFile(file);
  };

  const removePhoto = (index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingPhoto = (url: string) => {
    setExistingPhotoUrls((prev) => prev.filter((u) => u !== url));
  };

  const uploadFile = async (
    file: File,
    bucket: string,
    path: string,
  ): Promise<string> => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        upsert: true,
      });

    if (error) throw error;
    return data.path;
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Upload new photos
      const newPhotoUrls: string[] = [];
      for (let i = 0; i < photoFiles.length; i++) {
        const file = photoFiles[i];
        const timestamp = Date.now();
        const path = `${userId}/${date}_${timestamp}_${i}.${file.name.split(".").pop()}`;
        const uploadedPath = await uploadFile(file, "journal-photos", path);
        newPhotoUrls.push(uploadedPath);
      }

      // Upload video if provided
      let videoUrl = existingVideoUrl;
      if (videoFile) {
        const timestamp = Date.now();
        const path = `${userId}/${date}_${timestamp}.${videoFile.name.split(".").pop()}`;
        videoUrl = await uploadFile(videoFile, "journal-videos", path);
      }

      // Combine existing and new photo URLs
      const allPhotoUrls = [...existingPhotoUrls, ...newPhotoUrls];

      // Save journal entry
      const payload = {
        user_id: userId,
        entry_date: date,
        title: title,
        text_content: textContent || null,
        day_quality: dayQuality,
        is_bookmarked: isBookmarked,
        day_emoji: dayEmoji || null,
        photo_urls: allPhotoUrls.length > 0 ? allPhotoUrls : null,
        video_url: videoUrl,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("journal_entries").upsert(payload, {
        onConflict: "user_id,entry_date",
      });

      if (error) throw error;

      // Show success dialog
      setShowSuccessDialog(true);
    } catch (error) {
      console.error("Error saving journal:", error);
      setShowErrorDialog(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Header with back button, date, and edit button */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/journal")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Journal
        </Button>
        {canEdit && isViewMode && (
          <Button variant="default" size="sm" onClick={() => setMode("edit")}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit Entry
          </Button>
        )}
        {!canEdit && isViewMode && (
          <span className="text-sm text-muted-foreground">
            Entries older than 7 days cannot be edited
          </span>
        )}
      </div>

      {/* Date Display */}
      <div className="text-center pt-10">
        <h1 className="text-4xl font-bold mb-1">
          {new Date(date).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
          })}
        </h1>
        <p className="text-lg text-muted-foreground">
          {new Date(date).toLocaleDateString("en-US", {
            weekday: "long",
          })}
        </p>
      </div>

      <Card className="border-0 shadow-none">
        <CardContent className="space-y-6 px-2 pb-4">
          {/* Day Emoji */}
          <div className="space-y-2 flex flex-col items-center mt-8 mb-8">
            {isViewMode ? (
              <>
                <div className="text-4xl">
                  {dayEmoji || (
                    <span className="text-muted-foreground text-base">
                      No emoji selected
                    </span>
                  )}
                </div>
                <Label className="mt-6">Day Emoji</Label>
              </>
            ) : (
              <>
                <Input
                  type="text"
                  placeholder=""
                  value={dayEmoji}
                  onChange={(e) => {
                    // Use emoji-regex to extract only valid emojis
                    const regex = emojiRegex();
                    const matches = e.target.value.match(regex);
                    // Take only the first emoji if any valid emojis are found
                    setDayEmoji(
                      matches && matches.length > 0 ? matches[0] : "",
                    );
                  }}
                  className="w-24 h-24 rounded-full text-3xl text-center"
                  maxLength={10}
                />
                <Label className="mt-6">Day Emoji</Label>
              </>
            )}
          </div>

          {/* Title */}
          <div className="space-y-2 flex flex-col items-center">
            <div className="flex items-center justify-between w-full max-w-2xl">
              <Label htmlFor="title">Title</Label>
              {!isViewMode && (
                <span
                  className={`text-sm ${
                    titleCharacterCount > titleCharacterLimit
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }`}
                >
                  {titleCharacterCount}/{titleCharacterLimit}
                </span>
              )}
            </div>
            {isViewMode ? (
              <div className="p-3 border rounded-lg w-full max-w-2xl">
                {title || (
                  <span className="text-muted-foreground">No title</span>
                )}
              </div>
            ) : (
              <Input
                id="title"
                placeholder="Give your day a title..."
                value={title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setTitle(e.target.value.slice(0, 30))
                }
                className="w-full max-w-2xl"
              />
            )}
          </div>

          {/* Text Content */}
          <div className="space-y-2 flex flex-col items-center">
            <div className="flex items-center justify-between w-full max-w-2xl">
              <Label htmlFor="text-content">Your Thoughts</Label>
              {!isViewMode && (
                <span
                  className={`text-sm ${characterCount > characterLimit ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {characterCount}/{characterLimit}
                </span>
              )}
            </div>
            {isViewMode ? (
              <div className="p-3 border rounded-lg min-h-[100px] whitespace-pre-wrap w-full max-w-2xl">
                {textContent || (
                  <span className="text-muted-foreground">No notes</span>
                )}
              </div>
            ) : (
              <Textarea
                id="text-content"
                placeholder="Write about your day... What did you accomplish? How did you feel?"
                value={textContent}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setTextContent(e.target.value.slice(0, 300))
                }
                className="min-h-[150px] resize-none w-full max-w-2xl"
              />
            )}
          </div>

          {/* Day Quality */}
          <div className="space-y-2 flex flex-col items-center">
            <Label>Day Quality</Label>
            <div className="flex gap-2 justify-center max-w-2xl w-full">
              {QUALITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => !isViewMode && setDayQuality(option.value)}
                  disabled={isViewMode}
                  className={`flex-1 p-3 border rounded-lg transition-all ${
                    dayQuality === option.value
                      ? "border-primary bg-primary/10 scale-105"
                      : "border-border hover:border-primary/50"
                  } ${isViewMode ? "cursor-default" : "cursor-pointer"}`}
                >
                  <div className="text-2xl mb-1">{option.emoji}</div>
                  <div className="text-xs">{option.label.split(" ")[1]}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-dashed border-border my-8"></div>

          {/* Photo Upload */}
          <div className="space-y-2 flex flex-col items-center">
            <Label>
              Photos{" "}
              {isViewMode && existingPhotoUrls.length === 0 ? "" : "(optional)"}
            </Label>
            {isViewMode && existingPhotoUrls.length === 0 ? (
              <p className="text-muted-foreground text-sm">No photos</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-2">
                  {existingPhotoUrls.map((url) => (
                    <div key={url} className="relative">
                      <div className="w-20 h-20 border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                        {photoSignedUrls[url] ? (
                          <img
                            src={photoSignedUrls[url]}
                            alt="Journal photo"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      {!isViewMode && (
                        <button
                          type="button"
                          onClick={() => removeExistingPhoto(url)}
                          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {!isViewMode &&
                    photoFiles.map((file, index) => (
                      <div key={index} className="relative">
                        <div className="w-20 h-20 border rounded-lg overflow-hidden">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                </div>
                {!isViewMode &&
                  photoFiles.length + existingPhotoUrls.length < 10 && (
                    <div className="w-full max-w-2xl space-y-2">
                      <Input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoSelect}
                        className="cursor-pointer"
                      />
                      <p className="text-xs text-muted-foreground text-center">
                        Upload up to 10 photos (max 5MB each)
                      </p>
                    </div>
                  )}
              </>
            )}
          </div>

          {/* Video Upload */}
          <div className="space-y-2 flex flex-col items-center">
            <Label>
              Video{" "}
              {isViewMode && !existingVideoUrl && !videoFile
                ? ""
                : "(optional)"}
            </Label>
            {isViewMode && !existingVideoUrl && !videoFile ? (
              <p className="text-muted-foreground text-sm">No video</p>
            ) : (
              <>
                {(existingVideoUrl || videoFile) && (
                  <div className="w-full max-w-2xl space-y-2">
                    {existingVideoUrl && videoSignedUrl ? (
                      <video
                        src={videoSignedUrl}
                        controls
                        className="w-full rounded-lg border"
                        preload="metadata"
                      />
                    ) : videoFile ? (
                      <video
                        src={URL.createObjectURL(videoFile)}
                        controls
                        className="w-full rounded-lg border"
                        preload="metadata"
                      />
                    ) : (
                      <div className="flex items-center gap-2 p-3 border rounded-lg">
                        <Video className="h-5 w-5" />
                        <span className="text-sm">Loading video...</span>
                      </div>
                    )}
                    {!isViewMode && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setVideoFile(null);
                          setExistingVideoUrl(null);
                        }}
                        className="w-full"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Remove video
                      </Button>
                    )}
                  </div>
                )}
                {!isViewMode && !existingVideoUrl && !videoFile && (
                  <div className="w-full max-w-2xl space-y-2">
                    <Input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoSelect}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      Upload one video (max 50MB)
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Save Button */}
          {!isViewMode && (
            <div className="flex gap-2 pt-4 justify-center">
              <Button
                type="button"
                variant={isBookmarked ? "default" : "outline"}
                onClick={() => setIsBookmarked(!isBookmarked)}
                size="icon"
                title={isBookmarked ? "Remove bookmark" : "Bookmark this day"}
              >
                <BookmarkIcon
                  className={`h-4 w-4 ${isBookmarked ? "fill-current" : ""}`}
                />
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  saving ||
                  !dayQuality ||
                  !dayEmoji ||
                  !title.trim() ||
                  !textContent.trim()
                }
                className="flex-1 max-w-xs"
              >
                {saving ? (
                  "Saving..."
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Done
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => router.push("/journal")}
                disabled={saving}
                title="Discard changes"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Success Dialog */}
      <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Success!</AlertDialogTitle>
            <AlertDialogDescription>
              Journal entry saved successfully.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => router.push("/journal")}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Error Dialog */}
      <AlertDialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Error</AlertDialogTitle>
            <AlertDialogDescription>
              Failed to save journal entry. Please try again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
