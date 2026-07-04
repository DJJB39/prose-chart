// Formatting primitives. Tabular figures, editorial restraint.
// Currency defaults to GBP; the full app derives currency from column
// name/values in Phase 2. Percent expects a fraction (0.12 -> "12%").

export type FormatKind = "currency" | "number" | "percent" | "compact";

const gbp0 = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const gbpCompact = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  notation: "compact",
  maximumFractionDigits: 1,
});

const num0 = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const numCompact = new Intl.NumberFormat("en-GB", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const pct1 = new Intl.NumberFormat("en-GB", {
  style: "percent",
  maximumFractionDigits: 1,
});

export function formatValue(kind: FormatKind, value: number): string {
  if (!Number.isFinite(value)) return "—";
  switch (kind) {
    case "currency":
      return Math.abs(value) >= 100_000 ? gbpCompact.format(value) : gbp0.format(value);
    case "percent":
      return pct1.format(value);
    case "compact":
      return numCompact.format(value);
    case "number":
    default:
      return num0.format(value);
  }
}

export function formatMonth(iso: string): string {
  // "2024-06-01" -> "Jun 24"
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

export function formatGeneratedAt(d = new Date()): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
