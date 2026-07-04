import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef } from "react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { ExportBar } from "@/components/report/ExportBar";
import { Report } from "@/components/report/Report";
import { readShare } from "@/lib/share";

export const Route = createFileRoute("/share/$payload")({
  component: SharedReport,
  head: () => ({
    meta: [
      { title: "Shared report — Veritas" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content: "A read-only Veritas report shared by link.",
      },
    ],
  }),
});

function SharedReport() {
  const { payload } = Route.useParams();
  const prepared = useMemo(() => readShare(payload), [payload]);
  const reportRef = useRef<HTMLElement>(null);

  if (!prepared) {
    return (
      <div className="min-h-screen bg-paper text-ink">
        <div className="no-print flex items-center justify-end gap-3 px-8 py-4">
          <ThemeToggle />
        </div>
        <main className="mx-auto max-w-[62ch] px-8 py-24">
          <p className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">Veritas</p>
          <h1 className="mt-4 font-editorial text-[44px] leading-[1.05] tracking-[-0.015em] text-ink">
            This link can no longer be read.
          </h1>
          <p className="mt-6 font-serif text-[19px] leading-[1.5] text-ink-muted">
            The payload is missing, damaged, or from an older version of Veritas.
            Ask the sender to re-share, or compose a new report from your own data.
          </p>
          <Link
            to="/"
            className="mt-10 inline-flex items-center border border-ink bg-ink px-4 py-2 text-[12px] uppercase tracking-[0.18em] text-paper transition-opacity hover:opacity-90"
          >
            Compose a report
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* No `prepared` prop → Share button hidden. No `onReset` → no reset. Export retained. */}
      <ExportBar
        targetRef={reportRef}
        filename={`veritas-${prepared.sourceFilename.replace(/\.[^.]+$/, "")}.pdf`}
      />
      <main className="mx-auto max-w-[900px] px-8 py-10">
        <Report ref={reportRef} prepared={prepared} />
      </main>
    </div>
  );
}
