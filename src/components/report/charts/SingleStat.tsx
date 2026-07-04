import { formatValue, type FormatKind } from "@/lib/format";

type Props = { label?: string; value: number; format: FormatKind; footnote?: string };

/** A dominant standalone figure — set editorially, not as a chart. */
export function SingleStat({ label, value, format, footnote }: Props) {
  return (
    <div className="relative border border-ink/10 px-8 py-10">
      <div className="absolute top-0 left-0 h-[3px] w-14 bg-accent" />
      {label ? (
        <div className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">{label}</div>
      ) : null}
      <div
        className="mt-4 font-editorial text-[88px] leading-none tracking-[-0.02em] text-ink tabular"
        suppressHydrationWarning
      >
        {formatValue(format, value)}
      </div>
      {footnote ? (
        <div className="mt-4 max-w-[52ch] text-[13px] text-ink-muted">{footnote}</div>
      ) : null}
    </div>
  );
}
