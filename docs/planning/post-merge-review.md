# Post-Merge Review — Cynical Senior Engineer Pass

Date: 2026-09-23. Scope: everything landed via PRs #2, #3, #4, #5 plus this repo's history end-to-end. What follows is the honest read of what shipped, what's still fragile, what remains unverified, and what a new user (a "customer") would trip over on first clone.

## 0. What actually happened

- **PR #2** — the main consolidation (32 vendored files + wiki + planning docs + harness path fixes). Merged clean.
- **PR #3** — post-merge stress test caught 3 additional harness scripts (`compare_a1.js`, `compare_matrix.js`, `compounding.mjs`) that still called `git -C lib rev-parse HEAD`. Would have crashed on any invocation. Fixed with the same `SELFHEAL_VERSION` read as `run_trials.js`.
- **PR #4** — same stress test caught 96 Playwright trace `.zip` files (6.1 MB) checked into `experiment/logs/traces/`, cited by zero reports. Removed from tracking and gitignored. `.jsonl` logs (292 K) kept — those ARE cited as evidence by 10 report `.md` files.
- **PR #5** — during branch cleanup, found 3 research documents on `claude/happy-sanderson-bb1691` not in main. Preserved them into `docs/research/` before deleting the branch.
- **Branch cleanup** — 33 local branches deleted (all safely covered by main or explicitly-discarded parallel lineage). 8 disposable session-worktrees removed. Remote GitHub branches could NOT be deleted (repository ruleset blocks it — repo-owner setting change needed).

## 1. Structure — what a fresh clone actually gets

Test: `git clone https://github.com/prashantkothari/ai-native-test-reliability.git` yields:

```
/                                   ← repo root
├── AGENTS.md                       agent-orientation
├── CLAUDE.md                       repo instructions (starts with the branching-discipline note)
├── NOTICE.md                       vendor provenance (ai-for-qa @ dc5a87f)
├── README.md                       setup + report caveats
├── .claude/                        ← Claude Code session config + skills (INTERNAL; see §5.1)
├── docs/
│   ├── architecture-v1.md          canonical architecture reference (212 lines)
│   ├── planning/                   consolidation planning trail (7 docs incl. this one)
│   └── research/                   3 research MDs preserved from happy-sanderson
├── experiment/                     the actual runnable Playwright harness
│   ├── PLAN.md                     stale, kept as historical record (with a pointer note)
│   ├── SELFHEAL_VERSION            single line: dc5a87fc5b1cde7e38bcb8a7420f0e40cbdcac8c
│   ├── .gitignore                  target_repo/, logs/traces/, node_modules/, screenshots/
│   ├── package.json                name: "self-heal-runner"
│   ├── docs/                       one file: legacy_target_pick.md
│   ├── fixtures/                   authored-test.json
│   ├── harness/                    20 files — runners, scouts, bundler, tests
│   ├── logs/                       6 .jsonl evidence logs (traces/ now gitignored)
│   ├── mutations/                  6 .patch files
│   ├── report/                     20 .md report files (historical, read-only)
│   ├── self-heal/                  32 vendored files from ai-for-qa
│   ├── selfheal-core.js            33rd vendored file
│   └── tools/                      vendor-scrub.sh
└── wiki/                           curated index + 10 tests + sync tool
```

**All 10 `wiki/tests/*.sh` pass on the fresh clone.** All JS files pass `node --check`. Bundle builds byte-identical to the pre-vendor submodule baseline (100 072 bytes). `npm install` succeeds. The customer's very first `node harness/run_trials.js` invocation crashes with the friendly `Missing …/target_repo — see README` error, exactly as designed.

## 2. Cynical review — what actually bothers me

### 2.1 The `experiment/logs/trials.jsonl` file has dev-machine absolute paths baked in

Sample line (there are 16 like this):
```
"screenshot": "/Users/prashant/Documents/playwright_middleware/.claude/worktrees/ai-native-test-reliability-011333/experiment/logs/screenshots/S1v2-A1-trusted.png"
```

This is checked in as "evidence" for `report/p1_v2_results.md` but it references a specific dev workstation's filesystem. A customer opening `trials.jsonl` sees another engineer's home directory path baked into their supposedly-shipped repo. Not sensitive per se, but it undermines the "reproducible evidence" framing the report leans on. Also, `run_trials.js` opens `trialsFile` with `fs.writeFileSync(trialsFile, '')` — truncating it — so the very first time anyone runs a trial, this "historical evidence" is silently overwritten. So it's evidence-that-gets-wiped-on-first-use. Contradictory as a design.

**Fix (not applied):** either move the historical trials.jsonl to `experiment/report/trials-archive.jsonl` (out of the runner's write path) OR strip the machine-specific paths in place. Either is a per-report-value judgment call the user should make, so this document flags it rather than surgically edits committed "evidence" data (that risks looking like data tampering).

### 2.2 `.claude/` at repo root

The root-level `.claude/` directory contains Claude Code session config and the Matt-Pocock skills library. It survived because:
- `.claude/skills/` is genuinely useful development tooling for anyone continuing to work on this repo with Claude Code
- Nothing about it broke anything
- Removing it is a decision only the repo owner should make

But a first-time customer cloning this repo sees `.claude/` next to `README.md` and wonders "is this Anthropic's config? Do I need it? Should I edit it?". The right disposition depends on scope: is this a "repo shipped to a customer who will consume it" (strip `.claude/`) or "our team's monorepo that customers happen to have access to" (keep it)? **Not decided in this session** — flagged for the owner.

### 2.3 `report/*.md`'s citation format is fragile

Reports cite raw data like `see logs/trials.jsonl:5-8` (line ranges into a truncate-on-run file). If anyone reruns the harness, the line numbers no longer correspond. This is a documentation smell in the underlying reports — not something I should edit under the "reports are read-only" rule, but a customer trying to verify a report's claim will hit this immediately.

### 2.4 `SELFHEAL_VERSION` is a marker, not a lock

`test_selfheal_version_bump.sh` fires if `experiment/self-heal/**` changes without `SELFHEAL_VERSION` also changing — but it compares against the "vendor: ai-for-qa @" commit found via commit-message grep. If someone rewrites that commit's message during a history rewrite (e.g., to strip trace zips retroactively), the base becomes null and the test skips silently. Fallback behavior: skip with `"nothing to compare against"`. This is the "silent-except" pattern the redteam pass flagged as a repo anti-pattern.

**Not fixed:** a stricter fallback (fail if base can't be found AND `experiment/self-heal/**` has any git history) is possible but requires the user to accept that a fresh clone with squashed history genuinely can't run this check.

### 2.5 `test_dual_mode.sh` has a real known-limitation

It runs `node -e "require('./file.js')"` on each dual-mode schema file. Catches top-level browser-only API references (`window.crypto`, `document.querySelector` at import time). Does NOT catch lazy references inside function bodies that aren't invoked at load. This is flagged inside the script's own header, but a customer relying on the test as a full contract will be surprised.

### 2.6 The vendor-scrub script silently no-ops on unknown files

`tools/vendor-scrub.sh` only scrubs the 5 files hard-coded in its list. If a future vendor pull brings in a new file with vendor-name references, the scrub misses it. The sentinel file `.vendor-scrubbed` would still exist, giving false confidence that "scrub already ran." No CI enforcement means this is a slow-drift risk. Sentinel is gitignored so fresh clones re-run, but re-run against the same hardcoded 5-file list.

### 2.7 The vendor-scrub target list overlaps with the reports

Grep of the merged main for any of the 6 vendor names outside the 5 scrubbed files: `gong`, `amplitude` appear in `report/matrix_d1_d8_*.md`, `report/n8n_*.md` (n8n is fine, but the reports mention amplitude/gong as pilots too). These are historical measurement references, not runtime code, so they're arguably fine to keep — but the "vendor scrub" hygiene is inconsistently applied: strict on library code, absent on report prose. Worth acknowledging.

## 3. API surface — what's exposed to a customer

The library API (the 13 bundled globals) is unchanged and byte-identical to what the pre-vendor submodule shipped. See `docs/planning/hld.md` §API structure tree for the full enumeration. Customer-facing entry points at the harness layer:

- **`node experiment/harness/bundle-library.js`** → produces `logs/selfheal-bundle.js` (100 072 bytes)
- **`node experiment/harness/run_trials.js`** → runs the P2 mutation matrix (14 mutations × 2 modes) against `experiment/target_repo/`. Requires user to have cloned the target app there.
- **`node experiment/harness/translate-locator.test.js`** → 10 unit tests for the locator translator
- **`node experiment/harness/compare_a1.js` / `compare_matrix.js` / `compounding.mjs`** → the phase-r experiment runners (fixed by PR #3)

`experiment/package.json` scripts:
- `bundle` → `node harness/bundle-library.js`
- `test:translator` → `node harness/translate-locator.test.js`
- `trial` → `node harness/run_trials.js`

**No `test` script wired.** A customer running `npm test` gets `Error: no test specified`. Minor but customer-facing surprise.

## 4. Tests — actual coverage vs. claimed coverage

| Test | What it does | What it doesn't do |
|---|---|---|
| `wiki/tests/test_files_coverage.sh` | Every `docs/**` and `docs/**/**` file has a `wiki/files.md` entry | Doesn't check `experiment/self-heal/**` (the actual bulk of the repo) despite `wiki/files.md`'s own claimed scope |
| `wiki/tests/test_freshness.sh` | `wiki/README.md`'s `Last-verified:` header ≤30 days old | Doesn't check any other doc's freshness |
| `wiki/tests/test_glossary_terms.sh` | Every term in `wiki/glossary.terms` appears in `wiki/glossary.md` | Substring match — false positives possible ("healed" matches "self-healed") |
| `wiki/tests/test_links.sh` | Every relative link inside `wiki/**/*.md` resolves | Doesn't check links inside `docs/**`, `experiment/**` or the vendored `self-heal/docs/**` (dead links possible outside `wiki/`) |
| `wiki/tests/test_no_duplication.sh` | `wiki/architecture.md` < 30% of `docs/architecture-v1.md` line count | Line-based, not content-based; large distilled summary would sneak past |
| `wiki/tests/test_selfheal_version.sh` | `SELFHEAL_VERSION` exists, non-empty, SHA-shaped | Doesn't verify that SHA is actually fetchable from any real remote |
| `wiki/tests/test_selfheal_version_bump.sh` | Bump-on-lib-change invariant | Silent no-op if base commit can't be found — see §2.4 |
| `wiki/tests/test_size.sh` | `wiki/**/*.md` bytes ≤ 50 % of `docs/**/*.md` bytes | Depends on `docs/planning/` staying large; if docs shrink, wiki suddenly fails |
| `wiki/tests/test_structure.sh` | Required files present + no wiki/*.md >80 lines | 80-line cap forced `docs/planning/*.md` relocation during S3 |
| `wiki/tests/test_dual_mode.sh` | 3 schema files load under `node -e require()` | Only load-time browser-API refs; see §2.5 |
| `experiment/harness/translate-locator.test.js` | 10 unit tests for the locator translator | Doesn't test the vendored self-heal library's pipeline modules |
| `experiment/harness/compare_matrix.test.mjs` | Present, not run in any automation | Not wired to any npm script |

**No test verifies:**
- `experiment/self-heal/**` is unchanged from the vendored SHA (`Probe 1a` was ad-hoc, not automated)
- `bundle-library.js`'s file list still matches what actually exists (deleting a bundled file would produce a runtime error at bundle-time, no earlier signal)
- `run_trials.js`'s target-repo assertion (`experiment/target_repo/.git` must exist) works — no test simulates the missing-target-repo path
- Any of the actual library semantics — no unit tests for `SELFHEAL.matchStep`, `bestLocator`, `verifyEffect`, `brain.put/get`

## 5. Assumptions still in play — the honest list

**Cleared / verified this session:**
- ✅ Bundle byte-reproducibility against pre-vendor baseline
- ✅ All 33 vendored files present, correct SHA, no vendor-name leaks
- ✅ All 4 harness scripts fixed for the removed submodule
- ✅ Fresh clone → npm install → bundle → tests all succeed
- ✅ All 10 wiki tests pass on fresh clone

**Still assumed, not verified:**
1. **Probe 2b (full trial against target_repo) has never run this session.** No trial reports were regenerated; existing report claims are unverified against the current merged state. Would require cloning the actual target app (n8n per branch history, or Excalidraw per older reports — reports disagree with each other about which is canonical target).
2. **License/attribution.** `NOTICE.md` documents provenance but neither the source (`prashantkothari/ai-for-qa`) nor this repo has a LICENSE file. Treating this as self-owned code consolidation. If ownership ever changes hands or a contributor from outside the current owner shows up, this is unresolved.
3. **`test_selfheal_version_bump.sh` behavior on a squashed history.** If someone ever does `git filter-repo` to strip the trace zips from history, the "vendor: ai-for-qa @" commit gets rewritten with a new SHA, and this test's grep-based base-finding will still work (grep is by commit message, not by SHA) — but the check uses `git log --grep` which matches on commit message text. Text-based coupling is fragile.
4. **The removed remote branches** (`consolidated-main`, `fix-remaining-lib-refs`, `clean-tracked-artifacts`, `preserve-research-docs`, `claude/github-commits-not-pushing-632a19`, and older `claude/ai-native-test-reliability-011333`, `claude/p1-slice`) — locally deleted but remote push was rejected by GitHub ruleset. Repo owner needs to either update the ruleset to allow deletion OR accept them as historical branches on the remote.
5. **`/Users/prashant`'s literal home directory as a git repo.** Its working tree is genuinely dirty with pre-existing drift from ~13 days of normal Claude Code usage (deleted `.claude/skills/*` files, etc.). This session left it completely untouched. That drift belongs to the user's ongoing daily use of their machine, not this consolidation. Recommend NOT trying to "fix" it — this repo being rooted at `$HOME` is the original sin that produced the whole three-repo confusion in the first place.
6. **`.claude/` remaining at repo root** — undecided (see §2.2). Currently kept.
7. **`experiment/logs/trials.jsonl` dev-machine paths** — undecided (see §2.1). Left in place.
8. **Trial reports' internal consistency.** The reports were left read-only. They cite line ranges into a truncate-on-run file. They cite `libSha: 599dca1c` while `SELFHEAL_VERSION` is now `dc5a87f`. They cite `Excalidraw` at one target SHA while later phase-r reports moved to n8n. Consistent internal contradictions across the report set were NOT reconciled — the reports-are-read-only rule protected them from edits, but a customer reading multiple reports in sequence will find those contradictions.

## 6. Recommended next steps (not done)

Ordered by cost × value:

1. **Repo-owner: update GitHub ruleset to allow branch deletion**, then `git push origin --delete` the 7 stale remote branches. 5 minutes.
2. **Decide `.claude/` disposition** — keep, or move to a private/tooling-only repo. Impact: cosmetic + first-impression clarity for customers.
3. **Decide `trials.jsonl` disposition** — archive to `report/` or scrub paths. Impact: reproducibility credibility.
4. **Run Probe 2b** — clone the actual target app, run `node experiment/harness/run_trials.js`, verify `false_heal=0` still holds against the current merged tree. Only real end-to-end verification of everything shipped.
5. **Add `test` script** to `experiment/package.json` — even if it's just `npm run test:translator`, so `npm test` doesn't error.
6. **Add a per-module test entry-point** — run all six vendored test HTML pages (`self-heal/tests/*.html`, `self-heal/schemas/tests.html`, `self-heal/brain/tests.html`, `self-heal/pipeline/lever-tests.html`) as a wiki test. Currently vendored but not exercised.
7. **Optional: history rewrite** — `git filter-repo --path experiment/logs/traces --invert-paths --force` (destructive!) to actually shrink clone size. Requires force-push and coordination with anyone who's already cloned. Cost/benefit questionable at 6 MB.
