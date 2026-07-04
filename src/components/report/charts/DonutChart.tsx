import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { formatValue, type FormatKind } from "@/lib/format";
import type { ColorMap } from "@/lib/palette";
import { TOOLTIP_STYLE, CHART_FONT } from "./chart-theme";

type Datum = { x: string; y: number };
type Props = { data: Datum[]; colors: ColorMap; yFormat: FormatKind; height?: number };

export function DonutChart({ data, colors, yFormat, height = 280 }: Props) {
  const total = data.reduce((s, d) => s + d.y, 0);
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-8" style={{ height }}>
      <div className="h-full">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data} dataKey="y" nameKey="x"
              cx="50%" cy="50%" innerRadius="58%" outerRadius="88%"
              stroke="var(--paper)" strokeWidth={2}
              isAnimationActive={false}
              startAngle={90} endAngle={-270}
            >
              {data.map((d) => (
                <Cell key={d.x} fill={colors[d.x] ?? "var(--accent)"} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE}
              formatter={(v: number, n: string) => [formatValue(yFormat, v), n]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-2 text-[12px]" style={{ fontFamily: CHART_FONT }}>
        {data.map((d) => {
          const pct = total > 0 ? d.y / total : 0;
          return (
            <li key={d.x} className="flex items-center gap-3">
              <span className="inline-block h-2.5 w-2.5" style={{ backgroundColor: colors[d.x] }} />
              <span className="text-ink">{d.x}</span>
              <span className="ml-auto tabular text-ink-muted">
                {(pct * 100).toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
