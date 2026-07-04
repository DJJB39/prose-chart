import { useState } from "react";

import { exportReportToPdf } from "@/lib/pdf";
import { persistShare, type PreparedReport } from "@/lib/share";
import { ThemeToggle } from "@/components/ThemeToggle";

type Props = {
  targetRef: React.RefObject<HTMLElement | null>;
  filename?: string;
  onReset?: () => void;
  /** Provide to enable the Share button; omit on shared/read-only views. */
  prepared?: PreparedReport;
};

type ShareState =
  | { kind: "idle" }
  | { kind: "copied"; url: string }
  | { kind: "too_large" }
  | { kind: "error"; message: string };

const TOO_LARGE_MSG =
  "This report is too detailed to share by link — export it as a PDF instead.";

export function ExportBar({ targetRef, filename, onReset, prepared }: Props) {
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState<ShareState>({ kind: "idle" });

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

  async function handleShare() {
    if (!prepared) return;
    const result = persistShare(prepared);
    if (result.url === null) {
      console.warn(`[Veritas] share refused: ${result.reason} (${result.length} chars)`);
      setShare({ kind: "too_large" });
      return;
    }
    try {
      await navigator.clipboard.writeText(result.url);
      setShare({ kind: "copied", url: result.url });
      window.setTimeout(() => setShare({ kind: "idle" }), 3200);
    } catch (err) {
      console.error("[Veritas] clipboard write failed:", err);
      // Fall back to opening the link so the user can copy it manually.
      window.prompt("Copy this share URL:", result.url);
      setShare({ kind: "idle" });
    }
  }

  return (
    <div className="no-print sticky top-0 z-10 border-b border-ink/10 bg-paper/85 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-8 py-4">
        <span className="text-[11px] uppercase tracking-[0.2em] text-ink-muted">Veritas</span>
        <div className="mx-auto" />
        {onReset ? (
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 border border-ink/20 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-ink transition-opacity hover:opacity-80"
          >
            New report
          </button>
        ) : null}
        <ThemeToggle />
        {prepared ? (
          <button
            onClick={handleShare}
            disabled={share.kind === "too_large"}
            className="inline-flex items-center gap-2 border border-ink/20 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-ink transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            title={share.kind === "too_large" ? TOO_LARGE_MSG : "Copy a shareable link"}
          >
            {share.kind === "copied" ? "Link copied" : "Share"}
          </button>
        ) : null}
        <button
          onClick={handleExport}
          disabled={busy}
          className="inline-flex items-center gap-2 border border-ink bg-ink px-4 py-2 text-[12px] uppercase tracking-[0.18em] text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Rendering…" : "Export as PDF"}
        </button>
      </div>
      {share.kind === "too_large" ? (
        <div className="border-t border-ink/10 bg-paper/95 px-8 py-3 font-serif text-[14px] italic text-ink-muted">
          {TOO_LARGE_MSG}
        </div>
      ) : null}
    </div>
  );
}
