// POST /api/compose — Zod-validates the request, calls the configured AI
// provider, Zod-validates the returned spec against ReportSpec, and retries
// once with the validation error re-stated. The renderer never sees a
// malformed spec.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { callProvider, getProviderName } from "@/lib/ai-provider.server";
import { ReportSpecSchema } from "@/lib/spec";
import { validateSpec } from "@/lib/spec-validate";

const ColumnProfileSchema = z.object({
  name: z.string(),
  type: z.enum(["date", "numeric", "categorical", "id"]),
  cardinality: z.number(),
  min: z.union([z.string(), z.number(), z.null()]),
  max: z.union([z.string(), z.number(), z.null()]),
  null_pct: z.number(),
  top_categories: z.array(z.object({ value: z.string(), count: z.number() })),
});

const RequestSchema = z.object({
  brief: z.string().min(1).max(2000),
  source_filename: z.string().min(1).max(200),
  profile: z.object({
    rowCount: z.number().int().nonnegative(),
    columns: z.array(ColumnProfileSchema).min(1).max(60),
  }),
});

async function attempt(
  input: z.infer<typeof RequestSchema>,
  retry_reason?: string,
): Promise<
  | { ok: true; spec: import("@/lib/spec").ReportSpec; warnings: string[] }
  | { ok: false; reason: string }
> {
  const { raw } = await callProvider({ ...input, retry_reason });
  const parsed = ReportSpecSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: `Zod: ${parsed.error.issues.slice(0, 4).map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}` };
  }
  const check = validateSpec(parsed.data, input.profile);
  if (!check.ok) return { ok: false, reason: `Profile: ${check.errors.join("; ")}` };
  return { ok: true, spec: check.spec, warnings: check.warnings };
}

export const Route = createFileRoute("/api/compose")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const started = Date.now();
        let body: unknown;
        try { body = await request.json(); } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const parsed = RequestSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
        }
        const provider = getProviderName();
        try {
          let result = await attempt(parsed.data);
          let retried = false;
          if (!result.ok) {
            retried = true;
            console.warn(`[Veritas] first attempt failed (${provider}): ${result.reason} — retrying once`);
            result = await attempt(parsed.data, result.reason);
          }
          if (!result.ok) {
            console.error(`[Veritas] retry also failed (${provider}): ${result.reason}`);
            return Response.json(
              {
                error:
                  "Veritas could not compose a valid report for this dataset and brief. Try tightening the brief, or check that the columns you care about are present.",
                provider,
                detail: result.reason,
              },
              { status: 422 },
            );
          }
          console.log(`[Veritas] composed via ${provider} in ${Date.now() - started}ms (retried=${retried})${result.warnings.length ? `; warnings: ${result.warnings.join(" | ")}` : ""}`);
          return Response.json({ spec: result.spec, provider, retried, warnings: result.warnings });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[Veritas] provider error (${provider}):`, msg);
          const status = /401|403|Missing/i.test(msg) ? 500 : 502;
          return Response.json({ error: `Provider error: ${msg}`, provider }, { status });
        }
      },
    },
  },
});
