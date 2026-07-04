import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { EntrySurface } from "@/components/entry/EntrySurface";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ExportBar } from "@/components/report/ExportBar";
import { Report } from "@/components/report/Report";
import { sampleMeta, sampleRows } from "@/lib/sample-data";
import { parseFile } from "@/lib/parse";
import { hasNumericColumn, profileDataset } from "@/lib/profile";
import { ReportSpecSchema } from "@/lib/spec";
import { prepareReport, type PreparedReport } from "@/lib/share";
import type { Row } from "@/lib/aggregate";

export const Route = createFileRoute("/")({
  component: VeritasApp,
  head: () => ({
    meta: [
      { title: "Veritas — Editorial reports from your data" },
      {
        name: "description",
        content:
          "Turn a spreadsheet and a plain-English brief into a report you would be happy to hand to a board.",
      },
      { property: "og:title", content: "Veritas — Editorial reports from your data" },
      {
        property: "og:description",
        content:
          "Turn a spreadsheet and a plain-English brief into a report you would be happy to hand to a board.",
      },
    ],
  }),
});

function VeritasApp() {
  const [prepared, setPrepared] = useState<PreparedReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const reportRef = useRef<HTMLElement>(null);

  async function composeVia(brief: string, rows: Row[], filename: string) {
    const profile = profileDataset(rows);
    if (!hasNumericColumn(profile)) {
      throw new Error(
        "This dataset has no numeric column, so there is nothing to aggregate. A useful Veritas report needs at least one measure — revenue, a count, a rate — to compose against.",
      );
    }
    const res = await fetch("/api/compose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        brief: brief.trim() || "Compose the most useful report the columns support.",
        source_filename: filename,
        profile,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      spec?: unknown;
      error?: string;
      provider?: string;
      retried?: boolean;
    };
    if (!res.ok) throw new Error(data.error || `Compose failed (${res.status})`);
    const spec = ReportSpecSchema.parse(data.spec);
    console.log(`[Veritas] rendered via ${data.provider}${data.retried ? " (retried)" : ""}`);
    return prepareReport(spec, rows, { sourceFilename: filename, brief });
  }

  async function handleSubmit(brief: string, file: File | null) {
    setError(null);
    if (!file) return;
    setLoading(true);
    try {
      const parsed = await parseFile(file);
      if (parsed.rows.length === 0) {
        setError("The file parsed cleanly but contained no data rows beneath its header.");
        return;
      }
      const p = await composeVia(brief, parsed.rows as Row[], parsed.filename);
      setPrepared(p);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Veritas could not compose this report.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTrySample() {
    setError(null);
    setLoading(true);
    try {
      const p = await composeVia(sampleMeta.brief, sampleRows as unknown as Row[], sampleMeta.source_filename);
      setPrepared(p);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Veritas could not compose the sample report.");
    } finally {
      setLoading(false);
    }
  }

  if (!prepared) {
    return (
      <div className="min-h-screen bg-paper text-ink">
        <div className="no-print flex items-center justify-end gap-3 px-8 py-4">
          <ThemeToggle />
        </div>
        <EntrySurface
          onSubmit={handleSubmit}
          onTrySample={handleTrySample}
          error={error}
          loading={loading}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <ExportBar
        targetRef={reportRef}
        filename={`veritas-${prepared.sourceFilename.replace(/\.[^.]+$/, "")}.pdf`}
        onReset={() => setPrepared(null)}
        prepared={prepared}
      />
      <main className="mx-auto max-w-[900px] px-8 py-10">
        <Report ref={reportRef} prepared={prepared} />
      </main>
    </div>
  );
}
