import { useEffect, useRef, useState } from "react";

import { Dropzone } from "./Dropzone";

type Clarification = { question: string; options: string[] | null };

type Props = {
  onSubmit: (brief: string, file: File | null) => void;
  onTrySample: () => void;
  error?: string | null;
  loading?: boolean;
  clarification?: Clarification | null;
  onAnswerClarification?: (answer: string) => void;
};

export function EntrySurface({
  onSubmit,
  onTrySample,
  error,
  loading,
  clarification,
  onAnswerClarification,
}: Props) {
  const [brief, setBrief] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [answer, setAnswer] = useState("");
  const answerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (clarification) {
      setAnswer("");
      queueMicrotask(() => answerRef.current?.focus());
    }
  }, [clarification]);

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

        {clarification && onAnswerClarification ? (
          <div className="border border-ink/20 bg-paper px-5 py-4">
            <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-ink-muted">
              One quick question
            </div>
            <p className="font-serif text-[18px] leading-[1.4] text-ink">
              {clarification.question}
            </p>
            {clarification.options && clarification.options.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {clarification.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => onAnswerClarification(opt)}
                    disabled={loading}
                    className="border border-ink/25 px-4 py-2 text-[13px] text-ink transition-colors hover:border-ink disabled:opacity-40"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="mt-4 flex items-center gap-3">
              <input
                ref={answerRef}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && answer.trim()) onAnswerClarification(answer);
                }}
                placeholder={
                  clarification.options && clarification.options.length > 0
                    ? "…or type your own answer"
                    : "Type your answer"
                }
                className="flex-1 border border-ink/20 bg-paper px-3 py-2 font-serif text-[16px] text-ink placeholder:text-ink-muted/60 focus:border-accent focus:outline-none"
              />
              <button
                onClick={() => onAnswerClarification(answer)}
                disabled={loading || !answer.trim()}
                className="border border-ink bg-ink px-4 py-2 text-[12px] uppercase tracking-[0.18em] text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                Send
              </button>
            </div>
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
