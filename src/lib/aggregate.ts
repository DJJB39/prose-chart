// Aggregation contract — the app owns every number.
// The spec says which agg + which columns; this file computes over full data.

export type Agg =
  | "sum"
  | "avg"
  | "count"
  | "distinct_count"
  | "null_count"
  | "non_null_count"
  | "percent_of_total"
  | "min"
  | "max";
export type Row = Record<string, unknown>;

export function isBlank(v: unknown): boolean {
  return (
    v === null ||
    v === undefined ||
    (typeof v === "string" && v.trim() === "") ||
    (typeof v === "number" && Number.isNaN(v))
  );
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

/**
 * Reduce a bucket's numeric values to a scalar. Only the "measure" aggs
 * (sum/avg/min/max) route through here; count / distinct_count / null_count /
 * non_null_count / percent_of_total are all handled by the callers because
 * they need row-shape context, not the extracted numbers.
 */
export function reduceAgg(values: number[], agg: Agg): number {
  if (values.length === 0) return 0;
  switch (agg) {
    case "sum": return values.reduce((s, v) => s + v, 0);
    case "avg": return values.reduce((s, v) => s + v, 0) / values.length;
    case "min": return Math.min(...values);
    case "max": return Math.max(...values);
    default: return 0;
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
  if (agg === "distinct_count") {
    const seen = new Set<string>();
    for (const r of filtered) {
      const v = r[column];
      if (!isBlank(v)) seen.add(String(v));
    }
    return seen.size;
  }
  if (agg === "null_count") {
    let n = 0;
    for (const r of filtered) if (isBlank(r[column])) n++;
    return n;
  }
  if (agg === "non_null_count") {
    let n = 0;
    for (const r of filtered) if (!isBlank(r[column])) n++;
    return n;
  }
  if (agg === "percent_of_total") {
    // Share of the (unfiltered) dataset covered by `filtered`, expressed
    // as a percent. Without a filter this trivially returns 100.
    return rows.length === 0 ? 0 : (filtered.length / rows.length) * 100;
  }
  const nums: number[] = [];
  for (const r of filtered) {
    const n = toNum(r[column]);
    if (n !== null) nums.push(n);
  }
  return reduceAgg(nums, agg);
}

/** Count of rows whose value in `column` is null/blank (after optional filter). */
export function blankCount(
  rows: Row[],
  column: string,
  filter?: { column: string; equals: string },
): number {
  const filtered = filter
    ? rows.filter((r) => String(r[filter.column]) === filter.equals)
    : rows;
  let n = 0;
  for (const r of filtered) if (isBlank(r[column])) n++;
  return n;
}

/** Group rows by x (single series). Rows with blank x are excluded. Returns rows sorted by x asc. */
export function aggregateSeries(
  rows: Row[],
  x: string,
  y: string,
  agg: Agg,
): Array<{ x: string; y: number }> {
  const nonBlank = rows.filter((r) => !isBlank(r[x]));

  if (agg === "distinct_count") {
    const sets = new Map<string, Set<string>>();
    for (const r of nonBlank) {
      const key = String(r[x]);
      if (!sets.has(key)) sets.set(key, new Set());
      const v = r[y];
      if (!isBlank(v)) sets.get(key)!.add(String(v));
    }
    return [...sets.keys()].sort().map((k) => ({ x: k, y: sets.get(k)!.size }));
  }

  if (agg === "count" || agg === "null_count" || agg === "non_null_count" || agg === "percent_of_total") {
    const buckets = new Map<string, { total: number; nulls: number; nonNull: number }>();
    for (const r of nonBlank) {
      const key = String(r[x]);
      const b = buckets.get(key) ?? { total: 0, nulls: 0, nonNull: 0 };
      b.total += 1;
      if (isBlank(r[y])) b.nulls += 1; else b.nonNull += 1;
      buckets.set(key, b);
    }
    const keys = [...buckets.keys()].sort();
    const totalRows = nonBlank.length;
    return keys.map((k) => {
      const b = buckets.get(k)!;
      let value = 0;
      if (agg === "count") value = b.total;
      else if (agg === "null_count") value = b.nulls;
      else if (agg === "non_null_count") value = b.nonNull;
      else value = totalRows === 0 ? 0 : (b.total / totalRows) * 100;
      return { x: k, y: value };
    });
  }

  const buckets = new Map<string, number[]>();
  for (const r of nonBlank) {
    const key = String(r[x]);
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
  return keys.map((k) => ({ x: k, y: reduceAgg(buckets.get(k) ?? [], agg) }));
}

/** Group by x then split by series. Returns wide rows: {x, [seriesName]: number}. */
export function aggregateStacked(
  rows: Row[],
  x: string,
  y: string,
  series: string,
  agg: Agg,
): { data: Array<Record<string, string | number>>; seriesKeys: string[] } {
  type Cell = { total: number; nulls: number; nonNull: number; distinct: Set<string>; nums: number[] };
  const mkCell = (): Cell => ({ total: 0, nulls: 0, nonNull: 0, distinct: new Set(), nums: [] });

  const grid = new Map<string, Map<string, Cell>>();
  const xTotals = new Map<string, number>();
  const seriesOrder: string[] = [];
  const seen = new Set<string>();

  for (const r of rows) {
    if (isBlank(r[x]) || isBlank(r[series])) continue;
    const xk = String(r[x]);
    const sk = String(r[series]);
    if (!seen.has(sk)) { seen.add(sk); seriesOrder.push(sk); }
    if (!grid.has(xk)) grid.set(xk, new Map());
    const inner = grid.get(xk)!;
    const cell = inner.get(sk) ?? mkCell();
    cell.total += 1;
    if (isBlank(r[y])) cell.nulls += 1;
    else {
      cell.nonNull += 1;
      cell.distinct.add(String(r[y]));
      const n = toNum(r[y]);
      if (n !== null) cell.nums.push(n);
    }
    inner.set(sk, cell);
    xTotals.set(xk, (xTotals.get(xk) ?? 0) + 1);
  }

  const xKeys = [...grid.keys()].sort();
  const data = xKeys.map((xk) => {
    const row: Record<string, string | number> = { x: xk };
    const inner = grid.get(xk)!;
    const xTotal = xTotals.get(xk) ?? 0;
    for (const sk of seriesOrder) {
      const cell = inner.get(sk) ?? mkCell();
      let value = 0;
      if (agg === "count") value = cell.total;
      else if (agg === "distinct_count") value = cell.distinct.size;
      else if (agg === "null_count") value = cell.nulls;
      else if (agg === "non_null_count") value = cell.nonNull;
      else if (agg === "percent_of_total") value = xTotal === 0 ? 0 : (cell.total / xTotal) * 100;
      else value = reduceAgg(cell.nums, agg);
      row[sk] = value;
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
