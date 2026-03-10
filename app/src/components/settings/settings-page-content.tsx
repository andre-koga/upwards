import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { AppearanceCard } from "./appearance-card";
import { AuthCard } from "./auth-card";
import { BackupCard } from "./backup-card";
import { ArchiveCard, TaskOrderCard } from "./navigation-cards";
import { useAuth } from "@/lib/use-auth";

export default function SettingsPageContent() {
  const { isSupabaseConfigured } = useAuth();

  return (
    <div className="space-y-4 p-4 pb-24">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your preferences</p>
      </div>

      <AppearanceCard />

      {isSupabaseConfigured && <AuthCard />}

      <ArchiveCard />
      <TaskOrderCard />
      <BackupCard />

      <div className="text-center text-xs text-muted-foreground pt-4">
        <p>Upwards — local-first habit tracker</p>
      </div>

      <FloatingBackButton to="/" title="Home" />
    </div>
  );
}
