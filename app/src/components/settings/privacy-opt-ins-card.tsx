import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Clapperboard, MapPin } from "lucide-react";

import { Label } from "@/components/ui/label";
import { SettingsSection } from "@/components/ui/settings-section";
import { Switch } from "@/components/ui/switch";
import { updateAccountSettings } from "@/lib/account-settings";
import { useAccountSettings } from "@/lib/use-account-settings";

type LocationProblem = "denied" | "unsupported" | null;

/**
 * Asks the browser for location permission once, so the prompt appears while the
 * user is looking at the switch they just flipped, not later on Today. Resolves
 * to the problem, if any.
 */
function requestLocationPermission(): Promise<LocationProblem> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve("unsupported");
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve(null),
      (error) =>
        // Only an explicit refusal blocks. A timeout or an unavailable fix is
        // not a refusal, and the setting can still be on.
        resolve(error.code === error.PERMISSION_DENIED ? "denied" : null),
      { timeout: 10_000, maximumAge: 5 * 60_000 }
    );
  });
}

export function PrivacyOptInsCard() {
  const { t } = useTranslation("settings");
  const { autoLocation, dailyClip } = useAccountSettings();
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<LocationProblem>(null);

  const handleAutoLocation = async (next: boolean) => {
    setProblem(null);
    if (!next) {
      updateAccountSettings({ autoLocation: false });
      return;
    }
    setChecking(true);
    const result = await requestLocationPermission();
    setChecking(false);
    if (result) {
      // Stays off: the app must not claim to be locating when it cannot.
      setProblem(result);
      return;
    }
    updateAccountSettings({ autoLocation: true });
  };

  return (
    <SettingsSection
      title={t("optIns.title")}
      icon={MapPin}
      description={t("optIns.description")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <Label htmlFor="opt-in-auto-location" className="leading-snug">
            {t("optIns.autoLocation.label")}
          </Label>
          <p
            id="opt-in-auto-location-hint"
            className="text-xs leading-relaxed text-muted-foreground"
          >
            {t("optIns.autoLocation.hint")}
          </p>
          {problem ? (
            <p role="alert" className="text-xs text-destructive">
              {t(`optIns.autoLocation.${problem}`)}
            </p>
          ) : null}
        </div>
        <Switch
          id="opt-in-auto-location"
          aria-describedby="opt-in-auto-location-hint"
          checked={autoLocation === true}
          disabled={checking}
          onCheckedChange={(next) => void handleAutoLocation(next)}
        />
      </div>

      <div className="flex items-start justify-between gap-4 border-t border-border pt-3">
        <div className="min-w-0 space-y-1">
          <Label
            htmlFor="opt-in-daily-clip"
            className="flex items-center gap-1.5 leading-snug"
          >
            <Clapperboard className="h-3.5 w-3.5" aria-hidden />
            {t("optIns.dailyClip.label")}
          </Label>
          <p
            id="opt-in-daily-clip-hint"
            className="text-xs leading-relaxed text-muted-foreground"
          >
            {t("optIns.dailyClip.hint")}
          </p>
        </div>
        <Switch
          id="opt-in-daily-clip"
          aria-describedby="opt-in-daily-clip-hint"
          checked={dailyClip === true}
          onCheckedChange={(next) => updateAccountSettings({ dailyClip: next })}
        />
      </div>
    </SettingsSection>
  );
}
