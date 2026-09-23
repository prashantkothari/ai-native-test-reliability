---
name: code-review-qa
description: >
  Deep code review for the test suite itself — pytest files, conftest.py, fixtures,
  eval harness, mocks, async test patterns. Invoke with "/code-review-qa <file>" or
  when reviewing files under backend/tests/, eval/, or any *_test.py / test_*.py.
  Focuses on failure modes that hide bugs rather than catch them: silent collection
  errors, MagicMock-on-async, fixture leakage, single-run-only tests, missing
  negative-path coverage, hypothesis strategies that don't shrink, mock contracts
  that drift from production shape.
---

# Code Review — QA / Test Suite

A bad test suite is worse than no test suite — it gives false confidence. Tests that error at collection (G13-1) are invisible. MagicMock on async code (G13-5) doesn't exercise the real path. This skill reviews tests for effectiveness, not just presence.

## Triggers

Auto-invoke when reviewing files matching:
- `backend/tests/**/*.py`
- `backend/tests/conftest.py`
- `eval/**/*.py`
- Any file matching `test_*.py` or `*_test.py`
- `pyproject.toml` / `pytest.ini` / `setup.cfg` test config sections

## Review checklist

### A. Collection hygiene — Gate 13 territory (HARD)
1. **File imports complete cleanly**: `pytest --collect-only <file>` exits 0. No missing fixtures, no broken imports, no module-level side effects that fail.
2. **Binary fixtures (PDFs, images) use `pytestmark = pytest.mark.skipif(not PATH.exists(), reason=...)`**, not bare `assert PATH.exists()` (G13-4).
3. **Module-level side effects** (DB connections, file I/O) wrapped in fixtures, not run at import.
4. **No conditional imports** that change behavior based on env. If `RUN_DB_TESTS=1` gates the test, gate at the test/class level, not the import.

### B. Mock fidelity — Gate 13-5 territory (HARD)
5. **Every `await`-ed method mocked with `AsyncMock`**, not `MagicMock`. `'MagicMock' object can't be awaited` = silent failure to exercise prod path.
6. **Sync methods on response objects** (`.json()`, `.raise_for_status()`) stay `MagicMock`.
7. **Mock return shape matches production response shape**. When production HTTP shape changes (native Ollama replacing OpenAI shim), the mock MUST update same-PR.
8. **No `mock.return_value = mock.Mock()`** chains 3+ deep without a comment. Brittle and hides real coupling.
9. **`autospec=True` on critical mocks** so signature drift is caught.

### C. Idempotency — Gate 13-3 territory (HARD)
10. **Test runs twice in a row with same outcome**. UniqueViolationError on second run = fixture cleanup gap.
11. **Per-test UUID suffixes on natural keys**: `f"CAP-001-{uuid4().hex[:8]}"`, never assume clean DB.
12. **Fixture teardown explicit**: `yield`, then cleanup. Bare `return` without cleanup = leak.
13. **Module-level state reset between tests** when modules use globals (e.g., `_COMPANY_FALLBACK_COUNTER` — known issue from Session D).

### D. Coverage of failure paths
14. **Every public method has ≥1 negative test** (timeout, malformed input, auth fail).
15. **Test names declarative**: `test_extract_claims_with_low_confidence_filtered_correctly`, not `test_extract`.
16. **Both happy path AND degraded path tested** for every fallback chain.
17. **Boundary conditions tested**: empty list, single item, large list, None, special chars.

### E. Async-specific
18. **`@pytest.mark.asyncio` (or auto via `pytest-asyncio` config)** on every async test.
19. **No mixing sync `requests` with async TestClient** in the same test. Use `httpx.AsyncClient`.
20. **Event loop scope explicit**: `pytest-asyncio` mode controlled in config, not per-file.

### F. Database test hygiene
21. **DB tests use isolated test DB** (`preflight7_test`), never dev DB.
22. **`RUN_DB_TESTS` gate respected** — DB tests skip cleanly when not set.
23. **Migrations applied to test DB at session start**, not per-test (slow).
24. **Transaction-rollback fixture** for isolation, not delete-all teardown (slow + fragile).
25. **Tenant_id used in fixtures matches** what production code expects.

### G. Hypothesis / property-based
26. **Strategies bounded** (`st.integers(min_value=0, max_value=1000)`) — unbounded = slow + irrelevant edge cases.
27. **`@settings(deadline=None)` on slow property tests** to avoid flake.
28. **Custom `.filter(...)` strategies have a `assume(...)` fallback** to avoid health-check failures.
29. **Shrinking-friendly invariants**: failure on minimal input, not "input had 50 items".

### H. Test quality metrics
30. **Coverage measured with `--cov-branch`**, not just line. Branch coverage exposes untested conditionals.
31. **Slow tests marked `@pytest.mark.slow`** with target latency in docstring.
32. **Eval tests separated from unit tests** (`eval_db` marker per project conventions).
33. **No `time.sleep(N)` in tests** — use `asyncio.wait_for` or polling with timeout.

### I. Mutation-testing readiness
34. **Tests fail when production code is broken** (the obvious one — but assert by mutating in your head: if X became Y, would this test catch it?).
35. **Assertions on values, not just shapes**: `assert result.count == 5`, not just `assert isinstance(result, Response)`.
36. **No `assert True` or `assert result` as final assertion**. Spell out what's expected.

## Scoring rubric

- **HARD**: collection error, MagicMock-on-async, non-idempotent test (these hide bugs)
- **SOFT**: missing negative path, missing branch coverage, slow test without marker
- **NIT**: naming, redundant assertions

## Output format

```
## QA Review — <filename>

### HARD findings (M)
1. [Gate X] <file>:<line> — description
   Why this hides bugs: <one-line>
   Fix: <one-line>

### SOFT / NIT findings ...

### Score
- Gate coverage: X/36
- Signal:noise: 0.XX
- Collection-clean: yes / no
- Idempotent: yes / no / unknown
- Estimated mutation score: low / medium / high
- Negative-path coverage: X%
- Recommended next action: <one sentence>
```

## Not for
- Production code (use the matching `/code-review-*` skill)
- Eval rubric quality (separate concern — promptfoo / ragas configs)

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
