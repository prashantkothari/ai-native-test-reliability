# self-heal — Diagnosis-First Self-Healing (module hierarchy)

Implements the **Diagnosis-First** pipeline from the strategy ledger
(`~/.claude/plans/i-would-like-you-buzzing-goblet.md` → MASTER PLAN v2).

> **Core principle:** intelligent failure > risky heal. Diagnose *why* a step failed, route most
> failures to a named fail/abstain, and heal only the genuinely-healable subset — deterministically
> where possible (the majority is a *disambiguation/margin* problem, not a vision problem; see
> Ledger K8–K11), LLM only for the true residue.

## Dependency
All pipeline modules sit **on top of** the validated matcher core `../selfheal-core.js`
(`window.SELFHEAL`) and never modify it (its provenance is "measured Phase 0.5").

## Load order (browser)
```
../selfheal-core.js                 # the matcher (rank, scoreEx, verdict, diagnose, WEB/IOS, matchStep)
pipeline/candidate-generation.js    # eliminate + disambiguate           (+ window.SELFHEAL_CANDGEN)
pipeline/change-diagnosis.js        # diagnoseFailure                     (+ window.SELFHEAL_DIAGNOSIS)
pipeline/candidate-validation.js    # uniqueness/role + cost-gate stub    (+ window.SELFHEAL_VALIDATE)
pipeline/failure-reporter.js        # intelligent failure messages        (+ window.SELFHEAL_REPORTER)
pipeline/outcome-verification.js    # verify-by-effect wrapper            (+ window.SELFHEAL_VERIFY)
pipeline/learning-loop.js           # P2/P3 stub                          (+ window.SELFHEAL_LEARN)
```

## The pipeline (doc 2 mapping)
`Predict → Diagnose(1) → Generate(2) → Validate(3) → Act/Report(4) → Verify(5) → Learn(6)`

| Module | Step | Status |
|---|---|---|
| `change-diagnosis.js` | 1 Diagnose | **P1 BUILT** — reporting layer (relabels core's verdict/diagnosis; decision-divergence ≈ 0 in P1, GA2/R1) |
| `candidate-generation.js` | 2 Generate | **P1 BUILT** — `eliminate` + `disambiguate` (deterministic tie-break). `temporalLocality`/`structuralDiff` = P2 stubs |
| `candidate-validation.js` | 3 Validate | **PARTIAL** — `uniqueness`/`roleCongruent` built; `costGate` = P2 stub (needs calibration, I23/R5) |
| `failure-reporter.js` | 4 Report | **P1 BUILT** — deterministic intelligent-failure messages |
| `outcome-verification.js` | 5 Verify | **PARTIAL** — wraps core `verifyEffect` (logic-only); real act→observe = P2 (runtime) |
| `learning-loop.js` | 6 Learn | **P2/P3 STUB** — needs runtime-verified outcomes + federated store |

## Status legend
- **P1 BUILT** — deterministic, hermetically tested, no runtime/LLM/real-data needed.
- **PARTIAL** — the deterministic part is built; the calibrated/runtime part is a documented stub.
- **P2/P3 STUB** — documented + pseudocode only; *throws* if called, to prevent silent fake use.

## Tests
`tests/adversarial-validation.html` — open via `python3 -m http.server` (layout-independent tests
also runnable headless if a DOM lib is present). Covers the deterministic subset of the 30-case
taxonomy (`docs/FAILURE-TAXONOMY.md`).

## Honesty
No number is reported without a labelled set behind it; every metric is tagged
`measured`/`simulated`/`proxy`/`asserted`. A true 66% beats a fabricated 90%.
