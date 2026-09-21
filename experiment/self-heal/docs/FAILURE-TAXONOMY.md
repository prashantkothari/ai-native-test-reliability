# FAILURE-TAXONOMY.md — empirical basis for investment

Why we build the diagnosis-first pipeline, grounded in real data — not assumptions.
Sources: iOS Native Swipe POC (1000 real failures, 14 tenants) + the 30-case drift taxonomy.
Every number tagged `measured` / `asserted` (the POC %s are the analyst's classification = `measured`
at the category level, `asserted` for the deterministic-vs-semantic split, which D1 must verify).

## A. The 9 production patterns (POC — 1000 iOS Native swipe failures) `measured`

| Pattern | Failures | % | Root cause | Heal? | Correct behavior |
|---|---|---|---|---|---|
| A Stale / broken locators | 665 | 66.5% | test-asset drift + locator brittleness | mostly | re-locate by signal / disambiguate |
| B Screen state not ready | 42 | 4.2% | timing / overlay / animation | maybe | detect overlay → dismiss / wait |
| C Swipe loop budget | 11 | 1.1% | test-asset config | detect | dynamic budget; else fail |
| D Engine code defects | 20 | 2.0% | deterministic engine bugs | **no** | ENGINEERING fix |
| E Driver session lost | 60 | 6.0% | session lifecycle + no null guard | **no** | ENGINEERING (AI attributes cascade) |
| F Cloud connectivity drop | 37 | 3.7% | transient network + no retry | **no** | ENGINEERING retry |
| G App crash | 26 | 2.6% | third-party app instability | detect | attribute to crash, not swipe |
| H Custom add-on defects | 28 | 2.8% | add-on code bugs | **no** | ENGINEERING / add-on dev |
| I Opaque error messages | 111 | 11.1% | exception swallowing in engine | **no** | ENGINEERING (blinds diagnosis — prerequisite) |

**Stream split:** AI/Auto-Healer primary = A,B,C,G = **744 (74.4%)**; Engineering = D,E,F,H,I = 256 (25.6%).
**Scope:** this pipeline owns **A (+B,C,G)**; D/E/F/H/I are scoped OUT (never heal — detect+report only).
**Prerequisite:** Pattern I (opaque errors) must be fixed upstream or diagnosis is blind (Ledger J5).

## B. The 7-category failure-mode taxonomy (the routing axis)

| Category | Definition | Healable? | Correct behavior | P1 reachable? |
|---|---|---|---|---|
| DRIFT | element exists, selector wrong | **yes** | signal re-location / disambiguation | yes (matchStep + eliminate) |
| AMBIGUITY | multiple candidates, can't disambiguate | only w/ context | abstain (or break tie deterministically) | yes (eliminate; else honest abstain) |
| REMOVAL | element gone, no replacement | no | fail fast "removed" | yes (= not-found) |
| STATE_ISSUE | exists but not interactable | no | fail "disabled/hidden/overlay" | yes (actionability gate) |
| TEMPORAL | appears after wait | maybe | wait + retry | **no** — needs runtime |
| FLOW_CHANGE | interaction model changed | no | fail "flow changed; human review" | **no** — needs intent/runtime |
| UNKNOWN | can't classify | no | fail fast | yes (catch-all) |

## C. The deterministic-vs-semantic split (the investment question) `asserted — D1 verifies`

Verified fact (Ledger K8): the matcher ALREADY clears the heal floor on role+tag alone
(name-only button = 0.737 > 0.62; full-text-drift form input = 0.898). **What blocks the heal is
MARGIN (a duplicate tie), not the threshold.** So healing is mostly a *disambiguation* problem.

| Lever | Deterministic? | Addresses | Status |
|---|---|---|---|
| Whitespace-normalisation | yes | trailing-space locators (~30) | narrow heal — P1 candidate |
| Static malformed-locator detect | yes | self-concatenated XPath (~47) | report — P1 candidate |
| **Elimination (negative constraints)** | **yes** | duplicate ties / anchorless-icon | **BUILT (P1)** |
| Interaction-context / temporal locality | yes (needs runtime) | "near where I just acted" | P2 |
| Structural diff | yes (needs anchors+snapshot) | moved elements | P2 |
| Semantic / visual matching | **no — LLM/vision** | zero-token rephrase, icon-only redesign | P3 residue |

**Honest position (K10):** deterministic ceiling is structurally higher than name-fuzzy-only implies;
the true vision/LLM residue is only where structure AND text AND context fail at once. Whether the
split is 80/20 or 60/40 is **what D1 measures** — we do not assert a number.

## D. The 30-case drift taxonomy → category → P1 testability

Sorted from the 30-question source. "P1 test" = hermetically testable now without runtime.

| Cases | Theme | Category | P1 test? |
|---|---|---|---|
| Q1,Q3,Q4,Q6,Q7 | spatial move (sidebar/portal/FAB/row) | DRIFT | partial (signal-based; container needs scope) |
| Q8,Q13,Q23,Q24 | type/structure drift (button→link, wrapper, framework, class) | DRIFT | yes (role-not-tag; class-penalty) |
| Q9 | text→icon | DRIFT/AMBIGUITY | yes (name-absent → elimination/abstain) |
| Q19,Q20 | identical Submit / table Delete | AMBIGUITY | **yes (elimination tie-break or honest abstain)** |
| Q12 | enabled→disabled | STATE_ISSUE | **yes (isEnabled → gate)** |
| Q5 | collapsed/hidden | STATE_ISSUE | yes (visibility) |
| Q10,Q11,Q17,Q18 | split/merge/auto-save/shortcut | FLOW_CHANGE | no (needs intent) → fail-fast |
| Q14,Q15,Q16 | deleted / role-gated / A/B | REMOVAL | **yes (no candidate → fail-fast)** |
| Q2 | different page | REMOVAL | yes (not-on-page) |
| Q28,Q29,Q30 | scroll / delay / conditional reveal | TEMPORAL | no — needs runtime |

The deterministically-testable rows (Q12, Q14, Q19, Q20, Q9) are exercised in
`tests/adversarial-validation-tests.js`.
