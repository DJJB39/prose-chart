import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { EntrySurface } from "@/components/entry/EntrySurface";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ExportBar } from "@/components/report/ExportBar";
import { Report } from "@/components/report/Report";
import { sampleMeta, sampleRows } from "@/lib/sample-data";
import { parseFile } from "@/lib/parse";
import { hasNumericColumn, profileDataset } from "@/lib/profile";
import { ReportSpecSchema, type ReportSpec } from "@/lib/spec";
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

type Composed = {
  spec: ReportSpec;
  rows: Row[];
  brief: string;
  sourceFilename: string;
};

function VeritasApp() {
  const [composed, setComposed] = useState<Composed | null>(null);
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
      body: JSON.stringify({ brief: brief.trim() || "Compose the most useful report the columns support.", source_filename: filename, profile }),
    });
    const data = (await res.json().catch(() => ({}))) as { spec?: unknown; error?: string; provider?: string; retried?: boolean };
    if (!res.ok) throw new Error(data.error || `Compose failed (${res.status})`);
    const spec = ReportSpecSchema.parse(data.spec);
    console.log(`[Veritas] rendered via ${data.provider}${data.retried ? " (retried)" : ""}`);
    return { spec, rows, brief, sourceFilename: filename };
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
      const c = await composeVia(brief, parsed.rows as Row[], parsed.filename);
      setComposed(c);
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
      const c = await composeVia(sampleMeta.brief, sampleRows as unknown as Row[], sampleMeta.source_filename);
      setComposed(c);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Veritas could not compose the sample report.");
    } finally {
      setLoading(false);
    }
  }

  if (!composed) {
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
        filename={`veritas-${composed.sourceFilename.replace(/\.[^.]+$/, "")}.pdf`}
        onReset={() => setComposed(null)}
      />
      <main className="mx-auto max-w-[900px] px-8 py-10">
        <Report
          ref={reportRef}
          spec={composed.spec}
          rows={composed.rows}
          brief={composed.brief}
          sourceFilename={composed.sourceFilename}
        />
      </main>
    </div>
  );
}

