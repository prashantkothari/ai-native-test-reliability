---
name: code-review-infra
description: >
  Deep code review for infrastructure/config/startup code — config.py, main.py, pool.py,
  health endpoints, middleware, boot probes, scheduler, ingestion_worker, dependencies
  injection setup. Invoke with "/code-review-infra <file>" or when reviewing files that
  affect process startup, configuration, scheduling, or worker lifecycle. Focuses on
  failure modes that hit production but not dev: missing boot canaries, config drift,
  pool sizing, scheduler reliability, graceful shutdown, env var defaults that mask
  outages.
---

# Code Review — Infrastructure / Config / Startup

Infra code fails at boot, at restart, or at scale. Defaults that work in dev (single user, fresh DB) silently break in prod. This skill reviews for ops-class failures.

## Triggers

Auto-invoke when reviewing files matching:
- `backend/config.py`
- `backend/main.py`
- `backend/db/pool.py`
- `backend/routers/health.py`
- `backend/services/scheduler.py`
- `backend/services/ingestion_worker.py`
- `backend/services/extraction_canary.py`
- `backend/services/extraction_backend_probe.py`
- `backend/services/ingestion_validator.py`
- `backend/middleware/*.py`

## Review checklist

### A. Config hygiene — Gate 7-7 territory (HARD)
1. **Every config value from `os.getenv("X", default)`** with explicit type cast (`int(...)`, `float(...)`, `parse_bool(...)`). Bare `os.getenv` returns `str | None`.
2. **No magic numbers in services** — every tunable in `config.py` with descriptive name (Code Quality §1).
3. **Critical env vars validated at boot**: `EXTRACTION_BACKEND`, `JWT_SECRET`, DB URL. Missing = refuse to start, not silent fallback.
4. **`EXTRACTION_BACKEND` explicitly set in `.env`** (G7-7), not relying on `config.py` default. Pre-commit check exists.
5. **Default values match docs**: if `CLAUDE.md` says "Cerebras default", `config.py` must default to cerebras, not mlx.

### B. Boot probes — Gate 7-8 / 21 territory (HARD)
6. **`extraction_backend_probe.py` runs on every boot**, surfaces `/health.extraction_backend_probe`. Per G7-8.
7. **Boot canary checks ACTUAL OUTPUT SHAPE**, not just HTTP round-trip (Gate 21). `content_chars >= 1` for chat, `claims >= 1` for extraction.
8. **`EXTRACTION_BACKEND_REQUIRE_LIVE=true` refuses startup** if probe fails. Silent fallback = bug.
9. **Deterministic floor canary** (rule_v1 extractor) verified at boot — gives green path when LLM is down.

### C. Pool & resource sizing
10. **asyncpg pool size matches uvicorn workers × concurrent-requests-per-worker**. Under-sized pool = request queue.
11. **Pool init registers `pgvector.asyncpg.register_vector`** (G16-1 RETIRED — required for direct list binding).
12. **Pool acquired with timeout**: `await pool.acquire(timeout=...)`. Bare `acquire()` blocks forever.
13. **Connection-level statement_timeout set**: prevents one bad query from pinning worker forever.

### D. Health endpoint coverage — Gate 7-3 / 16-4 territory (HARD)
14. **`/health` distinguishes degraded vs. broken** for each subsystem (DB, AGE, LLM, embeddings, scheduler).
15. **Every pipeline stage with non-zero outputs has a counter on `/health`** (Gate 7-3). Zero with success = bug.
16. **Per-tenant drift metrics surface** (Gate 20-4): `workspace_count` vs `partition_count`.
17. **`/health` returns 503 when critical subsystem down**, not 200 with error in body. Load balancer needs status code.
18. **No expensive aggregations in `/health` request path**. Cache or compute async.

### E. Scheduler / background jobs — Gate 5 territory
19. **Scheduler uses APScheduler / similar with persistent jobstore**, not asyncio.create_task in startup.
20. **Job failure logged at ERROR + counter incremented**. Silent job failure = same shape as GAP-INGEST-002.
21. **Job idempotency**: re-running the same job ID doesn't double-process.
22. **Graceful shutdown drains in-flight jobs** (FastAPI lifespan handler).

### F. Logging
23. **`logging.getLogger(__name__)`** at module top, not `print()`. Gate 2 #4 hard reject.
24. **Log format includes `tenant_id`, `request_id`** in MDC/contextvars where available.
25. **No `print()` in services or routers** (Gate 2 #4).
26. **Log levels meaningful**: WARNING is "real user impact may occur", not "FYI".

### G. Middleware
27. **CORS configured explicitly**, not `allow_origins=["*"]` in production. Env-gated.
28. **Request ID middleware**: adds `X-Request-ID` to response, included in every log line.
29. **Trusted host middleware** active in prod (prevents host header injection).
30. **Body size limit** at middleware layer, not just per-endpoint.

### H. Graceful lifecycle
31. **Startup event runs migrations + warmups in correct order**: DB pool → schema check → cache warmup → boot probes → worker start.
32. **Shutdown event closes pool, cancels scheduler, drains background tasks**.
33. **No bare `os.exit(1)` in service code** — raise an exception or signal lifespan.

## Scoring rubric

- **HARD**: missing boot probe, broken health endpoint, missing env var validation, pool not configured for pgvector
- **SOFT**: scheduler reliability gaps, log hygiene, middleware config
- **NIT**: log formatting, naming

## Output format

```
## Infra Review — <filename>

### HARD findings (M)
1. [Gate X] <file>:<line> — description
   Failure mode in prod: <what users experience>
   Fix: <one-line>

### SOFT / NIT findings ...

### Score
- Gate coverage: X/33
- Signal:noise: 0.XX
- Boot probe coverage: full / partial / missing
- Health endpoint quality: useful / cosmetic / misleading
- Pool sizing: documented / unknown
- Recommended next action: <one sentence>
```

## Not for
- LLM-specific config (covered by `/code-review-ml`)
- Auth-specific config (covered by `/code-review-auth`)

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
