import type { ReportSpec } from "./spec";

// Hand-authored spec for the bundled sample. Structurally identical to what
// Phase 3's Claude call will return. The AI never sees numbers; we compute
// them here from the full dataset.
export const sampleSpec: ReportSpec = {
  report_title: "UK SaaS performance, July 2023 – June 2025",
  generated_summary:
    "Twenty-four months of transaction-level SaaS activity across five UK regions and four products. The dataset spans July 2023 to June 2025 and carries new-customer, revenue, and churn counts per region and product. The brief asks what drove revenue and where the record breaks with its own pattern.",
  kpis: [
    { label: "Total revenue", value_expr: { agg: "sum", column: "revenue_gbp" }, format: "currency" },
    { label: "New customers", value_expr: { agg: "sum", column: "new_customers" }, format: "compact" },
    { label: "Avg monthly revenue", value_expr: { agg: "avg", column: "revenue_gbp" }, format: "currency" },
    { label: "Products tracked", value_expr: { agg: "count", column: "product" }, format: "number" },
  ],
  sections: [
    {
      heading: "Revenue over time",
      insight_sentence:
        "Monthly revenue across the twenty-four months to June 2025. The chart shows the trajectory and where it accelerates.",
      chart: { type: "line", x: "month", y: "revenue_gbp", agg: "sum" },
    },
    {
      heading: "Cumulative reach",
      insight_sentence:
        "New customers added each month. Area chart to read total accumulation as much as the monthly cadence.",
      chart: { type: "area", x: "month", y: "new_customers", agg: "sum" },
    },
    {
      heading: "Revenue by product",
      insight_sentence:
        "Four products, two years of trading. The bar chart shows which lines carry the book.",
      chart: { type: "bar", x: "product", y: "revenue_gbp", agg: "sum" },
    },
    {
      heading: "Revenue mix by region",
      insight_sentence:
        "Monthly revenue split by region. Stacked bars show both the total and how the composition shifts.",
      chart: { type: "stacked_bar", x: "month", y: "revenue_gbp", series: "region", agg: "sum" },
    },
    {
      heading: "Product share",
      insight_sentence:
        "Share of total revenue by product across the whole period.",
      chart: { type: "donut", x: "product", y: "revenue_gbp", agg: "sum" },
    },
    {
      heading: "Regions ranked",
      insight_sentence:
        "Total revenue by region. Horizontal bars because the ordering matters more than the axis.",
      chart: { type: "horizontal_bar", x: "region", y: "revenue_gbp", agg: "sum" },
    },
    {
      heading: "The Manchester dip",
      insight_sentence:
        "February 2025 revenue in Manchester, isolated. One month, one region — a break in the pattern worth naming.",
      chart: {
        type: "single_stat", x: "month", y: "revenue_gbp", agg: "sum",
        filter: { column: "region", equals: "Manchester" },
      },
    },
  ],
  final_conclusion:
    "Growth is broad and product-led; the record is clean except for a single regional month that stands apart from everything around it.",
};
