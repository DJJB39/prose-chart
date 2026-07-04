// Profile-aware validation for a ReportSpec. Runs AFTER Zod parses the
// structural shape. Rejects specs that reference columns that do not exist
// in the dataset, or that ask for numeric aggregations on non-numeric
// columns. Silently drops series bindings whose cardinality would blow up
// a legend rather than failing the whole report.

import type { DatasetProfile } from "./profile";
import type { ReportSpec } from "./spec";

export type ValidationResult =
  | { ok: true; spec: ReportSpec; warnings: string[] }
  | { ok: false; errors: string[] };

const NUMERIC_AGGS = new Set(["sum", "avg", "min", "max"]);

export function validateSpec(spec: ReportSpec, profile: DatasetProfile): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byName = new Map(profile.columns.map((c) => [c.name, c]));

  const need = (col: string, where: string) => {
    if (!byName.has(col)) errors.push(`${where}: column "${col}" not in dataset`);
  };
  const needNumeric = (col: string, agg: string, where: string) => {
    if (!NUMERIC_AGGS.has(agg)) return;
    const c = byName.get(col);
    if (c && c.type !== "numeric") {
      errors.push(`${where}: "${agg}" needs numeric column, "${col}" is ${c.type}`);
    }
  };

  for (const k of spec.kpis) {
    need(k.value_expr.column, `kpi "${k.label}"`);
    needNumeric(k.value_expr.column, k.value_expr.agg, `kpi "${k.label}"`);
    if (k.value_expr.filter) need(k.value_expr.filter.column, `kpi "${k.label}" filter`);
  }

  const cleanedSections = spec.sections.map((s) => {
    const c = s.chart;
    need(c.x, `section "${s.heading}" x`);
    need(c.y, `section "${s.heading}" y`);
    needNumeric(c.y, c.agg, `section "${s.heading}"`);
    if (c.filter) need(c.filter.column, `section "${s.heading}" filter`);
    let series = c.series;
    let type = c.type;
    if (series) {
      const sc = byName.get(series);
      if (!sc) {
        errors.push(`section "${s.heading}": series column "${series}" not in dataset`);
      } else if (sc.cardinality > 8) {
        warnings.push(`section "${s.heading}": dropped series "${series}" (cardinality ${sc.cardinality} > 8)`);
        series = undefined;
      }
    }
    // A stacked_bar without a series is undefined — downgrade to a plain bar.
    if (type === "stacked_bar" && !series) {
      warnings.push(`section "${s.heading}": stacked_bar with no series → downgraded to bar`);
      type = "bar";
    }
    return { ...s, chart: { ...c, type, series } };
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, spec: { ...spec, sections: cleanedSections }, warnings };
}
