import { formatGeneratedAt } from "@/lib/format";

type TitleBlockProps = {
  title: string;
  sourceFilename: string;
  generatedAt?: Date;
  brief?: string;
};

export function TitleBlock({ title, sourceFilename, generatedAt, brief }: TitleBlockProps) {
  const date = formatGeneratedAt(generatedAt);
  return (
    <header className="border-b border-ink/10 pb-10">
      <div className="mb-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-ink-muted">
        <span className="tabular">Veritas</span>
        <span className="h-px w-8 bg-ink/25" />
        <span>Report</span>
      </div>
      <h1 className="font-editorial text-[64px] leading-[1.02] tracking-[-0.015em] text-ink">
        {title}
      </h1>
      {brief ? (
        <p className="mt-6 max-w-[52ch] font-serif text-[22px] leading-[1.35] text-ink-muted italic">
          &ldquo;{brief}&rdquo;
        </p>
      ) : null}
      <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-2 text-[12px] text-ink-muted sm:max-w-md">
        <dt className="uppercase tracking-[0.18em]">Source</dt>
        <dd className="tabular text-ink">{sourceFilename}</dd>
        <dt className="uppercase tracking-[0.18em]">Generated</dt>
        <dd className="tabular text-ink">{date}</dd>
      </dl>
    </header>
  );
}
