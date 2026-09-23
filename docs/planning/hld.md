# HLD — Consolidated Repo Design (post-merge target)

**Scope.** The target state for the merged repo: one repo, no submodule, ai-for-qa's needed files at their natural paths, harness code alongside them, wiki/ documenting both design intent and as-is behavior. This doc is the *to-be* companion to `execution-flow.md`'s *as-is*.

**Locked-in assumptions (from prior turns).**
- **A1.** ai-for-qa code lands at natural paths at repo root — no `vendor/` prefix.
- **A2.** Vendoring scope: 13 code files + `self-heal/docs/{ARCHITECTURE, FAILURE-TAXONOMY, PILOT-RESULTS}.md` + `self-heal/benchmark/*` (5 files) + `self-heal/schemas/validator.js` (needed by run_trials.js's vm-context load, not in original bundle-library list — surfaced by grep this session).
- **A3.** `target_repo/` (Excalidraw) is a gitignored external checkout. README documents the setup step.
- **A4.** Pinned lib identity = `599dca1c`. Preserved via a new `SELFHEAL_VERSION` marker file so that `libSha` in flywheel-event rows remains a *library* identity, not a monorepo-wide identity (see cross-cutting concerns below).
- **A5.** New wiki docs sit *alongside* the "planned" `wiki/architecture.md`, not replacing it. Cross-linked.

## File tree — merged monorepo layout

```
playwright_middleware/                    (repo root)
├── README.md                             ← from ai-native-test-reliability, adapted to describe
│                                          the consolidated repo (not just the P1 slice)
├── AGENTS.md                             ← from claude/code-wiki-repo-setup-8dbc46
├── CLAUDE.md                             ← from claude/code-wiki-repo-setup-8dbc46 + prepend note:
│                                          "continue on <canonical-branch>, do not branch from main"
├── package.json                          ← from experiment-only (name may need renaming;
│                                          current name is "ai-native-test-reliability-slice1")
├── .gitignore                            ← extended: adds target_repo/, logs/, node_modules/
├── .claude/                              ← Claude Code config + Matt-Pocock skills (from main)
│   ├── settings.json
│   └── skills/
│       ├── diagnose/SKILL.md
│       ├── grill-me/SKILL.md
│       ├── pattern-promoter/SKILL.md
│       ├── plan-template/SKILL.md
│       ├── redteam/SKILL.md
│       ├── session-codify/SKILL.md
│       ├── ship/SKILL.md
│       └── .deleted/2026-06-11/*         ← retired code-review-* skills, kept as history
│
├── selfheal-core.js                      ← from ai-for-qa root (the matcher core)
├── SELFHEAL_VERSION                      ← NEW: contains "599dca1c" as opaque library-identity
│                                          string; run_trials.js reads this in place of
│                                          `git -C lib rev-parse HEAD` (see cross-cutting)
│
├── self-heal/                            ← from ai-for-qa (natural paths, no prefix)
│   ├── README.md                         ← module hierarchy + load order + status table
│   ├── schemas/
│   │   ├── false-heal.js                 ← single-source gate decision
│   │   ├── flywheel-event.schema.js      ← row schema (dual-mode: browser + vm-context)
│   │   └── validator.js                  ← REQUIRED by run_trials.js (vm-context load)
│   ├── pipeline/
│   │   ├── candidate-generation.js       ← SELFHEAL_CANDGEN
│   │   ├── candidate-validation.js       ← SELFHEAL_VALIDATE
│   │   ├── change-diagnosis.js           ← SELFHEAL_DIAGNOSIS
│   │   ├── failure-reporter.js           ← SELFHEAL_REPORTER
│   │   ├── outcome-verification.js       ← SELFHEAL_VERIFY
│   │   ├── temporal-wait.js              ← SELFHEAL_TEMPORALWAIT
│   │   ├── search-and-pick.js            ← SELFHEAL_SEARCHPICK (standalone; not yet wired)
│   │   └── learning-loop.js              ← SELFHEAL_LEARN (P2/P3 stub — throws if called)
│   ├── brain/
│   │   └── brain.js                      ← SELFHEAL_BRAIN (verify-gated cache)
│   ├── pretotype/
│   │   └── selfheal-runtime.js           ← __RUNTIME (S7 executor prototype)
│   ├── docs/
│   │   ├── ARCHITECTURE.md               ← 8-stage loop, canonical
│   │   ├── FAILURE-TAXONOMY.md           ← 9 patterns + 7 categories, empirical basis
│   │   └── PILOT-RESULTS.md              ← "STATUS: AWAITING DATA" — kept as-is
│   └── benchmark/
│       ├── BENCHMARK-RUN.md
│       ├── baseline.json
│       ├── corpus.js
│       ├── eval-gate.html
│       └── eval-gate.js
│
├── harness/                              ← from experiment-only / feature/three-gaps
│   ├── bundle-library.js                 ← LIB path change: `../lib` → `..` (repo root)
│   ├── selfheal-playwright-runtime.js
│   ├── translate-locator.js
│   ├── translate-locator.test.js
│   ├── run_trials.js                     ← libSha source change: git submodule → SELFHEAL_VERSION
│   ├── score.js
│   ├── capture-fixture.mjs
│   ├── inspect-anchor.mjs
│   ├── scout-help.mjs
│   ├── scout-iframe.mjs
│   └── scout-menu.mjs
│
├── fixtures/
│   └── authored-test.json
│
├── mutations/
│   ├── prep_aria.patch
│   ├── mut_A1.patch
│   ├── mut_A2.patch
│   ├── mut_A3.patch
│   ├── mut_B1.patch
│   └── mut_B2.patch
│
├── logs/                                 ← gitignored (runtime output)
│   ├── .gitkeep
│   └── (trials.jsonl, screenshots/, selfheal-bundle.js — all runtime)
│
├── report/
│   ├── PLAN.md
│   ├── p1_results.md                     ← measured against Excalidraw @ e1bb9ff8, lib @ 599dca1c
│   ├── p1_v2_results.md
│   ├── p1_redteam.md
│   ├── p2_results.md
│   ├── three_gaps_closed.md
│   └── gap_E_control_flow.md
│
├── docs/                                 ← NEW: reorganize the awkward "Documents/playwright_middleware/"
│   └── architecture-v1.md                ← was Documents/playwright_middleware/SELF_HEAL_ARCHITECTURE_v1.md
│                                          (wiki/architecture.md's ../-link updated to match)
│
├── wiki/                                 ← from claude/code-wiki-repo-setup-8dbc46, extended
│   ├── INDEX.md                          ← index updated to list new docs
│   ├── README.md                         ← trust rule, freshness headers
│   ├── architecture.md                   ← the "planned" 8-stage design doc (unchanged)
│   ├── execution-flow.md                 ← NEW (Step 1 output)
│   ├── hld.md                            ← THIS DOC (Step 2 output)
│   ├── files-comparison.md               ← NEW (Step 3 output)
│   ├── plan-reconciliation.md            ← NEW (Step 4 output)
│   ├── merge-plan-v2.md                  ← NEW (Step 5 output)
│   ├── redteam-pass.md                   ← NEW (Step 6 output)
│   ├── files.md                          ← path → purpose → status for the merged tree
│   ├── glossary.md
│   ├── glossary.terms
│   ├── CHANGELOG.md                      ← append-only edit log
│   ├── tests/
│   │   ├── run.sh
│   │   ├── test_files_coverage.sh
│   │   ├── test_freshness.sh
│   │   ├── test_glossary_terms.sh
│   │   ├── test_links.sh
│   │   ├── test_no_duplication.sh
│   │   ├── test_size.sh
│   │   └── test_structure.sh
│   └── tools/
│       └── sync.sh
│
└── target_repo/                          ← GITIGNORED — user clones Excalidraw @ e1bb9ff8 here
                                            during setup (README documents the command)
```

**Total tracked files (estimate).** 13 (ai-for-qa code) + 3 (ai-for-qa docs) + 5 (benchmark) + 1 (validator) + 11 (harness) + 6 (mutations) + 1 (fixture) + 6 (reports) + 1 (PLAN) + 1 (architecture-v1) + ~15 (wiki) + ~8 (.claude/skills) + 5 (README/AGENTS/CLAUDE/package.json/.gitignore) + 1 (SELFHEAL_VERSION) ≈ **76 tracked files** in the consolidated repo. Compare: ai-for-qa alone was ~180 tracked files.

## API structure tree — every public export the harness can consume

Enumeration by file, in load order (matches `harness/bundle-library.js`).

### 1. `selfheal-core.js` → `window.SELFHEAL`

Confirmed via reading the tail of `selfheal-core.js` this session:
```js
const SELFHEAL = {
  DEF, DURA, TH,                          // weight tables + thresholds (heuristic constants)
  fuzzy, mv,                              // token/similarity helpers
  buildFromEx, scoreEx, verdict,          // scoring primitives
  predicted,                              // a-priori stability predictor
  WEB, IOS,                               // platform adapters (extract, actionable, ...)
  rank, match,                            // top-level candidate ranking + match wrapper
  looksHashed,                            // token-hygiene check
  bestLocator, flagOf,                    // selector emission + tier flag
  captureStep, descFromStep,              // step/descriptor authoring helpers
  isShown, isEnabled, resolveScope,       // element predicates
  diagnose,                               // failure-category classification
  matchStep,                              // ★ the runtime entry point used by harness
  verifyEffect,                           // verify-by-effect wrapper
  noAnchorVeto                            // safety veto for anchorless heals
};
```

**Consumed by harness (evidence: `selfheal-playwright-runtime.js:36-44`).**
- `SELFHEAL.matchStep(document, anchor, {gate: true})` → returns `{verdict, best, margin, via, diagnosis}`.
- `SELFHEAL.bestLocator(ex)` → returns `{sel, tier}`.

Not directly consumed but present via internal calls: `WEB.extract`, `WEB.actionable`, `scoreEx`, `rank`, `verdict`, `diagnose`, `noAnchorVeto`, `verifyEffect`, `isRealAnchor` (used by brain.js).

### 2. `self-heal/schemas/false-heal.js` → `window.SELFHEAL_FALSEHEAL`

```js
API = {
  isFalseHeal({verdict, expectedVerdict, resolvedIdentity, expectedIdentity}) -> boolean
};
```

**Contract (from file header, verbatim):** `false-heal = the matcher acted on the WRONG element`. Identity-based; `verdict==='heal' && expectedVerdict==='heal'` → true iff identities differ; `verdict==='heal' && expectedVerdict!=='heal'` → true (healed when it shouldn't). Any other verdict → false.

Called by: S4 benchmark classifier, S8 live executor (this harness's `run_trials.js` when populating the flywheel row's `false_heal` field).

### 3. `self-heal/schemas/flywheel-event.schema.js` → `window.SELFHEAL_SCHEMA_FLYWHEEL`

```js
API = {
  EVENT: <JSON-schema>,                   // flywheel-event/v1 shape
  VERSION: 'flywheel-event/v1'
};
```

**Required fields** (from schema body): `schemaVersion, ts, app, testId, outcome, verify_confidence, category, source`.
**Enums enforced:** `outcome ∈ {PASS, PASS_WARNING, FAILED, ABSTAIN}`; `verify_confidence ∈ {HIGH, MEDIUM, NONE, simulated}`; `source ∈ {live, simulated, manual}`.
**Gate field:** `false_heal: boolean` (must aggregate to 0).

Loaded twice per run: once in browser (via bundle), once in Node (via vm context in `run_trials.js`).

### 4. `self-heal/schemas/validator.js` → `window.SELFHEAL_VALIDATOR`

```js
API = {
  validate(row, schema) -> {valid: boolean, errors: [...]}
};
```

**Not in `bundle-library.js`'s file list** (this was surfaced by grep this session — I noticed `run_trials.js` line ~27 loads it via vm context separately). Missing this file breaks Node-side row validation but not browser-side matching. Landing this in the merge is a *silent requirement* — the current `bundle-library.js` file list is technically incomplete for Node-side use.

### 5-12. `self-heal/pipeline/*.js` → 8 SELFHEAL_* globals

Each pipeline module installs one global on window. Public surface per module (from file headers + API-CONTRACT sections):

| File | Global | Public API |
|---|---|---|
| `candidate-generation.js` | `SELFHEAL_CANDGEN` | `eliminate(cands, opts)`, `disambiguate(cands, step, opts)`, (P2 stubs: `temporalLocality`, `structuralDiff`) |
| `change-diagnosis.js` | `SELFHEAL_DIAGNOSIS` | `diagnoseFailure(matchResult, step, opts)` → 7-category label |
| `candidate-validation.js` | `SELFHEAL_VALIDATE` | `uniqueness(cand, doc)`, `roleCongruent(cand, step)`, (P2 stub: `costGate`) |
| `failure-reporter.js` | `SELFHEAL_REPORTER` | `reportFailure(matchResult, step)` → intelligent-failure message string |
| `outcome-verification.js` | `SELFHEAL_VERIFY` | `decide(before, after, expect)` → 3-way outcome (logic layer over `verifyEffect`) |
| `temporal-wait.js` | `SELFHEAL_TEMPORALWAIT` | lever for TEMPORAL category (P2 — not exercised in current harness) |
| `search-and-pick.js` | `SELFHEAL_SEARCHPICK` | `searchAndPick(doc, step, opts)` — widens scope. **STANDALONE**; not currently wired |
| `learning-loop.js` | `SELFHEAL_LEARN` | P2/P3 stub — **throws** if called, by design (prevent silent fake use) |

**Consumed directly by harness:** none of the pipeline modules. They run *inside* `SELFHEAL.matchStep` as pipeline stages, transparently to the harness.

### 13. `self-heal/brain/brain.js` → `window.SELFHEAL_BRAIN`

```js
makeBrain(seed) -> {
  get(testId, stepId, doc?)     -> {el, locator} | null   // returns null on cold miss OR
                                                          //   selector-no-longer-unique
  put(testId, stepId, verified) -> boolean                // gated on verified.confidence==='HIGH'
                                                          //   AND isRealAnchor(verified.locator)
  size() -> number,
  dump() -> plain object                                  // for persistence layers
}
isRealAnchor(sel) -> boolean                              // sel starts with '[' or '#'
```

**Consumed by harness:** optionally, via `__RUNTIME.executeLive(scopeEl, test, {brain, ladder})`. Current `run_trials.js` does NOT wire brain — this is P2 opt-in. Documented here because Step 3's file-comparison will reference it.

### 14. `self-heal/pretotype/selfheal-runtime.js` → `window.__RUNTIME`

```js
__RUNTIME = {
  executeLive(scopeEl, test, opts?) -> Promise<{steps: [rowLike, ...]}>
}
```

**Opts:** `{brain?, ladder?, expectedVerdicts?}`. When `brain` and `ladder` supplied AND ladder says step is at tier L2, tries brain.get() first; on hit, acts directly, skipping matchStep. Verify-by-effect *always* runs regardless of path.

**Not currently consumed by this harness's `selfheal-playwright-runtime.js`** — the harness reimplements the runtime loop in Node (delegating only `matchStep` + `bestLocator` to the browser). `__RUNTIME` is available in-page for a future consolidation.

## Cross-cutting concerns (the non-obvious plumbing)

### C1. libSha identity — the trap the merge creates

**Before merge:** `run_trials.js` derives `libSha` via `execSync('git -C lib rev-parse HEAD')`. This gives the specific ai-for-qa commit that authored the library code being tested. It's stable across harness-only changes.

**After merge (naive):** if `lib/` no longer exists as a submodule and we swap `git -C lib rev-parse` for `git rev-parse HEAD`, `libSha` becomes the monorepo SHA — which changes on every commit to any file. A README typo would rotate `libSha` in every subsequent flywheel row, destroying the training-substrate's identity property.

**Fix:** commit a `SELFHEAL_VERSION` file at repo root, containing a stable opaque marker (start value: `599dca1c` — the last upstream lib SHA the code was pulled from). Runner reads this file for `libSha`. Bump only when self-heal/* changes.

**Alt fix (more automatic):** compute `libSha = git log -1 --format=%H -- self-heal/ selfheal-core.js`. Advantage: no manual bump. Disadvantage: mixing self-heal internal-refactor commits with true "library-behavior" commits — a comment-only touch to self-heal/README.md would rotate libSha. The `SELFHEAL_VERSION` marker is more explicit about *intent* (this is a library version, bumped when behavior changes), which matches how library versioning normally works.

**Recommendation:** `SELFHEAL_VERSION` marker + a shell test in `wiki/tests/` that fails if the file is missing or empty. Landed in Step 5's merge plan.

### C2. Node-vs-Browser dual-mode files

Two files (`self-heal/schemas/flywheel-event.schema.js`, `self-heal/schemas/validator.js`) run in *both* Node (vm context load) and Browser (IIFE global install). Constraint: they must not import browser-only APIs (no `window.crypto`, no `document`, no `fetch`).

Current state: both files use the `(function(root){…})(typeof window !== 'undefined' ? window : globalThis)` pattern (verified in `false-heal.js` and `flywheel-event.schema.js` this session), which handles this correctly.

Merge risk: none, unless someone "modernizes" these files to ES modules. Landing a `wiki/tests/test_dual_mode.sh` that runs each file in a fresh `node -e "require('./self-heal/schemas/xxx.js')"` context would catch a regression.

### C3. Path changes in harness scripts

Two files need path updates:

**`harness/bundle-library.js` line 15:**
```js
const LIB = path.resolve(__dirname, '..', 'lib');    // BEFORE
const LIB = path.resolve(__dirname, '..');           // AFTER (repo root)
```

**`harness/run_trials.js` lines 22-31 (vm-context loader):**
```js
_loadLib('lib/self-heal/schemas/validator.js');       // BEFORE
_loadLib('self-heal/schemas/validator.js');           // AFTER

_loadLib('lib/self-heal/schemas/flywheel-event.schema.js');  // BEFORE
_loadLib('self-heal/schemas/flywheel-event.schema.js');      // AFTER
```

**`harness/run_trials.js` line 49 (libSha derivation):**
```js
const libSha = execSync('git -C lib rev-parse HEAD', {cwd:ROOT}).toString().trim();       // BEFORE
const libSha = fs.readFileSync(path.join(ROOT,'SELFHEAL_VERSION'),'utf8').trim();         // AFTER
```

### C4. .gitignore additions

```
# Runtime output
logs/*
!logs/.gitkeep

# External test target (see README setup)
target_repo/

# Node
node_modules/

# Playwright
test-results/
playwright-report/
```

### C5. package.json changes

- `name`: rename from `"ai-native-test-reliability-slice1"` → something reflecting the consolidated scope (e.g., `"self-heal-runner"`; user decision).
- No new dependencies. Playwright ^1.47.0 remains the only devDep.
- Scripts stay: `bundle`, `test:translator`, `trial`. Add `wiki:test` → `wiki/tests/run.sh` (already exists as a script).

## Wiki tree — content contract

Following the existing convention on `claude/code-wiki-repo-setup-8dbc46`:

- **`INDEX.md`** — one line per doc. New entries: `execution-flow.md`, `hld.md`, `files-comparison.md`, `plan-reconciliation.md`, `merge-plan-v2.md`, `redteam-pass.md`.
- **`README.md`** — trust rule ("wiki is advisory, not authoritative; verify vs source; sync-status gate at 14 days"), freshness headers.
- **`architecture.md`** — the 8-stage design-doc distillation (unchanged; existing).
- **`execution-flow.md`** — as-is what runs today (Step 1 output).
- **`hld.md`** — this doc (Step 2 output).
- **`files-comparison.md`** — local vs ai-for-qa file-by-file (Step 3 output).
- **`plan-reconciliation.md`** — deltas between Step 3 findings and existing merge plan (Step 4 output).
- **`merge-plan-v2.md`** — final merge plan v2, conforming to plan-template (Step 5 output).
- **`redteam-pass.md`** — combined redteam over all 5 docs (Step 6 output).
- **`files.md`** — path → purpose → status table for every tracked file in the consolidated repo.
- **`glossary.md` + `glossary.terms`** — Q1/Q2/Q3, T0–T3, K-numbers, failure taxonomy, HITL, verify-by-effect (existing convention).
- **`CHANGELOG.md`** — append-only edit log.
- **`tests/*.sh`** — 7 tests that enforce wiki structure (existing scripts). Should pass on the consolidated repo. `test_files_coverage.sh` may need updating to reflect the new file paths.
- **`tools/sync.sh`** — freshness sync script.

## Cynical review (internal redteam — Step 2)

1. **`validator.js` was hidden.** It's not in `bundle-library.js`'s explicit list, but `run_trials.js` demands it via vm-context. I only surfaced this by re-reading `run_trials.js` this turn. The prior plan (`make-an-experiment-plan-atomic-cocke.md`) claimed to vendor "the 13 files" — that count was wrong. Actual working set is **14 files** minimum. Anyone executing the prior plan literally as written would ship a broken repo whose Node-side row validation dies at `_loadLib('lib/self-heal/schemas/validator.js')`. Step 3's file-comparison MUST re-verify against the vm-context loader, not just `bundle-library.js`'s array.

2. **The SELFHEAL_VERSION marker is a new invariant that isn't automatically enforced.** Documented as a rule ("bump when self-heal/* changes"), but nothing prevents a future contributor from editing `self-heal/brain/brain.js` and forgetting the bump. That's a classic half-bridge (promise without gate) — same anti-pattern the plan-template explicitly calls out. Real fix: a pre-commit hook or `wiki/tests/test_selfheal_version.sh` that greps `git diff --name-only main…HEAD` for `self-heal/` changes AND `SELFHEAL_VERSION` changes; fails if one appears without the other. Land in Step 5.

3. **`__RUNTIME` and `SELFHEAL_BRAIN` are bundled but unused.** The harness bundles all 13 files but only calls into 2 (`matchStep`, `bestLocator`). The other 11 are inert cost. Not a merge blocker — bundle is small — but worth flagging: if a future Step decides to trim bundle size, half the surface can be dropped. Not this plan's decision.

4. **`search-and-pick.js` is marked STANDALONE / ADDITIVE** (from its own header). It exists in the load-order list but isn't wired to `matchStep`'s call graph. Vendoring it is technically dead code carriage. Trade-off: keeping it preserves the load-order shape (so a future wiring session doesn't need to change bundle-library.js), vs. shipping obviously-unused code. Recommend: keep, comment in `wiki/files.md` noting "not currently wired; retained for future S9 lever wiring."

5. **The wiki/tests/ scripts were designed against `wiki/architecture.md`'s content shape.** If those tests validate specific headings, section counts, or link patterns, they may fail on the new `wiki/execution-flow.md` and `wiki/hld.md` docs. Need to read the test scripts before Step 5's merge-plan to confirm. Flag: this is a lurking Step-5 debt, not a Step-2 blocker, but ignoring it would make the "wiki tests pass" verification of Step 5 dishonest.

6. **The `docs/architecture-v1.md` rename is a link break.** Every place that links to `Documents/playwright_middleware/SELF_HEAL_ARCHITECTURE_v1.md` (including `wiki/architecture.md`'s own first-line link, verified this session) breaks unless updated in the same commit. Step 5 must audit `grep -r "Documents/playwright_middleware/SELF_HEAL"` before renaming.

7. **`report/*.md` reference "lib SHA a31ace4" (in p1_results.md) or "599dca1c" (later reports).** These are historical measurements; they should stay historical. But if the merge plan touches these files (e.g., search-replace `lib/` → `self-heal/` in paths cited within reports), it modifies the historical record. Rule for Step 5: report/* is **read-only** during the merge — no path rewrites, even if the paths cited become slightly stale (add a footnote in the report if needed).

## Assumptions to validate before Step 3

- **A6.** `wiki/tests/*.sh` scripts don't validate file paths that would break on the new file tree. **Verify in Step 3 by reading each test script.**
- **A7.** No other file in the local repo cites `lib/` as a path (besides the two already identified in `bundle-library.js` and `run_trials.js`). **Verify in Step 3 by `git grep -n "lib/"` across all local branches.**
- **A8.** The 5 files in `self-heal/benchmark/` don't have transitive dependencies outside their directory (e.g., they don't reference `../ui/` mockups or `../tools/` scripts). **Verify in Step 3 by grepping benchmark/*.js for `../` imports and references.**
- **A9.** `harness/*.mjs` scout scripts (`scout-help`, `scout-menu`, `scout-iframe`) don't have hidden dependencies on target_repo being at a specific path. Their purpose is inspecting a running target; they probably tolerate any target. **Verify in Step 3.**

## Open questions for the user (before Step 3)

- **Q4.** `package.json` `name` field currently reads `"ai-native-test-reliability-slice1"`. What should it be after consolidation? Options: `"self-heal-runner"`, `"playwright-middleware"`, `"self-heal-experiment"`, or something else you want.
- **Q5.** The rename `Documents/playwright_middleware/SELF_HEAL_ARCHITECTURE_v1.md` → `docs/architecture-v1.md`: is that OK, or should the file stay where it is to avoid breaking any external references you might have (bookmarks, other notes, links from outside this repo)?
- **Q6.** Should `.claude/skills/.deleted/2026-06-11/*` (the 7 retired code-review-* skills) be preserved in the consolidated repo, or is this a good moment to prune them?
