# Merge Plan v3 — Consolidate playwright_middleware + ai-for-qa

<!-- plan-template applied. Supersedes merge-plan-v2.md via redteam-pass.md's 5 blockers.
     Absorbs all 5 blocker fixes + 2 sub-item fixes. No back-references — self-contained. -->

**Changes vs v2 (headline):**
- File count corrected: 32 vendored (not 27). Manifest enumerates all 32.
- 3 new wiki-tests landed with concrete implementations: `test_selfheal_version.sh`, `test_selfheal_version_bump.sh`, `test_dual_mode.sh`.
- Probe 4 existence guards added (prevent silent-pass on missing file).
- `NOTICE.md` added at repo root recording vendor provenance.
- Rollback §5 rewritten with LIFO discipline + full-reset alternative.
- Probe 1 split into 1a (byte-diff) + 1b (semantic check via translate-locator.test.js).
- `vendor-scrub.sh` documented as vendor-time-only, not CI/pre-commit.

## 0. Pre-flight (grep before referencing — HARD GATE)

**Vendoring manifest — 32 files from ai-for-qa @ `599dca1c`, exhaustively enumerated:**

*Code (13):*
- `selfheal-core.js` — matcher core, `window.SELFHEAL`
- `self-heal/schemas/false-heal.js` — `SELFHEAL_FALSEHEAL`, the gate
- `self-heal/schemas/flywheel-event.schema.js` — `SELFHEAL_SCHEMA_FLYWHEEL`
- `self-heal/pipeline/{candidate-generation,change-diagnosis,candidate-validation,failure-reporter,outcome-verification,temporal-wait,search-and-pick,learning-loop}.js` — 8 files
- `self-heal/brain/brain.js` — `SELFHEAL_BRAIN`
- `self-heal/pretotype/selfheal-runtime.js` — `__RUNTIME`

*Node-side dependency (1, missed by original plan; surfaced in HLD):*
- `self-heal/schemas/validator.js` — `SELFHEAL_VALIDATOR`, loaded via vm-context in `harness/run_trials.js`

*Benchmark deps (2, surfaced in files-comparison):*
- `self-heal/pretotype/fixtures.js` — login-screen DOM fixtures, loaded by eval-gate.html
- `self-heal/pretotype/payment-fixtures.js` — checkout DOM fixtures

*Docs (3, per Q3):*
- `self-heal/docs/{ARCHITECTURE,FAILURE-TAXONOMY,PILOT-RESULTS}.md`

*Benchmark (5, per Q3):*
- `self-heal/benchmark/{BENCHMARK-RUN.md,baseline.json,corpus.js,eval-gate.html,eval-gate.js}`

*Tests (8 files, per grill-tested decision):*
- `self-heal/brain/tests.html`
- `self-heal/schemas/tests.html`
- `self-heal/tests/adversarial-validation.html + adversarial-validation-tests.js` — pair
- `self-heal/tests/candidate-widening.html + candidate-widening-tests.js` — pair
- `self-heal/pipeline/lever-tests.html + lever-tests.js` — pair

**Total: 13 + 1 + 2 + 3 + 5 + 8 = 32 files.**

**Verified this thread:**
- `git ls-tree experiment-only -- lib` → gitlink `599dca1c56d55e35b11af289932e0d3a64413299`
- `git merge-base --is-ancestor 599dca1c a31ace4` → exit 1 (fork-only commit)
- 8 files, 15 hit-lines on `claude/code-wiki-repo-setup-8dbc46` reference `Documents/playwright_middleware/` (enumerated in §3 rename block)
- 2 hits in `feature/three-gaps:experiment/harness/run_trials.js` lines 31-32 for `lib/`
- `gh api repos/prashantkothari/ai-for-qa/license` → 404; `gh api repos/preflight7/ai-for-qa/license` → 404; both repos public. Self-vendoring inferred from userEmail = prashant.kothari@gmail.com owning both source and destination — but `NOTICE.md` lands regardless for provenance.

**Re-verify at plan-execution time (§0 probes before any code touch):**
- `test -f self-heal/schemas/validator.js` in the fetched `599dca1c` tree — must exist
- `git ls-remote https://github.com/prashantkothari/ai-for-qa.git 599dca1c` — SHA still fetchable
- `wc -l wiki/tools/sync.sh` — non-empty (deferred sanity check per Q10)
- For each of the 8 test files: `test -f` in the fetched tree — must exist. Any missing test = adjust manifest or investigate upstream.

## 1. Context

**What we're trying to do.** Consolidate ai-for-qa's needed 32 files directly into the local monorepo at natural paths (no submodule, no `vendor/` prefix). Ship one repo containing library code + harness + docs + wiki + tests + provenance, pushable to a new GitHub remote (Option A). ai-native-test-reliability is skipped (near-duplicate of local `experiment-only`; nothing to port).

**Why now.** User is about to push real work to a fresh remote. Delaying accumulates more branch sprawl (30 local branches, 8 all claiming to be tip of same experiment lineage).

**Scope (in).**
- Vendor 32 files at natural paths.
- Ship `SELFHEAL_VERSION` marker file (value: `599dca1c`) — anchors flywheel-row `libSha` identity.
- Ship `tools/vendor-scrub.sh` — sentinel-file idempotent, vendor-time-only.
- Ship `NOTICE.md` at repo root — vendor provenance record.
- Ship 3 new wiki-tests (see §2 for concrete implementations).
- Rename `Documents/playwright_middleware/SELF_HEAL_ARCHITECTURE_v1.md` → `docs/architecture-v1.md`, update 15 inbound links across 8 files.
- Update 3 harness paths (`bundle-library.js` LIB, `run_trials.js` `_loadLib` × 2, libSha derivation).
- Update `.gitignore` for `target_repo/`, `logs/*`, `node_modules/`.
- Add `README.md` at repo root (adapted from ai-native-test-reliability, plus target_repo setup + report-prose-caveat).
- Consolidate 8 experiment-lineage branches into `consolidated-main` (per Q; canonical = `claude/ai-native-test-reliability-011333`).
- Push consolidated branch to new remote. Named branch first, PR to `main`.
- Archive (not delete) ai-native-test-reliability after S5 confirms parity.

**Non-goals.**
- Not rewriting ai-for-qa upstream.
- Not fixture-app swap for Excalidraw (Option C decided).
- Not upgrading past `599dca1c`.
- Not landing CI.
- Not adding a LICENSE file — flagged as user's decision, not blocking this merge.
- Not pruning the 20 non-experiment local branches — cleanup after S5.

**Constraints.** No wall-clock budget stated. Reversibility is binding: every step is plain git with obvious undo. No force-push, no history rewrite of any GitHub repo. Sentinel discipline for scrub. LIFO rollback discipline.

## 1.5 Ordering — 80/20 risk × value

| Session | Surgical layers | Read-only? | Value | Risk | Reversibility | Order |
|---|---|---|---|---|---|---|
| S0. Branch-lineage audit | none (git log/diff only) | Y | 5 | 1 | N/A | 1 |
| S1. Consolidate 8 lineage branches → `consolidated-main` | 1 branch × merge-commits | N | 5 | 2 | `git reset` or branch delete | 2 |
| S2. Vendor 32 files + run scrub | 32 new files, 1 tool script | N | 5 | 2 | git revert commit | 3 |
| S3. Wiring: harness edits, SELFHEAL_VERSION, rename, .gitignore, README, NOTICE, wiki updates, 3 new wiki-tests | ~10 edits, 3 renames, 8 new files | N | 4 | 3 | git revert commit (LIFO after S2) | 4 |
| S4. Verification pass | none (read-only checks) | Y | 5 | 1 | N/A | 5 |
| S5. Push to new remote | remote:config, 1 branch push | N | 5 | 1 | remote branch delete | 6 |
| S6. Archive ai-native-test-reliability | repo settings only | N | 2 | 1 | un-archive | 7 (gated on S5) |

## 2. Mock execution

**Files to touch (net):**

*Adds (new files, ~44 total):*
- 32 vendored files (§0 manifest)
- `SELFHEAL_VERSION` (1 file, 1 line: `599dca1c`)
- `NOTICE.md` at repo root (~20 lines, vendor provenance) — **NEW in v3**
- `tools/vendor-scrub.sh` (~35 lines, sentinel-checked, vendor-time-only per docstring)
- `tools/.vendor-scrubbed` (sentinel; gitignored)
- `README.md` at repo root (~55 lines: purpose + setup + target_repo clone step + lib/-in-reports caveat)
- `AGENTS.md`, `CLAUDE.md` at repo root (from wiki-setup branch; CLAUDE.md prepended with 1-line canonical-branch rule)
- 6 new wiki docs: `execution-flow.md`, `hld.md`, `files-comparison.md`, `plan-reconciliation.md`, `merge-plan-v3.md` (this doc), `redteam-pass.md`
- 3 new wiki-tests: `test_selfheal_version.sh`, `test_selfheal_version_bump.sh`, `test_dual_mode.sh` — **NEW in v3**
- `logs/.gitkeep` (keeps `logs/` in tree though contents gitignored)

*Renames:*
- `Documents/playwright_middleware/SELF_HEAL_ARCHITECTURE_v1.md` → `docs/architecture-v1.md`

*Removes:*
- `.gitmodules`, `lib/` gitlink

*Edits:*
- `harness/bundle-library.js` — 1 line: `LIB = path.resolve(__dirname, '..')`
- `harness/run_trials.js` — 4 lines: 2× `_loadLib()` path prefix, 1× libSha via SELFHEAL_VERSION, 1× target_repo missing-check
- `wiki/INDEX.md` — line 6 path update + 6 new doc entries
- `wiki/README.md` — line 16 link update
- `wiki/architecture.md` — line 3 link update
- `wiki/files.md` — full rewrite
- `wiki/tests/{test_files_coverage,test_no_duplication,test_size}.sh` — path updates (3 files)
- `wiki/tools/sync.sh` — path update (lines 16, 28)
- `PLAN.md` — 1-line update
- `package.json` — `name` → `"self-heal-runner"`
- `.gitignore` — 5-line append
- `wiki/CHANGELOG.md` — append 1 line per session

### §2.a Concrete wiki-test implementations (new in v3)

**`wiki/tests/test_selfheal_version.sh`:**
```bash
#!/usr/bin/env bash
# Asserts SELFHEAL_VERSION exists at repo root, non-empty, and contains a valid git SHA prefix.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

f=SELFHEAL_VERSION
[[ -f "$f" ]] || { echo "  missing: $f"; exit 1; }
[[ -s "$f" ]] || { echo "  empty: $f"; exit 1; }

content=$(tr -d '[:space:]' < "$f")
if ! [[ "$content" =~ ^[0-9a-f]{7,40}$ ]]; then
  echo "  invalid SHA in $f: '$content'"
  exit 1
fi
echo "  ok: $f = $content"
```

**`wiki/tests/test_selfheal_version_bump.sh`:**
```bash
#!/usr/bin/env bash
# If self-heal/* or selfheal-core.js changed since main, SELFHEAL_VERSION must also have changed.
# Enforces the "bump-on-library-change" invariant that keeps libSha meaningful.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# Only meaningful when we're comparing HEAD to main
base=$(git merge-base HEAD main 2>/dev/null || git rev-list --max-parents=0 HEAD | tail -1)

lib_changed=$(git diff --name-only "$base"..HEAD -- self-heal/ selfheal-core.js | wc -l)
ver_changed=$(git diff --name-only "$base"..HEAD -- SELFHEAL_VERSION | wc -l)

if (( lib_changed > 0 && ver_changed == 0 )); then
  echo "  FAIL: self-heal/ or selfheal-core.js changed vs $base without a SELFHEAL_VERSION bump"
  echo "  files changed:"
  git diff --name-only "$base"..HEAD -- self-heal/ selfheal-core.js | sed 's/^/    /'
  exit 1
fi
echo "  ok: lib_changed=$lib_changed ver_changed=$ver_changed"
```

**`wiki/tests/test_dual_mode.sh`:**
```bash
#!/usr/bin/env bash
# Asserts each dual-mode file (must run in both Node vm-context AND browser IIFE)
# loads cleanly under `node -e require(...)`. Catches an accidental browser-only API
# introduction (window.crypto, document., fetch) that would break the Node-side path.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

dual_mode_files=(
  self-heal/schemas/false-heal.js
  self-heal/schemas/flywheel-event.schema.js
  self-heal/schemas/validator.js
)

fail=0
for f in "${dual_mode_files[@]}"; do
  [[ -f "$f" ]] || { echo "  missing: $f"; fail=1; continue; }
  if ! node -e "require('./$f')" 2>/dev/null; then
    echo "  FAIL: $f cannot be require()'d from Node (likely browser-only API introduced)"
    fail=1
  else
    echo "  ok: $f"
  fi
done
exit "$fail"
```

### §2.b Concrete `tools/vendor-scrub.sh`:

```bash
#!/usr/bin/env bash
# VENDOR-TIME ONLY. Not for CI. Not for pre-commit.
# Redacts 6 vendor names from files that landed via ai-for-qa vendoring.
# Idempotent via sentinel at tools/.vendor-scrubbed (gitignored — fresh clones re-run scrub,
# which is a no-op since the source files are already redacted).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

SENTINEL=tools/.vendor-scrubbed
if [[ -f "$SENTINEL" && "${1:-}" != "--force" ]]; then
  echo "vendor-scrub: sentinel present ($SENTINEL); already run. Pass --force to re-run."
  exit 0
fi

FILES=(
  self-heal/pretotype/fixtures.js
  self-heal/pretotype/payment-fixtures.js
  self-heal/schemas/tests.html
  self-heal/tests/adversarial-validation-tests.js
  self-heal/tests/candidate-widening-tests.js
)

# Verify all files present before scrubbing anything
for f in "${FILES[@]}"; do
  [[ -f "$f" ]] || { echo "vendor-scrub: expected file missing: $f"; exit 1; }
done

# Portable sed -i (macOS + Linux). Word-boundary match on 6 known vendor names.
for f in "${FILES[@]}"; do
  # Use different delimiters and case-insensitive
  sed -E -i.bak 's/\b(testsigma|gong|amplitude|appsmith|immich|salesforce)\b/REDACTED/gI' "$f"
  rm -f "$f.bak"
done

mkdir -p tools
date -u +%Y-%m-%dT%H:%M:%SZ > "$SENTINEL"
echo "vendor-scrub: scrubbed ${#FILES[@]} files; sentinel written"
```

### §2.c `NOTICE.md` (new in v3):

```markdown
# NOTICE

This repository contains code vendored from other sources. Provenance recorded here so
future contributors know what came from where.

## Vendored from prashantkothari/ai-for-qa @ 599dca1c

- `selfheal-core.js`
- `SELFHEAL_VERSION` file records the pinned SHA
- `self-heal/**` — schemas, pipeline, brain, pretotype (selfheal-runtime.js, fixtures.js, payment-fixtures.js), docs, benchmark, tests
- Total: 32 files

Vendored at natural paths (no `vendor/` prefix) per user preference. Runtime consumption is
via `harness/bundle-library.js` which reads the 13 code files in a fixed load order.

**License note:** ai-for-qa (both `prashantkothari/ai-for-qa` and `preflight7/ai-for-qa` fork)
carries no LICENSE file as of 2026-09-21. Vendoring is treated as self-owned code
consolidation (source and destination are owned by the same user). A future contributor
adding a LICENSE to either repo should update this notice.

## Vendored from prashantkothari/ai-native-test-reliability

- `README.md` at repo root (adapted; only file with unique content vs. local `experiment-only`)
```

### §2.d Critical changes (pseudocode):

1. **S0 branch-lineage audit** (read-only, unchanged from v2).
2. **S1 branch consolidation** (unchanged from v2).
3. **S2 vendor + scrub:**
   ```
   git checkout consolidated-main
   AIFQA=$(mktemp -d)
   git clone https://github.com/prashantkothari/ai-for-qa.git "$AIFQA"
   (cd "$AIFQA" && git checkout 599dca1c)
   # verify probe files exist upstream before anything else
   for f in selfheal-core.js self-heal/schemas/validator.js self-heal/pretotype/fixtures.js \
            self-heal/pretotype/payment-fixtures.js self-heal/brain/tests.html \
            self-heal/schemas/tests.html self-heal/tests/adversarial-validation.html \
            self-heal/tests/adversarial-validation-tests.js \
            self-heal/tests/candidate-widening.html \
            self-heal/tests/candidate-widening-tests.js \
            self-heal/pipeline/lever-tests.html self-heal/pipeline/lever-tests.js; do
     [[ -f "$AIFQA/$f" ]] || { echo "manifest verification failed: $f"; exit 1; }
   done
   cp "$AIFQA/selfheal-core.js" .
   cp -r "$AIFQA/self-heal" .
   # PRUNE OUT-of-scope subtrees per files-comparison §3
   rm -rf self-heal/ui/ self-heal/panel/ self-heal/tools/
   rm -f self-heal/pretotype/{amplitude-report,flow-pretotype,opentest-*,payment-pretotype,report-viewer,testgen*,generic-report}*.{html,js}
   rm -f self-heal/pretotype/PRETOTYPE-RUN.md
   # commit vendor before scrub — makes the diff clean
   git add self-heal/ selfheal-core.js
   git commit -m "vendor: ai-for-qa @ 599dca1c (32 files, pre-scrub)"
   # write scrub tool + NOTICE
   cp <scrub-script-template> tools/vendor-scrub.sh
   chmod +x tools/vendor-scrub.sh
   cp <notice-template> NOTICE.md
   bash tools/vendor-scrub.sh    # sentinel-checked
   git add tools/vendor-scrub.sh NOTICE.md self-heal/  # scrubbed files show as edits
   git commit -m "vendor: run scrub + add NOTICE.md"
   ```
4. **S3 wiring** (in order, each a distinct commit for LIFO rollback):
   - Write `SELFHEAL_VERSION` with `599dca1c`; commit
   - Write 3 new wiki-tests (`test_selfheal_version.sh`, `test_selfheal_version_bump.sh`, `test_dual_mode.sh`) + `chmod +x`; commit
   - Rename `Documents/playwright_middleware/SELF_HEAL_ARCHITECTURE_v1.md` → `docs/architecture-v1.md`; commit
   - Update 15 inbound links across 8 files; commit
   - Edit `harness/bundle-library.js` (1 line); commit
   - Edit `harness/run_trials.js` (4 lines); commit
   - Delete submodule: `git submodule deinit lib; git rm -r lib; rm .gitmodules`; commit
   - Update `.gitignore`, add `logs/.gitkeep`; commit
   - Write `README.md`; commit
   - Copy `AGENTS.md`, `CLAUDE.md` from wiki-setup branch, prepend note; commit
   - Copy 6 wiki docs from scratchpad; commit
   - Rewrite `wiki/INDEX.md`, `wiki/files.md`; commit
   - Append `wiki/CHANGELOG.md`; commit
   - **After every 3-4 commits above, run `bash wiki/tests/run.sh` — fail-fast per v2 §Cynical #3.**

5. **S4 verification** (see §4 below for full checklist).
6. **S5 push** (unchanged from v2).
7. **S6 archive** (unchanged from v2).

**Most plausible bug (updated).** The vendor-scrub redacts a legitimate identifier because the regex catches it in an unintended context (e.g., a variable named `amplitudeThreshold` in test fixture code, which becomes `REDACTEDThreshold`). Probe 1b (below) catches this by running `harness/translate-locator.test.js` against the scrubbed bundle — if any test breaks, the scrub scope needs to narrow (whitelist known-safe filenames or use more restrictive context matching).

## 2.5 Probes (HARD GATE)

**Probe 1a — Bundle byte-reproducibility (S4).**
Pre-S2: run `npm run bundle` in the pre-merge submodule state, save `logs/selfheal-bundle.js` as `/tmp/selfheal-bundle.BASELINE.js`. Post-S3: re-run `npm run bundle`. `diff /tmp/selfheal-bundle.BASELINE.js logs/selfheal-bundle.js` — must be empty except for whitespace / line-endings. Non-empty diff = stop.

**Probe 1b — Post-scrub semantic check (S4, NEW in v3).**
`node --test harness/translate-locator.test.js` (or the equivalent invocation). Must pass. Verifies that vendor-scrub didn't redact a legitimate identifier that translate-locator.js relies on. If tests fail after scrub but passed before scrub, the scrub regex is too broad — narrow it.

**Probe 2a — Fresh-clone bundle (S4, NEW in v3, split from v2 Probe 2).**
`git clone /path/to/repo /tmp/smoke; cd /tmp/smoke; npm install; npm run bundle`. Success = no missing-file / no path errors. Does NOT require target_repo.

**Probe 2b — Full trial (S4, NEW in v3, requires user setup).**
After Probe 2a passes AND user has cloned target_repo per README: `npm run trial`. Produces `logs/trials.jsonl` with 0 total `false_heal=true` rows across at least the pristine trial. Explicitly opt-in — plan cannot verify this without user's target_repo clone.

**Probe 3 — Wiki-tests pass (S4).**
`bash wiki/tests/run.sh` — all tests PASS (7 original + 3 new = 10).

**Probe 4 — Vendor-scrub effectiveness (S2, UPDATED in v3 — existence guards).**
```bash
for f in self-heal/pretotype/fixtures.js \
         self-heal/pretotype/payment-fixtures.js \
         self-heal/schemas/tests.html \
         self-heal/tests/adversarial-validation-tests.js \
         self-heal/tests/candidate-widening-tests.js; do
  [[ -f "$f" ]] || { echo "PROBE 4 FAIL: expected file missing: $f"; exit 1; }
  hits=$(grep -icE '\b(testsigma|gong|amplitude|appsmith|immich|salesforce)\b' "$f")
  [[ "$hits" == "0" ]] || { echo "PROBE 4 FAIL: $f has $hits vendor-name hits"; exit 1; }
done
[[ -f tools/.vendor-scrubbed ]] || { echo "PROBE 4 FAIL: sentinel missing"; exit 1; }
echo "PROBE 4: pass"
```

## 3. Failure modes — 7-lens checklist (unchanged from v2 except lens 1, 6, 7)

1. **Data correctness — YES.** [As v2, plus:] `wiki/tests/test_selfheal_version.sh` now lands in §2, actually enforces the file's presence + shape. Not just documentation.

2. **Concurrency — N/A.** (unchanged)

3. **Auth / tenant isolation — N/A.** (unchanged)

4. **Performance — N/A.** (unchanged; 32 files still small)

5. **Deploy order — YES.** (unchanged from v2)

6. **Observability contract — YES.** [As v2, plus:] `wiki/tests/test_dual_mode.sh` catches regressions in flywheel-event.schema.js / validator.js / false-heal.js that would break Node-side row validation. Real gate, not documentation.

7. **Half-bridge recurrence — YES.** [As v2, plus:] `wiki/tests/test_selfheal_version_bump.sh` enforces the SELFHEAL_VERSION bump-on-library-change invariant. Landed in §2 with concrete implementation. Half-bridge closed.

**+ Lens 8: License / attribution (NEW in v3).** What could go wrong: vendoring 32 files without provenance record makes future contributors unable to trace lineage; a future ownership change (or third-party contribution) might create genuine license ambiguity. How we'd notice: nothing automated. Mitigation: `NOTICE.md` landed at repo root (§2.c) with source repo + SHA + note on self-owned status. If it happens anyway: NOTICE.md can be corrected via PR; the vendor SHA is stable and traceable via `SELFHEAL_VERSION`.

## 4. Verification (updated for v3)

Named, runnable checks at S4:

- **`git rev-parse consolidated-main`** — must exist (post S1)
- **`bash tools/vendor-scrub.sh`** — must exit 0; `tools/.vendor-scrubbed` present (post S2)
- **Probe 4** (with existence guards) — zero vendor-name hits, sentinel present (post S2)
- **`git ls-files 'lib*' '.gitmodules'`** — must return empty (post S3)
- **`bash wiki/tests/test_selfheal_version.sh`** — must PASS (NEW)
- **`bash wiki/tests/test_selfheal_version_bump.sh`** — must PASS (NEW)
- **`bash wiki/tests/test_dual_mode.sh`** — must PASS (NEW)
- **`bash wiki/tests/run.sh`** — all 10 tests PASS (7 original + 3 new)
- **`diff /tmp/selfheal-bundle.BASELINE.js logs/selfheal-bundle.js`** — empty (Probe 1a)
- **`node --test harness/translate-locator.test.js`** — pass (Probe 1b, semantic check)
- **Fresh-clone bundle** (Probe 2a) — succeeds
- **Full trial** (Probe 2b, requires user setup) — 0 `false_heal=true` rows
- **`test -f NOTICE.md && grep -q '599dca1c' NOTICE.md`** — must succeed (NEW)
- **`gh api repos/<new-owner>/<new-repo> --jq '.default_branch'`** — returns `main` (post S5 merge)
- **`gh repo view prashantkothari/ai-native-test-reliability --json isArchived`** — `{"isArchived": true}` (post S6)

## 5. Rollback (rewritten for v3 — LIFO discipline)

**Rollback rule: LIFO.** Revert commits in reverse chronological order. Never revert an earlier session's commit while a later session's dependent commit remains applied.

**Full-reset alternative (fastest, safest):**
- Before any commit lands in S2: `git checkout consolidated-main` — S0/S1 state is unchanged.
- After S2 but before S3: `git reset --hard <pre-S2-SHA>` fully undoes S2 in one operation.
- After S3 but before S5: `git reset --hard <pre-S2-SHA>` fully undoes S2 + S3.

**Per-commit revert (surgical, if only one session needs undoing):**
- S3 first, then S2, in that order. Never S2 alone while S3 is applied — S3 removed `lib/` submodule, so reverting S2 without also reverting S3 leaves the tree with no library at all (self-heal/ gone, lib/ gone).

**Worked example.** Probe 1a diff is non-empty at S4:
1. Investigate cause. If cosmetic (whitespace only) → not a rollback trigger.
2. If real content diff → decide whether to fix-forward (adjust wiring in S3) or roll back.
3. To fully undo: `git reset --hard <pre-S1-tip>` → drops consolidated-main entirely, returns to pre-merge state. No remote touched (S5 hadn't run). No collateral damage.

**Undoing S5 (push):**
- Named branch: `git push origin --delete consolidated-main`. Removes the branch from remote.
- PR merged to `main`: `git revert -m 1 <merge-SHA>` locally, force-push blocked by policy — instead open a "Revert merge" PR. Reversible via git history.

**Undoing S6 (archive):** GitHub un-archive is one-click.

**Unrecoverable state:** none. Deleting the ai-native-test-reliability GitHub repo is explicitly NOT in this plan (S6 is archive, not delete).

**Decision rule for triggering rollback:**
- Probe 1a diff non-empty, cause not immediately obvious → rollback S3 then S2, investigate.
- Probe 1b (semantic check) fails → scrub too broad, narrow scrub scope, redo S2.
- Probe 3 (wiki-tests) fails and can't be fixed in <1 hour → rollback S3, investigate.
- S5 PR review surfaces content the user didn't authorize → delete pushed branch, revisit.

## 6. Bug-pair check

Unchanged from v2. Two bugs (three-repo confusion + branch sprawl) are related-not-collapsible; the plan handles them sequentially (S1 → S5), which remains correct.

## 7. Cofounder pass

**N/A** — repository/build consolidation only. No HITL/UI surface affected.

## §Cynical review (internal redteam — merge-plan-v3, self-critique)

1. **Three new wiki-tests + one new lens + one new probe = plan grew ~15%.** More surface = more chances for a plan-execution mistake. Trade-off is correct (all additions close previously-open half-bridges) but merge-plan-v3 is denser than v2. If execution time budget matters, prioritize S2 + Probe 4 + Probe 1b — those are the actual correctness-critical additions; wiki-tests could ride as a follow-up commit if pressed for time.

2. **`test_selfheal_version_bump.sh` uses `git merge-base HEAD main`.** If the merge lands on a fresh remote where `main` is empty (unrelated history), `git merge-base HEAD main` returns nothing and the fallback (`git rev-list --max-parents=0 HEAD | tail -1` = root commit) treats the entire history as "the change." This over-fires initially — every self-heal/ file will appear "changed since root" and demand a VERSION bump on every commit. **Fix:** in S3, land the test AFTER the initial vendor commit + SELFHEAL_VERSION file — that way the invariant is "changed since we landed 599dca1c," and future PRs behave correctly. Document in test file header.

3. **`test_dual_mode.sh` runs `node -e "require(...)"` on each dual-mode file.** IIFE-wrapped `(function(root){…})(typeof window !== 'undefined' ? window : globalThis)` files are self-invoking — `require()` executes them. If the file references `window.crypto` inside the IIFE body, `require()` throws. Good. But: if the browser-only API is inside a lazy function that's not called at load time (e.g., inside an `isFalseHeal()` body), `require()` succeeds silently. **True dual-mode gate would need to invoke each exported function too.** Deferred as a follow-up hardening; the load-time check catches the most common regression (top-level `document.querySelector` etc.).

4. **The vendor-scrub script's sed is CASE-INSENSITIVE (`/gI`).** That means "Testsigma", "TESTSIGMA", "testSigma" all get redacted. Good for coverage; could over-match if a legit identifier collides with a vendor name in a different case. Probe 1b (semantic check) is the mitigation.

5. **Probe 4 uses `\b(name)\b` word-boundary.** `gong-analytics-adapter` would match on `\bgong\b`. `gong2` would NOT match (word boundary between `g` and `2` doesn't exist). Sufficient for the flagged files, but if future vendored files contain vendor names embedded in identifiers, the regex would need updating. Acceptable for the current scope; documented in scrub script header.

## §Assumptions unchanged from v2

- New GitHub remote empty (user creates before S5).
- `gh` CLI authenticated as `preflight7`.
- `599dca1c` still fetchable from prashantkothari/ai-for-qa.
- 8 experiment-lineage branches still present locally.
- No new work landed on those 8 branches since this plan was written.

## §Next-actions checklist (unchanged from v2 except license note)

- [ ] User creates empty GitHub repo for the new remote, notes URL.
- [ ] User confirms `SELFHEAL_VERSION` initial value = `599dca1c`.
- [ ] User confirms `LICENSE` decision (add to merged repo or skip — not blocking v3).
- [ ] Execute S0 → S6 in order, with commits + explicit verification pass after each.
- [ ] After S6: user decides fate of 20 non-experiment local branches.

<!-- merge-plan-v3 applied — 5 blockers + 2 sub-items absorbed from redteam-pass.md -->
