import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, now, newId } from "@/lib/db";
import type { JournalEntry } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
  ArrowLeft,
  Pencil,
  Check,
  Trash2,
  Bookmark as BookmarkIcon,
} from "lucide-react";

const QUALITY_OPTIONS = [
  { value: 1, emoji: "😞", label: "1 Bad" },
  { value: 2, emoji: "😕", label: "2 Poor" },
  { value: 3, emoji: "😐", label: "3 Okay" },
  { value: 4, emoji: "😊", label: "4 Good" },
  { value: 5, emoji: "🤩", label: "5 Great" },
];

const titleCharacterLimit = 30;
const characterLimit = 300;

interface JournalFormProps {
  date: string;
  existingEntry: JournalEntry | null;
  canEdit?: boolean;
  initialMode?: "view" | "edit";
}

export default function JournalForm({
  date,
  existingEntry,
  canEdit = true,
  initialMode = existingEntry ? "view" : "edit",
}: JournalFormProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"view" | "edit">(initialMode);
  const isViewMode = mode === "view";

  const [title, setTitle] = useState(existingEntry?.title ?? "");
  const [textContent, setTextContent] = useState(
    existingEntry?.text_content ?? "",
  );
  const [dayQuality, setDayQuality] = useState<number | null>(
    existingEntry?.day_quality ?? null,
  );
  const [dayEmoji, setDayEmoji] = useState(existingEntry?.day_emoji ?? "");
  const [isBookmarked, setIsBookmarked] = useState(
    existingEntry?.is_bookmarked ?? false,
  );

  const [saving, setSaving] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);

  const titleCharacterCount = title.length;
  const characterCount = textContent.length;

  const handleSave = async () => {
    if (!dayQuality || !dayEmoji || !title.trim() || !textContent.trim())
      return;
    try {
      setSaving(true);
      const n = now();
      const existing = await db.journalEntries
        .where("entry_date")
        .equals(date)
        .filter((e) => !e.deleted_at)
        .first();

      if (existing) {
        await db.journalEntries.update(existing.id, {
          title,
          text_content: textContent || null,
          day_quality: dayQuality,
          day_emoji: dayEmoji || null,
          is_bookmarked: isBookmarked,
          updated_at: n,
        });
      } else {
        await db.journalEntries.add({
          id: newId(),
          entry_date: date,
          title,
          text_content: textContent || null,
          day_quality: dayQuality,
          day_emoji: dayEmoji || null,
          is_bookmarked: isBookmarked,
          created_at: n,
          updated_at: n,
          synced_at: null,
          deleted_at: null,
        });
      }
      setShowSuccessDialog(true);
    } catch (error) {
      console.error("Error saving journal:", error);
      setShowErrorDialog(true);
    } finally {
      setSaving(false);
    }
  };

  // Format date for display using local time
  const displayDate = new Date(date + "T00:00:00");

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/journal")}>
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
          {displayDate.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
          })}
        </h1>
        <p className="text-lg text-muted-foreground">
          {displayDate.toLocaleDateString("en-US", { weekday: "long" })}
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
                    // Keep only the first emoji-like character(s)
                    const val = e.target.value;
                    // Simple approach: take value and limit to reasonable length
                    setDayEmoji(val.slice(0, 8));
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
                onChange={(e) => setTitle(e.target.value.slice(0, 30))}
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
                  className={`text-sm ${
                    characterCount > characterLimit
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }`}
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
                onChange={(e) => setTextContent(e.target.value.slice(0, 300))}
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
                onClick={() => navigate("/journal")}
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
            <AlertDialogAction onClick={() => navigate("/journal")}>
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
            <AlertDialogAction onClick={() => setShowErrorDialog(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
