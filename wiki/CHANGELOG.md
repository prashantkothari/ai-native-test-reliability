# Wiki Changelog

Append-only. One line per sync run or manual edit. Newest at top.

- 2026-09-24 — T4 n8n verification: ran `experiment/harness/phase_s_final.mjs` against a fresh
  boot of `npx n8n@1.60.0 start` on localhost:5678. 298 rows in `experiment/logs/phase_s.jsonl`;
  plugin false_heal 0/144 across Pass A L-cold + L-brain; naive PW 12/72 (17%); identity oracle
  Pass C caught 1/2 imposters. Reproduces recovered `phase_s_final.md` numbers exactly. PR #15.
- 2026-09-24 — T7/T8/T9 decisions merged (PR #16): kept `.claude/` at repo root + added
  README explanation; moved `experiment/logs/trials.jsonl` -> `experiment/report/trials-archive.jsonl`
  (out of runner's truncate-path) + annotated 4 reports with path notes; added MIT LICENSE
  (© 2026 Prashant Kothari).
- 2026-09-24 — eval Phase 2 (PR #14): live rerun of jev-judge harness fills previously-null
  per-case token/latency fields in results/jev-run-results-unlabeled-decoy.json and
  results/choice-run.json. Aggregates reproduce recovered numbers within ±0.03%.
- 2026-09-23 — T5 (npm test script) + T14 (basic GitHub Actions CI: wiki-tests + harness-tests
  on every PR/push to main) merged (PR #10). T6 (module HTMLs), T13 (17 session archive
  clicks), T15 (weekly wiki-sync cron) deferred with rationale.
- 2026-09-23 — T1 (ruleset scope narrowed to default branch only, done by owner) + T2 (all 10
  stale merged branches deleted from origin) — remote back to main-only. PRs #9 + inline.
- 2026-09-23 — next-actions.md task list published (PR #8): 15 tasks, dependency-ordered,
  decisions vs doable clearly split. Later extended with T16-T18 (recovery from worktree
  removal mistake).
- 2026-09-23 — post-merge cynical review (PR #6): 7 things a customer would trip over,
  tests coverage table, assumption inventory.
- 2026-09-23 — severed preflight7 references (PR #7): NOTICE.md + 3 report migration notes;
  archived preflight7/ai-native-test-reliability and preflight7/ai-for-qa as read-only.
- 2026-09-23 — post-merge stress-test fixes:
  - PR #3: 3 more harness scripts (compare_a1.js, compare_matrix.js, compounding.mjs) had the
    same `git -C lib` submodule call that would hard-crash; fixed to read SELFHEAL_VERSION.
  - PR #4: removed 96 Playwright trace .zip files (6.1MB) that no report cited; kept the
    evidence-cited .jsonl logs.
  - PR #5: preserved 3 research MDs from `claude/happy-sanderson-bb1691` before deleting the
    branch.
  - PR #11: cleaned up peer-session's misplaced `Documents/playwright_middleware/...` paths.
- 2026-09-23 — main consolidation (PR #2) merged into `prashantkothari/ai-native-test-reliability`
  via `-s ours` merge to establish shared history with the pre-existing empty main. 33 vendored
  files, wiki scaffold, planning docs, harness rewired for no-submodule structure.

- 2026-09-24 — recovery: jev-judge eval (~340-call bake-off harness) rebuilt via peer session
  after earlier `git worktree remove --force` mistake — merged as PR #12 with 47 files, cases
  reproduce byte-identical, results partial-with-documented-null-gaps. Also merged PR #11 fixing
  misplaced Documents/... paths from peer session's direct-to-main push. See docs/planning/
  next-actions.md T16-T18 for details.

- 2026-09-21 — consolidation S4 (verification): Probe 1a (bundle byte-diff vs true
  pre-vendor baseline, captured from a fresh chip-c-a1-scaffold checkout with the real
  submodule initialized) PASS, byte-identical, 100072 bytes. Probe 1b (translate-locator
  unit tests) PASS 10/10 — note: doesn't exercise the scrubbed benchmark/test files, only
  translate-locator.js itself. Probe 2a (fresh clone -> npm install -> bundle -> tests)
  PASS. Probe 3 (wiki-tests) PASS 10/10 on the fresh clone too. Probe 2b (full trial against
  target_repo) DEFERRED — needs the actual target app (n8n, per this branch's commit
  history) cloned and confirmed by the user; not something to fabricate.
- 2026-09-21 — consolidation S3 (wiring): harness paths repointed at experiment/self-heal/,
  SELFHEAL_VERSION added, submodule removed, 3 new wiki-tests added (test_selfheal_version,
  test_selfheal_version_bump, test_dual_mode), README.md + NOTICE.md added, docs/planning/
  created for the 6 full-length planning docs (moved out of wiki/ to respect the 80-line cap).
- 2026-09-21 — consolidation S2 (vendor): 33 files vendored from prashantkothari/ai-for-qa @
  dc5a87f (corrected from merge-plan-v3's assumed 599dca1c), scrubbed via tools/vendor-scrub.sh
  (perl-based after a BSD-sed \b bug was caught by Probe 4).
- 2026-09-21 — consolidation S1: consolidated-main built from chip-c-a1-scaffold merged with
  chip-d-legacy-target (S0 audit found neither was an ancestor of the other; the originally
  assumed canonical branch, claude/ai-native-test-reliability-011333, was a strict ancestor
  of both and superseded).
- 2026-09-21 — init: created wiki skeleton, tests, sync script, CI workflow.
