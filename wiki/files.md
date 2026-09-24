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

| [docs/planning/post-merge-review.md](../docs/planning/post-merge-review.md) | Post-merge cynical review — what shipped, what's still fragile, and every remaining assumption. | built |

| [docs/research/self-heal-learnings-2026-09.md](../docs/research/self-heal-learnings-2026-09.md) | Self-heal learnings — how the shipped code compares to the research frontier. | built |
| [docs/research/test-recorder-survey-2026-09.md](../docs/research/test-recorder-survey-2026-09.md) | Recorder-fork survey. | built |
| [docs/research/test-recorder-survey-2026-09-v2.md](../docs/research/test-recorder-survey-2026-09-v2.md) | Recorder-fork survey (v2 revision). | built |

| [docs/planning/next-actions.md](../docs/planning/next-actions.md) | Comprehensive future-work punch list — 15 tasks, dependency-ordered, with decisions vs. doable items separated. | built |

| [docs/plans/self-heal-second-opinion-checker.md](../docs/plans/self-heal-second-opinion-checker.md) | Design plan for wiring a Jev second-opinion checker into the self-heal loop as a reject-only veto. Includes bake-off history. | built |

| [docs/research/rrweb-spike-summary-2026-09.md](../docs/research/rrweb-spike-summary-2026-09.md) | Reconstructed summary of the rrweb MV3-recorder spike — Rank 2 verdict + 6-question findings. Original detail lost with the deleted worktree. | reconstructed |

<!-- Add rows here as new source files land. Sync will flag missing entries. -->
