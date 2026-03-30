import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { AppearanceCard } from "@/components/settings/appearance-card";
import { AuthCard } from "@/components/settings/auth-card";
import { SyncCard } from "@/components/settings/sync-card";
import { BackupCard } from "@/components/settings/backup-card";
import {
  ArchiveCard,
  TaskOrderCard,
} from "@/components/settings/navigation-cards";
import { useAuth } from "@/lib/use-auth";

export default function SettingsPage() {
  const { isSupabaseConfigured } = useAuth();
  const buildLabel = import.meta.env.VITE_APP_BUILD_TIMESTAMP ?? "dev";
  const randomPhrase = import.meta.env.VITE_APP_RANDOM_PHRASE ?? "hey there!";
  return (
    <div className="space-y-3 p-4 pb-24">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your preferences
        </p>
      </header>

      <AppearanceCard />

      {isSupabaseConfigured && (
        <>
          <AuthCard />
          <SyncCard />
        </>
      )}

      <ArchiveCard />
      <TaskOrderCard />
      <BackupCard />

      <div className="space-y-1 pt-4 text-center text-xs text-muted-foreground">
        <p>Upwards — local-first habit tracker</p>
        <p className="scale-75 font-mono opacity-50">
          {randomPhrase} - {buildLabel}
        </p>
      </div>

      <FloatingBackButton to="/" title="Home" />
    </div>
  );
}
