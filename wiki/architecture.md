# Architecture (distilled)

Full doc: [../docs/architecture-v1.md](../docs/architecture-v1.md).

## Golden rule

Never click the WRONG thing to make a test pass. A clear honest failure beats a wrong fix.

## The 8-stage self-heal loop

1. STUDY — enumerate visible+revealed controls.
2. LOCATE — extract 11 signals, score, rank candidates.
3. RECORD — write descriptor + container context + fragility flag.
4. INTENT — author/AI one-line "why" (survives redesign).
5. EXECUTE — act via driver; search-and-pick for role-less menus.
6. DIAGNOSE — classify failure across the 7-category taxonomy.
7. HEAL — context → ordinal → widener; gate; else abstain.
8. LEARN — only from HIGH-confidence verified outcomes.

Cross-cuts: VERIFY (3-way outcome), HITL (record+execute time), LLM/vision gate (residue).

## Stage → component → status

No implementation files exist yet in this repo — this table is the design doc's own plan, not a report of working code.

| # | Stage | File | Status |
|---|---|---|---|
| 1 | STUDY | `tools/app-observer.js` | planned |
| 2 | LOCATE | `selfheal-core.js` (`WEB.extract`, `scoreEx`, `rank`) | planned |
| 3 | RECORD | `captureStep`, `captureContext` | planned |
| 4 | INTENT | — (Clue-3) | planned |
| 5 | EXECUTE | `selfheal-runtime.js` | planned |
| 6 | DIAGNOSE | `change-diagnosis.js`, core `diagnose` | planned |
| 7 | HEAL | `candidate-generation.js` | planned |
| — | VERIFY | `outcome-verification.js`, `verifyEffect` | planned |
| 8 | LEARN | `learning-loop.js` | planned |
| ⟂ | HITL | `tools/hitl-overlay.js` | planned |

## Stack (80/20)

- Build local, deterministic: descriptors, scoring, diagnosis, disambiguation, search-and-pick, HITL, drift fuzzing.
- Adopt wholesale: Playwright (EXECUTE), hosted Vision-LLM (INTENT + residue).
- Borrow patterns only: OpenTest YAML, Momentic auto-gen, Antithesis replay, Swarm persona explore, Healenium LCS + history-DB, Skyvern route-memorization.

## Mobile expansion

Do NOT fork Maestro. Add `engine-mobile` on Appium/WebDriverIO, share YAML across web+mobile. P1 blocker: extract `selfheal-core` to a dep-free package (per §3e Autonoma reference).
