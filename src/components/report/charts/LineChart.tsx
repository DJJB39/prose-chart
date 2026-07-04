import {
  CartesianGrid,
  Line,
  LineChart as RCLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatValue, type FormatKind } from "@/lib/format";

type Datum = { x: string; y: number };

type Props = {
  data: Datum[];
  yFormat: FormatKind;
  xTickFormatter?: (v: string) => string;
  height?: number;
};

const INK = "#121212";
const INK_MUTED = "#5b5a55";
const RULE = "rgba(18,18,18,0.10)";
const ACCENT = "#2d5bff";

export function LineChart({ data, yFormat, xTickFormatter, height = 320 }: Props) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <RCLineChart data={data} margin={{ top: 12, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid stroke={RULE} vertical={false} strokeDasharray="0" />
          <XAxis
            dataKey="x"
            stroke={RULE}
            tick={{
              fill: INK_MUTED,
              fontSize: 11,
              fontFamily: "Inter Tight Variable, Inter Tight, sans-serif",
            }}
            tickLine={false}
            axisLine={{ stroke: RULE }}
            tickFormatter={xTickFormatter}
            minTickGap={24}
          />
          <YAxis
            stroke={RULE}
            tick={{
              fill: INK_MUTED,
              fontSize: 11,
              fontFamily: "Inter Tight Variable, Inter Tight, sans-serif",
            }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => formatValue(yFormat, v)}
            width={64}
          />
          <Tooltip
            cursor={{ stroke: INK, strokeWidth: 1, strokeDasharray: "2 2" }}
            contentStyle={{
              background: "#faf9f6",
              border: `1px solid ${RULE}`,
              borderRadius: 2,
              fontSize: 12,
              fontFamily: "Inter Tight Variable, Inter Tight, sans-serif",
              color: INK,
              boxShadow: "none",
            }}
            labelFormatter={xTickFormatter}
            formatter={(v: number) => [formatValue(yFormat, v), ""]}
          />
          <Line
            type="monotone"
            dataKey="y"
            stroke={ACCENT}
            strokeWidth={1.75}
            dot={false}
            activeDot={{ r: 3.5, fill: ACCENT, stroke: "#faf9f6", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </RCLineChart>
      </ResponsiveContainer>
    </div>
  );
}
