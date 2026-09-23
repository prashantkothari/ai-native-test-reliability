# Files Comparison — Local Monorepo vs ai-for-qa

**Purpose.** File-by-file comparison of the local monorepo (across its canonical branches) and `prashantkothari/ai-for-qa` (@ pinned SHA `599dca1c`). Feeds Step 5's merge plan by naming exactly which files land, which are skipped, and which have hidden dependencies not captured in Step 2's HLD.

**Method.** Every entry in this doc is backed by a `gh api` fetch or `git show/ls-tree/grep` command run this session. No claim is from memory.

**Two headline findings from the verification pass:**
1. **Vendoring count was undercalled by two.** Q3's "13 files + docs + benchmark harness" is missing (a) `self-heal/schemas/validator.js` (required by Node-side vm-context; surfaced in Step 2) and (b) `self-heal/pretotype/fixtures.js` + `self-heal/pretotype/payment-fixtures.js` (referenced by `benchmark/eval-gate.html`; surfaced this step). Real minimum working set = **17 files**.
2. **The wiki-test scripts hardcode `Documents/playwright_middleware/` in 3 places.** Renaming that directory (Q5 answered "yes") breaks `test_files_coverage.sh`, `test_no_duplication.sh`, and `test_size.sh` unless updated in the same commit.

## §1. Confirmed vendoring set (17 files + docs + benchmark)

### §1a. The 13 bundled code files (unchanged from bundle-library.js list)

| # | Source path in ai-for-qa | Global installed | Consumed by harness? |
|---|---|---|---|
| 1 | `selfheal-core.js` | `SELFHEAL` | YES (matchStep, bestLocator) |
| 2 | `self-heal/schemas/false-heal.js` | `SELFHEAL_FALSEHEAL` | YES (isFalseHeal via SELFHEAL_FALSEHEAL) |
| 3 | `self-heal/schemas/flywheel-event.schema.js` | `SELFHEAL_SCHEMA_FLYWHEEL` | YES (row schema validation) |
| 4 | `self-heal/pipeline/candidate-generation.js` | `SELFHEAL_CANDGEN` | Indirect (inside matchStep) |
| 5 | `self-heal/pipeline/change-diagnosis.js` | `SELFHEAL_DIAGNOSIS` | Indirect |
| 6 | `self-heal/pipeline/candidate-validation.js` | `SELFHEAL_VALIDATE` | Indirect |
| 7 | `self-heal/pipeline/failure-reporter.js` | `SELFHEAL_REPORTER` | Indirect |
| 8 | `self-heal/pipeline/outcome-verification.js` | `SELFHEAL_VERIFY` | Indirect |
| 9 | `self-heal/pipeline/temporal-wait.js` | `SELFHEAL_TEMPORALWAIT` | NOT wired (P2) |
| 10 | `self-heal/pipeline/search-and-pick.js` | `SELFHEAL_SEARCHPICK` | NOT wired (S9 lever, standalone) |
| 11 | `self-heal/pipeline/learning-loop.js` | `SELFHEAL_LEARN` | NOT wired (throws by design) |
| 12 | `self-heal/brain/brain.js` | `SELFHEAL_BRAIN` | NOT wired (P2 opt-in) |
| 13 | `self-heal/pretotype/selfheal-runtime.js` | `__RUNTIME` | NOT wired (harness has its own runtime) |

**Land-as target:** each at its natural path at repo root (no `vendor/` prefix, per Q3).

### §1b. Corrections — 4 files not in Q3's scope but demanded by the code

| # | Source path | Why needed | Blocking |
|---|---|---|---|
| 14 | `self-heal/schemas/validator.js` | `run_trials.js:31` loads it via vm-context for Node-side row validation | **YES — without it, `_loadLib()` throws, every trial dies before it runs** |
| 15 | `self-heal/pretotype/fixtures.js` | `benchmark/eval-gate.html` line 44: `<script src="../pretotype/fixtures.js">` | **YES for eval-gate.html to render**; not blocking for `harness/run_trials.js` |
| 16 | `self-heal/pretotype/payment-fixtures.js` | `benchmark/eval-gate.html` line 45: `<script src="../pretotype/payment-fixtures.js">` | Same as fixtures.js |
| 17 | `docs/architecture-v1.md` | This is the `Documents/playwright_middleware/SELF_HEAL_ARCHITECTURE_v1.md` local doc, renamed per Q5 | Not a vendoring file — flagged here for completeness |

**Decision needed (Q7):** Do we vendor fixtures.js + payment-fixtures.js to make the benchmark actually runnable, or do we ship eval-gate.html as an inert file (broken until dependencies land)? See open questions below.

### §1c. Documentation (3 files, per Q3)

| Source path | Purpose | Land-as |
|---|---|---|
| `self-heal/docs/ARCHITECTURE.md` | 8-stage self-heal loop, canonical design doc | `self-heal/docs/ARCHITECTURE.md` |
| `self-heal/docs/FAILURE-TAXONOMY.md` | 9-pattern + 7-category empirical basis | `self-heal/docs/FAILURE-TAXONOMY.md` |
| `self-heal/docs/PILOT-RESULTS.md` | "STATUS: AWAITING DATA" pilot template | `self-heal/docs/PILOT-RESULTS.md` |

### §1d. Benchmark harness (5 files, per Q3)

| Source path | Purpose | Note |
|---|---|---|
| `self-heal/benchmark/BENCHMARK-RUN.md` | How to run benchmarks + report format | Documentation only |
| `self-heal/benchmark/baseline.json` | Reference numbers for regression tests | Data file, no deps |
| `self-heal/benchmark/corpus.js` | Test corpus definition | Loaded by eval-gate.html |
| `self-heal/benchmark/eval-gate.html` | Browser-based benchmark runner | **8 script src=../ references** (see §1b) |
| `self-heal/benchmark/eval-gate.js` | Benchmark logic (score, compare, report) | Loaded by eval-gate.html |

**eval-gate.html's full transitive dep list** (verified this session):
```html
<script src="../../selfheal-core.js"></script>       ← §1a #1  ✓
<script src="../pipeline/candidate-generation.js">   ← §1a #4  ✓
<script src="../pipeline/change-diagnosis.js">       ← §1a #5  ✓
<script src="../pipeline/failure-reporter.js">       ← §1a #7  ✓
<script src="../pretotype/fixtures.js"></script>     ← §1b #15 ← NEW
<script src="../pretotype/payment-fixtures.js">      ← §1b #16 ← NEW
<script src="../schemas/validator.js"></script>      ← §1b #14 ← NEW
<script src="../schemas/flywheel-event.schema.js">   ← §1a #3  ✓
<script src="../schemas/false-heal.js"></script>     ← §1a #2  ✓
<script src="corpus.js"></script>                    ← self
```

## §2. Local-only files (already present, unchanged path)

These files exist in `experiment-only` or `feature/three-gaps` and stay put.

### §2a. Harness (11 files, path unchanged)

| File | Verified this session | Notes |
|---|---|---|
| `harness/bundle-library.js` | Read line 15 (LIB path), line ~45 (VENDOR_NAMES) | **Needs 1-line edit:** `LIB = path.resolve(__dirname, '..')` (drop the `'lib'` arg) |
| `harness/selfheal-playwright-runtime.js` | Read lines 20-49 | Path-agnostic, no change |
| `harness/translate-locator.js` | Read lines 1-40 | Path-agnostic |
| `harness/translate-locator.test.js` | Filename verified in tree | Path-agnostic |
| `harness/run_trials.js` | Read lines 1-80 | **Needs 3 edits:** `_loadLib('lib/...')` → `_loadLib('...')` on lines 31-32; `execSync('git -C lib rev-parse HEAD')` → `fs.readFileSync('SELFHEAL_VERSION')` on line ~49 |
| `harness/score.js` | Filename verified on feature/three-gaps | Not present on ai-native-test-reliability; local-only |
| `harness/scout-help.mjs` | Read first 15 lines | Hardcodes `http://localhost:3001/` (target_repo URL) — path OK, URL OK per Option C |
| `harness/scout-menu.mjs` | Read first 20 lines | Same |
| `harness/scout-iframe.mjs` | Read first 15 lines | **Self-contained** (uses `data:text/html` URL, not target_repo) |
| `harness/capture-fixture.mjs` | Read first 20 lines | Reads `logs/selfheal-bundle.js` — path unchanged |
| `harness/inspect-anchor.mjs` | Read first 15 lines | Reads `logs/selfheal-bundle.js` — path unchanged |

### §2b. Fixtures / mutations / reports / PLAN

| Path | Files | Change needed? |
|---|---|---|
| `fixtures/authored-test.json` | 1 file | No |
| `mutations/*.patch` | 6 files (prep_aria + A1/A2/A3 + B1/B2) | No (patches apply to `target_repo`) |
| `report/p1_results.md, p1_v2_results.md, p1_redteam.md, p2_results.md, three_gaps_closed.md, gap_E_control_flow.md` | 6 files | **Read-only per HLD redteam #7** — do NOT rewrite paths |
| `PLAN.md` | 1 file | Update the 1-line load-order pointer to reflect new paths |

### §2c. `.claude/`

| Path | Files | Notes |
|---|---|---|
| `.claude/settings.json` | 1 | Path-agnostic |
| `.claude/.gitignore` | 1 | No change |
| `.claude/projects/preflight7-state.md` | 1 | Present on `main` |
| `.claude/skills/README.md` | 1 | No change |
| `.claude/skills/{diagnose,grill-me,pattern-promoter,plan-template,redteam,session-codify,ship}/SKILL.md` | 7 | No change |
| `.claude/skills/.deleted/2026-06-11/{code-review-*}/SKILL.md` | 7 | **Preserve per Q6** |

### §2d. `wiki/` (existing scaffold, needs test-script updates)

| Path | Change needed? |
|---|---|
| `wiki/README.md, INDEX.md, architecture.md, glossary.md, glossary.terms, files.md, CHANGELOG.md` | INDEX.md + files.md need updates for new merged tree; others unchanged |
| **`wiki/tests/test_files_coverage.sh`** | **Line: `git ls-files 'Documents/playwright_middleware/*'` — needs update to new paths (see §4)** |
| **`wiki/tests/test_no_duplication.sh`** | **Line: `src=Documents/playwright_middleware/SELF_HEAL_ARCHITECTURE_v1.md` — path change to `docs/architecture-v1.md`** |
| **`wiki/tests/test_size.sh`** | **Line: `find Documents/playwright_middleware -type f` — path change to `find docs -type f -name '*.md'` (probably; may need to include self-heal/docs/ too)** |
| `wiki/tests/test_structure.sh, test_freshness.sh, test_glossary_terms.sh, test_links.sh, run.sh` | No hardcoded paths (verified this session); no change |
| `wiki/tools/sync.sh` | Not read this session — flag for Step 5 |

### §2e. Root-level docs and config

| Path | Change |
|---|---|
| `Documents/playwright_middleware/SELF_HEAL_ARCHITECTURE_v1.md` | **Rename** to `docs/architecture-v1.md` per Q5 |
| `package.json` | **Rename** `name` field to `"self-heal-runner"` per Q4 |
| `.gitignore` | Extend with `target_repo/`, `logs/*` (with `!logs/.gitkeep`), `node_modules/`, `test-results/`, `playwright-report/` |
| `.gitmodules` | **DELETE** (submodule going away) |
| `README.md` | **NEW** — copy `ai-native-test-reliability/README.md`, adapt scope description |
| `SELFHEAL_VERSION` | **NEW** — contains `599dca1c` |
| `AGENTS.md, CLAUDE.md` | Bring from `claude/code-wiki-repo-setup-8dbc46`; CLAUDE.md gets 1-line prepend about branching discipline |

## §3. Explicitly OUT-of-scope from ai-for-qa (~163 files, NOT merged)

Per Q3, these stay upstream in ai-for-qa and are NOT vendored. Categorized so we can revisit later.

### §3a. UI mockups (v1–v4 iterations, design artifacts)

- `self-heal/ui/test-authoring-mockup{,-v2,-v3,-v4,-insurance}.html` — 5 files
- `self-heal/ui/test-detail-mockup{,-v1,-v2,-v3}.html` — 4 files
- `self-heal/ui/cross-layer-trace.html` — 1 file
- `self-heal/ui/fonts/DM_Sans/*.ttf` — 2 font files
- `self-heal/ui/part-b.patch` — 1 file

**Reason to skip:** design-doc iterations, no runtime dep on the core, not consumed by harness.

### §3b. Panel (working QA-agent plugin UI)

- `self-heal/panel/{panel.html,panel.js,panel.css,datagen.js,drift-torture.js}` — 5 files

**Reason to skip:** standalone browser-extension prototype, not consumed by harness. Renders synthetic fixture, not this harness's `logs/trials.jsonl`.

### §3c. Real-site harnesses (Amplitude, Gong)

- `self-heal/tools/amplitude-e2e-{harness.html,runner.js}` + `amplitude-stash.js` — 3 files
- `self-heal/tools/gong-e2e-{harness.html,runner.js}` — 2 files

**Reason to skip:** target different apps we're not testing here. Amplitude/Gong are also on the bundler's `VENDOR_NAMES` scrub list (indirect signal that the source contains real customer references).

### §3d. Autonomous explorer + HITL tools

- `self-heal/tools/app-observer.js` — STUDY-stage walker; not called by harness
- `self-heal/tools/hitl-{overlay,live-demo}.js` — HITL UI, not wired
- `self-heal/tools/candidate-coverage-probe.js` — coverage diagnostic
- `self-heal/tools/core-fix-{tests.html,tests.js}` + `CORE-FIX-RUN.md` — 3 files

**Reason to skip:** none exercise the currently-running pipeline. STUDY stage is aspirational per the design doc; adding these now is scope creep.

### §3e. Pretotype (except the two fixtures files surfaced above)

- `self-heal/pretotype/{amplitude-report.{html,js}}` — 2 files
- `self-heal/pretotype/{flow-pretotype.{html,js}}` — 2 files
- `self-heal/pretotype/{opentest-pretotype.html,opentest-pretotype-live.html,opentest-runner.js}` — 3 files
- `self-heal/pretotype/{payment-pretotype.html,report-viewer.html}` — 2 files
- `self-heal/pretotype/{testgen-compare.html,testgen-v2.js,testgen.js}` — 3 files
- `self-heal/pretotype/generic-report.{html,js}` — 2 files
- `self-heal/pretotype/PRETOTYPE-RUN.md` — 1 file

**Reason to skip:** experimental report/runner variants, not consumed by harness.

### §3f. Root-level explainer/lab HTML (incubator files predating the module)

- `self-healing-explainer.html`, `self-healing-explainer copy.html` — 2 files (one is a literal Finder duplicate flagged in ai-for-qa's own architecture)
- `self-healing-lab.html` — 1 file
- `descriptor-workbench.html` — 1 file (where `selfheal-core.js` was ported from)
- `selfheal-tests.js, selfheal-tests.html` — 2 files (Phase-1 tests for selfheal-core.js)
- `qi-dashboard.html, block2-data-flow.html, live-inspector.js` — 3 files
- `testcraft-authoring-agent-mockup.html` — 1 file
- `descriptor-workbench.html` — 1 file
- `ios_pagesource.xml` — 1 file (iOS test fixture)

**Reason to skip:** explainer/incubator/dashboard files, not consumed by harness. **Note:** `selfheal-tests.{js,html}` are the *tests for selfheal-core.js*; skipping them means the vendored core ships without its own test suite. Testing-skill flag — see redteam.

### §3g. Root-level planning/strategy docs

- `self-healing-PLAN.md, self-healing-descriptor-spec.md, PHASE1-tasks.md, IMPLEMENTATION-REFERENCE.md, FEEDBACK-LOOP.md, QI-insights-recommendations.md, CLAUDE.md, context.md` — 8 files
- `static-server.py, .claude/launch.json, .claude/static-server.py` — 3 files

**Reason to skip:** project-wide strategy docs of ai-for-qa; the merged repo has its own `wiki/architecture.md` + `docs/architecture-v1.md` + `wiki/glossary.md` covering equivalent ground.

### §3h. Module-level tests (skipped — flag for redteam)

- `self-heal/tests/adversarial-validation-tests.{js,html}` — 2 files (validation module tests)
- `self-heal/tests/candidate-widening-tests.{js,html}` — 2 files (candidate-widening tests)
- `self-heal/brain/tests.html` — 1 file (brain tests)
- `self-heal/pipeline/lever-tests.{html,js}` — 2 files (lever tests)
- `self-heal/schemas/tests.html` — 1 file (schema tests)

**Reason skipping is questionable:** these test the *exact* modules we're vendoring. Not vendoring them means the vendored code arrives without its own regression tests. Testing-skill concern — see redteam.

## §4. Concrete diff — what changes vs today's `experiment-only`

**Adds (17 files + 5 docs/benchmark + a few config = ~23 new tracked files):**
- 13 code files in §1a
- 4 supporting files in §1b (validator.js, fixtures.js, payment-fixtures.js, — architecture-v1.md is a rename, not add)
- 3 docs in §1c
- 5 benchmark files in §1d
- New root files: `README.md`, `SELFHEAL_VERSION`, `AGENTS.md`, `CLAUDE.md`
- New `wiki/execution-flow.md`, `wiki/hld.md`, `wiki/files-comparison.md`, `wiki/plan-reconciliation.md`, `wiki/merge-plan-v2.md`, `wiki/redteam-pass.md`

**Removes:**
- `.gitmodules` (submodule going away)
- `lib/` gitlink (submodule going away)

**Renames:**
- `Documents/playwright_middleware/SELF_HEAL_ARCHITECTURE_v1.md` → `docs/architecture-v1.md`

**Edits (small):**
- `harness/bundle-library.js` — 1 line (LIB path)
- `harness/run_trials.js` — 3 lines (2 _loadLib paths + libSha derivation)
- `wiki/tests/test_files_coverage.sh` — 1 line (path glob)
- `wiki/tests/test_no_duplication.sh` — 1 line (src path)
- `wiki/tests/test_size.sh` — 1 line (find path)
- `wiki/architecture.md` — 1 line (link to `../docs/architecture-v1.md`)
- `PLAN.md` — 1 line (load-order pointer)
- `package.json` — `name` field
- `.gitignore` — 4-5 line append
- `wiki/INDEX.md` — new entries for new docs
- `wiki/files.md` — full rewrite (whole file-tree changed)

**Total: ~15-20 files touched** (net), most edits ≤ 5 lines each.

## §5. Cynical review (internal redteam — Step 3)

1. **The vendored library ships without its own tests (§3h).** ai-for-qa has 6 test HTML files exercising the modules we're vendoring (brain, schemas, pipeline levers, adversarial validation, candidate widening). We're pulling in the code but not the tests. If a future edit to `self-heal/pipeline/candidate-validation.js` accidentally breaks `uniqueness()`, nothing in this repo catches it — the only assertion is the end-to-end `false_heal=0` gate, which is a very indirect signal. **Testing-skill flag: strongly consider vendoring the 6 test HTML files.** They're small (mostly wrappers), self-contained (each imports its own module), and would give us per-module coverage. Trade-off: 6 more files, some duplicated file surface, but real per-file regression signal. **Recommend: vendor them; add to Step 5 plan.**

2. **The benchmark eval-gate.html is broken without fixtures.js + payment-fixtures.js.** §1b flagged this. Two choices:
   - **Vendor both** (17→19 file count): benchmark actually runs, `baseline.json` becomes a live regression check.
   - **Ship eval-gate.html inert**: benchmark files land as docs; eval-gate.html renders a broken page if opened. Adds tech debt.
   Ask user (Q7 below).

3. **Report files reference "lib/" paths in prose** (e.g., `p1_results.md` may say "pinned lib SHA a31ace4 in `lib/`"). §2b marked these read-only, but a reader today opens `p1_results.md` and follows a mental link that no longer exists. Not a merge blocker, but at least a **README callout: "reports written pre-merge, `lib/` in prose = today's repo root."** Otherwise a reader half a year from now will spend time hunting for a non-existent directory.

4. **`.gitignore` for `target_repo/` doesn't stop `git status` from noticing it as an untracked directory** if user hasn't run `git clone` yet. Fine — untracked is not an error state. But `run_trials.js` calls `git -C target_repo rev-parse HEAD` and dies if `target_repo/` is missing. Cosmetic improvement: add an early-check in `run_trials.js` (or a `pretrial.sh` wrapper) that prints "Missing target_repo/. See README §Setup." rather than the raw git error. **Small usability fix, not a merge blocker.**

5. **`self-heal/pipeline/search-and-pick.js` and `learning-loop.js` and `temporal-wait.js` are dead weight** in the current call graph (verified by re-reading `bundle-library.js` and the runtime). Vendoring them because "they're in the load order" preserves the shape for a future wiring session — a real cost of ~50KB in bundle text, no runtime cost after IIFE install (all cost is one-time on first page load). Ok but note in `wiki/files.md` as "loaded, not-yet-wired."

6. **`fixtures.js` and `payment-fixtures.js` may contain vendor names.** ai-for-qa's `bundle-library.js` scrubs `[testsigma, gong, amplitude, appsmith, immich, salesforce]` from bundle output. If eval-gate.html doesn't go through that scrubbing (it doesn't — it's HTML, loaded directly), then vendoring these two files as-is may put vendor names into the merged repo's own source. **Testing-skill flag: grep both files for the 6 vendor names before deciding to vendor them, or add scrubbing during vendoring.** Recorded in open questions.

7. **The `harness/score.js` file is on `feature/three-gaps` but the file wasn't inspected this session.** I've been treating it as a local-only addition beyond ai-native-test-reliability's scope. Should verify it isn't a competitor to `SELFHEAL.verifyEffect` or similar — a duplicate we'd want to consolidate rather than keep as-is. **Flag for Step 5's plan: 5-minute read of score.js.**

## §6. Open questions before Step 4

- **Q7.** Vendor `self-heal/pretotype/fixtures.js` + `self-heal/pretotype/payment-fixtures.js` so eval-gate.html actually renders, or ship eval-gate.html inert? (Trade: 2 more files vs. broken benchmark file in the tree.)
- **Q8.** Vendor the 6 ai-for-qa test HTML files (§3h) alongside the modules they test? Currently the merged repo has no per-module coverage — only end-to-end `false_heal=0`. Bringing them adds real regression signal.
- **Q9.** Scrubbing: `fixtures.js` + `payment-fixtures.js` are HTML-loaded (not bundled), so `bundle-library.js`'s vendor-name scrub doesn't apply. Options: (a) grep-and-scrub before vendoring, (b) vendor as-is and add a `.gitignore-style` post-vendor scrubber, (c) skip these files and ship eval-gate.html inert (loops back to Q7). Ask if the user wants me to run the grep now to see what's actually in them.
