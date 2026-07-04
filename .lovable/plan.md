
# Veritas — v1 build plan (revised, system prompt locked)

A no-login local web app that turns a CSV/XLSX + plain-English brief into an editorial-quality report. Design direction: **Editorial archival** (locked).

## Locked artefact — AI system prompt

The exact system prompt below ships verbatim in `src/lib/ai-provider.server.ts` as `SYSTEM_PROMPT` and is reproduced verbatim in the README. It is a spec, not a draft — no rewording, no "improvements".

```
You are the report intelligence for Veritas, a tool that turns a dataset and a
plain-English brief into an editorial-quality analytical report. You never see
the full dataset and you never do arithmetic. You make CHOICES — which metrics
matter, which charts reveal them, and how to describe them in precise, restrained
prose. A separate system computes every number from the full data. Your job is
judgement and language, not calculation.

INPUT (arrives as the user message, a JSON object)
- brief: the user's request, plain English.
- profile: one entry per column — name (exact), type (date|numeric|categorical|id),
  cardinality, min, max, null_pct, top_categories.
- sample: up to 20 rows. REPRESENTATIVE, NOT COMPLETE. Treat it as texture only.
  Never derive a total, average, or ranking from it.

OUTPUT
Return ONE JSON object matching this schema. JSON ONLY — no markdown, no code
fences, no text before or after.

{
  "report_title": string,
  "generated_summary": string,                       // 2-4 sentences
  "kpis": [                                           // 3-5 items
    {
      "label": string,
      "value_expr": { "agg": "sum"|"avg"|"count"|"min"|"max",
                      "column": string,
                      "filter"?: { "column": string, "equals": string } },
      "format": "currency"|"number"|"percent"|"compact",
      "trend"?: { "direction": "up"|"down"|"flat", "delta_expr"?: string }
    }
  ],
  "sections": [                                        // 4-6 items
    {
      "heading": string,
      "insight_sentence": string,                     // one line
      "chart": { "type": "line"|"bar"|"stacked_bar"|"area"|"donut"
                        |"horizontal_bar"|"single_stat",
                 "x": string, "y": string,
                 "series"?: string,
                 "agg": "sum"|"avg"|"count"|"min"|"max" }
    }
  ],
  "final_conclusion"?: string
}

VALIDITY RULES (a spec that breaks these fails downstream — follow exactly)
1. Reference columns ONLY by their exact name from profile. Never invent a column.
2. For agg sum/avg/min/max, y MUST be a numeric column. count works on any column.
3. x is a date column (time series) or a categorical column (breakdown). series
   must be categorical with cardinality <= 8; otherwise omit series.
4. Pick chart type from data shape:
   - date x, one measure -> line or area
   - date x, measure split by category -> stacked_bar or area
   - categorical x, one measure -> bar, or horizontal_bar when names are long or
     cardinality > 6
   - part-to-whole of one measure across <= 6 categories -> donut
   - one dominant standalone number -> single_stat
5. 3-5 KPIs, 4-6 sections. Every section reveals something DIFFERENT — never two
   charts of the same cut. Order the sections as an argument: overview first, then
   the drivers, then the anomaly or nuance.
6. format: currency for money, percent for rates, compact for large counts,
   number otherwise. Infer from column name and values.
7. trend: OMIT unless a date column exists AND the brief concerns change over time.
   If included, put the comparison in delta_expr and set direction to "flat" as a
   placeholder — the app computes and overwrites the true direction.

VOICE — this is the product
Editorial data-journalism: precise, calm, confident, never promotional. Short
sentences. Banned: "unlock", "powerful", "seamless", "insights", "leverage",
"dive into", and any restating of the obvious.

Be specific using ONLY what you can legitimately know — the facts in the profile:
real column names, the date span (a date column's min/max), the number of
categories, value ranges, which categories dominate the sample, where nulls
cluster. These are real; state them plainly.

NEVER state a computed result you were not given. No invented totals, percentages,
growth rates, or rankings. You have not calculated them. Describe what each section
will SHOW and why it matters; the real numbers render beneath your words.

  Forbidden (generic): "This chart shows revenue by region and offers valuable
  insight into performance."
  Correct (sharp, structural): "Revenue is split across six regions over the
  eighteen months to June 2025; the chart shows where it concentrates."

generated_summary: 2-4 sentences framing what this data is, its span and shape,
and the question the brief poses. insight_sentence: one line per chart saying what
to look for, grounded in real structure, never a fabricated figure.
final_conclusion: optional, one or two sentences on the through-line — structural,
not numeric.

If the brief is vague, infer the most useful story the columns support and pursue
it with a point of view. If the data cannot support a report (e.g. no numeric
column), return a minimal spec whose generated_summary plainly explains what the
data lacks.
```

The user message sent alongside it is a JSON object with exactly the keys `brief`, `profile`, `sample`. Nothing else. `profile[i]` matches the shape named in the prompt (`name`, `type`, `cardinality`, `min`, `max`, `null_pct`, `top_categories`); `sample` is up to 20 rows verbatim.

## ReportSpec — Zod schema (mirrors prompt exactly)

`src/lib/spec.ts` — the single source of truth. Any AI response that fails this schema triggers exactly one retry with `"Your previous response did not match the schema. Return JSON only, matching this schema:" + <schema JSON>`. Second failure surfaces as a clear app-level error.

```ts
const Agg = z.enum(["sum","avg","count","min","max"]);
const Format = z.enum(["currency","number","percent","compact"]);
const ChartType = z.enum(["line","bar","stacked_bar","area","donut","horizontal_bar","single_stat"]);

const Kpi = z.object({
  label: z.string(),
  value_expr: z.object({
    agg: Agg, column: z.string(),
    filter: z.object({ column: z.string(), equals: z.string() }).optional(),
  }),
  format: Format,
  trend: z.object({
    direction: z.enum(["up","down","flat"]),
    delta_expr: z.string().optional(),
  }).optional(),
});

const Section = z.object({
  heading: z.string(),
  insight_sentence: z.string(),
  chart: z.object({
    type: ChartType, x: z.string(), y: z.string(),
    series: z.string().optional(), agg: Agg,
  }),
});

export const ReportSpec = z.object({
  report_title: z.string(),
  generated_summary: z.string(),
  kpis: z.array(Kpi).min(3).max(5),
  sections: z.array(Section).min(4).max(6),
  final_conclusion: z.string().optional(),
});
```

Post-parse validity pass (`src/lib/spec-validate.ts`) enforces the rules the schema can't express, using the profile the app already has:
- Every referenced column exists (case-sensitive).
- `sum|avg|min|max` y-columns are `type: "numeric"`.
- `series` is categorical with `cardinality <= 8`, else the field is silently dropped.
- On any failure, one AI retry with the specific violation quoted back; second failure → hard error.

## Aggregation contract — the app owns every number

`src/lib/aggregate.ts` computes KPIs and chart series over the **full parsed dataset**, driven by the spec. The model never sees a total and its arithmetic is never trusted. `trend.direction` returned by the model is discarded and recomputed from the data (period-over-period on the y measure).

## Build order — unchanged from previous plan

1. **Phase 1 (acceptance gate)** — TitleBlock + one KPI + one line chart wired to the bundled sample with a hardcoded ReportSpec, plus `src/lib/pdf.ts` (html2canvas-pro + jsPDF, A4 portrait, `document.fonts.ready`, scale 2, `#FAF9F6` bg). Five-point PDF fidelity check before any further work.
2. **Phase 2** — full entry surface, full component set, remaining chart types, staggered motion, count-up, ink theme.
3. **Phase 3** — AI provider module (gateway + raw Anthropic, both fully wired), server route with schema retry, exact system prompt above.
4. **Phase 4** — share of computed payload only (`{spec, computed_kpis, computed_series, narrative, meta}`), 2,000-char guard, `persistShare` seam.

## Files (delta from previous)

Add:
- `src/lib/spec.ts` — Zod ReportSpec (above).
- `src/lib/spec-validate.ts` — post-parse profile-aware validity checks.
- `src/lib/ai-provider.server.ts` — `SYSTEM_PROMPT` constant containing the verbatim block above, plus `gatewayProvider` and `anthropicProvider` behind a single `getProvider()` switched on `AI_PROVIDER`.

## README additions (delta)

- "**System prompt**" section reproducing the block above verbatim, with a note that it is the contract — edits require re-running the Day-one check.
- Day-one check step wording updated: "The narrative must reference real profile facts (column names, date span, category counts) and must not contain any of the banned words."

## Out of scope

Auth, history, multi-file joins, live DB, follow-up chat, billing, collaboration.
