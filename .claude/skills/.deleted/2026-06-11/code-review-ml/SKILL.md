---
name: code-review-ml
description: >
  Deep code review for ML/AI pipeline code — extraction, embeddings, NER, LLM calls, prompts,
  reranking, model config, vector ops. Invoke with "/code-review-ml <file>" or when reviewing
  files under backend/services/ that touch instructor_extractor, retrieval_service,
  claim_extraction, cognee_*, entity_resolution, embedding_service, reranker_service,
  graph_service, or any *.yaml prompt template. Focuses on failure modes that don't show up
  in pytest: silent fallback chains, library default trust, retry storms, prompt drift,
  tensor shape mismatches, token cost blowups, model swap contract breaks.
---

# Code Review — ML/AI Pipeline

ML/AI code fails differently than regular Python. Tests pass, code looks right, but the pipeline silently degrades because a library default changed, a model returned a different shape, or a fallback chain swallowed the real error. This skill reviews for those classes of failure specifically.

## Triggers

Auto-invoke when reviewing files matching:
- `backend/services/instructor_extractor*.py`
- `backend/services/retrieval_service.py`
- `backend/services/claim_extraction_service.py`
- `backend/services/cognee_*.py`
- `backend/services/entity_resolution_service.py`
- `backend/services/embedding_service.py`
- `backend/services/reranker_service.py`
- `backend/services/extraction_*.py`
- `backend/services/ner_service.py`
- `backend/prompts/*.yaml`
- `backend/config/ontology/*.yaml`

Or when user explicitly says `/code-review-ml <file>` or "review the ML code in X".

## Review checklist (in order — stop and report at first systemic failure)

### A. Library defaults — Gate 7 territory (HARD)
1. **Every `acompletion()` / `instructor.acreate()` / LLM call has explicit `timeout=`** within ±20 lines. Missing timeout = silent OS-socket timeout (15-30 min worker pin).
2. **Every LLM call has explicit `max_retries=` or `num_retries=`**. Streaming calls MUST be `num_retries=0` (retrying mid-stream corrupts output).
3. **Every `AsyncOpenAI()`, `httpx.AsyncClient()`, `aiohttp.ClientSession()` has explicit `timeout=httpx.Timeout(...)`**. Bare construction = G7-2 violation.
4. **`response_model=` or `response_format=` set explicitly**. Don't trust library default schema inference.

### B. Silent fallback chains — Gate 16 territory (HARD)
5. **Every `except Exception` around an LLM/HTTP/embedding call** must do ONE of: re-raise with `logger.critical(exc_info=True)`, increment a named `/health` metric, or have a `# fail-silent intentional: <reason>` comment. Plain `logger.warning("...")` and continue = bug.

   **Silent-except classification (added 2026-06-02 from chat_agent_service review):** before scoring as HARD, classify each silent except into:
   - **OK** — has `fail-silent intentional` comment AND a `logger.{info,warning,exception}` call within ±5 lines. Acknowledged + observable.
   - **HARD** — bare `except: pass` OR `except: continue` without comment AND without log. True silent failure.
   - **SOFT** — has `fail-silent intentional` comment but NO log (e.g., bare `pass`). Acknowledged but blind.
   - **MISLABELED** — `# fail-silent intentional:` comment attached to non-exception code (e.g., `if not x: continue`). Confusing; flag as NIT for cleanup.

   Count each separately. Only `HARD` and `SOFT` counts in the file's score; `OK` and `MISLABELED` are NIT.
6. **Fallback chains** (cerebras → groq → ollama → rule_v1): each transition logged at WARNING+ with the *real* exception, not just "falling through". A label string like `extraction_method=instructor_v2_<backend>` is NOT proof which backend responded — verify the model_returned matches.
7. **Zero-output cases** (pipeline returns `[]` with status='success'): must increment a metric AND surface on `/health`. Per G7-3: zero outputs with success status = bug.
8. **DB fallback nuance (added 2026-06-02 from cognee_relationship review):** when a function falls back to a hardcoded default because DB fetch failed, distinguish between (a) "table doesn't exist" = acceptable fallback (log INFO once), (b) "table exists but fetch failed (connection/timeout)" = HARD error (re-raise OR per-call metric, not single log). The same catch block handling both = silent quality degradation.

### C. Model swap / config drift — Gate 21 territory (HARD)
8. **Boot probe asserts output shape, not just round-trip**. `content_chars >= 1` for chat, `claims >= 1` for extraction. A live=True with empty response = false positive.
9. **Env vars read explicitly, not via library auto-pickup**. `EXTRACTION_BACKEND=cerebras` works ONLY if `instructor_extractor.py` has a Cerebras branch. Grep for the branch.
10. **Model identifier strings hardcoded in tests fail loudly**, not silently. If `LITELLM_CHAT_MODEL` changes, the model-name assertion must catch it.

### D. Prompt & ontology hygiene
11. **Prompt YAML files loaded from canonical path**. Per dev-environment rule 1: uvicorn opens YAMLs per-request → MUST live in main repo, not just worktree.
12. **Prompt template variables (`{vocabulary}`, `{ontology_types}`) all substituted before send**. Unfilled `{...}` reaching the LLM = silent prompt drift.
13. **Workspace-specific vocab injected via `vocabulary_loader.compose_vocabulary()`**, NOT hardcoded in the template.
14. **Out-of-vocab claims**: dropped LOUDLY (WARN + counter), never silently. Check the V2 ontology types list matches `claim_types.yaml`.

### E. Concurrency & resource control
15. **Semaphores scoped per-operation**, not shared. `claim_semaphore = Semaphore(8)`, NOT the same semaphore for claims + relationships.
16. **No nested LLM calls**. Entity extraction inside claim extraction = pipeline death. Each stage is one service.
17. **Async safety**: any `await`-ed function mocked with `AsyncMock` (per G13-5), never `MagicMock`.

### F. Vector / pgvector specifics
18. **pgvector binding**: directly bind `list[float]` (per G16-1 RETIRED, register_vector handles it). No more `to_pgvector_str()` calls — that helper is deleted.
19. **Vector dimension assertions**: 384 for our embeddings. Mismatch = silent insertion failure pre-2026-05-17 (now structural).
20. **Cosine similarity scores normalized**: `1 - distance` not raw asyncpg float. Score >1 or <0 = bug.

### G. Token cost transparency
21. **Token budgets per stage documented in code comments or config**. "6K-30K tokens/doc" per CLAUDE.md.
22. **No LLM at query time** (G2: never call LLM at query time). Retrieval cascade is SQL+vector+graph only. Grep for `acompletion` in any router/retrieval path = bug.
23. **Batching, not per-sentence**. Per-sentence LLM calls in a loop = cost explosion.

## Scoring rubric

For each finding, label as:
- **HARD** — gate violation, blocks shipping (Gate 7, 16, 21 territory)
- **SOFT** — pattern violation, fix soon (token efficiency, prompt hygiene)
- **NIT** — style/cleanup (not actionable for rework)

Report at top:
- **Total findings**: N (HARD: x, SOFT: y, NIT: z)
- **Gate violations**: list gate numbers
- **Bugs likely caught**: cross-reference BUGS.md for matches
- **Signal:noise** = HARD+SOFT / total. Target ≥0.7

## Output format

```
## ML/AI Review — <filename>

### HARD findings (M)
1. [Gate X] <file>:<line> — <one-line description>
   <2-3 line explanation of failure mode>
   Fix: <one-line suggestion>

### SOFT findings (N)
...

### NIT findings (O)
...

### Score
- Gate coverage: X/23 checks passed
- Signal:noise: 0.XX
- Likely bugs caught: <list>
- Recommended next action: <one sentence>
```

## What this skill is NOT for

- Router/endpoint review → use `/code-review-api`
- DB query / schema review → use `/code-review-db`
- Test file review → use `/code-review-qa`
- Frontend review → use `/code-review-ui`
- Auth/session logic → use `/code-review-auth`
- Config/startup/health → use `/code-review-infra`

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

### v11 refinement 2026-06-03 — ML HARD discipline (skill-specific)

**Audit result: across iterations 1-4, /code-review-ml claimed 9 HARD findings on ML files. 0 of 9 were real after validation.** Common failure mode: severity inflation on silent-except handlers that DO have logs + intentional comments.

**Before declaring ANY finding HARD on an ML file, answer ALL of:**

1. **Is there an `# fail-silent intentional:` comment on the except line OR within ±2 lines?**
   → If YES + a logger.{info,warning,exception} call within ±5 lines → **OK, NOT HARD**. Skip this finding entirely or mark NIT.
   → If YES + NO log → SOFT, not HARD. Flag the missing log specifically.

2. **Does the silent code path require a non-default env flag or feature toggle to fire?**
   → If YES → SOFT regardless of impact (dormant). Reference the gate flag.

3. **Is the "fragility" you're flagging a runtime bug OR just code smell?**
   → "Code is fragile if someone moves it" / "pattern depends on convention" / "could break if X" = **NOT HARD, NOT EVEN SOFT — this is NIT or skip.** Reviewer code review skill, not gate violation.

4. **For "missing log on silent except" — is the call truly silent OR does it log via the function it returns from?**
   → If the early-return is `return fallback_claims` which is logged ONCE per chunk, OR the calling function logs the outcome → **OK, NOT HARD**.

5. **For "claim is partially true" — would a fix actually change behavior, or is this a documentation/convention nit?**
   → If the fix is "add a clarifying log line" with no behavior change → SOFT max.

**Hard-block list — these are NEVER HARD on ML files:**

- ❌ Silent-except WITH `# fail-silent intentional:` comment + ANY log statement = OK
- ❌ Pattern fragility ("could break if moved", "implicit convention") = code smell, not bug
- ❌ "Missing observability" on background non-critical tasks (trace updates, span emits) = SOFT max
- ❌ "Token cost estimate is approximate" / "metric is a rough estimate" = NIT max
- ❌ "Function COULD return wrong result if X breaks" without showing X actually breaks = speculation, drop

**When in doubt, downgrade to SOFT.** ML files are mostly clean; reviewer impulse is to find something HARD; resist that impulse. **It is OK to produce a review with 0 HARD findings on a well-written ML file.** retrieval_service.py in iter 1 was correctly classified as 0 HARD — that's the calibration target.

### LLM Output Trust Boundary (P3 — Pass 1 CRITICAL, ML-only)

**LLM-generated values are untrusted input. Treat them as data, not code.** This check is unique to ML-caller / ML-consumer files.

Check for:

1. **LLM → DB writes without format validation**
   - Emails from LLM written to DB without regex check (`EMAIL_REGEXP`)
   - URLs from LLM written to DB without `urlparse()` + scheme/host validation
   - Free-text strings without `.strip()` + length cap before persist
   - JSON: `.model_validate(...)` required, NOT `.model_construct(...)` (which skips validation)

2. **LLM-generated URLs fetched without allowlist** → SSRF risk
   - `requests.get(llm_url)` / `httpx.get(llm_url)` / `aiohttp.session.get(llm_url)` — must check `parsed.hostname` against an allowlist BEFORE fetch
   - LLM giving the request URL = LLM controlling network destination

3. **Structured tool output (lists, dicts) accepted without shape check** before DB write
   - LLM returns `{"entities": [...]}` → MUST validate via Pydantic before INSERT
   - Bare `data["entities"]` access = unchecked structure → KeyError or schema drift at runtime

4. **LLM output stored in KB/vector-DB without sanitization** → stored prompt injection
   - Strip control chars (`\x00-\x1f`) before persist
   - Cap length to known max (e.g. 8K chars)
   - Tag source field `source_type='untrusted_llm_output'` so downstream knows

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
