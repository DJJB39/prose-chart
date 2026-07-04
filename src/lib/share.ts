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
  isBlank,
  trendDirection,
  type Row,
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
};

export type PreparedSection = {
  heading: string;
  insight: string;
  chart: PreparedChart;
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
};

// ---------- format inference ----------

function guessFormat(name: string): FormatKind {
  const n = name.toLowerCase();
  if (/(revenue|price|amount|cost|spend|gbp|usd|eur|£|value|sales)/.test(n)) return "currency";
  if (/(rate|pct|percent|ratio|share|%)/.test(n)) return "percent";
  if (/(count|customers|users|orders|sessions|visits|units)/.test(n)) return "compact";
  return "number";
}

function isMonthColumn(col: string, rows: Row[]): boolean {
  const sample = rows.find((r) => r[col] !== null && r[col] !== undefined);
  if (!sample) return false;
  return typeof sample[col] === "string" && /^\d{4}-\d{2}-\d{2}/.test(String(sample[col]));
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
      cats.push(
        ...uniqueOrdered(rows.map((r) => String(r[s.chart.x])).filter((v) => !isBlank(v))),
      );
    }
  }
  const colors = buildColorMap(uniqueOrdered(cats));

  const dateCol = Object.keys(rows[0] ?? {}).find(
    (c) => typeof rows[0]?.[c] === "string" && /^\d{4}-\d{2}-\d{2}/.test(String(rows[0][c])),
  );

  const kpis: PreparedKpi[] = spec.kpis.map((k) => {
    const value = aggregateScalar(rows, k.value_expr.agg, k.value_expr.column, k.value_expr.filter);
    let trend: "up" | "down" | "flat" | undefined;
    if (k.trend && dateCol) {
      const series = aggregateSeries(rows, dateCol, k.value_expr.column, k.value_expr.agg);
      trend = trendDirection(series);
    }
    return { label: k.label, value, format: k.format, trend };
  });

  const sections: PreparedSection[] = spec.sections.map((section) => {
    const chart = section.chart;
    const yFormat = guessFormat(chart.y);
    const scoped = chart.filter
      ? rows.filter((r) => String(r[chart.filter!.column]) === chart.filter!.equals)
      : rows;
    const xIsMonth = isMonthColumn(chart.x, scoped);

    let prepared: PreparedChart;
    if (chart.type === "stacked_bar" && chart.series) {
      const { data, seriesKeys } = aggregateStacked(scoped, chart.x, chart.y, chart.series, chart.agg);
      prepared = { type: "stacked_bar", data, seriesKeys, yFormat, xIsMonth };
    } else if (chart.type === "single_stat") {
      const value = aggregateScalar(scoped, chart.agg, chart.y);
      const footnote = chart.filter
        ? `${chart.filter.column} = ${chart.filter.equals}. Aggregate of ${chart.y}.`
        : undefined;
      prepared = { type: "single_stat", value, format: yFormat, footnote };
    } else if (chart.type === "donut") {
      const data = aggregateSeries(scoped, chart.x, chart.y, chart.agg);
      prepared = { type: "donut", data, yFormat };
    } else {
      // Validator guarantees stacked_bar has a series here; any other
      // shape renders through the flat series path. No silent metric
      // substitution — the agg the spec asked for is what we compute.
      const flatType = chart.type as "line" | "area" | "bar" | "horizontal_bar";
      const data = aggregateSeries(scoped, chart.x, chart.y, chart.agg);
      prepared = { type: flatType, data, yFormat, xIsMonth };
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

    return { heading: section.heading, insight, chart: prepared };
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
