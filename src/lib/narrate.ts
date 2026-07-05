// The numbers-aware narrative pass ("analyst pass").
//
// Phase 1 (compose) keeps the model blind to every value — it can only choose
// metrics and write structural prose. Phase 2 hands the model the COMPUTED
// results — KPI values, deltas, and each chart's aggregated points, all
// calculated by the app — and asks it to rewrite the prose with real figures.
//
// The discipline survives: the model may only quote numbers that appear in
// the digest we sent it. verifyNarrative() enforces that mechanically — any
// figure in the returned prose that is not present in the digest fails the
// pass, and the caller keeps the structural (phase-1) text instead. Numbers
// remain the app's monopoly; the model is a writer with a fact sheet.
//
// This module is pure and isomorphic: the server route uses buildDigest +
// verifyNarrative to gate the model, the client uses applyNarrative to
// upgrade the rendered report in place.

import { formatValue } from "@/lib/format";
import type { PreparedReport } from "@/lib/share";

export type DigestSection = {
  heading: string;
  chart: string;
  x?: string;
  y?: string;
  agg?: string;
  point_count: number;
  points: Array<{ x: string; y: string }>;
  structural_insight: string;
};

export type NarrativeDigest = {
  brief?: string;
  title: string;
  row_count: number;
  kpis: Array<{ label: string; value: string; change_vs_prior_month?: string }>;
  sections: DigestSection[];
  structural_summary: string;
  structural_conclusion?: string;
};

export type Narrative = {
  summary: string;
  insights: string[];
  conclusion?: string;
};

const MAX_POINTS = 24;

function fmtPct(pct: number): string {
  const sign = pct >= 0 ? "+" : "\u2212";
  return `${sign}${(Math.abs(pct) * 100).toFixed(1)}%`;
}

/** Compact, fully computed fact sheet for the narrator. */
export function buildDigest(prepared: PreparedReport): NarrativeDigest {
  const sections: DigestSection[] = prepared.sections.map((s) => {
    const c = s.chart;
    let points: Array<{ x: string; y: string }> = [];
    let pointCount = 0;

    if (c.type === "single_stat") {
      points = [{ x: "value", y: formatValue(c.format, c.value) }];
      pointCount = 1;
    } else if (c.type === "stacked_bar") {
      // Per-x totals plus per-series totals — small and information-dense.
      pointCount = c.data.length;
      const xTotals = c.data.map((row) => {
        const total = c.seriesKeys.reduce((sum, k) => sum + (Number(row[k]) || 0), 0);
        return { x: String(row.x), y: formatValue(c.yFormat, total) };
      });
      const seriesTotals = c.seriesKeys.map((k) => {
        const total = c.data.reduce((sum, row) => sum + (Number(row[k]) || 0), 0);
        return { x: `${k} (series total)`, y: formatValue(c.yFormat, total) };
      });
      points = [...xTotals.slice(-Math.max(4, MAX_POINTS - seriesTotals.length)), ...seriesTotals];
    } else {
      pointCount = c.data.length;
      const data = c.data;
      if (data.length <= MAX_POINTS) {
        points = data.map((d) => ({ x: d.x, y: formatValue(c.yFormat, d.y) }));
      } else {
        // Long time series: keep the most recent run, plus the extremes so
        // the narrator can name the peak and the trough truthfully.
        const recent = data.slice(-(MAX_POINTS - 2));
        const maxP = data.reduce((a, b) => (b.y > a.y ? b : a));
        const minP = data.reduce((a, b) => (b.y < a.y ? b : a));
        const pack = new Map<string, { x: string; y: string; tag?: string }>();
        pack.set(maxP.x, { x: maxP.x, y: formatValue(c.yFormat, maxP.y), tag: "peak" });
        pack.set(minP.x, { x: minP.x, y: formatValue(c.yFormat, minP.y), tag: "trough" });
        for (const d of recent) {
          if (!pack.has(d.x)) pack.set(d.x, { x: d.x, y: formatValue(c.yFormat, d.y) });
        }
        points = [...pack.values()].map((p) => ({
          x: p.tag ? `${p.x} (${p.tag})` : p.x,
          y: p.y,
        }));
      }
    }

    return {
      heading: s.heading,
      chart: c.type,
      x: s.meta?.x,
      y: s.meta?.y,
      agg: s.meta?.agg,
      point_count: pointCount,
      points,
      structural_insight: s.insight,
    };
  });

  return {
    brief: prepared.brief,
    title: prepared.title,
    row_count: prepared.rowCount,
    kpis: prepared.kpis.map((k) => ({
      label: k.label,
      value: formatValue(k.format, k.value),
      change_vs_prior_month: k.delta ? fmtPct(k.delta.pct) : undefined,
    })),
    sections,
    structural_summary: prepared.summary,
    structural_conclusion: prepared.conclusion,
  };
}

// ---------- verification ----------

/** Strip formatting so "£1,240" and "1240" compare equal. */
function normaliseNumbers(text: string): string {
  return text.replace(/(\d),(?=\d)/g, "$1");
}

const NUM_TOKEN = /\d+(?:\.\d+)?/g;

/**
 * Every numeric token in the narrative must appear somewhere in the digest.
 * Small integers (≤ 12) pass freely — ordinals, month counts, "top 5" — as
 * do 4-digit years that appear anywhere in the digest's x values.
 */
export function verifyNarrative(
  digest: NarrativeDigest,
  narrative: Narrative,
): { ok: true } | { ok: false; offenders: string[] } {
  const digestNorm = normaliseNumbers(JSON.stringify(digest));
  const offenders: string[] = [];

  const checkText = (text: string, where: string) => {
    const norm = normaliseNumbers(text);
    for (const token of norm.match(NUM_TOKEN) ?? []) {
      const n = Number(token);
      if (Number.isFinite(n) && n <= 12 && !token.includes(".")) continue;
      if (!digestNorm.includes(token)) {
        offenders.push(`${where}: "${token}" is not a figure supplied in the digest`);
      }
    }
  };

  checkText(narrative.summary, "summary");
  narrative.insights.forEach((s, i) => checkText(s, `insights[${i}]`));
  if (narrative.conclusion) checkText(narrative.conclusion, "conclusion");

  return offenders.length === 0 ? { ok: true } : { ok: false, offenders };
}

// ---------- application ----------

/** Merge a verified narrative into a PreparedReport, immutably. */
export function applyNarrative(prepared: PreparedReport, narrative: Narrative): PreparedReport {
  return {
    ...prepared,
    summary: narrative.summary || prepared.summary,
    conclusion: narrative.conclusion ?? prepared.conclusion,
    sections: prepared.sections.map((s, i) => {
      const upgraded = narrative.insights[i];
      return upgraded && upgraded.trim() ? { ...s, insight: upgraded } : s;
    }),
    narrated: true,
  };
}

/**
 * Client helper: post the digest, verify is done server-side, apply on
 * success. Fails silent — the structural report is already on screen and
 * is always a complete, correct fallback.
 */
export async function upgradeNarrative(prepared: PreparedReport): Promise<PreparedReport | null> {
  try {
    const res = await fetch("/api/narrate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ digest: buildDigest(prepared) }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { narrative?: Narrative };
    if (!data.narrative) return null;
    // Belt and braces: re-verify client-side before applying.
    const check = verifyNarrative(buildDigest(prepared), data.narrative);
    if (!check.ok) {
      console.warn("[Veritas] narrative failed client-side verification:", check.offenders);
      return null;
    }
    return applyNarrative(prepared, data.narrative);
  } catch {
    return null;
  }
}
