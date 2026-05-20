import { useState } from "react";
import { User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsSection } from "@/components/ui/settings-section";
import { useUserProfile } from "@/lib/use-user-profile";

const usernameInputId = "settings-username";
const displayNameInputId = "settings-display-name";

export function ProfileCard() {
  const { username, displayName, loading, setUsername, setDisplayName } =
    useUserProfile();
  const [usernameInput, setUsernameInput] = useState("");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [editingUsername, setEditingUsername] = useState(false);
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameError(null);
    setSaving(true);
    const { error } = await setUsername(usernameInput.trim().toLowerCase());
    setSaving(false);
    if (error) {
      setUsernameError(error);
    } else {
      setEditingUsername(false);
      setUsernameInput("");
    }
  };

  const handleSaveDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisplayNameError(null);
    setSaving(true);
    const { error } = await setDisplayName(displayNameInput.trim());
    setSaving(false);
    if (error) {
      setDisplayNameError(error);
    } else {
      setEditingDisplayName(false);
      setDisplayNameInput("");
    }
  };

  if (loading) return null;

  return (
    <SettingsSection title="Profile">
      {/* Display name */}
      {editingDisplayName ? (
        <form onSubmit={(e) => void handleSaveDisplayName(e)} className="space-y-2">
          <Label htmlFor={displayNameInputId}>Display name</Label>
          <Input
            id={displayNameInputId}
            value={displayNameInput}
            onChange={(e) => setDisplayNameInput(e.target.value)}
            placeholder="Your name"
            autoFocus
          />
          {displayNameError && (
            <p className="text-xs text-destructive">{displayNameError}</p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setEditingDisplayName(false);
                setDisplayNameError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {displayName ?? (
                <span className="text-muted-foreground">No display name</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Shown if you invite friends to a Goal
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDisplayNameInput(displayName ?? "");
              setEditingDisplayName(true);
            }}
          >
            {displayName ? "Edit" : "Set name"}
          </Button>
        </div>
      )}

      {/* Username */}
      {editingUsername ? (
        <form onSubmit={(e) => void handleSaveUsername(e)} className="space-y-2 pt-2">
          <Label htmlFor={usernameInputId}>Username</Label>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">@</span>
            <Input
              id={usernameInputId}
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value.toLowerCase())}
              placeholder="your_username"
              pattern="[a-z0-9_]{3,20}"
              title="3–20 characters: a-z, 0-9, underscore"
              autoFocus
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Letters, numbers, underscore. 3–20 characters.
          </p>
          {usernameError && (
            <p className="text-xs text-destructive">{usernameError}</p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setEditingUsername(false);
                setUsernameError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                {username ? (
                  <span className="font-mono">@{username}</span>
                ) : (
                  <span className="text-muted-foreground">No username</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Friends can find you by exact username
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setUsernameInput(username ?? "");
              setEditingUsername(true);
            }}
          >
            {username ? "Edit" : "Set username"}
          </Button>
        </div>
      )}
    </SettingsSection>
  );
}
