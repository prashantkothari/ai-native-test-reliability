---
name: code-review-api
description: >
  Deep code review for API/router layer — FastAPI routers, request/response models, Pydantic
  schemas, endpoint contracts, error handling, OpenAPI surface. Invoke with
  "/code-review-api <file>" or when reviewing files under backend/routers/. Focuses on
  failure modes that bite at the HTTP boundary: missing auth guards, tenant_id leaks,
  schema drift between FE and BE, error response shape leaking internals, missing
  validation on user input, response_model=None silently breaking TS type generation.
---

# Code Review — API / Router Layer

API code fails at the boundary. Frontend sends X, backend expects Y, both pass their own tests, runtime returns 422 or 500 to real users. This skill reviews for boundary-class failures.

## Triggers

Auto-invoke when reviewing files matching:
- `backend/routers/*.py`
- `backend/main.py` (router registration)
- `backend/dependencies.py` (auth/session guards)
- `backend/middleware/*.py`

Or when user explicitly says `/code-review-api <file>`.

## Review checklist (HARD blocks first)

### ⚠️ FRAMEWORK SEMANTICS — DON'T FLAG (validated 2026-06-02)

Before flagging anything as a HARD finding, check if it's a framework convention, not a bug. **Known FALSE POSITIVES from prior reviews:**

- **`request: Request = None`** in FastAPI is NOT an auth bypass. FastAPI auto-injects `Request` regardless of default value (built-in dependency). The default is ignored. Verified by test: `GET /endpoint` without headers → FastAPI still injects Request with headers present. Don't flag this pattern.
- **Manual `get_user_from_request(request)` pattern** is a code-style preference vs `Depends()`, NOT a security bug. It works correctly when called inside an endpoint body. Flag it as SOFT (consistency) at most, not HARD.

When in doubt about framework behavior: run a 5-line test before flagging HARD. Confident-but-wrong findings cost more than missed real bugs.

### A. Auth & tenant isolation — Gate 4 territory (HARD)
1. **Every protected endpoint extracts user identity somehow**: either via `Depends(get_workspace_context)` OR via manual extraction in the endpoint body. Both are acceptable; consistency matters less than presence.
2. **`tenant_id` extracted from session/context return value**, never from query params, request body, or path params. Trusting client-supplied tenant_id = cross-tenant leak.
3. **Every DB query in the endpoint includes `WHERE tenant_id = $N`** explicitly, even when RLS is active (belt-and-suspenders per Gate 4).
4. **Login/signup endpoints use `requireNotAuth()` equivalent**. Authenticated user hitting `/login` should redirect or 409, not silently create duplicate session.

### B. Pydantic contract — B6 territory (HARD)
5. **Every endpoint has `response_model=` set** to a named Pydantic model. Bare `dict` return = anonymous OpenAPI path = broken TS type generation = FE drift.
6. **Request body is a typed Pydantic model**, never `dict` or `body: bytes` (unless file upload).
7. **No field renaming without coordinated migration**. If a Pydantic field is renamed, `openapi.json` + `frontend/src/types/generated.ts` MUST regenerate in the same commit (`make openapi-types`).
8. **Field validators use `field_validator` (Pydantic v2)** with explicit error messages. Bare `Field(...)` constraints leak Pydantic's default error shape.

### C. Error handling — Gate 16 territory (HARD)
9. **No `except Exception: return {"error": str(e)}`**. Leaks DB schema names, file paths, stack traces. Use `logger.exception(...)` + generic message.
10. **HTTPException raised explicitly with `status_code`** (401, 403, 404, 409, 422). Don't return 200 with `{"error": ...}` body.
11. **404 distinguished from 403**. Returning 404 on a tenant-mismatched resource is fine (hides existence); returning 200 with empty list is a leak.
12. **Error responses never include `detail=` with raw exception**. Wrap.

### D. URL / route correctness — Gate 1 territory (HARD)
13. **Route path matches FE call exactly**. `router.post("/foo")` vs `fetch("/api/foo")` — prefix awareness.
14. **Path parameters typed**: `{id}` → `id: UUID`, not `id: str`. UUID validation at FastAPI layer, not in handler.
15. **No trailing-slash inconsistency** within one router. Pick one, stick to it.
16. **No hardcoded UUIDs in handlers**. Demo tenant UUIDs in mockData.ts only.

### E. Request validation
17. **Query params with limits**: `Query(default=20, le=100)` — prevent `?limit=10000000` DOS.
18. **String inputs sanitized for LLM prompts**: `question.strip()[:1000]` (Code Quality §3 prompt injection rule).
19. **File uploads: size + content-type validated**. `UploadFile` with no size check = OOM.
20. **Pagination cursor opaque**, not a raw offset. Raw offset leaks row counts.

### F. Async / DB connection hygiene
21. **Every `async with pool.acquire() as conn:` released properly**. Long-running endpoint holding conn = pool exhaustion.
22. **Transaction wraps multi-statement writes** (`async with conn.transaction():`). Bare execute pairs = partial state on crash.
23. **No `await` inside list comprehension that triggers N+1 DB roundtrips**. Use `query_neighbourhood_batch()`-style batch.

### G. OpenAPI hygiene
24. **`summary=` and `description=` on every endpoint**. Empty = docs blank.
25. **Tags consistent**: one tag per logical group; `tags=["library"]` not `tags=["library", "facts", "ingest"]`.
26. **Deprecated endpoints marked `deprecated=True`** with sunset date in description.

## Scoring rubric

- **HARD**: auth/tenant leak, response_model missing, error leak (blocks shipping)
- **SOFT**: validation gap, OpenAPI hygiene, async hygiene (fix soon)
- **NIT**: tags/summary cleanup (low priority)

Cross-reference: PR #115, #132, #135 (squash-merge content drops) — check if this router was affected.

## Output format

```
## API Review — <filename>

### HARD findings (M)
1. [Gate X] <file>:<line> — <one-line description>
   Failure mode: <what breaks at runtime>
   Fix: <suggested change>

### SOFT findings (N)
### NIT findings (O)

### Score
- Gate coverage: X/26 checks passed
- Signal:noise: 0.XX
- Auth surface: clean / compromised
- TS type drift risk: low / medium / high
- Recommended next action: <one sentence>
```

## Not for
- ML pipeline → `/code-review-ml`
- DB schema → `/code-review-db`
- Auth service itself → `/code-review-auth`
- Frontend → `/code-review-ui`

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

### v11 refinement 2026-06-03 — API B6 inflation discipline (skill-specific)

**Audit result: across iterations 1-4, /code-review-api claimed 11 HARD findings on API/router files. Only 1 of 11 was real after validation (9% accuracy).** Most over-rated: B6 (bare-dict return) violations.

**B6 HARD criteria (ALL three must hold — otherwise SOFT or skip):**

1. **The endpoint is consumed by frontend code that asserts on the response shape.**
   → Grep `frontend/` for the route or method. If FE never reads response body or only reads success status → SOFT.

2. **`make openapi-types-check` would actually surface the drift.**
   → If the route already has documented behavior + FE handles it correctly → SOFT.

3. **Adding `response_model=` is non-trivial** (response shape differs from existing models).
   → If it's a one-line addition + obvious shape → AUTO-FIX SOFT, not HARD.

**Mandatory SOFT (these are NEVER HARD per HTTP verb convention):**

- ❌ DELETE returning `{"success": True}` or similar → SOFT (clients send DELETE for side-effect, body rarely consumed)
- ❌ HEAD returning empty/status-only → SOFT (by HTTP spec)
- ❌ PATCH returning the updated resource without response_model when FE re-fetches anyway → SOFT
- ❌ Bulk-operation endpoint returning `{"count": N, "items": [...]}` where FE only reads count → SOFT
- ❌ Health/admin/internal endpoints not consumed by FE → SOFT or skip
- ❌ Internal-only endpoints (admin, debug, ops) → SOFT or skip

**Other API patterns to deflate (often over-rated):**

- ❌ `request: Request = None` in FastAPI handlers — **NEVER FLAG** (auto-injected; default ignored — already in FRAMEWORK SEMANTICS section above)
- ❌ Dead/unused query param (e.g., `workspace_id` accepted but not used) → SOFT (code smell, not bug)
- ❌ `get_pool()` called without None check → SOFT (in practice pool is always init'd at startup; only fails on misconfig)
- ❌ Dynamic SQL column construction with parameterized values (not interpolation) → SOFT (not injection)
- ❌ Inconsistent trailing-slash → SOFT
- ❌ Missing OpenAPI `summary=` → NIT max
- ❌ Pydantic field has no validator + backend validates at runtime → SOFT (returns 400 instead of 422; UX gap not bug)

**When B6 IS HARD:**
- ✅ GET endpoint returning dict with FE typescript consuming N specific fields → BREAKS on rename
- ✅ POST returning new resource ID + FE using ID to navigate → BREAKS on shape change
- ✅ Endpoint feeds typed retrieval/dashboard consumer → drift breaks UI

**When in doubt, downgrade to SOFT.** It is OK to produce an API review with 0 HARD findings on a clean router. The 4 review iterations showed routers tend to be mostly clean; reviewer impulse to find HARD findings produced noise.

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
