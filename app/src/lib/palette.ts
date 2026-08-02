import {
  DEFAULT_PALETTE,
  PALETTE_OPTIONS,
  type PaletteValue,
} from "@/lib/themes";

const PALETTE_STORAGE_KEY = "upwards-color-palette";

export function isPaletteValue(value: string): value is PaletteValue {
  return PALETTE_OPTIONS.some((palette) => palette.value === value);
}

export function getStoredPalette(): PaletteValue {
  if (typeof window === "undefined") {
    return DEFAULT_PALETTE;
  }

  const storedPalette = localStorage.getItem(PALETTE_STORAGE_KEY);
  if (storedPalette && isPaletteValue(storedPalette)) {
    return storedPalette;
  }

  return DEFAULT_PALETTE;
}

export function applyPalette(palette: PaletteValue): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.setAttribute("data-palette", palette);
}

export function setStoredPalette(palette: PaletteValue): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(PALETTE_STORAGE_KEY, palette);
  }
  applyPalette(palette);
}

export function initializeStoredPalette(): void {
  applyPalette(getStoredPalette());
}
