// ReportSpec — the shape returned by Claude in Phase 3, hand-authored here
// for Phase 2 so the composition pipeline is real. Every number below is
// computed from the full dataset in aggregate.ts, not stated by the spec.

import type { Agg } from "./aggregate";
import type { FormatKind } from "./format";

export type ChartType =
  | "line" | "bar" | "stacked_bar" | "area"
  | "donut" | "horizontal_bar" | "single_stat";

export type Kpi = {
  label: string;
  value_expr: {
    agg: Agg;
    column: string;
    filter?: { column: string; equals: string };
  };
  format: FormatKind;
  trend?: { direction: "up" | "down" | "flat"; delta_expr?: string };
};

export type Section = {
  heading: string;
  insight_sentence: string;
  chart: {
    type: ChartType;
    x: string;
    y: string;
    series?: string;
    agg: Agg;
    filter?: { column: string; equals: string };
  };
};

export type ReportSpec = {
  report_title: string;
  generated_summary: string;
  kpis: Kpi[];
  sections: Section[];
  final_conclusion?: string;
};
