// POST /api/narrate — the analyst pass. Receives the computed digest
// (every value already calculated by the app), asks the provider to rewrite
// summary / insights / conclusion with real figures, then MECHANICALLY
// verifies that every number in the returned prose appears in the digest.
// One retry with the offending figures restated; if that also fails, 422 —
// the client keeps the structural prose, which is always complete.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { callNarrator, extractJson, getProviderName } from "@/lib/ai-provider.server";
import { verifyNarrative, type Narrative, type NarrativeDigest } from "@/lib/narrate";

const NarrativeSchema = z.object({
  summary: z.string().min(1).max(1400),
  insights: z.array(z.string().min(1).max(700)).min(1).max(8),
  conclusion: z.string().max(700).optional(),
});

const DigestSchema = z.object({
  brief: z.string().max(4000).optional(),
  title: z.string().min(1).max(200),
  row_count: z.number().int().nonnegative(),
  kpis: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        change_vs_prior_month: z.string().optional(),
      }),
    )
    .max(8),
  sections: z
    .array(
      z.object({
        heading: z.string(),
        chart: z.string(),
        x: z.string().optional(),
        y: z.string().optional(),
        agg: z.string().optional(),
        point_count: z.number().int().nonnegative(),
        points: z.array(z.object({ x: z.string(), y: z.string() })).max(40),
        structural_insight: z.string().max(1200),
      }),
    )
    .min(1)
    .max(8),
  structural_summary: z.string().max(1400),
  structural_conclusion: z.string().max(700).optional(),
});

const RequestSchema = z.object({ digest: DigestSchema });

async function attempt(
  digest: NarrativeDigest,
  retry_reason?: string,
): Promise<{ ok: true; narrative: Narrative } | { ok: false; reason: string }> {
  const { raw } = await callNarrator(digest, retry_reason);
  // Providers occasionally wrap output; extractJson in the provider already
  // parsed for anthropic, but the gateway path may return a string.
  const candidate = typeof raw === "string" ? extractJson(raw) : raw;
  const parsed = NarrativeSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      reason: `Zod: ${parsed.error.issues
        .slice(0, 4)
        .map((i) => `${i.path.join(".")} ${i.message}`)
        .join("; ")}`,
    };
  }
  if (parsed.data.insights.length !== digest.sections.length) {
    return {
      ok: false,
      reason: `insights must have exactly ${digest.sections.length} entries (one per section, in order); got ${parsed.data.insights.length}`,
    };
  }
  const check = verifyNarrative(digest, parsed.data);
  if (!check.ok) return { ok: false, reason: `Verification: ${check.offenders.join("; ")}` };
  return { ok: true, narrative: parsed.data };
}

export const Route = createFileRoute("/api/narrate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const started = Date.now();
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const parsed = RequestSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: "Invalid request", issues: parsed.error.issues },
            { status: 400 },
          );
        }
        const provider = getProviderName();
        const digest = parsed.data.digest as NarrativeDigest;
        try {
          let result = await attempt(digest);
          let retried = false;
          if (!result.ok) {
            retried = true;
            console.warn(
              `[Veritas] narrate first attempt failed (${provider}): ${result.reason} — retrying once`,
            );
            result = await attempt(digest, result.reason);
          }
          if (!result.ok) {
            console.error(`[Veritas] narrate retry also failed (${provider}): ${result.reason}`);
            return Response.json(
              {
                error: "Narrative failed verification; keeping structural prose.",
                provider,
                detail: result.reason,
              },
              { status: 422 },
            );
          }
          console.log(
            `[Veritas] narrated via ${provider} in ${Date.now() - started}ms (retried=${retried})`,
          );
          return Response.json({ narrative: result.narrative, provider, retried });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[Veritas] narrate provider error (${provider}):`, msg);
          const status = /401|403|Missing/i.test(msg) ? 500 : 502;
          return Response.json({ error: `Provider error: ${msg}`, provider }, { status });
        }
      },
    },
  },
});
