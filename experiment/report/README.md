# experiment/report/ — reading guide + reconciliation

Twenty reports here span two months of experimental work (~2026-09-02 to 2026-09-10, later touched by 2026-09-23 severance notes and this reconciliation). They were written as-they-happened, not curated after the fact. This README exists so a reader picking up the folder cold can:

1. Find the right report for a given question,
2. Not get tripped up by identifiers that shift meaning across the timeline,
3. Understand which claims still hold and which were superseded.

Reports themselves are **read-only historical record** (the [reports-are-read-only rule](../../docs/planning/merge-plan-v3.md) protects them from post-hoc edits). This README does the reconciliation; the reports keep their original wording.

---

## Reading order (chronological)

| Report | Phase | Target app | libSha at time | One-line finding |
|---|---|---|---|---|
| `p1_results.md` | P1 slice-1 | Excalidraw @ `e1bb9ff8` | `a31ace4` | Adapter drives ai-for-qa pipeline via `addInitScript` + trusted click. `false_heal=0` across 3 trials at N=3. |
| `p1_redteam.md` | P1 | Excalidraw | `a31ace4` | Attacks P1's claims; surfaces gaps that P1 v2 closes. |
| `p1_v2_results.md` | P1 v2 | Excalidraw | `599dca1c` | Empirically exercises the heal path. Closes C1/C2/C3 + H2/H3 gaps. |
| `p2_results.md` | P2 | Excalidraw | `599dca1c` | Full mutation matrix (pristine + A1..A3 + B1..B3 + never_heal_A1) × trusted/synthetic. Retry-3x with modal-outcome-wins. |
| `three_gaps_closed.md` | P2 follow-up | Excalidraw | `599dca1c` | Closes heal_policy, iframe-scope, and control-flow spec gaps. |
| `gap_E_control_flow.md` | design | (spec, not a run) | n/a | Argues control-flow (While/If) belongs at runner-level, not library-level. |
| `phase_r_min.md` | Phase R min | Excalidraw | `599dca1c` | A1 three-way comparison (Library / Naive / Strict). Baseline for the phase-r matrix. |
| `matrix_d1_d8_benchmark.md` | Phase R matrix | Excalidraw | `599dca1c` → `c8d47aa` (after D5 fix) | Per-drift benchmark, D1..D8 attribute drifts. |
| `matrix_d1_d8_executive.md` | Phase R matrix | Excalidraw | same | Executive summary. Retracted oversold verdict on rerun. |
| `matrix_d1_d8_redteam.md` | Phase R matrix | Excalidraw | same | Redteam + D5 code-verified defect trace. |
| `matrix_d1_d8_per_trial.md` | Phase R matrix | Excalidraw | same | Full 105-row dump. |
| `compounding_c1_c2_benchmark.md` | Phase R compounding | Excalidraw | `c8d47aa` | Same-button repeat + cross-button corpus growth. Ladder promotion evidence. |
| `compounding_c1_c2_executive.md` | Phase R compounding | Excalidraw | same | Executive summary of the moat mechanism. |
| `element_wise_healing.md` | Phase R matrix follow-up | Excalidraw | same | Cross-element healing rates + flakiness signal. |
| `test_scenarios.md` | Phase R comms | Excalidraw | n/a | Test scenarios catalog for the live walkthrough. |
| `live_walkthrough.md` | Phase R comms | Excalidraw | same | Live walkthrough script for Claude+PW vs Claude+PW+Plugin. |
| `n8n_target_profile.md` | Phase R → Phase S transition | n8n 1.60.0 | `c8d47aa` → `dc5a87f` (after `data-test-id` fix) | Justifies switching target from Excalidraw to n8n. 63 testids vs Excalidraw's 16. |
| `n8n_first_scenarios.md` | Phase R → S | n8n 1.60.0 | `dc5a87f` | First 3 inline steps executed on n8n. Names `WEB.extract` needing `data-test-id` support. |
| `phase_s_final.md` | Phase S | n8n 1.60.0 | `dc5a87f` | **The USP numbers.** 298 trials. 0/144 plugin false_heal vs 17% naive-PW. Reproduced verbatim on 2026-09-24 (see §4). |
| `consolidated_findings.md` | project-wide | (all above) | `599dca1c` at time; superseded | Retrospective consolidation of slice-1 findings. |

---

## Identifier reconciliation — read this before citing a report's SHAs

### libSha values across the timeline

The reports cite four different lib SHAs. They are **not** four different projects — they are four points on one lineage, each labeled with the value that was current at the time the report was written.

| SHA in reports | What it is | Now points at |
|---|---|---|
| `a31ace4` | tip of `prashantkothari/ai-for-qa:main` on 2026-09-02 | unchanged upstream (repo still has this SHA reachable from main) |
| `599dca1c` | `preflight7/ai-for-qa:feature/heal-policy` @ 2026-09-03 — first "per-key heal policy" commit | fetchable from `prashantkothari/ai-for-qa` via direct SHA fetch (GitHub keeps fork network objects; also the commit is now merged into main lineage) |
| `c8d47aa` | Same branch, later commit — the "D5 ambiguity-firewall fix + rerun matrix" bump | same reachability |
| `dc5a87f` | Same branch, later still — "WEB.candidates includes test-id-bearing elements regardless of role" | **the current pinned version**, recorded in [`experiment/SELFHEAL_VERSION`](../SELFHEAL_VERSION) |

**Current authoritative value:** `experiment/SELFHEAL_VERSION` — a single line, machine-readable. Reports predating that file's existence use whichever value was current at their writing time; that value is preserved verbatim as historical accuracy.

### Target app across the timeline

Two distinct target apps in the reports:

- **Excalidraw** @ SHA `e1bb9ff8f8931e783c11d104abb8967ac6605c9a` — used by every report through `phase_r_min.md`, the D1-D8 matrix, and compounding.
- **n8n** 1.60.0 (npm package, not a git SHA — pinned by the `npx n8n@1.60.0 start` command in `phase_s_final.mjs`) — used from `n8n_target_profile.md` onward.

Neither was "the target"; the project moved from Excalidraw to n8n during Phase R to get more UI shape coverage (n8n has 63 testids vs Excalidraw's 16, plus forms/wizards/popups Excalidraw doesn't have). **`phase_s_final.md` on n8n is the current reference** — its §4 was reproduced end-to-end on 2026-09-24 (`experiment/logs/phase_s.jsonl` on `main`).

### Repo names in report prose

Some report bodies say things like "committed on `feature/heal-policy` as `dded40e`. Pushed to `preflight7/ai-for-qa`" or "Public repo `preflight7/ai-native-test-reliability`." These are **factually true for the time they were written** — the work was originally hosted on `preflight7/*`. In 2026-09-23 that content was consolidated into `prashantkothari/ai-native-test-reliability` (this repo) and the `preflight7/*` counterparts were archived (see [NOTICE.md](../../NOTICE.md)).

Reports affected got a top-of-file "Migration note (2026-09-23)" pointing forward. **This file is the canonical current location for everything a report describes.**

### `logs/trials.jsonl` path references

Reports predating 2026-09-24 cite `logs/trials.jsonl` (the Excalidraw-era 16-row evidence log). That file was moved to [`trials-archive.jsonl`](trials-archive.jsonl) in this same directory — out of `run_trials.js`'s truncate-on-run write path. Reports affected got a top-of-file "Path note (2026-09-24)." **Data unchanged; only the path moved.**

### Line-range citations into evidence files

A few reports cite specific line ranges (e.g., `logs/trials.jsonl:5-8`). Those ranges are trustworthy for the **historical** Excalidraw data now at `trials-archive.jsonl`. They are **not** trustworthy against `experiment/logs/phase_s.jsonl` (which is n8n-era, produced fresh on every `phase_s_final.mjs` run). If a report cites a JSONL file it doesn't name, assume it means the archive.

---

## Which report to read for which question

- **"Does the plugin actually work?"** → `phase_s_final.md` (n8n numbers, 298 trials, reproduced on 2026-09-24)
- **"How does the plugin compare to just Playwright?"** → `phase_s_final.md` Section 1 aggregate row
- **"Does the plugin heal repeatedly (compounding)?"** → `compounding_c1_c2_executive.md` (Excalidraw C1 evidence stands); `phase_s_final.md` §2 documents why it doesn't fire on n8n's `execute-workflow-button` specifically
- **"How was the original slice built?"** → `p1_results.md` and `p1_v2_results.md`
- **"What went wrong that had to be fixed?"** → `p1_redteam.md`, `three_gaps_closed.md`, `matrix_d1_d8_redteam.md`
- **"Why switch from Excalidraw to n8n?"** → `n8n_target_profile.md`
- **"What's the executive-level pitch?"** → `compounding_c1_c2_executive.md` + `matrix_d1_d8_executive.md` (Excalidraw) + `phase_s_final.md` (n8n)
- **"Where's the consolidated summary?"** → `consolidated_findings.md`, with the caveat that it predates the n8n phase

---

## Reconciliation limits (things this README does not fix)

- **The reports' own internal numbers occasionally shift after retractions.** E.g., `matrix_d1_d8_executive.md` explicitly retracts an oversold verdict inside its own body. Trust the body as it stands.
- **Some reports still cite `.env.jev` values, dev-machine paths, or bake-off token counts.** Those are frozen at the time the report was written; do not treat them as current.
- **Where the same claim appears in two reports with different numbers**, the later report supersedes the earlier one. The chronological table above orders them.
