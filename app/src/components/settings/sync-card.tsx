import { useState, useEffect } from "react";
import { Upload, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/components/ui/settings-section";
import { syncEngine } from "@/lib/sync";
import { useAuth } from "@/lib/use-auth";

export function SyncCard() {
  const { isAuthed } = useAuth();
  const [isForcePushing, setIsForcePushing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(syncEngine.getState().isSyncing);

  useEffect(() => {
    return syncEngine.subscribe((state) => setIsSyncing(state.isSyncing));
  }, []);

  const handleForcePush = async () => {
    if (!isAuthed) return;
    setIsForcePushing(true);
    try {
      await syncEngine.forcePushToCloud();
    } finally {
      setIsForcePushing(false);
    }
  };

  if (!isAuthed) return null;

  return (
    <SettingsSection
      title="Cloud sync"
      description="Force push uploads all local data to the cloud, overwriting remote with local. Use when you have local data that is not syncing."
    >
      <Button
        variant="outline"
        className="flex w-full items-center gap-2"
        onClick={handleForcePush}
        disabled={isForcePushing || isSyncing}
      >
        {isForcePushing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {isForcePushing ? "Pushing…" : "Force push to cloud"}
      </Button>
    </SettingsSection>
  );
}
