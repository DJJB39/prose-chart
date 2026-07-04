// Dataset profiling. Detects column types, ranges, and top categories from
// a parsed table. Also tags every column with a semantic ROLE so the model
// and validator can choose metrics discipline-agnostically:
//
//   measure     numeric, summable (revenue, units)
//   identifier  high-cardinality key or id-like name (MPAN, customer_id)
//   dimension   low-cardinality categorical, used for group-by
//   temporal    parseable dates, used as time axis

export type ColumnType = "date" | "numeric" | "categorical" | "id";
export type ColumnRole = "measure" | "identifier" | "dimension" | "temporal";

export type ColumnProfile = {
  name: string;
  type: ColumnType;
  role: ColumnRole;
  cardinality: number;
  min: string | number | null;
  max: string | number | null;
  null_pct: number;
  top_categories: Array<{ value: string; count: number }>;
};

export type DatasetProfile = {
  columns: ColumnProfile[];
  rowCount: number;
};

type Row = Record<string, unknown>;

const ISO = /^\d{4}-\d{2}-\d{2}/;
const UK_DATE = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/;

/** Best-effort parse for UK date strings and ISO strings. Returns ms or null. */
export function parseMaybeDate(v: unknown): number | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
  if (typeof v === "number") return null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  if (ISO.test(s)) {
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : t;
  }
  const m = s.match(UK_DATE);
  if (m) {
    const [, dd, mm, yy] = m;
    const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
    const t = Date.UTC(year, Number(mm) - 1, Number(dd));
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

function isIdName(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n === "id" ||
    n.endsWith("_id") ||
    n.endsWith(" id") ||
    n === "code" ||
    n === "sku" ||
    n === "mpan" ||
    n === "ref" ||
    n === "reference" ||
    n === "uuid" ||
    n.endsWith("_ref") ||
    n.endsWith("_code")
  );
}

function detectType(name: string, values: unknown[]): ColumnType {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
  if (nonNull.length === 0) return "categorical";
  const dateHits = nonNull.filter((v) => parseMaybeDate(v) !== null).length;
  if (dateHits / nonNull.length > 0.8) return "date";
  const numHits = nonNull.filter((v) => typeof v === "number" || (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)))).length;
  if (numHits / nonNull.length > 0.9) {
    const leadingZero = nonNull.some((v) => typeof v === "string" && /^0\d+/.test(v));
    if (leadingZero || isIdName(name)) return "id";
    return "numeric";
  }
  const unique = new Set(nonNull.map((v) => String(v)));
  if (unique.size === nonNull.length && isIdName(name)) return "id";
  return "categorical";
}

function classifyRole(
  name: string,
  type: ColumnType,
  cardinality: number,
  rowCount: number,
): ColumnRole {
  if (type === "date") return "temporal";
  if (type === "id") return "identifier";
  // Very high cardinality + id-like name → identifier even if numeric/categorical.
  const highCard = rowCount > 0 && cardinality / rowCount > 0.6;
  if (highCard && isIdName(name)) return "identifier";
  // Extremely high-cardinality numeric with id-like name (MPANs stored as ints) → identifier.
  if (type === "numeric" && highCard && isIdName(name)) return "identifier";
  if (type === "numeric" && cardinality > 1) return "measure";
  return "dimension";
}

export function profileDataset(rows: Row[]): DatasetProfile {
  if (rows.length === 0) return { columns: [], rowCount: 0 };
  const names = Object.keys(rows[0]);
  const rowCount = rows.length;
  const columns: ColumnProfile[] = names.map((name) => {
    const values = rows.map((r) => r[name]);
    const type = detectType(name, values);
    const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
    const null_pct = 1 - nonNull.length / values.length;
    let min: string | number | null = null;
    let max: string | number | null = null;
    if (type === "numeric") {
      const nums = nonNull.map((v) => Number(v)).filter((n) => Number.isFinite(n));
      if (nums.length) { min = Math.min(...nums); max = Math.max(...nums); }
    } else if (type === "date") {
      const ts = nonNull.map(parseMaybeDate).filter((t): t is number => t !== null);
      if (ts.length) {
        min = new Date(Math.min(...ts)).toISOString().slice(0, 10);
        max = new Date(Math.max(...ts)).toISOString().slice(0, 10);
      }
    }
    const counts = new Map<string, number>();
    for (const v of nonNull) {
      const k = String(v);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const cardinality = counts.size;
    const top_categories =
      type === "categorical"
        ? [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([value, count]) => ({ value, count }))
        : [];
    const role = classifyRole(name, type, cardinality, rowCount);
    return { name, type, role, cardinality, min, max, null_pct, top_categories };
  });
  return { columns, rowCount };
}

export function findColumn(profile: DatasetProfile, type: ColumnType): ColumnProfile | undefined {
  return profile.columns.find((c) => c.type === type);
}

export function findByRole(profile: DatasetProfile, role: ColumnRole): ColumnProfile | undefined {
  return profile.columns.find((c) => c.role === role);
}

export function hasNumericColumn(profile: DatasetProfile): boolean {
  return profile.columns.some((c) => c.type === "numeric");
}

export function hasMeasure(profile: DatasetProfile): boolean {
  return profile.columns.some((c) => c.role === "measure");
}
