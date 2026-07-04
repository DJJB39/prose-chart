// Synthetic UK SaaS dataset — 24 months × 5 regions × 4 products.
// Realistic structure with growth, seasonality, one anomaly (Manchester dip in
// Feb 2025), and one dominant product. The app computes every number from
// these rows; the AI never does arithmetic.

export type SampleRow = {
  month: string;          // "YYYY-MM-01"
  region: string;         // categorical, 5 values
  product: string;        // categorical, 4 values
  new_customers: number;
  revenue_gbp: number;
  churned_customers: number;
};

const REGIONS = ["London", "Manchester", "Birmingham", "Edinburgh", "Bristol"] as const;
const PRODUCTS = ["Ledger", "Atlas", "Signal", "Beacon"] as const;

// Deterministic PRNG so the sample renders identically on server + client.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function generate(): SampleRow[] {
  const rand = rng(1729);
  const rows: SampleRow[] = [];
  const start = new Date(Date.UTC(2023, 6, 1)); // 2023-07-01

  // Baselines
  const regionWeight: Record<string, number> = {
    London: 1.0, Manchester: 0.55, Birmingham: 0.45, Edinburgh: 0.35, Bristol: 0.28,
  };
  const productWeight: Record<string, number> = {
    Ledger: 1.0, Atlas: 0.62, Signal: 0.45, Beacon: 0.22,
  };
  const productPrice: Record<string, number> = {
    Ledger: 320, Atlas: 480, Signal: 210, Beacon: 890,
  };

  for (let m = 0; m < 24; m++) {
    const d = new Date(start);
    d.setUTCMonth(start.getUTCMonth() + m);
    const month = d.toISOString().slice(0, 10);
    // Underlying growth ~2.4%/mo, mild Dec bump, mild Jan dip.
    const growth = Math.pow(1.024, m);
    const monthOfYear = d.getUTCMonth();
    const seasonal = monthOfYear === 11 ? 1.09 : monthOfYear === 0 ? 0.9 : 1.0;

    for (const region of REGIONS) {
      for (const product of PRODUCTS) {
        // Anomaly: Manchester Feb 2025 outage-shaped dip.
        const anomaly = region === "Manchester" && month === "2025-02-01" ? 0.55 : 1.0;
        const noise = 0.9 + rand() * 0.2;

        const baseCustomers =
          14 * regionWeight[region] * productWeight[product] * growth * seasonal * anomaly * noise;
        const new_customers = Math.max(0, Math.round(baseCustomers));
        const revenue_gbp = Math.round(new_customers * productPrice[product] * (0.95 + rand() * 0.1));
        const churned_customers = Math.max(
          0,
          Math.round(new_customers * (0.06 + rand() * 0.05) + (anomaly < 1 ? 4 : 0)),
        );
        rows.push({ month, region, product, new_customers, revenue_gbp, churned_customers });
      }
    }
  }
  return rows;
}

export const sampleRows: SampleRow[] = generate();

export const sampleMeta = {
  source_filename: "uk_saas_2023-07_to_2025-06.csv",
  title: "UK SaaS performance, July 2023 – June 2025",
  brief:
    "Show what's driving revenue across regions and products, and flag anything unusual over the last two years.",
};
