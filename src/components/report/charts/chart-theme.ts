// Shared chart theming primitives. Both light and ink themes read from
// CSS variables, so a single element controls colour for every chart at once.

export const CHART_FONT = "Inter Tight Variable, Inter Tight, sans-serif";

export function useChartTokens() {
  // Read tokens via CSS variables to stay in lockstep with the theme toggle.
  return {
    ink: "var(--ink)",
    inkMuted: "var(--ink-muted)",
    rule: "var(--rule)",
    paper: "var(--paper)",
    accent: "var(--accent)",
  };
}

export const AXIS_TICK = {
  fill: "var(--ink-muted)",
  fontSize: 11,
  fontFamily: CHART_FONT,
};

export const TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--paper)",
  border: "1px solid var(--rule)",
  borderRadius: 2,
  fontSize: 12,
  fontFamily: CHART_FONT,
  color: "var(--ink)",
  boxShadow: "none",
};
