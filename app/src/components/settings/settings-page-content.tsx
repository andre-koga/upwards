/**
 * SRP: Renders the settings page content and build footer.
 */
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { AppearanceCard } from "./appearance-card";
import { AuthCard } from "./auth-card";
import { SyncCard } from "./sync-card";
import { BackupCard } from "./backup-card";
import { ArchiveCard, TaskOrderCard } from "./navigation-cards";
import { useAuth } from "@/lib/use-auth";

export default function SettingsPageContent() {
  const { isSupabaseConfigured } = useAuth();
  const buildLabel =
    import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
    import.meta.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
    "dev";

  return (
    <div className="space-y-4 p-4 pb-24">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your preferences</p>
      </div>

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
        <p className="scale-75 font-mono opacity-50">{buildLabel}</p>
      </div>

      <FloatingBackButton to="/" title="Home" />
    </div>
  );
}
