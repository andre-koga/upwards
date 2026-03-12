import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { syncEngine } from "@/lib/sync";
import { useAuth } from "@/lib/use-auth";

export function SyncCard() {
  const { isAuthed } = useAuth();
  const [isForcePushing, setIsForcePushing] = useState(false);

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
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Cloud Sync</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Force push uploads all local data to the cloud, overwriting remote
          with local. Use when you have local data that isn&apos;t syncing.
        </p>
        <Button
          variant="outline"
          className="flex w-full items-center gap-2"
          onClick={handleForcePush}
          disabled={isForcePushing || syncEngine.getState().isSyncing}
        >
          {isForcePushing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {isForcePushing ? "Pushing…" : "Force push to cloud"}
        </Button>
      </CardContent>
    </Card>
  );
}
