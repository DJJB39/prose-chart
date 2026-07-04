// Bundled synthetic sample dataset for the Phase-1 acceptance gate.
// The full ~800-row realistic dataset lands in Phase 2 alongside the entry surface.
// This slice is 24 months of aggregated UK regional SaaS revenue — enough to
// wire one KPI and one line chart with real, structural numbers.

export type SampleRow = {
  month: string; // ISO "YYYY-MM-01"
  revenue_gbp: number;
};

const seed: Array<[string, number]> = [
  ["2023-07-01", 128_400],
  ["2023-08-01", 131_900],
  ["2023-09-01", 142_300],
  ["2023-10-01", 149_800],
  ["2023-11-01", 156_200],
  ["2023-12-01", 168_500],
  ["2024-01-01", 154_100],
  ["2024-02-01", 161_700],
  ["2024-03-01", 175_900],
  ["2024-04-01", 182_400],
  ["2024-05-01", 191_600],
  ["2024-06-01", 204_800],
  ["2024-07-01", 198_300],
  ["2024-08-01", 206_500],
  ["2024-09-01", 221_400],
  ["2024-10-01", 234_800],
  ["2024-11-01", 246_100],
  ["2024-12-01", 268_700],
  ["2025-01-01", 241_500],
  ["2025-02-01", 253_300],
  ["2025-03-01", 274_600],
  ["2025-04-01", 289_100],
  ["2025-05-01", 301_800],
  ["2025-06-01", 318_400],
];

export const sampleRows: SampleRow[] = seed.map(([month, revenue_gbp]) => ({
  month,
  revenue_gbp,
}));

export const sampleMeta = {
  source_filename: "uk_saas_revenue_2023-07_to_2025-06.csv",
  title: "UK SaaS revenue, July 2023 – June 2025",
  brief: "Show me what's driving revenue, and flag anything unusual.",
};
