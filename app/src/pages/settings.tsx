import { useTranslation } from "react-i18next";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { AppPageShell } from "@/components/layout/app-page-shell";
import { AppearanceCard } from "@/components/settings/appearance-card";
import { LanguageCard } from "@/components/settings/language-card";
import { AuthCard } from "@/components/settings/auth-card";
import { ProfileCard } from "@/components/settings/profile-card";
import { SyncCard } from "@/components/settings/sync-card";
import { TaskOrderCard } from "@/components/settings/navigation-cards";
import { DayResetCard } from "@/components/settings/day-reset-card";
import { useAuth } from "@/lib/use-auth";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const SECTION_IDS = [
  "appearance",
  "language",
  "day-reset",
  "account",
  "tasks",
] as const;

type SectionId = (typeof SECTION_IDS)[number];

export default function SettingsPage() {
  const { t } = useTranslation("settings");
  const { t: tNav } = useTranslation("nav");
  const { isSupabaseConfigured, isAuthed } = useAuth();
  const buildLabel = import.meta.env.VITE_APP_BUILD_TIMESTAMP ?? "dev";
  const randomPhrase = import.meta.env.VITE_APP_RANDOM_PHRASE ?? "hey there!";

  const navItems: { id: SectionId; label: string; show?: boolean }[] = [
    { id: "appearance", label: t("appearance.title") },
    { id: "language", label: t("language.title") },
    { id: "day-reset", label: t("dayReset.title") },
    {
      id: "account",
      label: t("auth.title"),
      show: isSupabaseConfigured,
    },
    { id: "tasks", label: t("taskOrder.title") },
  ];

  const scrollToSection = (id: SectionId) => {
    document
      .getElementById(`settings-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <AppPageShell
      title={t("page.title")}
      subtitle={t("page.subtitle")}
      className="space-y-3 md:max-w-5xl"
      breadcrumbs={[
        { label: tNav("today"), to: "/" },
        { label: t("page.title") },
      ]}
    >
      <div className="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        <nav
          aria-label={t("page.title")}
          className="mb-4 hidden lg:sticky lg:top-4 lg:mb-0 lg:block"
        >
          <ul className="space-y-1">
            {navItems
              .filter((item) => item.show !== false)
              .map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={cn(
                      "w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors",
                      "hover:bg-muted hover:text-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                    onClick={() => scrollToSection(item.id)}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
          </ul>
        </nav>

        <div className="space-y-3">
          <section id="settings-appearance" className="scroll-mt-4">
            <AppearanceCard />
          </section>
          <section id="settings-language" className="scroll-mt-4">
            <LanguageCard />
          </section>
          <section id="settings-day-reset" className="scroll-mt-4">
            <DayResetCard />
          </section>

          {isSupabaseConfigured ? (
            <section id="settings-account" className="scroll-mt-4 space-y-3">
              <AuthCard />
              {isAuthed ? <ProfileCard /> : null}
              <SyncCard />
            </section>
          ) : null}

          <section id="settings-tasks" className="scroll-mt-4">
            <TaskOrderCard />
          </section>

          <Separator className="my-4" />

          <div className="space-y-1 pt-2 text-center text-xs text-muted-foreground">
            <p>{t("page.tagline")}</p>
            <p className="scale-75 font-mono text-muted-foreground">
              {randomPhrase} - {buildLabel}
            </p>
          </div>
        </div>
      </div>

      <FloatingBackButton to="/" title={tNav("home")} />
    </AppPageShell>
  );
}
