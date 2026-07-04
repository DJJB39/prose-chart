// Aggregation contract — the app owns every number.
// The spec says which agg + which columns; this file computes over full data.

export type Agg = "sum" | "avg" | "count" | "min" | "max";
export type Row = Record<string, unknown>;

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

export function reduceAgg(values: number[], agg: Agg, countAll: number): number {
  if (agg === "count") return countAll;
  if (values.length === 0) return 0;
  switch (agg) {
    case "sum": return values.reduce((s, v) => s + v, 0);
    case "avg": return values.reduce((s, v) => s + v, 0) / values.length;
    case "min": return Math.min(...values);
    case "max": return Math.max(...values);
  }
}

/** Single scalar over the whole dataset (optionally filtered). */
export function aggregateScalar(
  rows: Row[],
  agg: Agg,
  column: string,
  filter?: { column: string; equals: string },
): number {
  const filtered = filter
    ? rows.filter((r) => String(r[filter.column]) === filter.equals)
    : rows;
  if (agg === "count") return filtered.length;
  const nums: number[] = [];
  for (const r of filtered) {
    const n = toNum(r[column]);
    if (n !== null) nums.push(n);
  }
  return reduceAgg(nums, agg, filtered.length);
}

/** Group rows by x (single series). Returns rows sorted by x asc. */
export function aggregateSeries(
  rows: Row[],
  x: string,
  y: string,
  agg: Agg,
): Array<{ x: string; y: number }> {
  const buckets = new Map<string, number[]>();
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = String(r[x]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const n = toNum(r[y]);
    if (n !== null) {
      const arr = buckets.get(key) ?? [];
      arr.push(n);
      buckets.set(key, arr);
    } else if (!buckets.has(key)) {
      buckets.set(key, []);
    }
  }
  const keys = [...buckets.keys()].sort();
  return keys.map((k) => ({
    x: k,
    y: reduceAgg(buckets.get(k) ?? [], agg, counts.get(k) ?? 0),
  }));
}

/** Group by x then split by series. Returns wide rows: {x, [seriesName]: number}. */
export function aggregateStacked(
  rows: Row[],
  x: string,
  y: string,
  series: string,
  agg: Agg,
): { data: Array<Record<string, string | number>>; seriesKeys: string[] } {
  // xKey -> seriesKey -> nums
  const grid = new Map<string, Map<string, number[]>>();
  const counts = new Map<string, Map<string, number>>();
  const seriesOrder: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const xk = String(r[x]);
    const sk = String(r[series]);
    if (!seen.has(sk)) { seen.add(sk); seriesOrder.push(sk); }
    if (!grid.has(xk)) { grid.set(xk, new Map()); counts.set(xk, new Map()); }
    const inner = grid.get(xk)!;
    const cinner = counts.get(xk)!;
    cinner.set(sk, (cinner.get(sk) ?? 0) + 1);
    const n = toNum(r[y]);
    const arr = inner.get(sk) ?? [];
    if (n !== null) arr.push(n);
    inner.set(sk, arr);
  }
  const xKeys = [...grid.keys()].sort();
  const data = xKeys.map((xk) => {
    const row: Record<string, string | number> = { x: xk };
    const inner = grid.get(xk)!;
    const cinner = counts.get(xk)!;
    for (const sk of seriesOrder) {
      row[sk] = reduceAgg(inner.get(sk) ?? [], agg, cinner.get(sk) ?? 0);
    }
    return row;
  });
  return { data, seriesKeys: seriesOrder };
}

/** Period-over-period direction on a monthly time series. */
export function trendDirection(series: Array<{ x: string; y: number }>): "up" | "down" | "flat" {
  if (series.length < 2) return "flat";
  const last = series[series.length - 1].y;
  const prev = series[series.length - 2].y;
  const diff = last - prev;
  if (Math.abs(diff) / Math.max(Math.abs(prev), 1) < 0.005) return "flat";
  return diff > 0 ? "up" : "down";
}
