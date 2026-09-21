# Wiki Index — Consolidation Planning Docs

Landed 2026-09-21. These docs plan the consolidation of `playwright_middleware` (local) with `prashantkothari/ai-for-qa` into one repo. Read in order:

1. [execution-flow.md](execution-flow.md) — as-is architecture: 3-layer stack, boundary contract, gate placement, block-flow diagram
2. [hld.md](hld.md) — to-be design: merged file-tree, full API surface (14 globals), wiki tree, cross-cutting concerns (SELFHEAL_VERSION, path changes)
3. [files-comparison.md](files-comparison.md) — file-by-file comparison of local vs ai-for-qa, vendoring set enumerated (32 files)
4. [plan-reconciliation.md](plan-reconciliation.md) — deltas between docs 1-3 and the earlier merge plan
5. [redteam-pass.md](redteam-pass.md) — independent-context subagent redteam over docs 1-4; 5 blockers identified
6. [merge-plan-v3.md](merge-plan-v3.md) — **executable plan** (supersedes v2). All redteam blockers absorbed. 6 sessions: S0 audit → S6 archive.

**Status.** Docs only. No merge has been executed. Read merge-plan-v3.md end-to-end before approving S0.
