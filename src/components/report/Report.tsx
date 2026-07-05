import { forwardRef } from "react";

import { formatDay, formatMonth, formatValue } from "@/lib/format";
import type { PreparedReport } from "@/lib/share";

import { AreaChart } from "./charts/AreaChart";
import { BarChart } from "./charts/BarChart";
import { DonutChart } from "./charts/DonutChart";
import { HorizontalBar } from "./charts/HorizontalBar";
import { LineChart } from "./charts/LineChart";
import { SingleStat } from "./charts/SingleStat";
import { StackedBar } from "./charts/StackedBar";
import { KpiCard } from "./KpiCard";
import { ReportSection } from "./ReportSection";
import { SectionBoundary } from "./SectionBoundary";
import { TitleBlock } from "./TitleBlock";

type Props = { prepared: PreparedReport };

export const Report = forwardRef<HTMLElement, Props>(function Report({ prepared }, ref) {
  const { colors } = prepared;

  return (
    <article ref={ref} className="bg-paper text-ink">
      <TitleBlock
        title={prepared.title}
        sourceFilename={prepared.sourceFilename}
        brief={prepared.brief}
        summary={prepared.summary}
      />

      {/* KPI row */}
      <section className="mt-10" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
        <div className="mb-3 flex items-baseline justify-between border-b border-ink/10 pb-2">
          <h2 className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">Headline</h2>
          <span className="text-[11px] text-ink-muted tabular">00</span>
        </div>
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          style={{
            gridTemplateColumns: `repeat(${Math.min(prepared.kpis.length, 4)}, minmax(0, 1fr))`,
          }}
        >
          {prepared.kpis.map((k) => (
            <KpiCard
              key={k.label}
              label={k.label}
              value={k.value}
              format={k.format}
              trend={k.trend}
              delta={k.delta}
            />
          ))}
        </div>
      </section>

      {/* Chart sections */}
      {prepared.sections.map((section, i) => {
        const idx = i + 1;
        const c = section.chart;
        let body: React.ReactNode = null;

        const tickFor = (chart: { xIsMonth: boolean; xLabel?: "month" | "day" | "raw" }) =>
          chart.xLabel === "day" ? formatDay : chart.xIsMonth ? formatMonth : undefined;

        if (c.type === "line") {
          body = <LineChart data={c.data} yFormat={c.yFormat} xTickFormatter={tickFor(c)} />;
        } else if (c.type === "area") {
          body = <AreaChart data={c.data} yFormat={c.yFormat} xTickFormatter={tickFor(c)} />;
        } else if (c.type === "bar") {
          body = <BarChart data={c.data} yFormat={c.yFormat} />;
        } else if (c.type === "horizontal_bar") {
          body = <HorizontalBar data={c.data} yFormat={c.yFormat} />;
        } else if (c.type === "donut") {
          body = <DonutChart data={c.data} colors={colors} yFormat={c.yFormat} />;
        } else if (c.type === "stacked_bar") {
          body = (
            <StackedBar
              data={c.data}
              seriesKeys={c.seriesKeys}
              colors={colors}
              yFormat={c.yFormat}
              xTickFormatter={tickFor(c)}
            />
          );
        } else if (c.type === "single_stat") {
          body = <SingleStat value={c.value} format={c.format} footnote={c.footnote} />;
        }

        return (
          <SectionBoundary key={i} heading={section.heading}>
            <ReportSection index={idx} heading={section.heading} insight={section.insight}>
              {body}
            </ReportSection>
          </SectionBoundary>
        );
      })}

      {prepared.conclusion ? (
        <section
          className="mt-16 border-t border-ink/10 pt-8"
          style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
        >
          <div className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">In sum</div>
          <p className="mt-4 max-w-[62ch] font-serif text-[22px] leading-[1.4] text-ink italic">
            {prepared.conclusion}
          </p>
        </section>
      ) : null}

      <footer
        className="mt-12 border-t border-ink/10 pt-4 text-[11px] uppercase tracking-[0.2em] text-ink-muted"
        style={{ breakInside: "avoid" }}
      >
        <div className="flex items-center justify-between">
          <span>Veritas</span>
          <span className="tabular">
            {prepared.rowCount.toLocaleString("en-GB")} rows ·{" "}
            {formatValue("compact", prepared.rowCount)}
          </span>
        </div>
      </footer>
    </article>
  );
});
