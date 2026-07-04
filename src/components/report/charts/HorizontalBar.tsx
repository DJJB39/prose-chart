import {
  Bar, BarChart as RCBarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { formatValue, type FormatKind } from "@/lib/format";
import { AXIS_TICK, TOOLTIP_STYLE } from "./chart-theme";

type Datum = { x: string; y: number };
type Props = { data: Datum[]; yFormat: FormatKind; height?: number; color?: string };

export function HorizontalBar({ data, yFormat, height, color = "var(--accent)" }: Props) {
  // Sort descending so the ranking reads top-down.
  const sorted = [...data].sort((a, b) => b.y - a.y);
  const h = height ?? Math.max(180, sorted.length * 44);
  return (
    <div style={{ width: "100%", height: h }}>
      <ResponsiveContainer>
        <RCBarChart data={sorted} layout="vertical"
          margin={{ top: 8, right: 32, bottom: 8, left: 8 }} barCategoryGap="30%">
          <CartesianGrid stroke="var(--rule)" horizontal={false} />
          <XAxis type="number" stroke="var(--rule)" tickLine={false}
            axisLine={{ stroke: "var(--rule)" }} tick={AXIS_TICK}
            tickFormatter={(v: number) => formatValue(yFormat, v)} />
          <YAxis dataKey="x" type="category" stroke="var(--rule)" tickLine={false}
            axisLine={false} tick={{ ...AXIS_TICK, fill: "var(--ink)" }} width={120} />
          <Tooltip cursor={{ fill: "var(--accent-soft)" }} contentStyle={TOOLTIP_STYLE}
            formatter={(v: number) => [formatValue(yFormat, v), ""]} />
          <Bar dataKey="y" fill={color} isAnimationActive={false} maxBarSize={28} />
        </RCBarChart>
      </ResponsiveContainer>
    </div>
  );
}
