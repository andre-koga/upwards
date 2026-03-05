"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface UserPreferencesFormProps {
  userId: string;
  initialWakeTime: string;
  initialSleepTime: string;
}

export function UserPreferencesForm({
  userId,
  initialWakeTime,
  initialSleepTime,
}: UserPreferencesFormProps) {
  // Strip seconds from time for display in input (HH:MM:SS -> HH:MM)
  const formatForInput = (time: string) => time.substring(0, 5);

  const [wakeTime, setWakeTime] = useState(formatForInput(initialWakeTime));
  const [sleepTime, setSleepTime] = useState(formatForInput(initialSleepTime));
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const supabase = createClient();

  const handleSave = async () => {
    setIsSaving(true);
    setMessage("");

    try {
      // Ensure time format includes seconds (HH:MM:SS)
      const formatTime = (time: string) => {
        return time.length === 5 ? `${time}:00` : time;
      };

      // Simple update - user should already exist from settings page
      const { error } = await supabase
        .from("users")
        .update({
          typical_wake_time: formatTime(wakeTime),
          typical_sleep_time: formatTime(sleepTime),
        })
        .eq("id", userId);

      if (error) throw error;

      setMessage("Preferences saved successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error saving preferences:", error);
      setMessage("Failed to save preferences");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="wakeTime">Typical Wake Time</Label>
        <Input
          id="wakeTime"
          type="time"
          value={wakeTime}
          onChange={(e) => setWakeTime(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sleepTime">Typical Sleep Time</Label>
        <Input
          id="sleepTime"
          type="time"
          value={sleepTime}
          onChange={(e) => setSleepTime(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          For night owls: if you sleep after midnight, this represents the next
          day's time
        </p>
      </div>

      <Button onClick={handleSave} disabled={isSaving} className="w-full">
        {isSaving ? "Saving..." : "Save Preferences"}
      </Button>

      {message && (
        <p
          className={`text-sm text-center ${
            message.includes("success")
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
