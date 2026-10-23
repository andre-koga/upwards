import { useSearchParams } from "react-router-dom";
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
import { AboutCard } from "@/components/settings/navigation-cards";
import { SettingsNav } from "@/components/settings/settings-nav";
import {
  availableSettingsPanels,
  parseSettingsPanel,
  type SettingsPanel,
} from "@/lib/settings/panels";
import { useAuth } from "@/lib/use-auth";

function PanelContent({ panel }: { panel: SettingsPanel }) {
  const { t } = useTranslation("settings");
  const buildLabel = import.meta.env.VITE_APP_BUILD_TIMESTAMP ?? "dev";
  const randomPhrase = import.meta.env.VITE_APP_RANDOM_PHRASE ?? "hey there!";

  switch (panel) {
    case "general":
      return (
        <>
          <AppearanceCard />
          <LanguageCard />
        </>
      );
    case "journal":
      return (
        <>
          <PrivacyOptInsCard />
          <HolidaysCard />
        </>
      );
    case "account":
      return (
        <>
          <AuthCard />
          <SyncCard />
        </>
      );
    case "ai":
      return <AiCard />;
    case "data":
      return <BackupCard />;
    case "about":
      return (
        <>
          <AboutCard />
          <div className="space-y-1 pt-4 text-center text-xs text-muted-foreground">
            <p>{t("page.tagline")}</p>
            <p className="scale-75 font-mono text-muted-foreground">
              {randomPhrase} - {buildLabel}
            </p>
          </div>
        </>
      );
  }
}

export default function SettingsPage() {
  const { t } = useTranslation("settings");
  const { t: tNav } = useTranslation("nav");
  const { isSupabaseConfigured } = useAuth();
  const [searchParams] = useSearchParams();

  const panels = availableSettingsPanels(isSupabaseConfigured);
  const panel = parseSettingsPanel(
    searchParams.get("panel"),
    isSupabaseConfigured
  );

  return (
    <AppPageShell
      title={t("page.title")}
      subtitle={t("page.subtitle")}
      className="space-y-3"
    >
      <div className="space-y-3 lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:items-start lg:gap-x-6 lg:space-y-0">
        <SettingsNav panels={panels} current={panel} />
        <div
          role="region"
          aria-label={t(`panels.${panel}`)}
          className="min-w-0 space-y-3"
        >
          <PanelContent panel={panel} />
        </div>
      </div>

      <FloatingBackButton to="/you" title={tNav("tabs.you")} />
    </AppPageShell>
  );
}
