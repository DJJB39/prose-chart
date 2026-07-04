import { forwardRef, useMemo } from "react";

import { aggregateScalar, aggregateSeries, aggregateStacked, trendDirection, type Row } from "@/lib/aggregate";
import { formatMonth, formatValue } from "@/lib/format";
import { buildColorMap, uniqueOrdered } from "@/lib/palette";
import type { ReportSpec } from "@/lib/spec";

import { AreaChart } from "./charts/AreaChart";
import { BarChart } from "./charts/BarChart";
import { DonutChart } from "./charts/DonutChart";
import { HorizontalBar } from "./charts/HorizontalBar";
import { LineChart } from "./charts/LineChart";
import { SingleStat } from "./charts/SingleStat";
import { StackedBar } from "./charts/StackedBar";
import { KpiCard } from "./KpiCard";
import { ReportSection } from "./ReportSection";
import { TitleBlock } from "./TitleBlock";

type Props = {
  spec: ReportSpec;
  rows: Row[];
  sourceFilename: string;
  brief?: string;
};

function isMonthColumn(col: string, rows: Row[]): boolean {
  const sample = rows.find((r) => r[col] !== null && r[col] !== undefined);
  if (!sample) return false;
  return typeof sample[col] === "string" && /^\d{4}-\d{2}-\d{2}/.test(String(sample[col]));
}

function xFormatter(col: string, rows: Row[]) {
  return isMonthColumn(col, rows) ? formatMonth : undefined;
}

export const Report = forwardRef<HTMLElement, Props>(function Report(
  { spec, rows, sourceFilename, brief },
  ref,
) {
  // One palette for the whole report — assigned from every categorical value
  // any section touches, first-seen order, so colours are stable across sections.
  const colors = useMemo(() => {
    const cats: string[] = [];
    for (const s of spec.sections) {
      if (s.chart.series) cats.push(...uniqueOrdered(rows.map((r) => String(r[s.chart.series!]))));
      if (s.chart.type === "donut" || s.chart.type === "horizontal_bar" || s.chart.type === "bar") {
        cats.push(...uniqueOrdered(rows.map((r) => String(r[s.chart.x]))));
      }
    }
    return buildColorMap(uniqueOrdered(cats));
  }, [spec, rows]);

  return (
    <article ref={ref} className="bg-paper text-ink">
      <TitleBlock
        title={spec.report_title}
        sourceFilename={sourceFilename}
        brief={brief}
        summary={spec.generated_summary}
      />

      {/* KPI row */}
      <section
        className="mt-10"
        style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
      >
        <div className="mb-3 flex items-baseline justify-between border-b border-ink/10 pb-2">
          <h2 className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">Headline</h2>
          <span className="text-[11px] text-ink-muted tabular">00</span>
        </div>
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          style={{
            gridTemplateColumns: `repeat(${Math.min(spec.kpis.length, 4)}, minmax(0, 1fr))`,
          }}
        >
          {spec.kpis.map((k) => {
            const value = aggregateScalar(rows, k.value_expr.agg, k.value_expr.column, k.value_expr.filter);
            let trend: "up" | "down" | "flat" | undefined;
            if (k.trend) {
              const dateCol = Object.keys(rows[0] ?? {}).find((c) =>
                typeof rows[0]?.[c] === "string" && /^\d{4}-\d{2}-\d{2}/.test(String(rows[0][c])),
              );
              if (dateCol) {
                const series = aggregateSeries(rows, dateCol, k.value_expr.column, k.value_expr.agg);
                trend = trendDirection(series);
              }
            }
            return (
              <KpiCard key={k.label} label={k.label} value={value} format={k.format} trend={trend} />
            );
          })}
        </div>
      </section>

      {/* Chart sections */}
      {spec.sections.map((section, i) => {
        const idx = i + 1;
        const chart = section.chart;
        let body: React.ReactNode = null;
        const yFormat = guessFormat(chart.y);
        const scoped = chart.filter
          ? rows.filter((r) => String(r[chart.filter!.column]) === chart.filter!.equals)
          : rows;

        if (chart.type === "line") {
          const data = aggregateSeries(scoped, chart.x, chart.y, chart.agg);
          body = <LineChart data={data} yFormat={yFormat} xTickFormatter={xFormatter(chart.x, scoped)} />;
        } else if (chart.type === "area") {
          const data = aggregateSeries(scoped, chart.x, chart.y, chart.agg);
          body = <AreaChart data={data} yFormat={yFormat} xTickFormatter={xFormatter(chart.x, scoped)} />;
        } else if (chart.type === "bar") {
          const data = aggregateSeries(scoped, chart.x, chart.y, chart.agg);
          body = <BarChart data={data} yFormat={yFormat} />;
        } else if (chart.type === "horizontal_bar") {
          const data = aggregateSeries(scoped, chart.x, chart.y, chart.agg);
          body = <HorizontalBar data={data} yFormat={yFormat} />;
        } else if (chart.type === "donut") {
          const data = aggregateSeries(scoped, chart.x, chart.y, chart.agg);
          body = <DonutChart data={data} colors={colors} yFormat={yFormat} />;
        } else if (chart.type === "stacked_bar" && chart.series) {
          const { data, seriesKeys } = aggregateStacked(scoped, chart.x, chart.y, chart.series, chart.agg);
          body = (
            <StackedBar
              data={data}
              seriesKeys={seriesKeys}
              colors={colors}
              yFormat={yFormat}
              xTickFormatter={xFormatter(chart.x, scoped)}
            />
          );
        } else if (chart.type === "single_stat") {
          const value = aggregateScalar(scoped, chart.agg, chart.y);
          const footnote = chart.filter
            ? `${chart.filter.column} = ${chart.filter.equals}. Aggregate of ${chart.y}.`
            : undefined;
          body = <SingleStat value={value} format={yFormat} footnote={footnote} />;
        }

        return (
          <ReportSection key={i} index={idx} heading={section.heading} insight={section.insight_sentence}>
            {body}
          </ReportSection>
        );
      })}

      {spec.final_conclusion ? (
        <section
          className="mt-16 border-t border-ink/10 pt-8"
          style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
        >
          <div className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">In sum</div>
          <p className="mt-4 max-w-[62ch] font-serif text-[22px] leading-[1.4] text-ink italic">
            {spec.final_conclusion}
          </p>
        </section>
      ) : null}

      <footer
        className="mt-12 border-t border-ink/10 pt-4 text-[11px] uppercase tracking-[0.2em] text-ink-muted"
        style={{ breakInside: "avoid" }}
      >
        <div className="flex items-center justify-between">
          <span>Veritas</span>
          <span className="tabular">{rows.length.toLocaleString("en-GB")} rows · {formatValue("compact", rows.length)}</span>
        </div>
      </footer>
    </article>
  );
});

function guessFormat(name: string): "currency" | "number" | "percent" | "compact" {
  const n = name.toLowerCase();
  if (/(revenue|price|amount|cost|spend|gbp|usd|eur|£|value|sales)/.test(n)) return "currency";
  if (/(rate|pct|percent|ratio|share|%)/.test(n)) return "percent";
  if (/(count|customers|users|orders|sessions|visits|units)/.test(n)) return "compact";
  return "number";
}
