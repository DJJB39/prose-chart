// One palette, assigned once, held stable across every chart in a report.
// Editorial slate + warm earth — restrained, harmonious, print-safe.
// The accent (#2d5bff) is reserved for the primary measure line/bar; the
// categorical ramp below is for series splits.

export const CATEGORICAL = [
  "#2f3a4a", // slate
  "#8a6a3d", // umber
  "#4d6b7a", // teal-slate
  "#a37b5f", // clay
  "#6b7a5b", // moss
  "#7a5b6b", // aubergine
  "#3d5a8a", // ink-blue
  "#8a8a5b", // olive
];

export const ACCENT = "#2d5bff";

export type ColorMap = Record<string, string>;

/** Assign a stable colour to each category in first-seen order. */
export function buildColorMap(categories: readonly string[]): ColorMap {
  const map: ColorMap = {};
  const seen: string[] = [];
  for (const c of categories) {
    if (!(c in map)) {
      map[c] = CATEGORICAL[seen.length % CATEGORICAL.length];
      seen.push(c);
    }
  }
  return map;
}

/** Ordered list of unique categorical values as they first appear. */
export function uniqueOrdered<T>(values: readonly T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const v of values) {
    if (!seen.has(v)) { seen.add(v); out.push(v); }
  }
  return out;
}
