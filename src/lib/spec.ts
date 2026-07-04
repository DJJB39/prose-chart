// ReportSpec — validated shape returned by the AI provider. Zod is the
// source of truth; TS types are derived. Numbers are never stated by the
// spec; every value shown in the report is computed by aggregate.ts.

import { z } from "zod";

export const AggSchema = z.enum([
  "sum",
  "avg",
  "count",
  "distinct_count",
  "null_count",
  "non_null_count",
  "percent_of_total",
  "min",
  "max",
]);
export const FormatSchema = z.enum(["currency", "number", "percent", "compact"]);
export const ChartTypeSchema = z.enum([
  "line", "bar", "stacked_bar", "area", "donut", "horizontal_bar", "single_stat",
]);

export const FilterSchema = z.object({
  column: z.string().min(1),
  equals: z.string().min(1),
});

export const KpiSchema = z.object({
  label: z.string().min(1).max(60),
  value_expr: z.object({
    agg: AggSchema,
    column: z.string().min(1),
    filter: FilterSchema.optional(),
  }),
  format: FormatSchema,
  trend: z
    .object({
      direction: z.enum(["up", "down", "flat"]),
      delta_expr: z.string().optional(),
    })
    .optional(),
});

export const SectionSchema = z.object({
  heading: z.string().min(1).max(80),
  insight_sentence: z.string().min(1).max(360),
  chart: z.object({
    type: ChartTypeSchema,
    x: z.string().min(1),
    y: z.string().min(1),
    series: z.string().min(1).optional(),
    agg: AggSchema,
    filter: FilterSchema.optional(),
  }),
});

export const ReportSpecSchema = z.object({
  report_title: z.string().min(1).max(120),
  generated_summary: z.string().min(1).max(900),
  kpis: z.array(KpiSchema).min(1).max(6),
  sections: z.array(SectionSchema).min(1).max(8),
  final_conclusion: z.string().max(500).optional(),
});

export type Kpi = z.infer<typeof KpiSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type ReportSpec = z.infer<typeof ReportSpecSchema>;
export type ChartType = z.infer<typeof ChartTypeSchema>;
