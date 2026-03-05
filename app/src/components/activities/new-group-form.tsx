import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { COLOR_PALETTE } from "@/lib/colors";
import { db, now, newId } from "@/lib/db";

const EMOJI_OPTIONS = [
  "💪",
  "🏃",
  "🧘",
  "📚",
  "💻",
  "🎨",
  "🎵",
  "🍎",
  "😴",
  "🧹",
  "💰",
  "🌿",
  "✍️",
  "🎯",
  "🏋️",
  "🚴",
  "🤸",
  "🧗",
  "🏊",
  "🚶",
  "🧠",
  "❤️",
  "⭐",
  "🔥",
];

export default function NewGroupForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    color: COLOR_PALETTE[0].value,
    emoji: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError("Group name is required");
      return;
    }

    try {
      setIsSubmitting(true);
      const n = now();
      await db.activityGroups.add({
        id: newId(),
        name: formData.name.trim(),
        color: formData.color,
        emoji: formData.emoji || null,
        is_archived: false,
        order_index: null,
        created_at: n,
        updated_at: n,
        synced_at: null,
        deleted_at: null,
      });
      navigate("/activities");
    } catch (error) {
      console.error("Error creating group:", error);
      setError("Failed to create group. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Create New Activity Group</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Group Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Work, Health, Personal"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Color</Label>
                <div className="grid grid-cols-3 gap-2">
                  {COLOR_PALETTE.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, color: color.value })
                      }
                      className={`h-6 rounded-md border-2 transition-all ${
                        formData.color === color.value
                          ? "border-primary scale-110"
                          : "border-transparent hover:scale-105"
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    >
                      <span className="sr-only">{color.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Emoji (optional)</Label>
                <div className="grid grid-cols-8 gap-1">
                  {EMOJI_OPTIONS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          emoji: formData.emoji === em ? "" : em,
                        })
                      }
                      className={`h-9 w-9 rounded-md text-xl flex items-center justify-center transition-all border ${
                        formData.emoji === em
                          ? "border-primary bg-primary/10 scale-110"
                          : "border-transparent hover:bg-accent hover:scale-105"
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
                {formData.emoji && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, emoji: "" })}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Clear emoji
                  </button>
                )}
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create Group"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
