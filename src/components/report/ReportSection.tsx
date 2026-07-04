import type { ReactNode } from "react";

type Props = {
  index: number;
  heading: string;
  insight: string;
  children: ReactNode;
};

/** One report section: sticky-style eyebrow, heading number, insight line,
 *  chart body. `break-inside: avoid` keeps a section on one page in the PDF. */
export function ReportSection({ index, heading, insight, children }: Props) {
  const num = String(index).padStart(2, "0");
  return (
    <section
      className="mt-14 first:mt-10"
      style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
    >
      <div className="mb-3 flex items-baseline justify-between border-b border-ink/10 pb-2">
        <h2 className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">{heading}</h2>
        <span className="text-[11px] text-ink-muted tabular">{num}</span>
      </div>
      <p className="mb-6 max-w-[62ch] font-serif text-[19px] leading-[1.45] text-ink">
        {insight}
      </p>
      <div>{children}</div>
    </section>
  );
}
