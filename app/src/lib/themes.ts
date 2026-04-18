import type { LucideIcon } from "lucide-react";
import { Coffee, Laptop, Moon, Rainbow, Sparkles, Stone, Sun, Sunset, Trees, Waves, Zap } from "lucide-react";

export type ThemeModeValue = "system" | "light" | "dark";

export type PaletteValue = "default" | "ocean" | "sunset" | "forest" | "mocha" | "cyberpunk" | "pastel dreams" | "graphite" | "jellyfish";

export interface ThemeModeOption {
    value: ThemeModeValue;
    label: string;
    icon: LucideIcon;
}

export interface PaletteOption {
    value: PaletteValue;
    label: string;
    icon: LucideIcon;
}

export const THEME_MODE_OPTIONS: ThemeModeOption[] = [
    { value: "system", label: "System", icon: Laptop },
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
];

export const PALETTE_OPTIONS: PaletteOption[] = [
    { value: "default", label: "Classic", icon: Sun },
    { value: "ocean", label: "Ocean Breeze", icon: Waves },
    { value: "sunset", label: "Warm Sunset", icon: Sunset },
    { value: "forest", label: "Deep Forest", icon: Trees },
    { value: "mocha", label: "Hot Mocha", icon: Coffee },
    { value: "cyberpunk", label: "Cyberpunk", icon: Sparkles },
    { value: "pastel dreams", label: "Pastel Dreams", icon: Rainbow },
    { value: "graphite", label: "Pure Graphite", icon: Stone },
    { value: "jellyfish", label: "Jellyfish", icon: Zap },
];

export const DEFAULT_PALETTE: PaletteValue = "default";