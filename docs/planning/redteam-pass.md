# Combined Redteam Pass — All 5 Docs as a Set

**Method.** Independent-context redteam via subagent (plan-template Amendment 7 mandates subagent for ≥3-session plans). Subagent was given all 5 docs cold, without seeing them being written, and asked to attack cross-doc contradictions, promises-without-gates, missed lenses, and silent-except patterns.

## Verdict

**DO NOT SHIP AS-IS.** 5 blockers must be fixed in merge-plan-v2 before execution begins. Remaining findings are execution-time concerns already covered by the plan's own §Cynical review sections.

## Blocker 1 — File count arithmetic is wrong (32, not 27)

**Finding.** Merge-plan §0 header and §1 in-scope say "27 files vendored." Actual manifest enumerates 13 code + 1 validator + 2 fixtures + 3 docs + 5 benchmark + 8 tests (brain/tests.html + schemas/tests.html + 3 test pairs × 2 files) = **32**.

**Verification (this thread).** Test-file inventory from ai-for-qa (verified via `gh api`):
- `self-heal/brain/tests.html` — 1 file (standalone HTML with inline test JS, per file header at 599dca1c)
- `self-heal/schemas/tests.html` — 1 file (standalone; may or may not load external JS)
- `self-heal/tests/adversarial-validation.html + adversarial-validation-tests.js` — 2 files
- `self-heal/tests/candidate-widening.html + candidate-widening-tests.js` — 2 files
- `self-heal/pipeline/lever-tests.html + lever-tests.js` — 2 files

Total: **8 test files** (or 6 if we count only HTMLs — but shipping a .html that loads a missing .js is what makes this ambiguous).

**Fix for merge-plan-v2:** Update every mention of "27" to "32" (or "≥30, exact count set at S2 start after reading each test .html to confirm which have external .js companions"). §0 manifest becomes the authoritative count; slogans in §1 and §Cynical follow.

## Blocker 2 — Three promised wiki-tests never land in §2 files-to-touch

**Finding.** These tests are referenced across the docs as mitigations for real invariants:
- `wiki/tests/test_selfheal_version.sh` — invoked by Merge-plan §3 lens 1 mitigation ("a wiki-test that asserts the file exists, is non-empty, and its contents match")
- `wiki/tests/test_selfheal_version_bump.sh` — invoked by Merge-plan §3 lens 7 mitigation ("fails if `git diff --name-only main..HEAD -- self-heal/ selfheal-core.js` is non-empty AND `SELFHEAL_VERSION` is unchanged")
- `wiki/tests/test_dual_mode.sh` — invoked by HLD (Doc 2) §C2 ("would catch a regression [in Node-vs-Browser dual-mode files]")

None of these appear in Merge-plan §2 files-to-touch. Half-bridges — the mitigations they justify are just documentation until the tests exist.

**Fix for merge-plan-v2:** Add three new files to §2 adds list:
```
wiki/tests/test_selfheal_version.sh          (~15 lines, S3 deliverable)
wiki/tests/test_selfheal_version_bump.sh     (~20 lines, S3 deliverable)
wiki/tests/test_dual_mode.sh                 (~15 lines, S3 deliverable)
```
Each with a concrete implementation sketch. Add to Verification §4 as runnable checks.

## Blocker 3 — Probe 4 silently passes on missing files

**Finding.** The Probe 4 grep pipeline:
```bash
hits=$(grep -icE '...' file 2>/dev/null | awk '{s+=$2}...')
```
`2>/dev/null` silences the missing-file error; grep prints nothing to stdout; awk emits `0`; assertion passes with zero vendor-name hits. A file we *forgot to vendor* scores "clean" by absence rather than by scrubbing.

**Fix for merge-plan-v2:** Prepend an existence check:
```bash
for f in <list>; do
  [[ -f "$f" ]] || { echo "PROBE 4 FAIL: expected file missing: $f"; exit 1; }
  # ... then the grep check
done
```
Applies to every file the assertion loops over. Same fix for the sentinel check (`test -f tools/.vendor-scrubbed`).

## Blocker 4 — Licensing/attribution lens absent

**Finding (verified this thread).**
- `gh api repos/prashantkothari/ai-for-qa/license` → **404 (no detectable license)**
- `gh api repos/preflight7/ai-for-qa/license` → **404 (no detectable license)**
- Both repos: **public** (`isPrivate: false`)
- No `LICENSE`, `COPYING`, or `NOTICE` at repo root of either.

**Nuance.** The user (session Anthropic account: `prashant.kothari@gmail.com`; git identity: `preflight7`; ai-for-qa owner GitHub login: `prashantkothari`) appears to be the same person across all three identities. If so, this is **self-vendoring**, not third-party vendoring — no license grant needed because the user already owns the copyright.

**But** the plan should still document provenance to prevent future confusion:
1. If the user ever transfers `prashantkothari/ai-for-qa` to another owner, or if a contributor commits to the merged repo without knowing its lineage, the provenance record is what tells them "this code came from that place."
2. Also: even self-owned, adding an actual LICENSE file (MIT, Apache 2.0, or the user's choice) to both ai-for-qa and the merged repo protects the user themselves against future copyright-ambiguity.

**Fix for merge-plan-v2:** Add to §2:
- **New file at S2:** `NOTICE.md` (or `THIRDPARTY_NOTICES.md`) at repo root, listing the 32 vendored files, their source (`https://github.com/prashantkothari/ai-for-qa` @ `599dca1c`), and a note "vendored from user's own repo; self-owned code." One-time write, ~20 lines.
- **Recommendation flagged, not required:** add a `LICENSE` file to the merged repo (user picks MIT, Apache 2.0, or all-rights-reserved). Not blocking this merge; blocking any future public-repo contribution.

## Blocker 5 — Rollback ordering underspecified

**Finding.** Merge-plan §5 says "revert per commit." But S2's vendor commit and S3's `.gitmodules`/`lib/` removal are separate commits. If S2 is reverted after S3 has removed `lib/`, `self-heal/*` vanishes AND `lib/` is gone — harness has no library at all. Per-commit revert works only in reverse order.

**Fix for merge-plan-v2:** Rewrite §5 rollback rule:
> **Rollback rule:** revert commits in **reverse commit order** (LIFO). Alternatively, `git reset --hard <pre-S2-SHA>` to fully undo S2 + S3 in one shot. Do NOT revert S2's vendor commit without first reverting S3's submodule-removal commit — this leaves the tree with no library at all.

Add worked example: "To fully undo the merge from a state where S3 completed and something failed at S4: `git reset --hard <pre-S1-tip>`. This drops consolidated-main and returns to the pre-merge state; no remote was touched (S5 hadn't run)."

## Non-blocking findings (execution-time concerns, already covered)

The subagent flagged additional items that are either:
- Already covered in the plan's own §Cynical section (target_repo missing-check message, empty Documents/ folder, sync.sh unread, chip-branch conflict strategy — all in Merge-plan §Cynical),
- Or are silent-fallthrough patterns the fix-list above already addresses (Blocker 3 fixes the grep-on-missing-file silence).

Two worth acknowledging explicitly:

**A. Bundle-diff (Probe 1) is not a true regression gate.**
The subagent's point: Probe 1 diffs pre-S2 bundle (from submodule) vs post-S3 bundle (from vendored). If both are cp'd from the same 599dca1c source, of course they match. It cannot detect a scrub-caused semantic change (e.g., `gong` in a real identifier being redacted).
**Response:** The redteam is right that Probe 1 doesn't guarantee scrub-safety, but Probe 4 is the scrub-safety probe. Rename Probe 1 to "Probe 1a — Bundle byte-reproducibility" and add "Probe 1b — post-scrub semantic check": run the existing `harness/translate-locator.test.js` unit tests against the *scrubbed* bundle to confirm no legitimate identifier was redacted. Cheap: those tests already exist.

**B. `SELFHEAL_VERSION` file is per-clone reset via gitignored sentinel.**
The subagent's point: `tools/.vendor-scrubbed` is gitignored, so fresh clones re-run scrub. A contributor could commit a legitimate `salesforce` comment; a fresh clone silently redacts it.
**Response:** True but bounded. Two mitigations:
1. `vendor-scrub.sh` is only invoked at S2 execution time; it's not a pre-commit hook. Fresh clones don't run it automatically. The sentinel prevents *re-runs during S2*, not *runs during normal development*.
2. Documented in the script header: "run only at vendoring time; do not add to CI or pre-commit."

Both fine as-written; no plan change needed, but merge-plan §2 should add: "vendor-scrub.sh not part of routine dev — only invoked at vendor-refresh time."

## Assumption drift audit (for future reference, not blocking)

- **HLD A9** (scout .mjs scripts path-agnostic): asserted, not fully verified. Deferred — files-comparison §2a lists them all but only spot-checked hardcoded URLs. Grep for `../lib` in scout scripts at S2 start.
- **Architecture-stack A2** (pinned 599dca1c is correct): re-answered and locked earlier this thread (user's default "no preference" → recommended 599dca1c). Fine.
- **Architecture-stack cynical #1** (dual-mode constraint on schemas): HLD C2 promoted; test now landed via Blocker 2 fix.

## Concrete diff to merge-plan-v2

Amend §2 files-to-touch:

```
Adds (updated):
+  NOTICE.md (or THIRDPARTY_NOTICES.md) at repo root — vendor provenance record
+  wiki/tests/test_selfheal_version.sh
+  wiki/tests/test_selfheal_version_bump.sh
+  wiki/tests/test_dual_mode.sh
+  (upgrade "27 vendored files" → "32 vendored files")
```

Amend §2.5 Probes:

```
Probe 1a — Bundle byte-reproducibility (unchanged behavior)
Probe 1b (NEW) — Post-scrub semantic check: run harness/translate-locator.test.js against the scrubbed bundle
Probe 4 (UPDATED) — Add existence guard: [[ -f "$f" ]] || fail before grep on each file
```

Amend §4 Verification:

```
+ bash wiki/tests/test_selfheal_version.sh — must exit 0
+ bash wiki/tests/test_selfheal_version_bump.sh — must exit 0 (given no self-heal/ diff without VERSION bump)
+ bash wiki/tests/test_dual_mode.sh — must exit 0
+ test -f NOTICE.md — must exist
```

Amend §5 Rollback:

```
Rollback rule: LIFO — revert commits in reverse order.
Or: git reset --hard <pre-S2-SHA> for full rollback in one shot.
Never revert S2 vendor commit while S3 submodule-removal commit remains applied.
```

## Ship-readiness checklist

Fixes required before user approves plan execution:

- [ ] Blocker 1 — reconcile "27" to "32" (or empirical count at S2 start) throughout merge-plan-v2
- [ ] Blocker 2 — add 3 new wiki-test files to §2 with implementation sketches
- [ ] Blocker 3 — add existence guards to Probe 4 assertion
- [ ] Blocker 4 — add NOTICE.md to §2; flag LICENSE decision as user's call (not blocking)
- [ ] Blocker 5 — rewrite §5 rollback rule with LIFO discipline
- [ ] Sub-A — split Probe 1 into 1a/1b (byte-diff + semantic-diff)
- [ ] Sub-B — document vendor-scrub.sh as vendor-time-only in the script header

After all six items land in merge-plan-v2, the plan is ready to execute.
