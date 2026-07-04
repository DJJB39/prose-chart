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
      const profile = profileDataset(parsed.rows);
      if (!hasNumericColumn(profile)) {
        setError(
          "This dataset has no numeric column, so there is nothing to aggregate. A useful Veritas report needs at least one measure — revenue, a count, a rate — to compose against.",
        );
        return;
      }
      const spec = autoSpec(profile, brief, parsed.filename);
      if (!spec) {
        setError("The dataset does not carry a shape Veritas can compose a report from.");
        return;
      }
      setComposed({ spec, rows: parsed.rows as Row[], brief, sourceFilename: parsed.filename });
    } catch (err) {
      console.error(err);
      setError("The file could not be parsed. Veritas accepts .csv and .xlsx.");
    } finally {
      setLoading(false);
    }
  }

  function handleTrySample() {
    setError(null);
    setComposed({
      spec: sampleSpec,
      rows: sampleRows as unknown as Row[],
      brief: sampleMeta.brief,
      sourceFilename: sampleMeta.source_filename,
    });
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

