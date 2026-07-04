import {
  Bar, BarChart as RCBarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";

import { formatValue, type FormatKind } from "@/lib/format";
import type { ColorMap } from "@/lib/palette";
import { AXIS_TICK, TOOLTIP_STYLE, CHART_FONT } from "./chart-theme";

type Props = {
  data: Array<Record<string, string | number>>;
  seriesKeys: string[];
  colors: ColorMap;
  yFormat: FormatKind;
  xTickFormatter?: (v: string) => string;
  height?: number;
};

export function StackedBar({ data, seriesKeys, colors, yFormat, xTickFormatter, height = 300 }: Props) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <RCBarChart data={data} margin={{ top: 12, right: 24, bottom: 8, left: 8 }} barCategoryGap="20%">
          <CartesianGrid stroke="var(--rule)" vertical={false} />
          <XAxis dataKey="x" stroke="var(--rule)" tickLine={false}
            axisLine={{ stroke: "var(--rule)" }} tick={AXIS_TICK}
            tickFormatter={xTickFormatter} interval="preserveStartEnd" minTickGap={28}
            padding={{ left: 4, right: 12 }} />
          <YAxis stroke="var(--rule)" tickLine={false} axisLine={false}
            tick={AXIS_TICK} tickFormatter={(v: number) => formatValue(yFormat, v)} width={64} />
          <Tooltip
            cursor={{ fill: "var(--accent-soft)" }}
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={xTickFormatter}
            formatter={(v: number, name: string) => [formatValue(yFormat, v), name]}
          />
          <Legend
            wrapperStyle={{ fontFamily: CHART_FONT, fontSize: 11, color: "var(--ink-muted)", paddingTop: 8 }}
            iconType="square" iconSize={9} align="left"
          />
          {seriesKeys.map((k) => (
            <Bar key={k} dataKey={k} stackId="s" fill={colors[k]} isAnimationActive={false} maxBarSize={56} />
          ))}
        </RCBarChart>
      </ResponsiveContainer>
    </div>
  );
}
