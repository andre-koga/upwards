"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tables, TablesInsert } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { Pencil, Archive, Plus } from "lucide-react";
import { COLOR_PALETTE } from "@/lib/colors";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ActivityGroup = Tables<"activity_groups">;

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

interface ActivityGroupsManagerProps {
  userId: string;
  groups: ActivityGroup[];
  onGroupsChange: () => void;
}

export default function ActivityGroupsManager({
  userId,
  groups,
  onGroupsChange,
}: ActivityGroupsManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [archiveDialog, setArchiveDialog] = useState<{
    open: boolean;
    groupId: string | null;
  }>({ open: false, groupId: null });
  const [formData, setFormData] = useState({
    name: "",
    color: COLOR_PALETTE[0].value,
    emoji: "",
  });

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        // Update existing group
        const { error } = await supabase
          .from("activity_groups")
          .update({
            name: formData.name,
            color: formData.color,
            emoji: formData.emoji || null,
          })
          .eq("id", editingId);

        if (error) throw error;
        setEditingId(null);
      } else {
        // Create new group
        const insertPayload: TablesInsert<"activity_groups"> = {
          user_id: userId,
          name: formData.name,
          color: formData.color,
          emoji: formData.emoji || null,
          is_archived: false,
        };

        const { error } = await supabase
          .from("activity_groups")
          .insert(insertPayload);

        if (error) throw error;
        setIsAdding(false);
      }

      setFormData({ name: "", color: COLOR_PALETTE[0].value, emoji: "" });
      onGroupsChange();
    } catch (error) {
      console.error("Error saving group:", error);
      if (error && typeof error === "object" && "message" in error) {
        console.error("Error message:", (error as any).message);
      }
      if (error && typeof error === "object" && "details" in error) {
        console.error("Error details:", (error as any).details);
      }
    }
  };

  const handleEdit = (group: ActivityGroup) => {
    setEditingId(group.id);
    setFormData({
      name: group.name || "",
      color: group.color || COLOR_PALETTE[0].value,
      emoji: group.emoji || "",
    });
    setIsAdding(true);
  };

  const stopCurrentActivityInGroup = async (groupId: string) => {
    try {
      // Get today's daily entry
      const today = new Date().toISOString().split("T")[0];
      const { data: dailyEntry } = await supabase
        .from("daily_entries")
        .select("*")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();

      if (!dailyEntry || !dailyEntry.current_activity_id) return;

      // Check if current activity belongs to the group being archived
      const { data: currentActivity } = await supabase
        .from("activities")
        .select("*")
        .eq("id", dailyEntry.current_activity_id)
        .maybeSingle();

      if (!currentActivity || currentActivity.group_id !== groupId) {
        return; // Current activity not in this group
      }

      const now = new Date();

      // Close current activity period
      const { data: currentPeriod } = await supabase
        .from("activity_periods")
        .select("*")
        .eq("daily_entry_id", dailyEntry.id)
        .is("end_time", null)
        .maybeSingle();

      if (currentPeriod) {
        await supabase
          .from("activity_periods")
          .update({ end_time: now.toISOString() })
          .eq("id", currentPeriod.id);
      }

      // Clear current activity
      await supabase
        .from("daily_entries")
        .update({ current_activity_id: null })
        .eq("id", dailyEntry.id);
    } catch (error) {
      console.error("Error stopping current activity:", error);
    }
  };

  const handleArchive = async (id: string) => {
    setArchiveDialog({ open: true, groupId: id });
  };

  const confirmArchive = async () => {
    if (!archiveDialog.groupId) return;

    try {
      // Stop current activity if it belongs to this group
      await stopCurrentActivityInGroup(archiveDialog.groupId);

      // Archive the group
      const { error: groupError } = await supabase
        .from("activity_groups")
        .update({ is_archived: true })
        .eq("id", archiveDialog.groupId);

      if (groupError) throw groupError;

      // Archive all activities in this group
      const { error: activitiesError } = await supabase
        .from("activities")
        .update({ is_archived: true })
        .eq("group_id", archiveDialog.groupId);

      if (activitiesError) throw activitiesError;

      setArchiveDialog({ open: false, groupId: null });
      onGroupsChange();
    } catch (error) {
      console.error("Error archiving group:", error);
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ name: "", color: COLOR_PALETTE[0].value, emoji: "" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Groups</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-sm"
          >
            <span>New Group</span>
            <Plus className="h-4 w-4 shrink-0" />
          </button>
        )}
        {isAdding && (
          <form
            onSubmit={handleSubmit}
            className="space-y-3 p-4 border rounded-md"
          >
            <div>
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
            <div>
              <Label>Color</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, color: color.value })
                    }
                    className={`h-8 rounded-full border-2 transition-all ${
                      formData.color === color.value
                        ? "border-primary ring-2 ring-primary ring-offset-1"
                        : "border-transparent hover:border-muted-foreground/50"
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label>Emoji (optional)</Label>
              <div className="grid grid-cols-8 gap-1 mt-2">
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
                  className="text-xs text-muted-foreground hover:text-foreground underline mt-1"
                >
                  Clear emoji
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                {editingId ? "Update" : "Create"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCancel}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {groups.length === 0 && !isAdding && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No groups yet. Create one to get started!
            </p>
          )}
          {groups.map((group) => (
            <div
              key={group.id}
              className="flex items-center justify-between p-3 border rounded-md hover:bg-accent"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full shrink-0"
                  style={{
                    backgroundColor: group.color || COLOR_PALETTE[0].value,
                  }}
                />
                {group.emoji && (
                  <span className="text-lg leading-none">{group.emoji}</span>
                )}
                <span className="font-medium">{group.name}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleEdit(group)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleArchive(group.id)}
                >
                  <Archive className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <AlertDialog
        open={archiveDialog.open}
        onOpenChange={(open) =>
          setArchiveDialog({ open, groupId: archiveDialog.groupId })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive this group? All activities in
              this group will also be archived. You can unarchive them later
              from Settings &gt; Archived.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchive}>
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
