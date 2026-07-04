## Goal

Make the report engine discipline-agnostic. Columns declare a semantic ROLE; the vocabulary of aggregations expands; the validator rejects role/agg mismatches instead of silently substituting. Missingness is always flagged, never plotted.

## 1. Vocabulary — new aggregations

Extend `Agg` in `src/lib/aggregate.ts` and `AggSchema` in `src/lib/spec.ts`:

- `distinct_count` — unique non-blank values in a column (already added last turn; keep)
- `null_count` — rows where the column is blank/null
- `non_null_count` — rows where the column is present
- `percent_of_total` — value / row count × 100, formatted as percent

Implement each in `aggregate.ts` for both scalar (KPI) and series (chart) paths. `percent_of_total` in a series means each bucket's share of the total non-blank rows.

## 2. Column roles — extend the profile

Add a `role` field to `ColumnProfile` in `src/lib/profile.ts`:

```
type ColumnRole = "measure" | "identifier" | "dimension" | "temporal"
```

Classification (runs after existing type detection):

- `temporal` — type is `date`
- `identifier` — type is `id`, OR type is `numeric`/`categorical` with cardinality > 60% of rowCount and an id-like name (MPAN, code, sku, ref, uuid, `*_id`)
- `measure` — type is `numeric` AND NOT identifier AND cardinality > 1 (i.e. summable numbers, not category codes stored as ints)
- `dimension` — everything else (low-cardinality categoricals, and numeric columns that look like categories)

Send `role` and `null_pct` (already present) in the API request. Update the Zod `ColumnProfileSchema` in `src/routes/api/compose.ts` and the `DatasetProfile` type consumers.

## 3. Fail-loud validator — role/agg compatibility

Rewrite the agg-compatibility check in `src/lib/spec-validate.ts` around ROLE, not type. Matrix:

```text
                measure  identifier  dimension  temporal
sum/avg/min/max   ok       reject      reject     reject
count             ok       ok          ok         ok
distinct_count    ok       ok          ok         ok
null_count        ok       ok          ok         ok
non_null_count    ok       ok          ok         ok
percent_of_total  ok       reject      reject     reject   (needs a measure)
```

Also: reject `sum` on any identifier even if type is numeric (MPANs are not addable). Any violation → validator returns `{ok:false, errors:[...]}` with the specific role/agg pair named, which triggers the existing one-shot retry in `/api/compose` with the reason echoed back to the model. If the retry still fails, the section-level error boundary shows the editorial fallback (already wired) rather than a wrong number.

Remove the current silent "downgrade stacked_bar → bar when series dropped" behaviour in `spec-validate.ts` and the defensive stacked_bar → bar fallback in `share.ts` for the case where the model asked for something invalid. Silent downgrades stay only for the pure cardinality-8 series case (which is a rendering constraint, not a wrong metric).

## 4. System prompt — teach roles

Update `SYSTEM_PROMPT` in `src/lib/ai-provider.server.ts` to:

- describe the four roles and the compatibility matrix above
- state explicitly: "Use `distinct_count` on identifier/dimension columns for 'how many different X' KPIs. Never emit `count` where a distinct count is meant — `count` returns the row total."
- restate: the app excludes blank/null from chart categories and surfaces missingness as a data-quality line; never plot "null" as a category, never narrate blanks as a group.
- keep the existing "no fabricated numbers" rules

The profile shape sent to the model now includes `role` per column, so the model can pick metrics from role, not guess from name.

## 5. Missingness — already flagged, keep

The prior turn already appends a data-quality sentence per section when `blankCount(scoped, chart.x) > 0` and filters blanks out of `aggregateSeries`/`aggregateStacked`. Keep that. Additionally, the model may now emit an explicit `null_count` or `non_null_count` KPI (e.g. "Records missing Agent") — the vocabulary above supports it.

## Files touched

- `src/lib/aggregate.ts` — new aggs in `Agg`, `reduceAgg`, `aggregateScalar`, `aggregateSeries`; `percent_of_total` needs `rowCount` context passed in.
- `src/lib/profile.ts` — `ColumnRole`, role classifier, exported on `ColumnProfile`.
- `src/lib/spec.ts` — `AggSchema` extended.
- `src/lib/spec-validate.ts` — role-based compatibility matrix; remove silent metric substitutions.
- `src/lib/share.ts` — drop the "stacked_bar → bar" defensive fallback for invalid specs (rely on validator + boundary); wire `percent_of_total` through the series path with total context.
- `src/lib/ai-provider.server.ts` — prompt updates.
- `src/routes/api/compose.ts` — `ColumnProfileSchema` gains `role`.

## Verification

- Type-check clean.
- Build a synthetic dataset with an identifier column (MPAN-like), a dimension (Agent), and no numeric — confirm compose produces KPIs using `distinct_count` on the identifier/dimension and `null_count` for missingness, not `count`.
- Feed a spec that requests `sum` on an identifier through `validateSpec` in isolation and confirm it rejects with a clear message.
