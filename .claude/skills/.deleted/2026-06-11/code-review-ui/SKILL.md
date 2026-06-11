---
name: code-review-ui
description: >
  Deep code review for frontend code — TypeScript components, vanilla TS pages, CSS,
  React (AskAI), routing, state, API client. Invoke with "/code-review-ui <file>" or when
  reviewing files under frontend/src/. Focuses on failure modes specific to FE: design
  token violations (Gate 11), hardcoded UUIDs (Gate 2), TS type drift from backend
  (B6), missing auth guards on routes (Gate 12), accessibility, stale fetch error
  handling, hand-written API interfaces.
---

# Code Review — UI / Frontend

Frontend code fails when it lies about backend shape (TS type drift), when it leaks the demo tenant UUID into production code, or when it builds an island with private CSS variables. This skill reviews for those classes.

## Triggers

Auto-invoke when reviewing files matching:
- `frontend/src/pages/**/*.ts` / `*.tsx`
- `frontend/src/components/**/*.ts` / `*.tsx` / `*.css`
- `frontend/src/lib/api.ts`
- `frontend/src/routes.ts`
- `frontend/src/styles/*.css`
- `frontend/src/types/*.ts`

## Review checklist

### A. Design tokens — Gate 11 territory (HARD)
1. **No private `--component-*` color variables**. All colors via `tokens.css` (`--bg-app`, `--fg`, `--accent`, etc.).
2. **No raw color values in CSS** (`#17130F`, `rgb(...)`, `rgba(...)`). Grep: `grep -E "^\s*--.*:\s*(#|rgb)"` should find 0 in new files.
3. **No private spacing/radius/font tokens**. Use `--space-N`, `--radius-input`, `--font-display`.
4. **Theme switching via `[data-theme='dark']` on `<html>`**, not per-component dark-mode logic.

### B. Tenant / hardcoded values — Gate 2 territory (HARD)
5. **No `00000000-0000-0000-0000-000000000099` UUID** in pages or components. `mockData.ts` exempt.
6. **`tenant_id` read from `session.workspace.tenant_id`**, never constructed or hardcoded in FE.
7. **No `MOCK_MODE = true`** committed. Default false.

### C. API contract — B6 territory (HARD)
8. **TS types imported from `frontend/src/types/generated.ts`**, not hand-written. Hand-written interfaces in `lib/api.ts` and `types/api.ts` are tech debt (37 files tracked) — new code MUST use generated.
9. **Endpoint URL string matches backend route exactly**. `fetch('/api/library/facts')` vs `@router.get('/facts')` mounted at `/api/library` — check the prefix.
10. **All `<input>` fields captured by name/id, NOT `placeholder.includes()`**. Placeholder text changes; name doesn't.
11. **Every form field reaches the fetch payload**. Check the `body: JSON.stringify({...})` includes all fields.

### D. Route guards — Gate 12 territory (HARD)
12. **Route registered in `frontend/src/routes.ts`** with exact path used in `router.navigate()`.
13. **`requireAuth()` called for protected routes**, `requireNotAuth()` for login/signup.
14. **No stub pages** (`<h1>Coming soon</h1>`) registered without a TODO + ticket reference.

### E. Error handling
15. **`fetch()` response checked**: `if (!res.ok) throw new Error(...)` before `.json()`.
16. **No `catch (e) { console.log(e) }` and continue**. Either show user-facing error or rethrow.
17. **Loading states**: every async UI action has a loading indicator + error state, not just success-path UI.
18. **Network errors distinct from API errors**: `TypeError: fetch` vs `res.status >= 400`.

### F. State management (vanilla TS)
19. **Module-level state minimized**. Page-scope state in a class or closure, not exported variables.
20. **Cleanup on route change**: timers, listeners, subscriptions cleared.
21. **Single source of truth for session**: `getSession()` from one place, not 3 different `localStorage.getItem('session')`.

### G. React-specific (AskAI)
22. **No `useEffect` with missing deps** triggering infinite re-renders.
23. **State updates inside async callbacks** check `isMounted` or use AbortController.
24. **Keys on list items** stable (not array index when list reorders).
25. **No inline object/array literals as props** (`<X config={{...}}>`) — re-renders children every render.

### H. Accessibility
26. **Buttons have type=button or type=submit** explicitly. Default in `<form>` is submit.
27. **`<label htmlFor>` matches input id**. Not relying on label-wrapping for SR.
28. **Focusable elements have visible focus style** (don't `outline: none` without alternative).
29. **Color contrast meets WCAG AA** via tokens (tokens enforce this).

### I. Bundle / perf
30. **No `import * from 'large-lib'`** when only one function used.
31. **No synchronous JSON parse of large files** on render path.

## Scoring rubric

- **HARD**: design token violation (Gate 11), tenant UUID leak, hand-written type for backend response, missing route guard
- **SOFT**: error handling, accessibility, async cleanup
- **NIT**: bundle size, stylistic

## Output format

```
## UI Review — <filename>

### HARD findings (M)
1. [Gate X] <file>:<line> — description
   Failure mode: <user-visible breakage>
   Fix: <one-line>

### SOFT / NIT findings ...

### Score
- Gate coverage: X/31
- Signal:noise: 0.XX
- Token compliance: clean / mixed / violating
- TS drift risk: low / medium / high (hand-written types count)
- A11y score: pass / partial / fail
- Recommended next action: <one sentence>
```

## Not for
- API contract issues at the backend → `/code-review-api`
- Generated.ts itself (auto-generated)

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

### v11 refinement 2026-06-03 — UI tracked-tech-debt discipline

**Audit result: across iterations 1-4, /code-review-ui claimed 6 HARD findings on UI files. Only 1 of 6 was real after validation (17% accuracy).** Common failure: re-flagging known tracked tech debt (hand-written types, inline cssText) as fresh HARD bugs.

**Before declaring ANY UI finding HARD, answer ALL of:**

1. **Is this a TRACKED tech debt pattern OR a NEW violation?**
   - **Tracked:** hand-written interfaces in `lib/api.ts` / `types/api.ts` (37 files known, B7 closed as redundant), inline cssText with hardcoded values in legacy components → **SOFT** maximum. Don't re-HARD-flag tracked debt.
   - **NEW:** newly-introduced hand-written type in a fresh component, new private `--ask-*` CSS namespace → HARD candidate.

2. **Is the type ACTIVELY drifting from backend OR just stale?**
   - **Actively drifting:** backend Pydantic shape changed in this PR, generated.ts updated, but hand-written interface still ref'd → HARD
   - **Stale but matching:** hand-written interface matches current backend shape, just not auto-generated → **SOFT** (tracked debt)

3. **For inline styles — is this NEW CSS-in-JS or a one-off pattern in legacy code?**
   - **NEW** (component adds inline style without consulting tokens.css) → HARD candidate.
   - **Legacy** (file predates tokens.css, refactor is a separate sprint) → **SOFT** or NIT.

4. **For silent fetch errors — is the call critical (mutation, navigation) or background?**
   - **Critical** (re-index, role change, payment) → user MUST see feedback → HARD candidate.
   - **Background** (telemetry, prefetch) → log-only is fine → **SOFT** or NIT.

5. **For React-specific items — is the file actually React or vanilla TS?**
   - **Vanilla TS** (`.ts` file, no JSX, no React imports) → Section G (React) is N/A; mark and skip those checks.
   - **React (.tsx)** → all of G applies.

**Hard-block list — these are NEVER HARD on UI files:**

- ❌ Hand-written interfaces in `lib/api.ts` / `types/api.ts` (tracked tech debt — 37 files) → SOFT max
- ❌ Inline `cssText` with `var(--token)` references in legacy file → NIT (not pure tokens, but uses them)
- ❌ Type `any[]` in component that hasn't been migrated to generated types → SOFT (tracked)
- ❌ "React useEffect with intentional empty deps + comment" → NIT
- ❌ Missing `aria-label` on optional decorative button → SOFT max
- ❌ "Inline event listeners in dynamic loop (not delegation)" → NIT (perf, not bug)
- ❌ React Section G checks on a vanilla `.ts` file → skip entirely

**When UI IS HARD:**
- ✅ Hardcoded UUID `00000000-0000-0000-0000-000000000099` (demo tenant) in production code → HARD always
- ✅ Tenant_id constructed FE-side instead of read from session → HARD
- ✅ `requireAuth()` missing on protected route registration → HARD
- ✅ NEW raw color value (`#RRGGBB`) introduced in this PR without tokens.css update → HARD
- ✅ NEW private `--ask-*` / `--component-*` CSS namespace → HARD
- ✅ Critical mutation with silent catch (user clicks button, action fails, no feedback) → HARD

**When in doubt, downgrade to SOFT.** Most UI noise is tracked tech debt — the inventory already knows. Focus HARD findings on NEW violations in this PR's diff, not legacy patterns the codebase already knows about.

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
