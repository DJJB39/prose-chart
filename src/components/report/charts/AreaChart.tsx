import {
  Area, AreaChart as RCAreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { formatValue, type FormatKind } from "@/lib/format";
import { AXIS_TICK, TOOLTIP_STYLE } from "./chart-theme";

type Datum = { x: string; y: number };
type Props = {
  data: Datum[];
  yFormat: FormatKind;
  xTickFormatter?: (v: string) => string;
  height?: number;
};

export function AreaChart({ data, yFormat, xTickFormatter, height = 260 }: Props) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <RCAreaChart data={data} margin={{ top: 12, right: 32, bottom: 8, left: 8 }}>
          <defs>
            <linearGradient id="veritas-area-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--rule)" vertical={false} />
          <XAxis
            dataKey="x" stroke="var(--rule)" tickLine={false}
            axisLine={{ stroke: "var(--rule)" }} tick={AXIS_TICK}
            tickFormatter={xTickFormatter}
            interval="preserveStartEnd" minTickGap={28}
            padding={{ left: 4, right: 12 }}
          />
          <YAxis
            stroke="var(--rule)" tickLine={false} axisLine={false}
            tick={AXIS_TICK} tickFormatter={(v: number) => formatValue(yFormat, v)}
            width={64}
          />
          <Tooltip
            cursor={{ stroke: "var(--ink)", strokeWidth: 1, strokeDasharray: "2 2" }}
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={xTickFormatter}
            formatter={(v: number) => [formatValue(yFormat, v), ""]}
          />
          <Area
            type="monotone" dataKey="y" stroke="var(--accent)"
            strokeWidth={1.75} fill="url(#veritas-area-fill)"
            isAnimationActive={false}
          />
        </RCAreaChart>
      </ResponsiveContainer>
    </div>
  );
}
