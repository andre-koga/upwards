import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppPageShell } from "@/components/layout/app-page-shell";
import { GeneralSettingsGroup } from "@/components/settings/appearance-card";
import { HolidaysCard } from "@/components/settings/holidays-card";
import { PrivacyOptInsCard } from "@/components/settings/privacy-opt-ins-card";
import { AuthCard } from "@/components/settings/auth-card";
import { SyncCard } from "@/components/settings/sync-card";
import { AiCard } from "@/components/settings/ai-card";
import { BackupCard } from "@/components/settings/backup-card";
import { AboutCard } from "@/components/settings/navigation-cards";
import {
  SettingsActionRow,
  SettingsGroup,
} from "@/components/settings/settings-list";
import { FULL_APP_URL, isYouMode } from "@/lib/app-mode";
import { useIsGuest } from "@/lib/guest";
import { useAuth } from "@/lib/use-auth";
import { AppWindow } from "lucide-react";

/**
 * Every setting on one page, in one list. Technical things (sync, updates,
 * backup, error logs) are here too, not on another tab. `/settings#ai` scrolls
 * to the section with that id.
 */
export default function SettingsPage() {
  const { t } = useTranslation("settings");
  const { isSupabaseConfigured } = useAuth();
  const guest = useIsGuest();
  const buildLabel = import.meta.env.VITE_APP_BUILD_TIMESTAMP ?? "dev";
  const randomPhrase = import.meta.env.VITE_APP_RANDOM_PHRASE ?? "hey there!";
  const { hash } = useLocation();

  useLayoutEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash]);

  return (
    <AppPageShell
      title={t("page.title")}
      subtitle={t("page.subtitle")}
      className="space-y-9"
    >
      <GeneralSettingsGroup />
      {isYouMode ? null : <PrivacyOptInsCard />}
      {isYouMode ? null : <HolidaysCard />}
      {isSupabaseConfigured ? <AuthCard /> : null}
      {guest ? null : <SyncCard />}
      {isYouMode ? null : <BackupCard />}
      {isSupabaseConfigured && !isYouMode ? <AiCard /> : null}
      {isYouMode ? (
        <SettingsGroup title={t("fullApp.title")}>
          <SettingsActionRow
            href={FULL_APP_URL}
            icon={AppWindow}
            label={t("fullApp.open")}
            hint={t("fullApp.hint")}
          />
        </SettingsGroup>
      ) : null}
      <AboutCard />
      <div className="space-y-1 pb-2 pt-2 text-center text-xs text-muted-foreground">
        <p>{t("page.tagline")}</p>
        <p className="text-[0.6875rem] tabular-nums text-muted-foreground/70">
          {randomPhrase} - {buildLabel}
        </p>
      </div>
    </AppPageShell>
  );
}
