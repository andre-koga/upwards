import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // Brand palette (design-and-branding.md §2.3). Channel triplets in
        // index.css, so opacity modifiers work: bg-paper/70, border-line/60.
        // `extend` merges with Tailwind's own scales, so green-500 etc. remain.
        canvas: {
          DEFAULT: "hsl(var(--canvas) / <alpha-value>)",
          deep: "hsl(var(--canvas-deep) / <alpha-value>)",
        },
        paper: "hsl(var(--paper) / <alpha-value>)",
        line: {
          DEFAULT: "hsl(var(--line) / <alpha-value>)",
          strong: "hsl(var(--line-strong) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "hsl(var(--ink) / <alpha-value>)",
          muted: "hsl(var(--ink-muted) / <alpha-value>)",
          faint: "hsl(var(--ink-faint) / <alpha-value>)",
        },
        sage: "hsl(var(--sage) / <alpha-value>)",
        green: {
          DEFAULT: "hsl(var(--green) / <alpha-value>)",
          deep: "hsl(var(--green-deep) / <alpha-value>)",
        },
        terracotta: {
          DEFAULT: "hsl(var(--terracotta) / <alpha-value>)",
          text: "hsl(var(--terracotta-text) / <alpha-value>)",
        },
        gold: {
          DEFAULT: "hsl(var(--gold) / <alpha-value>)",
          text: "hsl(var(--gold-text) / <alpha-value>)",
        },
        lavender: "hsl(var(--lavender) / <alpha-value>)",
      },
      fontFamily: {
        crimson: ["Crimson Pro", "serif"],
        display: ["Newsreader", "serif"],
        preview: ["Manrope", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
