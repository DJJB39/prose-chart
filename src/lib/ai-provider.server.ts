// AI provider seam. Two real backends, no stubs:
//
//   AI_PROVIDER=anthropic  → direct api.anthropic.com (Claude Sonnet).
//     The writing-quality choice this product was designed around.
//     Requires ANTHROPIC_API_KEY.
//
//   AI_PROVIDER=gateway    → Lovable AI Gateway (OpenAI-compatible).
//     Documented fallback. Requires LOVABLE_API_KEY (auto-provisioned).
//
// The verbatim system prompt below is the contract. Do not paraphrase.

import type { DatasetProfile } from "./profile";

export type ProviderName = "anthropic" | "gateway";

export const SYSTEM_PROMPT = `You are the report intelligence for Veritas, a tool that turns a dataset and a
plain-English brief into an editorial-quality analytical report. You never see
the full dataset and you never do arithmetic. You make CHOICES — which metrics
matter, which charts reveal them, and how to describe them in precise, restrained
prose. A separate system computes every number from the full data. Your job is
judgement and language, not calculation.

INPUT (arrives as the user message, JSON):
- brief: the user's plain-English question or goal.
- source_filename: the file the data came from.
- profile: { rowCount, columns: [{ name, type, cardinality, min, max, null_pct, top_categories }] }
  where type is one of "numeric" | "date" | "categorical" | "id".
- You will NOT see any rows. Do not invent numbers.

OUTPUT: a single JSON object, no prose around it, matching this schema:

{
  "report_title": string,                            // editorial, specific to the data
  "generated_summary": string,                       // 2–4 sentences, structural not numeric
  "kpis": [                                          // 3–5 KPIs, distinct measures
    {
      "label": string,                               // short, human, no units
      "value_expr": {
        "agg": "sum" | "avg" | "count" | "min" | "max",
        "column": string,                            // must exist in profile
        "filter": { "column": string, "equals": string }   // optional
      },
      "format": "currency" | "number" | "percent" | "compact",
      "trend": { "direction": "up" | "down" | "flat" }     // optional; the app recomputes direction
    }
  ],
  "sections": [                                      // 4–6 sections, each a distinct cut
    {
      "heading": string,                             // short, editorial
      "insight_sentence": string,                    // one line, what to look for, no fabricated figures
      "chart": {
        "type": "line" | "bar" | "stacked_bar" | "area" | "donut" | "horizontal_bar" | "single_stat",
        "x": string,                                 // column name from profile
        "y": string,                                 // column name from profile
        "series": string,                            // optional, categorical, cardinality ≤ 8
        "agg": "sum" | "avg" | "count" | "min" | "max",
        "filter": { "column": string, "equals": string }   // optional
      }
    }
  ],
  "final_conclusion": string                         // optional, 1–2 sentences, structural
}

CONSTRAINTS
- Use only column names that appear in profile.columns (case-sensitive).
- sum/avg/min/max are only valid on numeric columns.
- series must be a categorical column with cardinality ≤ 8.
- Prefer a date column for x on time-based charts; use it as the natural spine.
- Distinct cuts per section: do not repeat the same x/y/series combination.
- If profile.columns contains NO column of type "numeric", you MUST use
  agg: "count" for every KPI value_expr and every chart. In that case
  set value_expr.column and chart.y to ANY column that exists in the
  profile — count works on any column and the app counts rows. Never
  invent a numeric column, never emit sum/avg/min/max, and never
  reference a column name that is not in profile.columns.
- generated_summary and insight_sentence describe STRUCTURE — direction, spread,
  concentration, cadence, outliers. Never state a total, average, percentage, or
  ranking figure. The app writes numbers; you write judgement.

VOICE
- Editorial, restrained, specific. British English. No hedging clichés
  ("interestingly", "it is worth noting"). No emoji. No exclamation marks.
- report_title: specific to the data's actual subject, not "Analysis of Data".
- generated_summary: what shape the data has and what the report will pursue.
- insight_sentence: one line per chart saying what to look for, grounded in real
  structure, never a fabricated figure.
- final_conclusion: optional, one or two sentences on the through-line —
  structural, not numeric.

If the brief is vague, infer the most useful story the columns support and pursue
it with a point of view. If the data cannot support a report (e.g. no numeric
column), return a minimal spec whose generated_summary plainly explains what the
data lacks.

Return the JSON object only. No markdown fences, no commentary.`;

// Model strings. Overridable via env for day-one flexibility.
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
const GATEWAY_MODEL = process.env.GATEWAY_MODEL || "openai/gpt-5";

type ComposeInput = {
  brief: string;
  source_filename: string;
  profile: DatasetProfile;
  retry_reason?: string;
};

function buildUserMessage(input: ComposeInput): string {
  const payload = {
    brief: input.brief,
    source_filename: input.source_filename,
    profile: input.profile,
  };
  const body = JSON.stringify(payload);
  if (input.retry_reason) {
    return `The previous response failed validation with: ${input.retry_reason}\n\nReturn the JSON object again, strictly matching the schema in the system prompt. Same input:\n\n${body}`;
  }
  return body;
}

function stripFences(text: string): string {
  const t = text.trim();
  if (t.startsWith("```")) {
    return t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  return t;
}

/** Extract the first {...} JSON object from a possibly noisy string. */
export function extractJson(text: string): unknown {
  const t = stripFences(text);
  try { return JSON.parse(t); } catch { /* fall through */ }
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(t.slice(start, end + 1));
  }
  throw new Error("Provider returned no parseable JSON");
}

async function callAnthropic(input: ComposeInput): Promise<unknown> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Missing ANTHROPIC_API_KEY");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(input) }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 500)}`);
  }
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  if (!text) throw new Error("Anthropic returned empty content");
  return extractJson(text);
}

async function callGateway(input: ComposeInput): Promise<unknown> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({
      model: GATEWAY_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserMessage(input) },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gateway ${res.status}: ${body.slice(0, 500)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Gateway returned empty content");
  return extractJson(text);
}

export function getProviderName(): ProviderName {
  const v = (process.env.AI_PROVIDER || "anthropic").toLowerCase();
  return v === "gateway" ? "gateway" : "anthropic";
}

export async function callProvider(input: ComposeInput): Promise<{ raw: unknown; provider: ProviderName; model: string }> {
  const provider = getProviderName();
  const raw = provider === "anthropic" ? await callAnthropic(input) : await callGateway(input);
  return { raw, provider, model: provider === "anthropic" ? ANTHROPIC_MODEL : GATEWAY_MODEL };
}
