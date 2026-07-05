import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { EntrySurface } from "@/components/entry/EntrySurface";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ExportBar } from "@/components/report/ExportBar";
import { Report } from "@/components/report/Report";
import { sampleMeta, sampleRows } from "@/lib/sample-data";
import { parseFile } from "@/lib/parse";
import { profileDataset } from "@/lib/profile";
import { ReportSpecSchema } from "@/lib/spec";
import { upgradeNarrative } from "@/lib/narrate";
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

type Clarification = { question: string; options: string[] | null };

function VeritasApp() {
  const [prepared, setPrepared] = useState<PreparedReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [clarification, setClarification] = useState<Clarification | null>(null);
  const pendingRef = useRef<{ brief: string; rows: Row[]; filename: string } | null>(null);
  const reportRef = useRef<HTMLElement>(null);
  const generationRef = useRef(0);

  /** Show the structural report immediately, then upgrade the prose in
   *  place once the numbers-aware narrative pass verifies. */
  function present(result: PreparedReport) {
    const generation = ++generationRef.current;
    setPrepared(result);
    void upgradeNarrative(result).then((upgraded) => {
      if (upgraded && generationRef.current === generation) {
        setPrepared((prev) => (prev && !prev.narrated ? upgraded : prev));
      }
    });
  }

  async function composeVia(
    brief: string,
    rows: Row[],
    filename: string,
  ): Promise<PreparedReport | "clarification"> {
    const profile = profileDataset(rows);
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
      clarification?: { question: string; options: string[] | null };
      error?: string;
      provider?: string;
      retried?: boolean;
    };
    if (!res.ok) throw new Error(data.error || `Compose failed (${res.status})`);
    if (data.clarification) {
      pendingRef.current = { brief, rows, filename };
      setClarification(data.clarification);
      return "clarification";
    }
    const spec = ReportSpecSchema.parse(data.spec);
    console.log(`[Veritas] rendered via ${data.provider}${data.retried ? " (retried)" : ""}`);
    return prepareReport(spec, rows, { sourceFilename: filename, brief });
  }

  async function handleSubmit(brief: string, file: File | null) {
    setError(null);
    setClarification(null);
    if (!file) return;
    setLoading(true);
    try {
      const parsed = await parseFile(file);
      if (parsed.rows.length === 0) {
        setError("The file parsed cleanly but contained no data rows beneath its header.");
        return;
      }
      const result = await composeVia(brief, parsed.rows as Row[], parsed.filename);
      if (result !== "clarification") present(result);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Veritas could not compose this report.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTrySample() {
    setError(null);
    setClarification(null);
    setLoading(true);
    try {
      const result = await composeVia(
        sampleMeta.brief,
        sampleRows as unknown as Row[],
        sampleMeta.source_filename,
      );
      if (result !== "clarification") present(result);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Veritas could not compose the sample report.");
    } finally {
      setLoading(false);
    }
  }

  async function handleClarificationAnswer(answer: string) {
    const pending = pendingRef.current;
    const q = clarification?.question;
    if (!pending || !q || !answer.trim()) return;
    setClarification(null);
    setLoading(true);
    setError(null);
    const appendedBrief = `${pending.brief}\n\nClarification — Q: ${q}\nA: ${answer.trim()}`;
    try {
      const result = await composeVia(appendedBrief, pending.rows, pending.filename);
      if (result !== "clarification") {
        pendingRef.current = null;
        present(result);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Veritas could not compose this report.");
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
          clarification={clarification}
          onAnswerClarification={handleClarificationAnswer}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <ExportBar
        targetRef={reportRef}
        filename={`veritas-${prepared.sourceFilename.replace(/\.[^.]+$/, "")}.pdf`}
        onReset={() => {
          generationRef.current++;
          setPrepared(null);
        }}
        prepared={prepared}
      />
      <main className="mx-auto max-w-[900px] px-8 py-10">
        <Report ref={reportRef} prepared={prepared} />
      </main>
    </div>
  );
}
