// Profile-aware validation for a ReportSpec. Runs AFTER Zod parses the
// structural shape. Rejects specs whose aggregation is invalid for the
// column's semantic ROLE — no silent substitutions. The validator's job
// is to fail loud so /api/compose can retry the model with the reason,
// and the section-level error boundary can show its editorial fallback
// rather than a wrong number.

import type { ColumnRole, DatasetProfile } from "./profile";
import type { Agg } from "./aggregate";
import type { ReportSpec } from "./spec";

export type ValidationResult =
  { ok: true; spec: ReportSpec; warnings: string[] } | { ok: false; errors: string[] };

// Role/agg compatibility matrix. Anything not listed is rejected.
const COMPAT: Record<Agg, ColumnRole[]> = {
  sum: ["measure"],
  avg: ["measure"],
  min: ["measure"],
  max: ["measure"],
  percent_of_total: ["measure", "identifier", "dimension", "temporal"],
  // ^ percent_of_total operates on row shape (share of total), so it is
  //   role-agnostic here; the column just names the bucket target.
  count: ["measure", "identifier", "dimension", "temporal"],
  distinct_count: ["measure", "identifier", "dimension", "temporal"],
  null_count: ["measure", "identifier", "dimension", "temporal"],
  non_null_count: ["measure", "identifier", "dimension", "temporal"],
};

// Aggs that would silently misrepresent an identifier: summing MPANs, etc.
const IDENTIFIER_FORBIDDEN = new Set<Agg>(["sum", "avg", "min", "max"]);

export function validateSpec(spec: ReportSpec, profile: DatasetProfile): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byName = new Map(profile.columns.map((c) => [c.name, c]));

  const need = (col: string, where: string) => {
    if (!byName.has(col)) errors.push(`${where}: column "${col}" not in dataset`);
  };

  const checkAgg = (col: string, agg: Agg, where: string) => {
    const c = byName.get(col);
    if (!c) return; // already reported by need()
    const allowed = COMPAT[agg];
    if (!allowed) {
      errors.push(`${where}: unknown aggregation "${agg}"`);
      return;
    }
    if (!allowed.includes(c.role)) {
      errors.push(
        `${where}: "${agg}" is not valid on ${c.role} column "${col}". ` +
          `Use one of ${COMPAT.count.includes(c.role) ? '"count", "distinct_count", "null_count", "non_null_count"' : '"sum", "avg", "min", "max"'}.`,
      );
      return;
    }
    if (c.role === "identifier" && IDENTIFIER_FORBIDDEN.has(agg)) {
      errors.push(
        `${where}: "${agg}" on identifier column "${col}" would silently misrepresent an id. Use "distinct_count" for unique-value counts or "count" for row totals.`,
      );
    }
  };

  for (const k of spec.kpis) {
    need(k.value_expr.column, `kpi "${k.label}"`);
    checkAgg(k.value_expr.column, k.value_expr.agg as Agg, `kpi "${k.label}"`);
    if (k.value_expr.filter) need(k.value_expr.filter.column, `kpi "${k.label}" filter`);
  }

  const cleanedSections = spec.sections.map((s) => {
    const c = s.chart;
    need(c.x, `section "${s.heading}" x`);
    need(c.y, `section "${s.heading}" y`);
    checkAgg(c.y, c.agg as Agg, `section "${s.heading}"`);
    if (c.filter) need(c.filter.column, `section "${s.heading}" filter`);

    let series = c.series;
    let type = c.type;
    let x_bucket = c.x_bucket;
    if (x_bucket) {
      const xc = byName.get(c.x);
      if (xc && xc.role !== "temporal") {
        // Bucketing a non-date axis is meaningless — rendering constraint,
        // not a metric substitution, so drop with a warning.
        warnings.push(
          `section "${s.heading}": x_bucket "${x_bucket}" dropped — "${c.x}" is not temporal`,
        );
        x_bucket = undefined;
      }
    }
    if (series) {
      const sc = byName.get(series);
      if (!sc) {
        errors.push(`section "${s.heading}": series column "${series}" not in dataset`);
      } else if (sc.cardinality > 8) {
        // Rendering constraint (legend blows up), NOT a metric substitution.
        // The metric requested by the model is preserved on the x axis.
        warnings.push(
          `section "${s.heading}": dropped series "${series}" (cardinality ${sc.cardinality} > 8)`,
        );
        series = undefined;
      }
    }
    if (type === "stacked_bar" && !series) {
      warnings.push(`section "${s.heading}": stacked_bar with no series → downgraded to bar`);
      type = "bar";
    }
    return { ...s, chart: { ...c, type, series, x_bucket } };
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, spec: { ...spec, sections: cleanedSections }, warnings };
}
