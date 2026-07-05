// The single touchpoint for sharing.
//
// Everything a share link needs is a PreparedReport: computed aggregates,
// palette, KPI values, narrative. The user's source rows never enter this
// module and never enter the URL. When (later) a server-side store is added,
// only this file changes — components import `prepareReport` / `readShare`
// / `persistShare` and know nothing about the payload format.

import LZString from "lz-string";

import {
  aggregateScalar,
  aggregateSeries,
  aggregateStacked,
  blankCount,
  bucketDate,
  isAdditiveAgg,
  isBlank,
  topNWithOther,
  trendDirection,
  type Agg,
  type Row,
  type TimeBucket,
} from "@/lib/aggregate";
import type { FormatKind } from "@/lib/format";
import { buildColorMap, uniqueOrdered, type ColorMap } from "@/lib/palette";
import type { ReportSpec } from "@/lib/spec";

export type PreparedChart =
  | {
      type: "line" | "area" | "bar" | "horizontal_bar";
      data: Array<{ x: string; y: number }>;
      yFormat: FormatKind;
      xIsMonth: boolean;
      xLabel?: "month" | "day" | "raw";
    }
  | {
      type: "donut";
      data: Array<{ x: string; y: number }>;
      yFormat: FormatKind;
    }
  | {
      type: "stacked_bar";
      data: Array<Record<string, string | number>>;
      seriesKeys: string[];
      yFormat: FormatKind;
      xIsMonth: boolean;
      xLabel?: "month" | "day" | "raw";
    }
  | {
      type: "single_stat";
      value: number;
      format: FormatKind;
      footnote?: string;
    };

export type PreparedKpi = {
  label: string;
  value: number;
  format: FormatKind;
  trend?: "up" | "down" | "flat";
  /** Real period-over-period change, computed by the app. pct is a fraction. */
  delta?: { pct: number; period: "month" };
};

export type PreparedSection = {
  heading: string;
  insight: string;
  chart: PreparedChart;
  /** What was computed — kept for the numbers-aware narrative pass. */
  meta?: { x: string; y: string; agg: string };
};

export type PreparedReport = {
  v: 1;
  title: string;
  summary: string;
  brief?: string;
  conclusion?: string;
  sourceFilename: string;
  rowCount: number;
  kpis: PreparedKpi[];
  sections: PreparedSection[];
  colors: ColorMap;
  /** True once the numbers-aware narrative pass has upgraded the prose. */
  narrated?: boolean;
};

// ---------- format inference ----------

/** Format is decided by the AGG first, the column name second. A count of
 *  rows in a "Revenue" cut is a count, not a currency. */
function formatFor(agg: Agg, yName: string): FormatKind {
  if (agg === "percent_of_total") return "percent";
  if (
    agg === "count" ||
    agg === "distinct_count" ||
    agg === "null_count" ||
    agg === "non_null_count"
  ) {
    return "compact";
  }
  return guessFormat(yName);
}

function coerceKpiFormat(agg: Agg, requested: FormatKind): FormatKind {
  if (agg === "percent_of_total") return "percent";
  const countLike =
    agg === "count" || agg === "distinct_count" || agg === "null_count" || agg === "non_null_count";
  if (countLike && requested === "currency") return "compact";
  return requested;
}

function guessFormat(name: string): FormatKind {
  const n = name.toLowerCase();
  if (/(revenue|price|amount|cost|spend|gbp|usd|eur|£|value|sales)/.test(n)) return "currency";
  if (/(rate|pct|percent|ratio|share|%)/.test(n)) return "percent";
  if (/(count|customers|users|orders|sessions|visits|units)/.test(n)) return "compact";
  return "number";
}

function isIsoDateColumn(col: string, rows: Row[]): boolean {
  const sample = rows.find((r) => r[col] !== null && r[col] !== undefined);
  if (!sample) return false;
  return typeof sample[col] === "string" && /^\d{4}-\d{2}-\d{2}/.test(String(sample[col]));
}

/** Distinct non-blank raw values in a column (cheap, capped scan). */
function distinctCount(rows: Row[], col: string, cap = 200): number {
  const seen = new Set<string>();
  for (const r of rows) {
    const v = r[col];
    if (!isBlank(v)) {
      seen.add(String(v));
      if (seen.size >= cap) break;
    }
  }
  return seen.size;
}

/** Pick the effective time bucket for a date-valued x axis. */
function resolveBucket(
  explicit: TimeBucket | undefined,
  rows: Row[],
  x: string,
): TimeBucket | undefined {
  if (explicit) return explicit;
  // Auto-bucket: daily-grain data on a long axis is unreadable. If there are
  // more than 45 distinct dates, roll up to months — same default judgement
  // a good analyst (or Power BI's date hierarchy) would apply.
  return distinctCount(rows, x, 60) > 45 ? "month" : undefined;
}

// ---------- prepare ----------

export function prepareReport(
  spec: ReportSpec,
  rows: Row[],
  meta: { sourceFilename: string; brief?: string },
): PreparedReport {
  const cats: string[] = [];
  for (const s of spec.sections) {
    if (s.chart.series) {
      cats.push(
        ...uniqueOrdered(rows.map((r) => String(r[s.chart.series!])).filter((v) => !isBlank(v))),
      );
    }
    if (s.chart.type === "donut" || s.chart.type === "horizontal_bar" || s.chart.type === "bar") {
      cats.push(...uniqueOrdered(rows.map((r) => String(r[s.chart.x])).filter((v) => !isBlank(v))));
    }
  }
  const colors = buildColorMap(uniqueOrdered(cats));
  // Top-N rollups introduce an "Other" slice that never appears in the raw
  // categories — give it a deliberately muted, stable grey.
  if (!("Other" in colors)) colors["Other"] = "#9aa0a8";

  const dateCol = Object.keys(rows[0] ?? {}).find(
    (c) => typeof rows[0]?.[c] === "string" && /^\d{4}-\d{2}-\d{2}/.test(String(rows[0][c])),
  );

  const monthKey = (v: unknown) => bucketDate(String(v), "month");

  const kpis: PreparedKpi[] = spec.kpis.map((k) => {
    const value = aggregateScalar(rows, k.value_expr.agg, k.value_expr.column, k.value_expr.filter);
    let trend: "up" | "down" | "flat" | undefined;
    let delta: PreparedKpi["delta"];
    if (dateCol) {
      const scoped = k.value_expr.filter
        ? rows.filter((r) => String(r[k.value_expr.filter!.column]) === k.value_expr.filter!.equals)
        : rows;
      const series = aggregateSeries(
        scoped,
        dateCol,
        k.value_expr.column,
        k.value_expr.agg,
        monthKey,
      );
      if (series.length >= 2) {
        trend = trendDirection(series);
        const last = series[series.length - 1].y;
        const prev = series[series.length - 2].y;
        if (prev !== 0 && Number.isFinite(last) && Number.isFinite(prev)) {
          delta = { pct: (last - prev) / Math.abs(prev), period: "month" };
        }
      } else if (k.trend) {
        trend = trendDirection(series);
      }
    }
    return {
      label: k.label,
      value,
      format: coerceKpiFormat(k.value_expr.agg, k.format),
      trend,
      delta,
    };
  });

  const sections: PreparedSection[] = spec.sections.map((section) => {
    const chart = section.chart;
    const yFormat = formatFor(chart.agg, chart.y);
    const scoped = chart.filter
      ? rows.filter((r) => String(r[chart.filter!.column]) === chart.filter!.equals)
      : rows;
    const xIsDate = isIsoDateColumn(chart.x, scoped);
    const bucket = xIsDate
      ? resolveBucket(chart.x_bucket as TimeBucket | undefined, scoped, chart.x)
      : undefined;
    const xKey = bucket ? (v: unknown) => bucketDate(String(v), bucket) : undefined;
    // Axis label style: months for month buckets and un-bucketed date axes
    // (back-compat), day labels for day/week buckets, raw keys for Q/Y.
    const xLabel: "month" | "day" | "raw" = !xIsDate
      ? "raw"
      : bucket === "day" || bucket === "week"
        ? "day"
        : bucket === "quarter" || bucket === "year"
          ? "raw"
          : "month";
    const xIsMonth = xLabel === "month";
    const categoricalX = !xIsDate;
    let truncationNote: string | undefined;

    /** Sort categorical distributions by value desc and cap at top-N. */
    const shapeCategorical = (
      data: Array<{ x: string; y: number }>,
      defaultN: number,
    ): Array<{ x: string; y: number }> => {
      if (!categoricalX) return data;
      const sorted = [...data].sort((a, b) => b.y - a.y);
      const n = chart.top_n ?? defaultN;
      if (sorted.length <= n) return sorted;
      const { data: capped, truncated, rolled } = topNWithOther(sorted, n, chart.agg);
      truncationNote = rolled
        ? `The smallest ${truncated.toLocaleString("en-GB")} ${chart.x} values are grouped as “Other”.`
        : `Showing the top ${n} of ${sorted.length.toLocaleString("en-GB")} ${chart.x} values by ${chart.agg}; ${chart.agg} does not aggregate into an “Other” group.`;
      return capped;
    };

    let prepared: PreparedChart;
    if (chart.type === "stacked_bar" && chart.series) {
      const { data, seriesKeys } = aggregateStacked(
        scoped,
        chart.x,
        chart.y,
        chart.series,
        chart.agg,
        xKey,
      );
      prepared = { type: "stacked_bar", data, seriesKeys, yFormat, xIsMonth, xLabel };
    } else if (chart.type === "single_stat") {
      const value = aggregateScalar(scoped, chart.agg, chart.y);
      const footnote = chart.filter
        ? `${chart.filter.column} = ${chart.filter.equals}. Aggregate of ${chart.y}.`
        : undefined;
      prepared = { type: "single_stat", value, format: yFormat, footnote };
    } else if (chart.type === "donut") {
      const data = shapeCategorical(aggregateSeries(scoped, chart.x, chart.y, chart.agg, xKey), 6);
      prepared = { type: "donut", data, yFormat };
    } else {
      // Validator guarantees stacked_bar has a series here; any other
      // shape renders through the flat series path. No silent metric
      // substitution — the agg the spec asked for is what we compute.
      const flatType = chart.type as "line" | "area" | "bar" | "horizontal_bar";
      let data = aggregateSeries(scoped, chart.x, chart.y, chart.agg, xKey);
      if (flatType === "bar" || flatType === "horizontal_bar") {
        data = shapeCategorical(data, 12);
      }
      prepared = { type: flatType, data, yFormat, xIsMonth, xLabel };
    }

    // Data-quality note: if the chart groups by a categorical column and
    // some rows are blank on it, surface that as an explicit line rather
    // than plotting "null" as a category.
    let insight = section.insight_sentence;
    if (chart.type !== "single_stat") {
      const missing = blankCount(scoped, chart.x);
      if (missing > 0 && scoped.length > 0) {
        const pct = ((missing / scoped.length) * 100).toFixed(1);
        insight += ` ${missing.toLocaleString("en-GB")} of ${scoped.length.toLocaleString("en-GB")} records (${pct}%) have no ${chart.x} assigned and are excluded from this chart.`;
      }
      if (chart.series) {
        const missingS = blankCount(scoped, chart.series);
        if (missingS > 0 && scoped.length > 0) {
          const pct = ((missingS / scoped.length) * 100).toFixed(1);
          insight += ` ${missingS.toLocaleString("en-GB")} records (${pct}%) have no ${chart.series} assigned.`;
        }
      }
    }

    if (truncationNote) insight += ` ${truncationNote}`;

    return {
      heading: section.heading,
      insight,
      chart: prepared,
      meta: { x: chart.x, y: chart.y, agg: chart.agg },
    };
  });

  return {
    v: 1,
    title: spec.report_title,
    summary: spec.generated_summary,
    brief: meta.brief,
    conclusion: spec.final_conclusion,
    sourceFilename: meta.sourceFilename,
    rowCount: rows.length,
    kpis,
    sections,
    colors,
  };
}

// ---------- encode / decode ----------

const URL_LIMIT = 2000;

/** Short content id — deterministic hash for parity with a future server store. */
export function shareId(payload: string): string {
  // FNV-1a 32-bit, base36. 8-ish chars. Not for security — just a slug.
  let h = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(36).padStart(7, "0");
}

export function encodePrepared(prepared: PreparedReport): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(prepared));
}

export function decodePrepared(payload: string): PreparedReport | null {
  try {
    const raw = LZString.decompressFromEncodedURIComponent(payload);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PreparedReport;
    if (parsed?.v !== 1 || !Array.isArray(parsed.sections)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export type ShareResult =
  | { url: string; id: string; length: number }
  | { url: null; reason: "too_large"; length: number; id: string };

/**
 * The single write path. Compresses a PreparedReport, produces an absolute
 * URL, and refuses to return a truncated link if the URL would exceed ~2KB.
 */
export function persistShare(prepared: PreparedReport, origin?: string): ShareResult {
  const payload = encodePrepared(prepared);
  const id = shareId(payload);
  const base =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "https://example.com");
  const url = `${base}/share/${payload}`;
  if (url.length > URL_LIMIT) {
    return { url: null, reason: "too_large", length: url.length, id };
  }
  return { url, id, length: url.length };
}

/** The single read path. */
export function readShare(payload: string): PreparedReport | null {
  return decodePrepared(payload);
}

export const SHARE_URL_LIMIT = URL_LIMIT;
