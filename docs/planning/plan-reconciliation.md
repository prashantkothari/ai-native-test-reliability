# Plan Reconciliation — Deltas Between Steps 1–3 and Earlier Merge Plan

**Purpose.** The merge plan at `~/.claude/plans/make-an-experiment-plan-atomic-cocke.md` was written before Steps 1–3 in this thread. Steps 1–3 surfaced new facts and reversed some assumptions. This doc names every delta so Step 5 can rewrite the plan with all of them absorbed — no silent updates.

**Structure.** For each area, three lines: what the earlier plan said → what Steps 1–3 established → implication for Step 5.

## §1. Vendoring file count

- **Earlier plan (§0, §2.5 Probe 1, §7 cynical review #2):** "The 13 files (~7% of ai-for-qa) are the actual working set."
- **Step 3 established:** True working set is **~27 files**:
  - 13 code files (unchanged from bundle-library.js list) ✓
  - +1 hidden dependency: `self-heal/schemas/validator.js` (surfaced Step 2 from run_trials.js vm-context load)
  - +2 benchmark deps: `self-heal/pretotype/fixtures.js` + `payment-fixtures.js` (surfaced Step 3 from eval-gate.html script srcs)
  - +3 docs: `self-heal/docs/{ARCHITECTURE,FAILURE-TAXONOMY,PILOT-RESULTS}.md` (per Q3)
  - +5 benchmark files: `self-heal/benchmark/*` (per Q3)
  - +~8 test files: 6 test HTMLs + companion .js (grill-tested decision this thread)
- **Implication for Step 5:** Probe 1 (bundle-reproducibility diff) MUST run against the 17-file minimum working set, not the 13-file bundle. If someone reads the earlier plan literally and skips validator.js, `_loadLib()` throws before any trial runs. Rewriting §0 (pre-flight) to name all 27 files explicitly is a HARD gate.

## §2. Path structure — vendor/ vs natural paths

- **Earlier plan (§2 files-to-touch):** "New: `vendor/self-heal/{selfheal-core.js, ...}`"
- **User later established (this thread):** "there are no vendors, only one repo please" — natural paths, no `vendor/` prefix.
- **Implication for Step 5:** All `vendor/` references in the old plan must be rewritten to natural paths. `selfheal-core.js` at repo root, `self-heal/` at repo root. Also affects `VENDORED_FROM.md` naming — becomes `SELFHEAL_VERSION` (a different concept: a bumpable version marker, not a source-provenance record).

## §3. libSha identity — the silent trap

- **Earlier plan:** Not identified. Plan assumed removing the submodule was a straightforward path swap.
- **Step 2 (HLD C1) established:** Naive removal of the submodule makes `libSha` collapse to the monorepo SHA. This changes on every commit to any file — destroying the training-substrate identity of flywheel-event rows.
- **Implication for Step 5:** New required artifact: a committed `SELFHEAL_VERSION` file, opaque marker value (start: `599dca1c`). `run_trials.js` reads this instead of `git -C lib rev-parse HEAD`. New wiki-test enforces bump-when-self-heal-changes to prevent silent drift.

## §4. target_repo (Excalidraw external)

- **Earlier plan (§7 cynical review #2):** "The merge plan does not currently address `target_repo` — which is *not* a git submodule but is git-tree-manipulated by the runner. That's a lurking dependency."
- **User established (this thread):** target_repo stays as an external, gitignored, README-documented setup step. NOT vendored, NOT submoduled.
- **Implication for Step 5:** Explicit `.gitignore` entry for `target_repo/`. README documents the one-time `git clone excalidraw && git checkout e1bb9ff8`. `run_trials.js` should print a clear error (not raw `git -C target_repo` exception) if target_repo is missing. **This is a minor code change to `run_trials.js` — needs adding to Step 5's §2 files-to-touch.**

## §5. Wiki-test breakage — hardcoded `Documents/playwright_middleware/`

- **Earlier plan:** Not identified. Wiki-tests were listed as "verify wiki tests pass" but not audited.
- **Step 3 established:** 3 of 7 wiki-test scripts hardcode `Documents/playwright_middleware/` — will break on Q5's rename to `docs/`.
  - `wiki/tests/test_files_coverage.sh` line 8: `git ls-files 'Documents/playwright_middleware/*'`
  - `wiki/tests/test_no_duplication.sh` line 7: `src=Documents/playwright_middleware/SELF_HEAL_ARCHITECTURE_v1.md`
  - `wiki/tests/test_size.sh` line 6: `find Documents/playwright_middleware -type f -name '*.md'`
- **Implication for Step 5:** These 3 files are edits alongside the rename. Otherwise "wiki tests pass" is a false verification claim.

## §6. Report files' `lib/` prose references

- **Earlier plan (§7 cynical review #7):** "report/* is **read-only** during the merge — no path rewrites, even if the paths cited become slightly stale."
- **Step 3 reinforced:** Read-only stance correct. Also added: **README callout needed** so a future reader knows "lib/" in reports = today's repo root.
- **Implication for Step 5:** Reports untouched, but the new README.md must include: "Reports in `report/*.md` predate the merge. When they cite `lib/`, that path is now the repo root."

## §7. Vendor-name scrub for HTML-loaded fixtures

- **Earlier plan:** Not identified.
- **Steps 2–3 established:** `bundle-library.js`'s vendor-name scrub only applies to the bundled JS output — it doesn't touch anything else in the repo. `fixtures.js` + `payment-fixtures.js` + 3 test .js files contain 5–7 total vendor-name references (in comments and fixture strings, referencing Gong/Amplitude pilot evidence — not customer data, but hygiene practice).
- **Implication for Step 5:** New artifact — `tools/vendor-scrub.sh` — runs the same 6-word substitution at vendoring time. Applied to the 5 files with hits. Documents the practice; matches ai-for-qa's own hygiene.

## §8. Module tests (§3h of files-comparison)

- **Earlier plan:** Not identified. Tests were implicitly out of scope.
- **Steps 2–3 established, plus grill decision this thread:** Ship all 6 test HTMLs + their JS companions (~8 files total). Reasoning: per-module regression signal + tests-as-documentation. Without them, the vendored library relies solely on the end-to-end `false_heal=0` gate for regression detection.
- **Implication for Step 5:** Files-to-touch grows by ~8. New wiki-test entry: a `wiki/tests/test_selfheal_tests.sh` that opens each vendored test HTML and asserts it renders + all module tests report success. (Or simpler: a note in README that these are runnable via `python3 -m http.server` from repo root.)

## §9. Sequencing — session structure

- **Earlier plan (§1.5 ordering table):** 6 sessions (S0 branch audit → S1 branch consolidation → S2 submodule URL → S3 vendoring → S4 push → S5 archive ai-native-test-reliability).
- **Steps 1–3 established:** Structure still sound, but:
  - **S2 is now unnecessary** as a standalone session — there's no submodule URL to resolve because we're removing the submodule entirely. Fold what remains (choosing which SHA to pin) into S3.
  - **S3 grows** from "vendor 13 files" to "vendor 27 files + write SELFHEAL_VERSION + update 5 harness/wiki files + write vendor-scrub tool + rewrite README + rewrite wiki/files.md + rewrite wiki/INDEX.md". This is bigger than a single-commit session — split into S3a (vendor + scrub) and S3b (wiring: path edits, SELFHEAL_VERSION, .gitignore, README, wiki/*).
  - **New: S3c** — Verify wiki tests still pass on the merged tree. Includes updating the 3 hardcoded paths in wiki-tests.
- **Revised sequence proposal:**
  - S0. Branch-lineage audit (unchanged; read-only, ordered first)
  - S1. Pick canonical branch, land the 8 sibling branches (unchanged)
  - **S2. Vendor + scrub** (was S3 partial): copy 27 files, run vendor-scrub.sh, commit
  - **S3. Wiring changes**: 3 harness edits, SELFHEAL_VERSION file, .gitignore additions, README, wiki/INDEX+files rewrites, wiki-test path updates, docs/architecture-v1.md rename
  - **S4. Verification** (was S3.Probe 1 + S3.Probe 3): bundle-diff, fresh-clone smoke test, wiki-tests pass, `npm run trial` reproduces `false_heal=0`
  - **S5. Push** (unchanged): to new remote, named branch first, PR-then-fast-forward `main`
  - **S6. Archive** ai-native-test-reliability on GitHub (unchanged from earlier S5; renumbered)

## §10. Non-goals that stay non-goals

- Fixture-app swap for Excalidraw (rejected earlier in this thread — Option C won).
- Fork-merge decision for the preflight7 heal-policy commit (rejected in Q on lib version — pin 599dca1c stays, explicit user decision later if they want to upgrade).
- Fixing the ai-for-qa `self-healing-explainer.html` vs `copy.html` Finder duplicate (heads-up in earlier plan; still not this repo's problem).
- Adding CI (mentioned in earlier plan §3 lens 7 as a suggested improvement, not part of the plan itself).

## §11. New non-goals surfaced in this reconciliation

- **Not fixing the "8 branches all claim canonical" tangle in one commit.** S1 consolidates but does not rewrite the individual chip-a/b/c/d or phase-r-* branch histories — those get merged into consolidated-main via merge commits, preserving the divergent history for reference. Cleanup (pruning the source branches) waits until S5's push confirms the target remote has everything.
- **Not landing per-file benchmark automation.** eval-gate.html will render post-vendor, but wiring it into a CI-like flow (e.g., "fail the trial if baseline.json regresses") is deferred. Landing benchmark files makes future automation cheap; automating them now is scope creep.
- **Not touching ai-for-qa upstream.** The Finder-duplicate cleanup, the vendor-name comment cleanup, any per-key-heal-policy PR back to prashantkothari — all stay upstream problems.

## §12. Cynical review (internal redteam — Step 4)

1. **The old plan's "1400s elapsed" footer was a warning sign I ignored.** The template says "target <20s overhead"; a plan that takes 20+ minutes to write is either research-grade (fine — the footer noted this) or under-scoped and needs another pass (also fine, but not called out). Steps 1–3 in this thread confirmed the second reading: several load-bearing gaps (validator.js, libSha trap, fixtures.js deps, wiki-test hardcodes) weren't caught in the earlier plan and only surfaced with additional inspection. **Rule for Step 5:** if the revised plan is also over-budget on the plan-template's overhead metric, that's a signal to grill again, not to ship.

2. **Reconciliation itself is a diff, not a new source of truth.** This doc names the deltas, but Step 5's plan must fully re-state the merge — no "see §X of the old plan" references. A future reader shouldn't need to open two plans.

3. **The "27 files" count is still soft.** `wiki/tools/sync.sh` wasn't inspected this session (flagged in §2d of files-comparison). If it has transitive deps or hardcoded paths, the count could grow again. **Recommend: 5-minute read of sync.sh at the start of Step 5.**

4. **The vendor-scrub tool has a subtle risk: idempotency.** `sed -i "s/\bgong\b/REDACTED/gi"` is fine on a first run, but if a future contributor writes a legitimate comment saying "gong" (e.g., mentioning it in a design note), the scrub silently redacts it. The scrub tool needs to be a **one-time** operation with a marker (e.g., a `.vendor-scrubbed` sentinel file), or an explicit allowlist. Otherwise, the tool becomes a foot-gun. **Recommend: scrub-once with sentinel, documented in tools/vendor-scrub.sh header.**

5. **S1 (branch consolidation) is treated as low-risk in the earlier plan (`risk=2`).** Steps 1–3 didn't change that assessment, but the 8-branch merge is more subtle than a single fast-forward: `chip-a-comparator-fix` and `chip-d-legacy-target` may have conflicts with each other (they're in different worktrees today, unclear if their diffs overlap). **Recommend: S1 does a `git log --oneline canonical..chip-*` for each branch first, and if any pair has non-trivial diffs, request explicit merge conflict resolution rather than auto-merging.**

6. **The old plan's §6 bug-pair check pattern is still valid** — the three-repo confusion and the branch-sprawl were named as related-but-not-identical bugs, and this reconciliation confirms that framing. No update to §6 needed.

## §13. Ready-to-write list for Step 5

Step 5's merge-plan-v2 must:
- [ ] Conform to plan-template's 6-section structure (Pre-flight, Context, Mock-Execution, Failure-Modes-7-lens, Verification, Rollback, plus §6 bug-pair, §7 cofounder-N/A).
- [ ] State the file count as 27 (not 13) throughout.
- [ ] Include SELFHEAL_VERSION as a first-class artifact, not an afterthought.
- [ ] Include vendor-scrub.sh with idempotency safeguard.
- [ ] Include wiki-test path edits (test_files_coverage, test_no_duplication, test_size) alongside the rename.
- [ ] Rename `Documents/playwright_middleware/SELF_HEAL_ARCHITECTURE_v1.md` → `docs/architecture-v1.md` per Q5, with all inbound-link updates.
- [ ] Include README callout about `lib/` in report/* prose.
- [ ] Include target_repo missing-check in run_trials.js (or a pretrial wrapper).
- [ ] Include the 8 test-file vendorings + their consumption path (python3 -m http.server or similar).
- [ ] Split S3 into S2 (vendor+scrub) and S3 (wiring), per §9.
- [ ] Keep S0 read-only and ordered first (existing template rule).
- [ ] Keep report/* strictly read-only.
- [ ] Cynical review pass — include a §Failure-modes-7-lens pass over the revised plan.

## §14. Open questions before Step 5

- **Q10.** `wiki/tools/sync.sh` — should I read it now as an inline step in Step 5, or is it OK to defer to Step 5's §0 pre-flight?
- **Q11.** Idempotency for `vendor-scrub.sh`: sentinel file (`.vendor-scrubbed`) or explicit allowlist of files? Sentinel is simpler; allowlist is safer against a future contributor removing the sentinel.
