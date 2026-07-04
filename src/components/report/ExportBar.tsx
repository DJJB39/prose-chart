import { useState } from "react";

import { exportReportToPdf } from "@/lib/pdf";

type Props = { targetRef: React.RefObject<HTMLElement | null>; filename?: string };

export function ExportBar({ targetRef, filename }: Props) {
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    if (!targetRef.current) return;
    setBusy(true);
    try {
      await exportReportToPdf(targetRef.current, filename);
    } catch (err) {
      console.error("[Veritas] PDF export failed:", err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="no-print sticky top-0 z-10 flex items-center justify-end gap-3 border-b border-ink/10 bg-paper/85 px-8 py-4 backdrop-blur-sm">
      <span className="text-[11px] uppercase tracking-[0.2em] text-ink-muted">Veritas</span>
      <div className="mr-auto" />
      <button
        onClick={handleExport}
        disabled={busy}
        className="inline-flex items-center gap-2 border border-ink bg-ink px-4 py-2 text-[12px] uppercase tracking-[0.18em] text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Rendering…" : "Export as PDF"}
      </button>
    </div>
  );
}
