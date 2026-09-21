/* self-heal/benchmark/corpus.js — S4 benchmark corpus (roadmap F2: "false-heal cannot regress").
 *
 * READ-ONLY consumer of self-heal/pretotype/fixtures.js (PRETOTYPE_FIXTURES) and
 * self-heal/pretotype/payment-fixtures.js (PAYMENT_FIXTURES). Every case below is assembled FROM
 * those already-authored, already-validated fixtures + their pre-registered expectations (see
 * self-heal/pretotype/PRETOTYPE-RUN.md — GO, false-heal 0/9 on the login flow and 0/6 on the
 * complex payment screen). No new fixture DOM is hand-authored here — this file's only job is to
 * flatten those pre-registered expectations into a flat, run-once benchmark case list for
 * eval-gate.js. Does not modify fixtures.js / payment-fixtures.js / pipeline / selfheal-core.js.
 *
 * Each case carries, beyond the brief's {id, source, mountHtml, expectedVerdict, expectedCategory,
 * note} sketch, the extra fields eval-gate.js needs to actually reproduce a captureStep + matchStep/
 * diagnose call (a single flat HTML string is not enough — capture-time and exec-time state can
 * legitimately differ, e.g. the payment fixtures' disabled-CTA and popup-over-popup cases):
 *   captureHtml()  — fn: DOM to mount + capture the recorded step from (record-time state)
 *   execHtml()     — fn: DOM to mount before matching (execute-time state, PRE-drift)
 *   drift          — null | 'restyle' | 'localize' — applied to execHtml()'s mounted DOM by
 *                    eval-gate.js's own drift helper. flow-pretotype.js documents this exact
 *                    transform (hash class/id for 'restyle'; reverse text/aria-label/placeholder
 *                    for 'localize') but does not export it on window, and flow-pretotype.js is
 *                    read-only per project rules — so eval-gate.js reimplements the SAME documented,
 *                    deterministic transform as a small utility. This is not new fixture content.
 *   oracle         — the data-oracle ground-truth id the resolved element MUST carry for a correct
 *                    heal (the false-heal check below is keyed off this, per-case).
 *   context        — true only for payment C3 (row-text disambiguation via
 *                    candidate-generation.js's disambiguateByContext / captureContext).
 *   app            — explicit provenance tag ('fixture:login' | 'fixture:payment') for the optional
 *                    flywheel-event/v1 export (eval-gate.js's toFlywheelEvents). Deliberately an
 *                    explicit field, not inferred from parsing the human-readable `source` string —
 *                    a code-review finding (see BENCHMARK-RUN.md) flagged the earlier regex-on-source
 *                    approach as a silent-mistag risk for any future corpus source.
 *   mountHtml      — a static exec-state HTML *snapshot* (pre-drift), included to satisfy the
 *                    brief's named field and for the diff-table/log to show something readable.
 *                    The actual run never reads this field — it always re-derives the DOM fresh via
 *                    captureHtml()/execHtml()/drift so mounting exactly follows the established
 *                    flow-pretotype.js / payment-pretotype.html idiom (mount -> capture -> mount ->
 *                    [drift] -> match), not a frozen string.
 *
 * expectedVerdict is in matchStep's OWN vocabulary {heal, abstain, fail} — not the higher-level
 * report vocabulary {PASS, PASS_HEALED, ABSTAIN, FAILED} that fixtures.js / payment-fixtures.js use.
 * The mapping PASS/PASS_HEALED->'heal', ABSTAIN->'abstain', FAILED->'fail' is not invented here — it
 * is exactly the mapping payment-pretotype.html's own (already-GO) case runner uses:
 *   `if (r.verdict === 'heal') { final = ... } else if (r.verdict === 'abstain') { final = 'ABSTAIN' }
 *    else { final = 'FAILED' }`
 * expectedCategory follows change-diagnosis.js's own taxonomy. For any heal, diagnoseFailure()
 * unconditionally returns category 'DRIFT' (its own convention — see change-diagnosis.js line ~20),
 * regardless of whether the DOM actually drifted; fixtures.js only pre-registers a category for its
 * two NON-heal rows (T3, T1|appbug), so 'DRIFT' on the heal rows below is that same established
 * default filled in — not a new, fabricated expectation.
 *
 * EXCLUDED ON PURPOSE — fixtures.js 'T1|appbug' (EXPECTED.report.finals: FAILED / APP_BUG).
 * Tracing flow-pretotype.js's runTest(): the T1|appbug row mounts the UNDRIFTED login DOM (matching
 * succeeds via heal/cache — matchStep never returns 'fail' for it) and only fails a POST-heal
 * assertion (verifyEffect: no "Dashboard" text after a click the app never actioned) — this is an
 * app-bug / verify-by-effect case, not a matchStep/diagnose case. Asserting expectedVerdict:'fail'
 * for it here would be fabricated (matchStep can structurally never produce 'fail' for this exact
 * DOM state, so the case could never pass and would misrepresent what a matcher benchmark measures).
 * See BENCHMARK-RUN.md for this decision log.
 */
(function (root) {
  const FX = root.PRETOTYPE_FIXTURES;
  const PF = root.PAYMENT_FIXTURES;
  if (!FX || !PF) throw new Error('corpus.js: PRETOTYPE_FIXTURES / PAYMENT_FIXTURES not loaded — load fixtures.js + payment-fixtures.js first');

  // ---- fixtures.js:T* — login screen; single capture/exec DOM (LOGIN_DOM), drift applied at exec ----
  function loginCase(id, testId, drift, expectedVerdict, expectedCategory, note) {
    const test = FX.TESTS.find(t => t.id === testId);
    if (!test) throw new Error('corpus.js: unknown fixtures.js TESTS id ' + testId);
    return {
      id, source: 'fixtures.js:' + testId + '|' + (drift || 'pristine'), app: 'fixture:login',
      captureHtml: function () { return FX.LOGIN_DOM; },
      execHtml: function () { return FX.LOGIN_DOM; },
      mountHtml: FX.LOGIN_DOM,
      drift: drift || null,
      oracle: test.target,
      context: false,
      expectedVerdict: expectedVerdict, expectedCategory: expectedCategory,
      note: note
    };
  }

  const FIXTURES_CASES = [
    loginCase('F-T1-pristine', 'T1', null, 'heal', 'DRIFT',
      'happy-path login; fixtures EXPECTED.report.finals["T1|pristine"]=PASS'),
    loginCase('F-T1-restyle', 'T1', 'restyle', 'heal', 'DRIFT',
      'class/id hashed by restyle; type=submit anchor survives -> heals; EXPECTED["T1|restyle"]=PASS_HEALED'),
    loginCase('F-T1-localize', 'T1', 'localize', 'heal', 'DRIFT',
      'visible text reversed by localize; id/name/type untouched -> resolves cleanly; EXPECTED["T1|localize"]=PASS'),
    loginCase('F-T2-pristine', 'T2', null, 'heal', 'DRIFT',
      'negative test (wrong password); matcher still resolves submit correctly (assertion semantics are separate); EXPECTED["T2|pristine"]=PASS'),
    loginCase('F-T3-pristine', 'T3', null, 'abstain', 'AMBIGUITY',
      'nameless icon button; tied with other same-role/tag buttons -> correctly abstains; EXPECTED["T3|pristine"]=ABSTAIN/AMBIGUITY'),
    loginCase('F-T4-pristine', 'T4', null, 'heal', 'DRIFT',
      'EXPECTED["T4|pristine"]=PASS'),
    loginCase('F-T5-pristine', 'T5', null, 'heal', 'DRIFT',
      'EXPECTED["T5|pristine"]=PASS'),

    // ---- F-T3-removed: false-heal regression guard (selfheal-core.js no-anchor veto, 2026-07-02) ----
    // NOT built via loginCase() — that helper always uses the SAME LOGIN_DOM for capture and exec (only
    // `drift` differs). This case needs a genuinely DIFFERENT exec-state DOM (the eye button structurally
    // removed, not just restyled/localized), which is exactly the captureHtml()/execHtml()-as-separate-
    // functions shape this file's header already documents for the payment cases (see header comment).
    // Same target as F-T3-pristine (T3's nameless eye icon — no testid/id/name/nameAttr; see fixtures.js
    // header), but here the control is genuinely GONE at exec time, not merely tied with a look-alike.
    // Pre-fix (LEVERS-RUN.md): matchStep healed this to the UNRELATED "Continue with Google" SSO button
    // (verdict:'heal', margin:0.187) because both remaining candidates only share generic DOM *context*
    // signals (role/tag/type/inForm/formAction) — not real identity — so elimination alone cleared
    // TH.heal+TH.margin. Must ABSTAIN with a named reason (selfheal-core.js's noAnchorVeto ->
    // diagnosis:'no-anchor' -> change-diagnosis.js maps this to AMBIGUITY, NOT REMOVAL: a candidate
    // DID clear the heal threshold, so this is a policy decline, not "nothing matched" — see
    // change-diagnosis.js's dedicated 'no-anchor' case for the full reasoning).
    {
      id: 'F-T3-removed', source: 'fixtures.js:T3|removed(eye)', app: 'fixture:login',
      captureHtml: function () { return FX.LOGIN_DOM; },
      execHtml: function () { return FX.LOGIN_DOM.replace(/<button type="button" class="icon"[\s\S]*?<\/button>\s*/, ''); },
      mountHtml: FX.LOGIN_DOM.replace(/<button type="button" class="icon"[\s\S]*?<\/button>\s*/, ''),
      drift: null,
      oracle: 'eye',
      context: false,
      expectedVerdict: 'abstain', expectedCategory: 'AMBIGUITY',
      note: 'nameless eye icon (T3 target) removed entirely from the exec DOM; must not heal to the ' +
        'unrelated SSO button by elimination — regression guard for the no-anchor veto (was heal/SSO, ' +
        'margin 0.187, before the 2026-07-02 selfheal-core.js fix); see self-heal/tools/CORE-FIX-RUN.md'
    }
  ];

  // ---- payment-fixtures.js:C* — cap-state capture, exec-state match (+ optional drift/context) ----
  const VERDICT_OF = { PASS: 'heal', PASS_HEALED: 'heal', ABSTAIN: 'abstain', FAILED: 'fail' };
  function paymentCase(c) {
    if (!VERDICT_OF[c.want.final]) throw new Error('corpus.js: unmapped payment-fixtures want.final ' + c.want.final);
    return {
      id: 'P-' + c.id, source: 'payment-fixtures.js:' + c.id, app: 'fixture:payment',
      captureHtml: PF.STATES[c.cap], execHtml: PF.STATES[c.exec], mountHtml: PF.STATES[c.exec](),
      drift: c.drift || null, oracle: c.oracle, context: !!c.context,
      expectedVerdict: VERDICT_OF[c.want.final], expectedCategory: c.want.category,
      note: c.label + ' (' + c.hard + '); payment-fixtures want=' + c.want.final + '/' + c.want.category
    };
  }
  const PAYMENT_CASES = PF.CASES.map(paymentCase);

  const CORPUS = FIXTURES_CASES.concat(PAYMENT_CASES);

  // Documented exclusion (see header) — not a runnable case, kept only for traceability so the
  // corpus's coverage of EXPECTED.report.finals is auditable (nothing silently dropped).
  const EXCLUDED = [
    {
      source: 'fixtures.js:T1|appbug',
      expectedFinal: 'FAILED', expectedCategory: 'APP_BUG',
      reason: 'app-bug / verify-by-effect case (post-heal assertion failure), not a matchStep/diagnose case — see corpus.js header comment and BENCHMARK-RUN.md'
    }
  ];

  root.SELFHEAL_BENCHMARK_CORPUS = CORPUS;
  root.SELFHEAL_BENCHMARK_EXCLUDED = EXCLUDED;
  if (typeof module !== 'undefined' && module.exports) module.exports = { CORPUS: CORPUS, EXCLUDED: EXCLUDED };
})(typeof window !== 'undefined' ? window : globalThis);
