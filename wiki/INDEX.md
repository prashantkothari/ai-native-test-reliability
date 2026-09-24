# Index

## Repo orientation
- [README.md](README.md) — orientation, trust rule, freshness headers.
- [architecture.md](architecture.md) — 8-stage self-heal loop, component→file map, status.
- [glossary.md](glossary.md) — Q1/Q2/Q3, T0–T3, K-numbers, failure taxonomy, HITL, verify-by-effect.
- [files.md](files.md) — path → purpose → status for `docs/**` and `experiment/self-heal/**`.
- [CHANGELOG.md](CHANGELOG.md) — append-only sync/edit log.
- [glossary.terms](glossary.terms) — required-term list driving `test_glossary_terms.sh`.

## Consolidation planning docs (landed 2026-09-21, `docs/planning/`)

Plan to merge this repo with `prashantkothari/ai-for-qa`. Full-length docs live under
`docs/planning/` (outside wiki/'s 80-line-per-file cap). Read in order:

1. [../docs/planning/execution-flow.md](../docs/planning/execution-flow.md) — as-is architecture: 3-layer stack, boundary contract, gate placement, block-flow diagram
2. [../docs/planning/hld.md](../docs/planning/hld.md) — to-be design: merged file-tree, full API surface (14 globals), wiki tree, cross-cutting concerns (SELFHEAL_VERSION, path changes)
3. [../docs/planning/files-comparison.md](../docs/planning/files-comparison.md) — file-by-file comparison of local vs ai-for-qa, vendoring set enumerated (32 files)
4. [../docs/planning/plan-reconciliation.md](../docs/planning/plan-reconciliation.md) — deltas between docs 1-3 and the earlier merge plan
5. [../docs/planning/redteam-pass.md](../docs/planning/redteam-pass.md) — independent-context subagent redteam over docs 1-4; 5 blockers identified
6. [../docs/planning/merge-plan-v3.md](../docs/planning/merge-plan-v3.md) — **executable plan** (supersedes v2). All redteam blockers absorbed. 6 sessions: S0 audit → S6 archive.

**Status (updated 2026-09-24):**

The consolidation is complete and the repo is customer-usable. Everything mergeable by me alone
is closed; a handful of tasks are held for the repo owner or genuinely deferred. See
`docs/planning/next-actions.md` for the full task ledger (T1..T18).

- Consolidation S0-S6 — DONE. `prashantkothari/ai-native-test-reliability` is the single
  canonical repo; `preflight7/*` testing repos archived.
- T1 (ruleset) + T2 (stale branch cleanup) — DONE, remote back to `main`-only.
- T4 (end-to-end verification on n8n) — DONE. 298-trial harness reproduces `phase_s_final.md`
  numbers exactly. Plugin false_heal 0/144, naive PW 17%.
- T5 (`npm test`) + T14 (GitHub Actions CI) — DONE. Every push and PR runs wiki tests +
  harness bundle + translate-locator tests.
- T7 / T8 / T9 — DONE. `.claude/` kept + noted, trials.jsonl archived, MIT LICENSE landed.
- T16 (jev-judge recovery) — DONE, both Phase 1 (code) and Phase 2 (live rerun with real
  token/latency data).
- Deferred with rationale: T6 (vendored-lib module tests), T10 (history rewrite for 6.1MB
  trace zips), T13 (17 session archive clicks), T15 (weekly wiki-sync cron).
- Owner's call: T3 (`/Users/prashant` home-dir drift), T11 (statefarm mockup on archived
  preflight7/ai-for-qa), T17 (rrweb-spike doc if that session resurfaces).
- Optional hygiene: T12 (report/*.md internal contradictions).
