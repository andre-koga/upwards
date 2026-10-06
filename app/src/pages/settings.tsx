import { useTranslation } from "react-i18next";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { AppPageShell } from "@/components/layout/app-page-shell";
import { AppearanceCard } from "@/components/settings/appearance-card";
import { HolidaysCard } from "@/components/settings/holidays-card";
import { PrivacyOptInsCard } from "@/components/settings/privacy-opt-ins-card";
import { LanguageCard } from "@/components/settings/language-card";
import { AuthCard } from "@/components/settings/auth-card";
import { SyncCard } from "@/components/settings/sync-card";
import { AiCard } from "@/components/settings/ai-card";
import { BackupCard } from "@/components/settings/backup-card";
import {
  AboutCard,
  TaskOrderCard,
} from "@/components/settings/navigation-cards";
import { useAuth } from "@/lib/use-auth";

export default function SettingsPage() {
  const { t } = useTranslation("settings");
  const { t: tNav } = useTranslation("nav");
  const { isSupabaseConfigured } = useAuth();
  const buildLabel = import.meta.env.VITE_APP_BUILD_TIMESTAMP ?? "dev";
  const randomPhrase = import.meta.env.VITE_APP_RANDOM_PHRASE ?? "hey there!";
  return (
    <AppPageShell
      title={t("page.title")}
      subtitle={t("page.subtitle")}
      className="space-y-3"
    >
      <AppearanceCard />
      <LanguageCard />
      <PrivacyOptInsCard />
      <HolidaysCard />

      {isSupabaseConfigured && (
        <>
          <AuthCard />
          <SyncCard />
          <AiCard />
        </>
      )}

      <TaskOrderCard />
      <BackupCard />
      <AboutCard />

      <div className="space-y-1 pt-4 text-center text-xs text-muted-foreground">
        <p>{t("page.tagline")}</p>
        <p className="scale-75 font-mono text-muted-foreground">
          {randomPhrase} - {buildLabel}
        </p>
      </div>

      <FloatingBackButton to="/" title={tNav("home")} />
    </AppPageShell>
  );
}
