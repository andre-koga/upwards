/**
 * Settings is a few panels, not one long list (ui-system-and-responsive-layout.md:
 * "Settings navigation beside the selected panel"). The panel is in the address
 * (`/settings?panel=ai`), so Back, a reload and a link from elsewhere land on
 * the same panel.
 *
 * Each panel groups settings a person looks for together. Two of them exist only
 * with an account service: without one there is no account, no sync and no AI to
 * set up, so those panels are not offered rather than shown empty.
 */
export const SETTINGS_PANELS = [
  "general",
  "journal",
  "account",
  "ai",
  "data",
  "about",
] as const;

export type SettingsPanel = (typeof SETTINGS_PANELS)[number];

export const DEFAULT_SETTINGS_PANEL: SettingsPanel = "general";

/** Panels that need the account service (sync, sign-in, AI through the account). */
const NEEDS_ACCOUNT_SERVICE: ReadonlySet<SettingsPanel> = new Set([
  "account",
  "ai",
]);

/** The panels on offer, in the order they are listed. */
export function availableSettingsPanels(
  hasAccountService: boolean
): SettingsPanel[] {
  return SETTINGS_PANELS.filter(
    (panel) => hasAccountService || !NEEDS_ACCOUNT_SERVICE.has(panel)
  );
}

/**
 * The panel named in the address, or the first one for anything else: a typo, a
 * panel from an older link, or one this build does not offer.
 */
export function parseSettingsPanel(
  value: string | null,
  hasAccountService: boolean
): SettingsPanel {
  const available = availableSettingsPanels(hasAccountService);
  return available.find((panel) => panel === value) ?? DEFAULT_SETTINGS_PANEL;
}

/** The address of a panel. The first is the bare `/settings`. */
export function settingsPanelPath(panel: SettingsPanel): string {
  return panel === DEFAULT_SETTINGS_PANEL
    ? "/settings"
    : `/settings?panel=${panel}`;
}
