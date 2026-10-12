/** True on Apple platforms, where the shortcut modifier is ⌘ instead of Ctrl. */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform ?? navigator.platform;
  return /mac|iphone|ipad|ipod/i.test(platform ?? "");
}

export function modifierLabel(): string {
  return isApplePlatform() ? "⌘" : "Ctrl";
}
