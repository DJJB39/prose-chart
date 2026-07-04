import { useState } from "react";

import { Dropzone } from "./Dropzone";

type Props = {
  onSubmit: (brief: string, file: File | null) => void;
  onTrySample: () => void;
  error?: string | null;
  loading?: boolean;
};

export function EntrySurface({ onSubmit, onTrySample, error, loading }: Props) {
  const [brief, setBrief] = useState("");
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="mx-auto max-w-[820px] px-8 py-20">
      <div className="mb-3 flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-ink-muted">
        <span className="tabular">Veritas</span>
        <span className="h-px w-8 bg-ink/25" />
        <span>New report</span>
      </div>
      <h1 className="font-editorial text-[56px] leading-[1.04] tracking-[-0.015em] text-ink">
        A report you would be happy<br />to hand to a board.
      </h1>
      <p className="mt-6 max-w-[52ch] font-serif text-[20px] leading-[1.4] text-ink-muted italic">
        Give it a spreadsheet and a sentence about what you want to know. Veritas returns an editorial-quality analytical report — the kind of thing that used to take a Monday.
      </p>

      <div className="mt-12 space-y-6">
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">Brief</span>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={3}
            placeholder="e.g. Show what's driving revenue across regions and flag anything unusual."
            className="mt-3 w-full resize-none border border-ink/20 bg-paper px-4 py-3 font-serif text-[18px] leading-[1.4] text-ink placeholder:text-ink-muted/60 focus:border-accent focus:outline-none"
          />
        </label>

        <Dropzone onFile={setFile} disabled={loading} />
        {file ? (
          <div className="text-[13px] text-ink-muted tabular">
            Loaded: <span className="text-ink">{file.name}</span> · {(file.size / 1024).toFixed(1)} KB
          </div>
        ) : null}

        {error ? (
          <div className="border-l-2 border-accent bg-accent-soft px-4 py-3 font-serif text-[16px] leading-[1.5] text-ink italic">
            {error}
          </div>
        ) : null}

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => onSubmit(brief, file)}
            disabled={loading || !file}
            className="inline-flex items-center gap-2 border border-ink bg-ink px-5 py-3 text-[12px] uppercase tracking-[0.18em] text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {loading ? "Composing…" : "Compose report"}
          </button>
          <button
            onClick={onTrySample}
            disabled={loading}
            className="inline-flex items-center gap-2 border border-ink/25 px-5 py-3 text-[12px] uppercase tracking-[0.18em] text-ink transition-colors hover:border-ink disabled:opacity-40"
          >
            Try the sample
          </button>
        </div>
      </div>
    </div>
  );
}
