import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { tabForShortcutKey } from "@/lib/navigation/destinations";

function modalIsOpen(): boolean {
  return (
    document.querySelector('[role="dialog"], [role="alertdialog"]') !== null
  );
}

/**
 * Desktop shortcuts (design-and-branding.md §6): ⌘/Ctrl+K toggles the palette,
 * ⌘/Ctrl+1–4 open the tabs. Every action is also reachable by pointer and by
 * Tab, so these are accelerators, not the only path.
 */
export function useAppShortcuts({
  enabled,
  onTogglePalette,
}: {
  enabled: boolean;
  onTogglePalette: () => void;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.altKey) return;
      if (!(event.metaKey || event.ctrlKey)) return;

      if (event.key.toLowerCase() === "k" && !event.shiftKey) {
        event.preventDefault();
        onTogglePalette();
        return;
      }

      if (event.shiftKey) return;
      const tab = tabForShortcutKey(event.key);
      // Leave the page alone while another dialog owns the keyboard.
      if (tab && !modalIsOpen()) {
        event.preventDefault();
        navigate(tab.to);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, navigate, onTogglePalette]);
}
