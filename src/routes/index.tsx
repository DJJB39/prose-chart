import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";

import { ExportBar } from "@/components/report/ExportBar";
import { KpiCard } from "@/components/report/KpiCard";
import { TitleBlock } from "@/components/report/TitleBlock";
import { LineChart } from "@/components/report/charts/LineChart";
import { formatMonth } from "@/lib/format";
import { sampleMeta, sampleRows } from "@/lib/sample-data";

export const Route = createFileRoute("/")({
  component: Phase1Report,
  head: () => ({
    meta: [
      { title: "Veritas — Editorial reports from your data" },
      {
        name: "description",
        content:
          "Turn a spreadsheet and a plain-English brief into a report you would be happy to hand to a board.",
      },
      { property: "og:title", content: "Veritas — Editorial reports from your data" },
      {
        property: "og:description",
        content:
          "Turn a spreadsheet and a plain-English brief into a report you would be happy to hand to a board.",
      },
    ],
  }),
});

function Phase1Report() {
  const reportRef = useRef<HTMLElement>(null);

  // Full-dataset aggregates. The app owns every number; the AI never does arithmetic.
  const totalRevenue = sampleRows.reduce((s, r) => s + r.revenue_gbp, 0);
  const chartData = sampleRows.map((r) => ({ x: r.month, y: r.revenue_gbp }));

  return (
    <div className="min-h-screen bg-paper text-ink">
      <ExportBar targetRef={reportRef} />
      <main className="mx-auto max-w-[880px] px-8 py-10">
        <article ref={reportRef} className="bg-paper">
          <TitleBlock
            title={sampleMeta.title}
            sourceFilename={sampleMeta.source_filename}
            brief={sampleMeta.brief}
          />

          <section
            className="mt-10"
            style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
          >
            <div className="mb-4 flex items-baseline justify-between border-b border-ink/10 pb-2">
              <h2 className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">
                Headline
              </h2>
              <span className="text-[11px] text-ink-muted tabular">01</span>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <KpiCard
                label="Total revenue"
                value={totalRevenue}
                format="currency"
                footnote={`Aggregated across ${sampleRows.length} months.`}
              />
              <KpiCard
                label="Latest month"
                value={sampleRows[sampleRows.length - 1].revenue_gbp}
                format="currency"
                footnote={formatMonth(sampleRows[sampleRows.length - 1].month)}
              />
            </div>
          </section>

          <section
            className="mt-10"
            style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
          >
            <div className="mb-4 flex items-baseline justify-between border-b border-ink/10 pb-2">
              <h2 className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">
                Revenue over time
              </h2>
              <span className="text-[11px] text-ink-muted tabular">02</span>
            </div>
            <p className="mb-5 max-w-[58ch] font-serif text-[19px] leading-[1.4] text-ink">
              Monthly revenue across the twenty-four months to June 2025. The chart shows the
              trajectory and where it accelerates.
            </p>
            <LineChart data={chartData} yFormat="currency" xTickFormatter={formatMonth} height={260} />
          </section>

          <footer className="mt-8 border-t border-ink/10 pt-4 text-[11px] uppercase tracking-[0.2em] text-ink-muted">
            <div className="flex items-center justify-between">
              <span>Veritas · Phase 1 acceptance gate</span>
              <span className="tabular">A4 portrait</span>
            </div>
          </footer>
        </article>
      </main>
    </div>
  );
}
