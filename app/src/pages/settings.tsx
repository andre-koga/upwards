import { useTranslation } from "react-i18next";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { AppearanceCard } from "@/components/settings/appearance-card";
import { LanguageCard } from "@/components/settings/language-card";
import { AuthCard } from "@/components/settings/auth-card";
import { ProfileCard } from "@/components/settings/profile-card";
import { SyncCard } from "@/components/settings/sync-card";
// import { BackupCard } from "@/components/settings/backup-card";
import { TaskOrderCard } from "@/components/settings/navigation-cards";
import { DayResetCard } from "@/components/settings/day-reset-card";
import { useAuth } from "@/lib/use-auth";

export default function SettingsPage() {
  const { t } = useTranslation("settings");
  const { t: tNav } = useTranslation("nav");
  const { isSupabaseConfigured, isAuthed } = useAuth();
  const buildLabel = import.meta.env.VITE_APP_BUILD_TIMESTAMP ?? "dev";
  const randomPhrase = import.meta.env.VITE_APP_RANDOM_PHRASE ?? "hey there!";
  return (
    <div className="space-y-3 p-4 pb-24">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t("page.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("page.subtitle")}</p>
      </header>

      <AppearanceCard />
      <LanguageCard />
      <DayResetCard />

      {isSupabaseConfigured && (
        <>
          <AuthCard />
          {isAuthed && <ProfileCard />}
          <SyncCard />
        </>
      )}

      <TaskOrderCard />
      {/* <BackupCard /> */}

      <div className="space-y-1 pt-4 text-center text-xs text-muted-foreground">
        <p>{t("page.tagline")}</p>
        <p className="scale-75 font-mono text-muted-foreground">
          {randomPhrase} - {buildLabel}
        </p>
      </div>

      <FloatingBackButton to="/" title={tNav("home")} />
    </div>
  );
}
