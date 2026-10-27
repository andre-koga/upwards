/**
 * The one AI visual language (design-and-branding.md §4). The gradients are
 * defined once as CSS variables in `index.css`; use these constants, never a
 * re-authored gradient.
 *
 * - `aiGradient`: radial, for a full-bleed tier-1 surface. At most one is
 *   visible per screen.
 * - `onAi`: the near-white text color for anything drawn on `aiGradient`.
 *
 * The linear gradient (`--ai-gradient-linear`) is the tier-2 edge. The weekly
 * letter is the first surface that uses it.
 */
export const aiGradient = "var(--ai-gradient)";
export const aiGradientLinear = "var(--ai-gradient-linear)";
export const onAi = "hsl(var(--on-ai))";
