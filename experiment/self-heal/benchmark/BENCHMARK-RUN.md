# BENCHMARK-RUN.md — S4 eval-gate result (`measured · live · 2026-07-01`)

Roadmap item F2: **"false-heal cannot regress. Protects every later session."** Built the corpus +
eval-gate harness in `self-heal/benchmark/` only — `selfheal-core.js`, `self-heal/pipeline/*`,
`self-heal/schemas/*`, and everything under `self-heal/pretotype/` were read, never modified.

Run in real Chrome (Claude-in-Chrome MCP, own tab) via `python3 -m http.server 8791 --bind 127.0.0.1`
from the worktree root, at `http://127.0.0.1:8791/self-heal/benchmark/eval-gate.html`.

## Verdict: **GO** · false-heal = **0 / 13** (measured) · match = **13 / 13** (measured) · regressions vs baseline = **0** · 0 console errors

| case | source | expected | actual | false-heal | match |
|------|--------|----------|--------|------------|-------|
| F-T1-pristine | fixtures.js:T1\|pristine | heal/DRIFT | heal/DRIFT | — | ✓ |
| F-T1-restyle | fixtures.js:T1\|restyle | heal/DRIFT | heal/DRIFT | — | ✓ |
| F-T1-localize | fixtures.js:T1\|localize | heal/DRIFT | heal/DRIFT | — | ✓ |
| F-T2-pristine | fixtures.js:T2\|pristine | heal/DRIFT | heal/DRIFT | — | ✓ |
| F-T3-pristine | fixtures.js:T3\|pristine | abstain/AMBIGUITY | abstain/AMBIGUITY | — | ✓ |
| F-T4-pristine | fixtures.js:T4\|pristine | heal/DRIFT | heal/DRIFT | — | ✓ |
| F-T5-pristine | fixtures.js:T5\|pristine | heal/DRIFT | heal/DRIFT | — | ✓ |
| P-C1 | payment-fixtures.js:C1 | abstain/REMOVAL | abstain/REMOVAL | — | ✓ |
| P-C2 | payment-fixtures.js:C2 | abstain/STATE_ISSUE | abstain/STATE_ISSUE | — | ✓ |
| P-C3 | payment-fixtures.js:C3 | heal/DRIFT (via context) | heal/DRIFT | — | ✓ |
| P-C4 | payment-fixtures.js:C4 | fail/REMOVAL | fail/REMOVAL | — | ✓ |
| P-C5 | payment-fixtures.js:C5 | abstain/AMBIGUITY | abstain/AMBIGUITY | — | ✓ |
| P-C6 | payment-fixtures.js:C6 | heal/DRIFT | heal/DRIFT | — | ✓ |

All numbers above are `measured` (a real run, in a real browser, against the real — unmodified —
matcher core + pipeline). `baseline.json` was generated FROM this run, not authored by hand.

## Corpus (13 cases; nothing hand-authored)

- 7 cases from `self-heal/pretotype/fixtures.js` (`PRETOTYPE_FIXTURES.EXPECTED.report.finals`) — the
  adversarial login screen across pristine/restyle/localize drift, plus the negative test and the
  nameless-icon ambiguity case.
- 6 cases from `self-heal/pretotype/payment-fixtures.js` (`PAYMENT_FIXTURES.CASES`) — the complex
  checkout screen: disabled CTA, popup-over-popup, identical twin rows (context disambiguation),
  role-less portal option, nameless gear icon, drift-under-a-modal.

**One documented exclusion**: `fixtures.js:T1|appbug` (`EXPECTED.report.finals["T1|appbug"]=FAILED`,
category `APP_BUG`). Traced through `flow-pretotype.js`'s `runTest()`: this row mounts the *undrifted*
login DOM (the matcher resolves it via heal/cache — `matchStep` never returns `'fail'` for it) and
only fails a **post-heal assertion** (`verifyEffect`: no "Dashboard" text after a click the app never
actioned). That is an app-bug / verify-by-effect case, not a `matchStep`/`diagnose` case. Registering
an `expectedVerdict:'fail'` for it would be fabricated — the matcher can structurally never produce
that verdict for this DOM state, so the case could never pass and would misrepresent what this gate
measures. Kept as a documented, non-runnable entry (`SELFHEAL_BENCHMARK_EXCLUDED`) for traceability
so nothing from `EXPECTED.report.finals` is silently dropped without a reason.

## Vocabulary mapping (not invented — reused from the already-GO `payment-pretotype.html` runner)

`expectedVerdict` is in `matchStep`'s own vocabulary (`heal`/`abstain`/`fail`), not the higher-level
report vocabulary (`PASS`/`PASS_HEALED`/`ABSTAIN`/`FAILED`). The mapping
`PASS/PASS_HEALED -> heal`, `ABSTAIN -> abstain`, `FAILED -> fail` is exactly what
`payment-pretotype.html`'s own (already-validated) case runner already uses. `expectedCategory` for
any heal is `'DRIFT'` — `change-diagnosis.js`'s `diagnoseFailure()` returns that category
unconditionally for `verdict==='heal'`; `fixtures.js` only pre-registers categories for its two
non-heal rows (T3, T1\|appbug), so `'DRIFT'` on the heal rows is that established default filled in,
not a new expectation.

## False-heal definition (the ceiling this gate exists to protect)

- actual verdict `heal`, expected verdict `heal` → false-heal iff resolved element's `data-oracle` !=
  the case's ground-truth oracle (healed to the **wrong** element).
- actual verdict `heal`, expected verdict `abstain`/`fail` → **always** a false-heal (healed at all
  when it should have abstained/failed), regardless of which element it resolved to.
- actual verdict `abstain`/`fail` → never a false-heal (nothing to heal wrong).

## Regression check vs `baseline.json`

`eval-gate.html` fetches `baseline.json` (the "last known good" snapshot, generated FROM the first
clean run of this gate) and flags a regression when, for the same case id:
1. its match-vs-expectation status flipped in **either** direction (a case that passed now fails, or
   a case that failed now passes — both flagged, not just regressions), OR
2. it was already non-matching in both runs, but the underlying `actualVerdict`/`actualCategory`
   changed anyway — silent drift in the matcher's failure *mode* while it stays non-matching. (Added
   during code review — see below; the bare pass/fail-flip check alone misses this.)

GO requires **both** `falseHealCount === 0` **and** `regressions.length === 0`.

## Code review (`code-review` skill, effort high, two parallel angle-groups)

Two review agents ran in parallel over `corpus.js` + `eval-gate.js` + `eval-gate.html`: one on
correctness (false-heal derivation, exception handling, cross-file call compatibility, JS pitfalls),
one on reuse/simplification/efficiency/altitude + CLAUDE.md conventions.

**Confirmed finding, fixed**: `computeRegressions()`'s original guard (`if (b.match !== r.match)`)
only fired on a pass/fail-status flip. When a case was ALREADY not matching its expectation in both
the baseline and the current run, a change in *which way* it was wrong (e.g.
`abstain/AMBIGUITY -> fail/REMOVAL`) went unflagged, since `false !== false` is `false`. This did not
compromise the false-heal ceiling itself (`falseHealCount` is recomputed fresh every run, never
diffed, so a genuinely new false-heal always trips the absolute `falseHealCount===0` check regardless
of baseline), but it was a real blind spot for silent matcher drift between two already-failing
states. **Fixed** in `eval-gate.js`'s `computeRegressions()`: now also flags `outcomeDrifted` when
`b.match===r.match===false` but `actualVerdict`/`actualCategory` differ. Re-ran the gate after the fix
— still GO, 13/13, false-heal 0.

**Two more confirmed findings from the cleanup/conventions reviewer, both fixed**:
1. `eval-gate.html`'s upfront script-load guard (`missing = [...]`) listed 6 required globals but
   omitted `SELFHEAL_CANDGEN` (`candidate-generation.js`), which the context-disambiguation case
   (P-C3) depends on — if that script failed to load, the clear top-level "Scripts did not load"
   banner wouldn't fire; the failure would surface only as one confusing per-case `ERROR` row instead.
   **Fixed**: added `'SELFHEAL_CANDGEN'` to the guard list.
2. `toFlywheelEvents()`'s `app` field was inferred by regex-matching the human-readable `source`
   string (`/^fixtures\.js/`), an implicit, undocumented coupling to `corpus.js`'s current naming —
   any future corpus source with a different `source` prefix would silently mis-tag as
   `'fixture:payment'` with no error. **Fixed**: `corpus.js` now carries an explicit `app` field per
   case (`'fixture:login'` / `'fixture:payment'`), threaded through `runCase`'s result object and
   read directly in `toFlywheelEvents` — no string-pattern inference left.

Re-ran the gate after both fixes — still GO, 13/13, false-heal 0, 0 regressions, flywheel export
still schema-valid (13/13 rows), confirmed `app` now reads e.g. `{testId:'F-T1-pristine',
app:'fixture:login'}` from the explicit field.

One additional finding was reported as harmless/optional and left as-is: `corpus.js`'s eager
`mountHtml: PF.STATES[c.exec]()` call at corpus-build time (for the diff-table display) duplicates
one DOM-string build per payment case at load time; the reviewer confirmed `PAYMENT_FIXTURES.STATES`
generators are pure (no `Math.random`/`Date.now`/counters), so this is redundant work only, not a
correctness risk, and not worth the added indirection of lazy rendering for ~6 short template strings.

No other correctness bugs found. The reviewer explicitly walked the false-heal derivation, exception
paths (a thrown error is always `match:false, falseHeal:false`, never silently skipped or counted as
a pass), the `getStage()` per-case try/catch boundary, `PAYMENT_FIXTURES.STATES`' purity (no shared
mutable state across eager `mountHtml` snapshot calls in `corpus.js`), and confirmed the `localize`
drift's `TreeWalker(SHOW_TEXT)` structurally cannot touch `data-oracle` attributes (attributes are
never visited by a text-only TreeWalker).

## Regression sanity check (proves the gate can actually FAIL, not just always print GO)

Run live in-browser against the loaded `window.SELFHEAL_BENCHMARK_CORPUS` (in-memory only — never
touched `corpus.js` on disk):

1. Mutated `F-T3-pristine`'s `expectedVerdict`/`expectedCategory` from `abstain/AMBIGUITY` to
   `heal/DRIFT` (simulating "the corpus now expects something the matcher doesn't actually do").
2. Re-ran `runBenchmark(corpus, document, baseline)` → **decision: FAIL**, `matchCount` dropped to
   `12/13`, and `regressions` correctly listed `F-T3-pristine` as `REGRESSED`
   (`baselineMatch:true -> currentMatch:false`, verdict/category unchanged — proving this is the
   *expectation* that drifted, not the matcher).
3. Reverted the mutation, re-ran → **decision: GO**, `13/13`, `0` regressions again.

This confirms the gate is a real gate: a genuine divergence renders `FAIL` and populates the
regressions table, not a banner that always says GO.

## Does NOT prove (honest scope boundary — same discipline as `PRETOTYPE-RUN.md`)

- **Not CI.** No `.github/workflows/*.yml` exists (no Node/CI runner in this environment, per project
  rules) — this is an in-browser, human/future-CI-readable PASS/FAIL harness, not a wired CI gate.
- **Not a heal-rate benchmark.** All 13 cases are synthetic/adversarial fixtures (Wizard-of-Oz drift),
  not real-app failures — this measures "does the matcher's behavior on a fixed, labelled corpus stay
  exactly what it was," not "what % of real breakages heal correctly" (that's D1 — real Pattern-A
  failure DOMs, still an open blocker per `context.md`).
- **Cold matcher only.** Cases run raw `matchStep`/`disambiguateByContext` per case; the brain/cache
  layer (`self-heal/brain/`) is a separate concern with its own test suite and is not exercised here.
- All false-heal/match counts above are labelled `measured` (13/13 cases, one real Chrome run) — no
  percentage is reported without this labelled set attached.

## Local test-only files (not committed)

To run this gate against the real fixtures, `self-heal/pretotype/fixtures.js`,
`self-heal/pretotype/payment-fixtures.js`, `self-heal/schemas/validator.js`, and
`self-heal/schemas/flywheel-event.schema.js` were copied (unmodified) from the `claude/peaceful-ride-9d7661`
branch's worktree into this session's isolated worktree, purely so the relative `<script src>` paths
in `eval-gate.html` resolve locally. These are **read-only, uncommitted, local-only copies** — they
are owned by other sessions (S0/S1) on that branch and are not part of this session's commit. Once
this branch and `claude/peaceful-ride-9d7661` are merged, both sets of files land at their real,
canonical paths together.

## Optional: flywheel-event/v1 export

`eval-gate.js` exposes `toFlywheelEvents(results)`, mapping each case outcome to a
`flywheel-event/v1`-shaped row (`self-heal/schemas/flywheel-event.schema.js`), validated in
`eval-gate.html` via `self-heal/schemas/validator.js`. All 13 rows validate cleanly
(`schema-valid`). `verify_confidence` is always `'simulated'` so these benchmark rows are logged but
can never be promoted to the brain — this gate measures the matcher, it does not train it. Not
required by the brief; included because it was low-risk and makes a benchmark run directly
consumable by the S3 report session without a separate adapter.
