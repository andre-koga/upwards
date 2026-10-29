/**
 * The one AI visual language (design-and-branding.md §4). The gradients are
 * defined once as CSS variables in `index.css`; use these constants, never a
 * re-authored gradient.
 *
 * - `aiGradient`: radial, for a full-bleed tier-1 surface. At most one is
 *   visible per screen.
 * - `onAi`: the near-white text color for anything drawn on `aiGradient`.
 *
 * The linear gradient (`--ai-gradient-linear`, for badges, hairline accents and
 * 1.5px borders) is defined in `index.css` too. Nothing uses it yet; add its
 * constant here when the first tier-2 or tier-3 surface does.
 */
export const aiGradient = "var(--ai-gradient)";
export const onAi = "hsl(var(--on-ai))";
