// Formatting primitives. Tabular figures, editorial restraint, deterministic
// across SSR + client (fixed locale, fixed fraction digits so hydration
// matches — the compact formatter is the one that differs between Node and
// browser Intl otherwise).

export type FormatKind = "currency" | "number" | "percent" | "compact";

const LOC = "en-GB";

const gbp0 = new Intl.NumberFormat(LOC, {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});
const gbpCompact = new Intl.NumberFormat(LOC, {
  style: "currency",
  currency: "GBP",
  notation: "compact",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const num0 = new Intl.NumberFormat(LOC, { maximumFractionDigits: 0 });
const numCompact = new Intl.NumberFormat(LOC, {
  notation: "compact",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const pct1 = new Intl.NumberFormat(LOC, {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatValue(kind: FormatKind, value: number): string {
  if (!Number.isFinite(value)) return "—";
  switch (kind) {
    case "currency":
      return Math.abs(value) >= 10_000 ? gbpCompact.format(value) : gbp0.format(value);
    case "percent":
      return pct1.format(value);
    case "compact":
      return Math.abs(value) >= 10_000 ? numCompact.format(value) : num0.format(value);
    case "number":
    default:
      return num0.format(value);
  }
}

export function formatMonth(iso: string): string {
  if (typeof iso !== "string") return String(iso);
  // "2024-06-01" -> "Jun 24". Manual to avoid SSR/browser locale drift.
  const m = iso.match(/^(\d{4})-(\d{2})/);
  if (!m) return iso;
  const [, y, mo] = m;
  const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${MONTHS[Number(mo) - 1]} ${y.slice(2)}`;
}

export function formatDay(iso: string): string {
  if (typeof iso !== "string") return String(iso);
  // "2024-06-12" -> "12 Jun". Manual to avoid SSR/browser locale drift.
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const [, , mo, d] = m;
  const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${Number(d)} ${MONTHS[Number(mo) - 1]}`;
}

export function formatGeneratedAt(d = new Date()): string {
  const day = d.getUTCDate();
  const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${day} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
