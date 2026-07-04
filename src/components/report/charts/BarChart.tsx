import {
  Bar, BarChart as RCBarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { formatValue, type FormatKind } from "@/lib/format";
import { AXIS_TICK, TOOLTIP_STYLE } from "./chart-theme";

type Datum = { x: string; y: number };
type Props = {
  data: Datum[];
  yFormat: FormatKind;
  height?: number;
  color?: string;
};

export function BarChart({ data, yFormat, height = 260, color = "var(--accent)" }: Props) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <RCBarChart data={data} margin={{ top: 12, right: 24, bottom: 8, left: 8 }} barCategoryGap="30%">
          <CartesianGrid stroke="var(--rule)" vertical={false} />
          <XAxis dataKey="x" stroke="var(--rule)" tickLine={false}
            axisLine={{ stroke: "var(--rule)" }} tick={AXIS_TICK} />
          <YAxis stroke="var(--rule)" tickLine={false} axisLine={false}
            tick={AXIS_TICK} tickFormatter={(v: number) => formatValue(yFormat, v)} width={64} />
          <Tooltip cursor={{ fill: "var(--accent-soft)" }} contentStyle={TOOLTIP_STYLE}
            formatter={(v: number) => [formatValue(yFormat, v), ""]} />
          <Bar dataKey="y" fill={color} isAnimationActive={false} maxBarSize={64} />
        </RCBarChart>
      </ResponsiveContainer>
    </div>
  );
}
