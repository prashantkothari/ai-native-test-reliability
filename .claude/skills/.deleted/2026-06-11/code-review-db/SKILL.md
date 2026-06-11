---
name: code-review-db
description: >
  Deep code review for DB/schema layer — Alembic migrations, schema.sql, asyncpg queries,
  pool config, indexes, constraints, AGE Cypher, pgvector, transactions. Invoke with
  "/code-review-db <file>" or when reviewing migrations, services with heavy SQL, or
  schema.sql. Focuses on failure modes that bite under load: missing indexes, transaction
  poisoning, constraint violations, tenant_id leaks at SQL layer, AGE per-workspace
  isolation gaps, SAVEPOINT misuse in upgrade(), pool exhaustion.
---

# Code Review — DB / Schema Layer

DB code fails at scale. A query that works on 10 rows times out on 100K. A migration that passes on empty test DB blows up on dev with rows. This skill reviews for production-shape failures.

## Triggers

Auto-invoke when reviewing files matching:
- `backend/db/schema.sql`
- `backend/db/migrations/versions/*.py`
- `backend/db/pool.py`
- `backend/db/age_init.py`
- `backend/services/age_graph.py`
- `backend/services/graph_service.py`
- Any service file with >5 `await conn.execute(` or `await conn.fetch(` calls
- Files matching `**/*migration*.py`

## Review checklist

### A. Tenant isolation at SQL — Gate 4 territory (HARD)
1. **Every `WHERE` clause on a domain table includes `tenant_id = $N`**. Grep for `FROM facts`, `FROM claims`, `FROM proposals` — each must have tenant_id filter.
2. **JOINs preserve tenant_id**: `JOIN entity_nodes en ON en.fact_id = f.id AND en.tenant_id = f.tenant_id`. Skipping the tenant_id on JOIN side = cross-tenant join leak.
3. **AGE queries use per-workspace graph name** via `graph_name_for_tenant(tenant_id)` (Gate 20-2). No hardcoded `preflight7_graph` in hot path.
4. **`workspaces.tenant_id` vs `workspaces.workspace_id`**: routers use tenant_id, auth tables use workspace_id. Don't cross.

**Isolation pattern hierarchy (added 2026-06-02 from age_graph review):**
- **STRONG: Physical isolation** — per-workspace partitions/graphs/schemas. A missing query filter routes to wrong partition (still scoped) instead of leaking. AGE `graph_name_for_tenant(tenant_id)` is the canonical pattern.
- **MEDIUM: Property-level filtering** — `WHERE tenant_id = $N` on shared tables. One missing clause = data leak. Requires belt-and-suspenders + tests.
- **WEAK: Row-level security (RLS) alone** — implicit; easy to bypass via raw connections, server-side tools.

When reviewing: if the file uses physical isolation, verify ALL queries route through the helper. If it uses property filtering, verify EVERY query has the WHERE clause. The physical-isolation file gets a structurally-safer score; the property-filtering file needs every site verified.

### B. SQL injection — Gate 2 territory (HARD)
5. **No f-string SQL**: `f"SELECT ... WHERE x = '{val}'"` is a hard reject. Use `$1, $2`.
6. **No `.format()` SQL**. Same rule.
7. **`asyncpg.execute(query, *args)`** — positional only. Mixing literal SQL + parameters fragile.
8. **Cypher in AGE**: parameters via `agtype` codec, not string interpolation. Label-union (`MATCH (n:A|B)`) is OK; value injection is not.

### C. Transaction boundaries — Gate 8 territory (HARD)
9. **Multi-row writes wrapped in `async with conn.transaction():`**. Bare execute pairs = partial state on crash.
10. **No `try/except Exception` inside a transaction that swallows asyncpg errors**. Poisoned transaction → subsequent statements all fail until ROLLBACK.
11. **Alembic `upgrade()` with try/except wrapping SQL** uses `SAVEPOINT` (G8 addendum 2026-05-26). Bare try doesn't unpoison the txn; `alembic_version` UPDATE then fails with InFailedSqlTransaction.
12. **Constraint-tightening migrations include dedupe/backfill BEFORE the constraint** (Gate 1 #12). Empty test DB passing ≠ safe on dev with rows.

### D. Index coverage
13. **Every `WHERE col = ...` on a >10K-row table has an index** on that col. Grep schema.sql for the column.
14. **Composite indexes ordered (most-selective, least-selective)**. `(tenant_id, status, created_at)` not `(created_at, status, tenant_id)`.
15. **`ORDER BY ... LIMIT N` paths have a matching index** ending in the sort column.
16. **`ivfflat`/`hnsw` index on every `vector(384)` column** queried by similarity. Missing = sequential scan.

### E. Constraint hygiene
17. **`NOT NULL` on columns the code assumes exist**. `tenant_id NOT NULL` enforced at schema, not just Pydantic.
18. **`CHECK` constraints document business rules** (status IN ('active', 'needs_review', 'deprecated')).
19. **`UNIQUE` constraints with appropriate partial WHERE** to avoid blocking soft-deleted rows.
20. **Foreign keys with `ON DELETE` clause explicit**: CASCADE, SET NULL, RESTRICT — never default.

### F. AGE / graph-specific
21. **Per-workspace graph created on workspace creation** (Gate 20-3 lifecycle hook).
22. **Per-workspace graph dropped on workspace deletion** in the same transaction.
23. **`/health` exposes `workspace_partition_drift` metric** (Gate 20-4).
24. **No silent fallback to `RELATED_TO`** when preferred edge type returns nothing — log it.

### G. pgvector specifics
25. **`pgvector.asyncpg.register_vector` registered in pool init** (G16-1 retired). `list[float]` binds directly.
26. **Vector dim matches column dim** (384 for our embeddings). Wrong dim = asyncpg error, not silent.
27. **Cosine distance returns 0–2 range**; convert to score with `1 - dist`. Negative or >1 = bug.

### H. Migration safety
28. **`op.create_index(..., postgresql_concurrently=True)` for non-empty tables** to avoid table lock.
29. **`op.add_column(..., nullable=True)` first**, then backfill, then `alter_column(nullable=False)`. One-shot NOT NULL on populated table = lock + fail.
30. **`op.execute()` raw SQL has same parameterization rules** as runtime queries.

## Scoring rubric

- **HARD**: tenant leak, SQL injection, missing transaction, broken FK, missing critical index
- **SOFT**: index coverage gap, constraint missing, AGE drift potential
- **NIT**: naming, comment hygiene

## Output format

```
## DB Review — <filename>

### HARD findings (M)
1. [Gate X] <file>:<line> — description
   Failure mode at scale: <what happens at 100K rows>
   Fix: <one-line>

### SOFT / NIT findings ...

### Score
- Gate coverage: X/30
- Signal:noise: 0.XX
- Tenant isolation: clean / leaky
- Migration safety: safe / risky
- Index coverage estimate: X% queries indexed
- Recommended next action: <one sentence>
```

## Not for
- LLM/embedding code (covered by `/code-review-ml` even when it touches DB)
- Router-level query construction issues (handled in `/code-review-api`)

---

## v11 Pattern Update (2026-06-03 — from gstack)

### Severity discipline — two-pass classification (P1)

**Pass 1 — CRITICAL (HARD)** — flag as HARD only if ALL three apply:
1. **Reachable in default config** — not gated by a non-default flag, ENV var, or rare code path
2. **Real runtime impact** — wrong output, data loss, security breach, or shipping blocker (NOT style/maintenance)
3. **Has grep/test evidence** — file:line + actual command output (NOT just pattern match against checklist)

**Mandatory downgrade rules (these are SOFT, not HARD):**
- DELETE/HEAD endpoint returning bare dict → SOFT (clients rarely consume body)
- "Weaker filter than ideal" (e.g. `tenant_id IS NOT NULL` vs `= $tid`) → SOFT (defense-in-depth, not active leak)
- Dormant code path (only fires when non-default flag is set) → SOFT
- "Pattern matches checklist but no grep evidence run" → DROP (insufficient evidence)

**Pass 2 — INFORMATIONAL (SOFT)** — worth fixing but doesn't meet HARD bar. Style, maintenance, defense-in-depth, hygiene.

**NIT** — cleanup, comments, naming. Not actionable for rework.

### Enum & Value Completeness check (P4 — Pass 1 CRITICAL)

When the file introduces, accepts, or references an enum value / status string / tier name / type constant:
1. TRACE through every consumer — `grep -rn "<value>" backend/ frontend/` then READ each match (not just grep count)
2. Check allowlists/filter arrays for missing sibling values
3. Check case/if-elsif chains for fallthrough to wrong default
4. Cite the consumers that need updates

This requires reading code OUTSIDE the file under review. If you don't have the patience to grep+read consumers, mark the finding as `NEEDS-MANUAL-GREP` and SKIP rather than guess.

### Fix-First Heuristic (P5)

After classifying severity, classify resolution path:
- **AUTO-FIX** (mechanical, one-line, no judgment): missing import, typo, magic number → named constant, missing log statement
- **ASK** (judgment required): architectural change, severity disagreement, schema migration, security trade-off

HARD findings lean ASK; SOFT findings lean AUTO-FIX.

### Output format — terse (P2)

For each finding: ONE line problem, ONE line fix, ONE line evidence. NO preamble, NO summaries, NO "looks good overall."

```
HARD [Gate X | category] path:N — <one-line problem>
  Fix: <one-line>
  Evidence: <grep command + result OR test that reproduces>
  Resolution: AUTO-FIX | ASK

SOFT [Gate X | category] path:N — <one-line problem>
  Fix: <one-line>
  Resolution: AUTO-FIX | ASK

NIT path:N — <one-line>
```

End the review with a SINGLE summary line:
```
Pre-Landing Review: N issues (X HARD, Y SOFT, Z NIT). Cost: ~$K tokens.
```

If no findings: `Pre-Landing Review: No issues found.`

**Banned phrases:** "Overall the file looks…", "This file demonstrates…", "Notable surprise…", "One-line justification…", "Score: X — rationale…", and any prose preamble before the findings list.

### v11 refinement 2026-06-03 — DB weak-filter & defense-in-depth discipline

**Audit result: across iterations 1-4, /code-review-db claimed 5 HARD findings on DB files. Only 1 of 5 was real after validation (17% accuracy).** Common failure: classifying "weaker-than-ideal filter" as HARD when no actual leak is possible.

**Before declaring ANY tenant/filter finding HARD, answer ALL of:**

1. **Is the filter MISSING entirely, or just WEAKER than ideal?**
   - **MISSING** (no tenant_id check anywhere in query) → HARD candidate
   - **WEAKER** (`tenant_id IS NOT NULL` instead of `= $tid`, or only on JOIN side not the SELECT) → **SOFT**, not HARD. Defense-in-depth gap.

2. **Is a cross-tenant leak ACTIVELY POSSIBLE, or only theoretical if other writes are broken?**
   - **Active:** Right now, given current write paths, can data from tenant A be returned to tenant B? → HARD
   - **Theoretical:** Only IF a different write path is broken (creates cross-tenant edges/refs) could this leak → **SOFT**. Cite the upstream gate that prevents it.

3. **For recursive walks / graph traversals — does the seed filter come from a tenant-scoped query?**
   - **Yes** (anchor IDs were obtained via `WHERE tenant_id = $tid` upstream) → traversal is transitively scoped. Weak inner filter is **SOFT**.
   - **No** (anchor IDs from URL/request directly) → HARD candidate.

4. **For JOINs — does either side of the JOIN have tenant_id in its WHERE?**
   - **Either side filters tenant_id** → **SOFT** even if other side doesn't (joined result is scoped by the filter).
   - **Neither side filters** → HARD candidate.

5. **For physical-isolation files (per-workspace graphs via `graph_name_for_tenant`) — is the partition routing correct?**
   - **Yes** → file is structurally safe; downgrade most findings to SOFT (Gate 20-2 architecture)
   - **No** (hardcoded `preflight7_graph` in hot path) → HARD candidate.

**Hard-block list — these are NEVER HARD on DB files:**

- ❌ `WHERE col IS NOT NULL` instead of `= $tid` when no cross-tenant data can exist → SOFT max
- ❌ "FK is single-column not composite (could leak if upstream is broken)" → SOFT — defense-in-depth, not active leak
- ❌ "Read-only query lacks transaction wrapper" → NIT — bare reads don't need transactions
- ❌ "Style violation: f-string SQL with hardcoded values (no user input)" → NIT (not injection, just convention)
- ❌ "Magic graph name (AGE_GRAPH_NAME default)" when callers route via `graph_name_for_tenant` → SOFT (footgun, not bug)
- ❌ Migration uses CHECK constraint that may be tightened later → NIT (future work, not bug)

**When tenant filter IS HARD:**
- ✅ User-supplied ID used directly in WHERE without joining tenant context
- ✅ JOIN result returned where NEITHER side has tenant_id
- ✅ AGE/Cypher query hardcodes `preflight7_graph` in hot path with no tenant_id property check
- ✅ Migration creates cross-tenant index without per-tenant partial

**When in doubt, downgrade to SOFT.** Defense-in-depth gaps are real concerns but not shipping blockers. The 8-iteration data shows DB code in this repo defaults to "scoped via upstream Gate 4 enforcement" — calibrate accordingly.

---

## v12 refinement 2026-06-03 — Confidence scoring (P6)

**Every finding MUST include a self-assessed confidence rating.** This forces the reviewer to be honest about evidence quality before claiming severity.

### Confidence levels

- **HIGH** — Grep evidence ran AND output matches finding AND framework semantics verified by mini-test if relevant. Reproducible by anyone. Default for verified gate violations.
- **MED** — Pattern matches checklist; grep evidence supports it; but reviewer didn't run a test to confirm runtime behavior. Probably real but worth user spot-check.
- **LOW** — Pattern observation only. No grep. No test. Reviewer noticed but didn't validate. **LOW confidence auto-downgrades severity by one level.**

### Auto-downgrade rule

If confidence is LOW:
- HARD with LOW confidence → automatically reclassified as SOFT
- SOFT with LOW confidence → automatically reclassified as NIT
- NIT with LOW confidence → dropped (insufficient signal)

This is mandatory — the reviewer MUST apply the downgrade before outputting.

### Updated output format

```
HARD [conf=HIGH | Gate X | category] path:N — <one-line problem>
  Fix: <one-line>
  Evidence: <grep command + output OR test result>
  Resolution: AUTO-FIX | ASK

SOFT [conf=HIGH/MED | Gate X | category] path:N — <one-line problem>
  Fix: <one-line>
  Resolution: AUTO-FIX | ASK

NIT [conf=HIGH/MED] path:N — <one-line>
```

### When to use which confidence

- **HIGH:** "I ran `grep X file` and got Y output; I ran `python -c '...'` and got Z result; this is reproducible"
- **MED:** "I read the code at file:N, the pattern matches X gate definition, but I didn't write a runtime test"
- **LOW:** "I saw a pattern that looks like X but I didn't grep or test — pure visual inspection"

### Banned: confidence-asymmetric reasoning

- ❌ Don't claim HARD severity with LOW confidence (auto-downgrades anyway)
- ❌ Don't pad MED confidence findings with "this could be a bug if X" speculation — that's LOW
- ❌ Don't use HIGH unless you ran the actual grep/test
- ❌ Don't downgrade-then-still-flag — if LOW becomes NIT-dropped, drop it. Don't list it.

### Summary line — add confidence breakdown

```
Pre-Landing Review: N issues (X HARD, Y SOFT, Z NIT). Confidence: H=N M=N L=0 (LOW auto-dropped). Est cost: ~$K tokens.
```

LOW count should always be 0 in output (LOW findings are dropped per auto-downgrade rule).
