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

**Status of the merge (see wiki/CHANGELOG.md for detail):**
- S0 (branch audit) — DONE. Canonical corrected: `chip-c-a1-scaffold` + `chip-d-legacy-target` merged (neither was ancestor of the other); `experiment-only` discarded (parallel lineage, wrong fork pin); `claude/ai-native-test-reliability-011333` was a strict ancestor of both, superseded.
- S1 (branch consolidation) — DONE. `consolidated-main` built.
- S2 (vendor + scrub) — DONE. Vendored from `dc5a87f` (not merge-plan-v3's assumed `599dca1c` — superseded by this branch's own "bump lib submodule" commits before this session started; `dc5a87f` is a strict superset). 33 files landed at `experiment/self-heal/` + `experiment/selfheal-core.js` (not repo-root — this branch nests everything under `experiment/`, unlike the flat layout the planning docs assumed).
- S3 (wiring) — IN PROGRESS.
- S4-S6 — pending.
