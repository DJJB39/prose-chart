# Veritas

Turn a spreadsheet and a plain-English brief into an editorial-quality
analytical report you would be happy to hand to a board.

## Setup

```bash
bun install
cp .env.example .env.local        # fill in ANTHROPIC_API_KEY
bun run dev
```

## Environment variables

| Var                 | Meaning                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| `AI_PROVIDER`       | `anthropic` (default) — direct api.anthropic.com. `gateway` — Lovable AI Gateway (OpenAI-compatible).       |
| `ANTHROPIC_API_KEY` | Required when `AI_PROVIDER=anthropic`. Get one at https://console.anthropic.com.                            |
| `ANTHROPIC_MODEL`   | Override the model snapshot. Default `claude-sonnet-4-5`.                                                   |
| `LOVABLE_API_KEY`   | Required when `AI_PROVIDER=gateway`. Auto-provisioned in Lovable projects.                                  |
| `GATEWAY_MODEL`     | Override the gateway model. Default `openai/gpt-5`.                                                         |

The default is raw Anthropic because Claude Sonnet is the model the report's
writing quality was designed around. Gateway is the documented fallback:
flip `AI_PROVIDER=gateway` and no other code changes.

## Architecture

Veritas splits judgement from arithmetic.

- **The model** (Claude Sonnet, or the gateway equivalent) sees only a
  dataset *profile* — column names, types, cardinalities, ranges — plus the
  brief. It returns a `ReportSpec` describing which metrics matter, which
  charts reveal them, and one editorial sentence per chart. It never sees
  a row and never states a number.
- **The app** computes every value from the full dataset (`src/lib/aggregate.ts`),
  renders the composed report, and exports it to A4 PDF with block-aware
  pagination (`src/lib/pdf.ts`).

## The report-spec schema

Validated with Zod in `src/lib/spec.ts`. Shape:

```jsonc
{
  "report_title": "string, editorial",
  "generated_summary": "2–4 sentences, structural not numeric",
  "kpis": [
    {
      "label": "string",
      "value_expr": {
        "agg": "sum | avg | count | min | max",
        "column": "column name from the profile",
        "filter": { "column": "...", "equals": "..." }   // optional
      },
      "format": "currency | number | percent | compact",
      "trend": { "direction": "up | down | flat" }        // optional; app recomputes
    }
  ],
  "sections": [
    {
      "heading": "string",
      "insight_sentence": "one line, no invented figures",
      "chart": {
        "type": "line | bar | stacked_bar | area | donut | horizontal_bar | single_stat",
        "x": "column name",
        "y": "column name",
        "series": "categorical column, cardinality ≤ 8",   // optional
        "agg": "sum | avg | count | min | max",
        "filter": { "column": "...", "equals": "..." }     // optional
      }
    }
  ],
  "final_conclusion": "string, optional"
}
```

After Zod, `src/lib/spec-validate.ts` runs a profile-aware pass: every
referenced column must exist, numeric aggregations must land on numeric
columns, and any `series` binding with cardinality > 8 is dropped
(warning logged) rather than failing the whole report. On any hard
error, the compose route retries the model **once** with the specific
Zod/profile error restated. If the retry also fails, the request is
refused with editorial copy — the renderer never sees a malformed spec.

## The verbatim system prompt

The full prompt sent to the provider is exported as `SYSTEM_PROMPT` from
`src/lib/ai-provider.server.ts`. Do not paraphrase it in code review —
it is the contract that guarantees the model chooses metrics and prose,
never numbers.

## Day-one check

1. `bun run dev`.
2. Open the app, click **Try the sample**. This runs the bundled UK SaaS
   dataset (24 months × 5 regions × 4 products, one deliberate Manchester
   anomaly in Feb 2025) through the compose pipeline.
3. Verify:
   - The compose route logs `[Veritas] composed via anthropic in NNNms (retried=false)` — no retry on first try.
   - The rendered summary and section insights read sharp and specific to
     the data's structure, not generic filler.
   - **Export as PDF** produces an A4 document where fonts, colours and
     chart lines match the on-screen report and no block is sliced across
     a page break.
4. If the narrative reads weak on the gateway, flip `AI_PROVIDER=anthropic`
   before judging. Raw Claude Sonnet is the writing-quality baseline.

## Sample data

`src/lib/sample-data.ts` generates a deterministic synthetic dataset —
`uk_saas_2023-07_to_2025-06.csv` — used by **Try the sample**. Change the
PRNG seed to shift the numbers without changing the shape.
