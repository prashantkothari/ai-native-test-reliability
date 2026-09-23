# Next-Actions Task List

Comprehensive punch list from everything surfaced during the consolidation + review + independence work (session 2026-09-21 → 2026-09-23). Everything the repo needs to be genuinely "done" for a customer, ordered by cost × value × dependency.

Legend:
- **Owner-only** — needs repo-owner auth on prashantkothari org; cannot be delegated
- **Blocked** — waiting on another task
- **Doable** — routine work, either automatable or a single small PR
- **Decision** — a real judgment call the human should make before executing

---

## Immediate (blocks further branch cleanup)

### T1 — Update the "protect" ruleset scope (Owner-only)

**What.** The current ruleset on `prashantkothari/ai-native-test-reliability` (id `22127928`, name `protect`) has `conditions.ref_name.include = ["~ALL"]` with rule `deletion` — protecting *every* branch from deletion. Needs to protect the default branch only.

**How.** From a `gh` session authenticated as `prashantkothari` (or the GitHub UI at `https://github.com/prashantkothari/ai-native-test-reliability/rules/22127928` → Targets → Branch targeting criteria → Include: Default branch):

```bash
gh api --method PATCH repos/prashantkothari/ai-native-test-reliability/rulesets/22127928 \
  --input - <<< '{"conditions":{"ref_name":{"include":["~DEFAULT_BRANCH"],"exclude":[]}}}'
```

**Blocks.** T2.

### T2 — Delete the 8 stale merged remote branches (Doable, once T1 is done)

**What.** 8 branches on `prashantkothari/ai-native-test-reliability` remote whose content is fully on `main`:
`claude/ai-native-test-reliability-011333`, `claude/github-commits-not-pushing-632a19`, `claude/p1-slice`, `clean-tracked-artifacts`, `consolidated-main`, `fix-remaining-lib-refs`, `post-merge-review`, `preserve-research-docs`, `sever-preflight7-dependency`, `task-list` (this branch, after merge).

**How.** Once T1 is done (Owner-only), the below can be run under any account with push:

```bash
for b in claude/ai-native-test-reliability-011333 claude/github-commits-not-pushing-632a19 \
         claude/p1-slice clean-tracked-artifacts consolidated-main fix-remaining-lib-refs \
         post-merge-review preserve-research-docs sever-preflight7-dependency; do
  git push https://github.com/prashantkothari/ai-native-test-reliability.git --delete "$b"
done
```

I can run this myself once T1 is done.

### T3 — Update `/Users/prashant`'s stale local `main` pointer (Decision — user only)

**What.** `/Users/prashant` (the actual home directory, checked out as a git worktree of the shared `.git`) has local `main` frozen at `3c40abe` from 2026-09-10 and 15+ uncommitted deletions in its working tree (13 days of normal Claude Code config drift). Nothing from today's work touched it; it predates the consolidation entirely.

**Why decision-only.** This is your live `$HOME`. Editing branch pointers or discarding the uncommitted deletions could damage your daily workflow. You'll want to `cd /Users/prashant && git status` yourself, review the drift, decide what to keep, then either commit it or stash-and-checkout to align with the new remote main.

**Not blocking anything.** Everything else in the repo/session flow works fine with `/Users/prashant` in its current state.

---

## Correctness gap (should ship before calling anything "done")

### T4 — Full trial run against target_repo (Probe 2b) — Blocked on target-app decision

**What.** Every planning/review doc says the merge is verified *except* for the end-to-end trial run. `experiment/report/*.md` disagrees with itself about which target: older reports cite Excalidraw `e1bb9ff8`, phase-r/phase-s reports moved to n8n with no fixed pin recorded on main.

**How.** Pick one target app + SHA, `git clone` it into `experiment/target_repo/`, then:

```bash
cd experiment
npm install
node harness/bundle-library.js
node harness/run_trials.js
```

Then verify `logs/trials.jsonl` shows `sum(false_heal) == 0`.

**Decision embedded.** Which target and which SHA? Options I can see from history:
- Excalidraw @ `e1bb9ff8f8931e783c11d104abb8967ac6605c9a` — what the older P1/P2 reports used
- n8n @ some SHA — what phase-s reports used; the exact SHA is not captured on main today

Whichever you pick, the SHA should be recorded in a new committed file like `experiment/TARGET_REPO_SHA`, mirroring `SELFHEAL_VERSION`, so it's reproducible.

### T5 — Wire `npm test` in `experiment/package.json` (Doable)

**What.** A customer runs `npm test` today and gets `Error: no test specified`. Trivial to fix.

**How.** Change `experiment/package.json`'s `scripts.test` to at least `node harness/translate-locator.test.js`. Ideally also chain the wiki tests: `test:translator && test:dual_mode && test:selfheal_version`. Small PR.

### T6 — Wire the 6 vendored self-heal test HTMLs to a runnable test target (Doable)

**What.** We vendored 6 test HTMLs (`self-heal/tests/*.html`, `self-heal/schemas/tests.html`, `self-heal/brain/tests.html`, `self-heal/pipeline/lever-tests.html`) but nothing runs them. They're per-module regression coverage — currently dead weight.

**How.** Either (a) add a tiny `python3 -m http.server` + Playwright headless runner that opens each and reads the pass/fail count, or (b) skip them and document why in `wiki/files.md`. My recommendation: (a), lands as a new script `experiment/harness/run_module_tests.mjs`. ~40 lines.

---

## Customer-facing polish (decisions the repo owner should make)

### T7 — `.claude/` at repo root — keep or strip? (Decision)

**What.** Root `.claude/` contains Claude Code session config + Matt-Pocock skills. First-time customer clones see it right next to `README.md` and wonder if it's required. Post-merge review §2.2 flagged this.

**Options.**
- (a) Keep as-is — it's genuinely useful dev tooling for anyone continuing to work on this repo with Claude Code. Add a one-line note in README explaining "these are optional dev tooling; ignore if you're not using Claude Code."
- (b) Move to a separate `dev-tooling/` prefix or a private repo.
- (c) Delete — you can always regenerate skill files.

### T8 — `experiment/logs/trials.jsonl` — dev-machine paths (Decision)

**What.** Baked-in `/Users/prashant/Documents/playwright_middleware/.claude/worktrees/…` paths in the committed evidence data. Cited by 10 reports as historical evidence but also truncated by every `npm run trial` invocation.

**Options.**
- (a) Move to `experiment/report/trials-archive.jsonl` (out of the runner's write path), leave paths as-is (they're historical, don't pretend otherwise).
- (b) Scrub paths in place using a small script, keep in `logs/`.
- (c) Delete — reports lose their raw-data backing.

My leaning: (a). Historical evidence should not sit in the runner's write path.

### T9 — LICENSE file (Decision)

**What.** No `LICENSE` in either `prashantkothari/ai-native-test-reliability` or `prashantkothari/ai-for-qa`. GitHub defaults to "all rights reserved" — this is technically fine for self-owned code but blocks any future outside contribution.

**Options.**
- MIT — most permissive, most common for tooling libraries
- Apache 2.0 — includes explicit patent grant, better for enterprise adoption
- BSL / SSPL — restrictive if you want to prevent SaaS resale
- Keep unlicensed (default) — status quo

### T10 — History rewrite for the 6.1 MB trace zips (Decision — mildly destructive)

**What.** Post-merge-review §7 recommendation. PR #4 removed them from the tip but the blobs remain in git history. `git filter-repo --path experiment/logs/traces --invert-paths --force` + force-push to main actually shrinks clone size for future clones. 6.1 MB isn't egregious — this is a cost/benefit judgment.

**Trade-off.** Force-push to main breaks anyone with an existing clone, requires ruleset temporarily off (which needs T1 done first anyway), leaves prior commit SHAs unstable.

### T11 — Statefarm-dashboard mockup on archived `preflight7/ai-for-qa` (Decision)

**What.** One unique commit on archived `preflight7/ai-for-qa:claude/statefarm-health-dashboard-0f8363` — a state-farm-specific CSM account-health dashboard mockup (3 files, ~1 commit). Per "different apps for different customers," probably shouldn't cross into the current customer's testing repo, but flagging just in case you want to preserve it somewhere else.

---

## Repo-hygiene follow-ups (low priority, ship at your leisure)

### T12 — Reconcile report/*.md internal contradictions

**What.** Reports cite `libSha: 599dca1c` while `SELFHEAL_VERSION` is now `dc5a87f` (see post-merge review §5 item 8). Reports also cite `logs/trials.jsonl:5-8` line ranges into a truncate-on-run file. Reading multiple reports in sequence exposes contradictions.

**Options.**
- Add a `Historical libSha` header table to each report (2 lines per file).
- Or: fold everything into a single canonical `experiment/report/README.md` that reconciles.

### T13 — Session archiving (Doable)

**What.** 17 stale `playwright-middleware`-group Claude Code sessions with dead worktrees. All their code is on `main` via the consolidation. I can bulk-archive them via `mcp__ccd_session_mgmt__archive_session`.

### T14 — Add basic CI (Doable)

**What.** Currently no CI. Even a minimal GitHub Actions workflow running `wiki/tests/run.sh` and `node harness/translate-locator.test.js` on every push to main would catch regressions the next contributor might miss.

**How.** Small `.github/workflows/test.yml`, ~30 lines.

### T15 — `wiki/tools/sync.sh` weekly cron (Doable)

**What.** `wiki/tools/sync.sh` exists and is already correct (bumps `Last-verified:` header, sets `Drift-open:`, writes `wiki/.sync-status`), but no scheduler runs it. Reference in README says "Weekly wiki sync. Runs in CI + locally" but no CI is wired.

**How.** Add to the same GitHub Actions workflow as T14 on a `schedule:` trigger.

---

## Explicit non-goals (naming these so they don't quietly slip back in)

- **NOT rewriting ai-for-qa upstream** — Finder-duplicate cleanup, vendor-name comment scrubbing, per-key-heal-policy PR back to prashantkothari — all remain upstream problems.
- **NOT fixture-app swap for Excalidraw/n8n** — decided earlier as Option C; target_repo stays as an external checkout.
- **NOT upgrading past `dc5a87f`** — pin stays; explicit decision needed to bump.
- **NOT touching `/Users/prashant`'s working-tree drift** — that's daily Claude Code use, unrelated to this consolidation.

---

## Recommended execution order

If you want a single reasonable path forward, roughly:

1. **T1** (5 min, owner only) → unblocks T2.
2. **T2** (1 min, delegable) → clean remote.
3. **T4 decision** — pick target app + SHA. Then I can run T4 end-to-end.
4. **T5, T6, T14, T15** as one PR — turns `npm test` into a real thing, wires CI, gets weekly sync running.
5. **T7, T8, T9** — three decisions, then execute.
6. Everything else (T10, T11, T12, T13) is optional / at leisure.

I can execute any of T2, T4 (given a target), T5, T6, T12, T13, T14, T15 as PRs without further input. T1 and T3 are yours only. T7–T11 need your decision before I proceed.
