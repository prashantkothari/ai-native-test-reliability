# Files — docs/** and experiment/self-heal/**

Scope: source files under `docs/` and `experiment/self-heal/`. Every non-README file matching that glob must have an entry.

`experiment/selfheal-core.js` and `experiment/self-heal/**` are now vendored and present (see wiki/files-comparison.md for the manifest). Not "planned" anymore.

| Path | Purpose | Status |
|---|---|---|
| [docs/architecture-v1.md](../docs/architecture-v1.md) | Canonical architecture reference: 8-stage self-heal loop, OSS map, 80/20 stack, agentic layers, Analyzer 2.0 alignment, lifecycle pool, Autonoma/Maestro references, mobile plan. | built |
| [docs/planning/execution-flow.md](../docs/planning/execution-flow.md) | As-is architecture: 3-layer stack (Node harness / injected browser lib / target SPA), boundary contract, gate placement. | built |
| [docs/planning/hld.md](../docs/planning/hld.md) | To-be design: merged file-tree, full API surface, wiki tree, cross-cutting concerns. | built |
| [docs/planning/files-comparison.md](../docs/planning/files-comparison.md) | File-by-file comparison, local vs ai-for-qa; 32-file vendoring manifest. | built |
| [docs/planning/plan-reconciliation.md](../docs/planning/plan-reconciliation.md) | Deltas between the file comparison and the earlier merge plan. | built |
| [docs/planning/redteam-pass.md](../docs/planning/redteam-pass.md) | Independent redteam pass over the planning docs; 5 blockers found. | built |
| [docs/planning/merge-plan-v3.md](../docs/planning/merge-plan-v3.md) | Executable merge plan, all redteam blockers absorbed. | built |

<!-- Add rows here as new source files land. Sync will flag missing entries. -->
