// Heuristic ReportSpec generator for user-uploaded datasets in Phase 2.
// This is a placeholder for Phase 3's Claude call — same output shape,
// same aggregation pipeline. Deterministic, profile-driven, no arithmetic.

import type { DatasetProfile } from "./profile";
import type { ReportSpec, Section, Kpi } from "./spec";
import type { FormatKind } from "./format";

function guessFormat(name: string): FormatKind {
  const n = name.toLowerCase();
  if (/(revenue|price|amount|cost|spend|gbp|usd|eur|£|\$|€|value|sales)/.test(n)) return "currency";
  if (/(rate|pct|percent|ratio|share|%)/.test(n)) return "percent";
  if (/(count|customers|users|orders|sessions|visits|units)/.test(n)) return "compact";
  return "number";
}

export function autoSpec(profile: DatasetProfile, brief: string, filename: string): ReportSpec | null {
  const numeric = profile.columns.filter((c) => c.type === "numeric");
  if (numeric.length === 0) return null;
  const date = profile.columns.find((c) => c.type === "date");
  const cats = profile.columns.filter((c) => c.type === "categorical" && c.cardinality <= 12);
  const smallCat = cats.find((c) => c.cardinality <= 6);
  const wideCat = cats.find((c) => c.cardinality > 6) ?? cats[1] ?? cats[0];

  const primary = numeric[0];
  const secondary = numeric[1];

  const title = filename.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ").trim();

  const kpis: Kpi[] = [];
  kpis.push({ label: `Total ${primary.name}`, value_expr: { agg: "sum", column: primary.name }, format: guessFormat(primary.name) });
  if (secondary) {
    kpis.push({ label: `Total ${secondary.name}`, value_expr: { agg: "sum", column: secondary.name }, format: guessFormat(secondary.name) });
  }
  kpis.push({ label: "Rows", value_expr: { agg: "count", column: primary.name }, format: "compact" });
  if (date) {
    kpis.push({ label: `Avg ${primary.name}`, value_expr: { agg: "avg", column: primary.name }, format: guessFormat(primary.name) });
  } else if (cats[0]) {
    kpis.push({ label: `Distinct ${cats[0].name}`, value_expr: { agg: "count", column: cats[0].name }, format: "number" });
  }

  const sections: Section[] = [];
  if (date) {
    sections.push({
      heading: `${primary.name} over time`,
      insight_sentence: `Monthly trend for ${primary.name} across the recorded period. Look for direction and any breaks.`,
      chart: { type: "line", x: date.name, y: primary.name, agg: "sum" },
    });
    if (secondary) {
      sections.push({
        heading: `${secondary.name} over time`,
        insight_sentence: `A parallel view of ${secondary.name}, to compare cadence against the headline measure.`,
        chart: { type: "area", x: date.name, y: secondary.name, agg: "sum" },
      });
    }
    if (smallCat) {
      sections.push({
        heading: `${primary.name} by ${smallCat.name}`,
        insight_sentence: `Composition of ${primary.name} by ${smallCat.name} across each month.`,
        chart: { type: "stacked_bar", x: date.name, y: primary.name, series: smallCat.name, agg: "sum" },
      });
    }
  }
  if (smallCat) {
    sections.push({
      heading: `${primary.name} share by ${smallCat.name}`,
      insight_sentence: `Part-to-whole view of ${primary.name} across ${smallCat.name}.`,
      chart: { type: "donut", x: smallCat.name, y: primary.name, agg: "sum" },
    });
  }
  if (wideCat) {
    sections.push({
      heading: `${wideCat.name} ranked`,
      insight_sentence: `Total ${primary.name} by ${wideCat.name}. Ordering matters more than the axis.`,
      chart: { type: "horizontal_bar", x: wideCat.name, y: primary.name, agg: "sum" },
    });
  }
  const usedCat = smallCat && smallCat !== wideCat ? smallCat : wideCat;
  if (usedCat && !sections.some((s) => s.chart.type === "bar")) {
    sections.push({
      heading: `${primary.name} by ${usedCat.name}`,
      insight_sentence: `Straight comparison of ${primary.name} across ${usedCat.name}.`,
      chart: { type: "bar", x: usedCat.name, y: primary.name, agg: "sum" },
    });
  }
  if (sections.length === 0) {
    sections.push({
      heading: primary.name,
      insight_sentence: `Single headline for ${primary.name}.`,
      chart: { type: "single_stat", x: primary.name, y: primary.name, agg: "sum" },
    });
  }

  return {
    report_title: title || "Dataset report",
    generated_summary: `The dataset carries ${profile.rowCount.toLocaleString("en-GB")} rows and ${profile.columns.length} columns. The brief: ${brief.trim() || "no explicit brief — the report follows the shape of the data."}`,
    kpis: kpis.slice(0, 5),
    sections: sections.slice(0, 6),
  };
}
