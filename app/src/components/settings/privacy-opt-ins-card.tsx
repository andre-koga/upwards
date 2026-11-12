import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Clapperboard, MapPin } from "lucide-react";

import {
  SettingsGroup,
  SettingsRow,
} from "@/components/settings/settings-list";
import { Switch } from "@/components/ui/switch";
import { updateAccountSettings } from "@/lib/account-settings";
import {
  requestLocationPermission,
  type LocationProblem,
} from "@/lib/location-permission";
import { useAccountSettings } from "@/lib/use-account-settings";

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
    <SettingsGroup title={t("optIns.title")} footer={t("optIns.description")}>
      <SettingsRow
        htmlFor="opt-in-auto-location"
        icon={MapPin}
        label={t("optIns.autoLocation.label")}
        hint={t("optIns.autoLocation.hint")}
        hintId="opt-in-auto-location-hint"
        control={
          <Switch
            id="opt-in-auto-location"
            aria-describedby="opt-in-auto-location-hint"
            checked={autoLocation === true}
            disabled={checking}
            onCheckedChange={(next) => void handleAutoLocation(next)}
          />
        }
      >
        {problem ? (
          <p role="alert" className="text-xs text-destructive">
            {t(`optIns.autoLocation.${problem}`)}
          </p>
        ) : null}
      </SettingsRow>
      <SettingsRow
        htmlFor="opt-in-daily-clip"
        icon={Clapperboard}
        label={t("optIns.dailyClip.label")}
        hint={t("optIns.dailyClip.hint")}
        hintId="opt-in-daily-clip-hint"
        control={
          <Switch
            id="opt-in-daily-clip"
            aria-describedby="opt-in-daily-clip-hint"
            checked={dailyClip === true}
            onCheckedChange={(next) =>
              updateAccountSettings({ dailyClip: next })
            }
          />
        }
      />
    </SettingsGroup>
  );
}
