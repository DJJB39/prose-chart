import { formatValue, type FormatKind } from "@/lib/format";

type KpiCardProps = {
  label: string;
  value: number;
  format: FormatKind;
  footnote?: string;
};

export function KpiCard({ label, value, format, footnote }: KpiCardProps) {
  return (
    <article className="relative flex flex-col justify-between border border-ink/10 bg-paper px-7 py-6">
      <div className="absolute top-0 left-0 h-[3px] w-10 bg-accent" />
      <div className="text-[11px] uppercase tracking-[0.2em] text-ink-muted">{label}</div>
      <div className="mt-6 font-editorial text-[52px] leading-none tracking-[-0.02em] text-ink tabular">
        {formatValue(format, value)}
      </div>
      {footnote ? (
        <div className="mt-4 text-[12px] text-ink-muted tabular">{footnote}</div>
      ) : null}
    </article>
  );
}
