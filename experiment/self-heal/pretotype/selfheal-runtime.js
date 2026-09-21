/* self-heal/pretotype/selfheal-runtime.js — S7 LIVE executor (prototype of the real selfheal-runtime).
 *
 * The missing keystone: snapshot -> resolve(+heal) -> ACT (real DOM events) -> observe -> verify-by-effect.
 * Turns S6's MOCK "asserted" into a REAL verified outcome, so verify_confidence is genuinely HIGH/MEDIUM
 * and the 3-way rule (outcome-verification.decide) applies — and HIGH outcomes become eligible to learn
 * from (learning-loop OV#4 gate), which simulated runs never were.
 *
 * SCOPE (pretotype): synthetic events on an INTERACTIVE in-page fixture. Real-app live execution needs
 * trusted events (chrome.debugger/CDP) + test-data/state safety -> the real MV3 extension, NOT here.
 *
 * S8 addition — OPTIONAL brain-first wiring (backward compatible; existing callers unaffected):
 *   executeLive(scopeEl, test, opts) takes an OPTIONAL opts.brain (self-heal/brain/brain.js instance)
 *   and opts.ladder (self-heal/pipeline/learning-loop.js instance). When BOTH are supplied AND the
 *   ladder says a given step's key (test.id + ':' + step._anchor.stepId) is tier 'L2', locateAndAct()
 *   tries brain.get() FIRST and, on a hit, acts directly on the resolved element — skipping matchStep
 *   for that step only. brain.get() itself still re-checks the cached selector resolves to exactly ONE
 *   live element (S2's existing safety check — reused here, not re-implemented). On a brain miss (even
 *   at L2 — e.g. the element is gone/duplicated now) it falls straight through to the real matcher,
 *   exactly as if no brain had been supplied — a cache hit is never assumed, only ever confirmed live.
 *   verify-by-effect below is UNCHANGED and ALWAYS runs regardless of which path located the element —
 *   the false-heal firewall never gets skipped, only re-matching does. Callers that omit opts (or omit
 *   opts.brain/opts.ladder) get byte-identical behaviour to before this change.
 *
 * firstTry addition (P1-tightening) — additive READ-ONLY observation, selfheal-core.js untouched:
 *   each step row now carries firstTry (true|false|null) — did the RECORDED bestLocator still uniquely
 *   resolve to the element the runtime ended up acting on? true = primary anchor held, no heal was
 *   needed. false = matcher had to lean on descriptor scoring to relocate (a heal occurred). null =
 *   inherently N/A (assert/navigate, no bestLocator recorded, or the anchor uses core's role=/name=
 *   pseudo-selector which is not a real CSS selector). Test-level result.firstTry aggregates across
 *   locate-only steps: any false → false; all true → true; else null. Downstream report/panel count
 *   only rows with firstTry===true|false, so absent/null is never miscounted either way.
 */
(function (root) {
  const S = root.SELFHEAL, V = root.SELFHEAL_VERIFY, CG = root.SELFHEAL_CANDGEN, DG = root.SELFHEAL_DIAGNOSIS,
        TW = root.SELFHEAL_TEMPORALWAIT, SP = root.SELFHEAL_SEARCHPICK;
  let _h = 0; const hash = s => { _h = 0; for (let i = 0; i < s.length; i++) _h = (_h * 31 + s.charCodeAt(i)) >>> 0; return _h; };

  // snapshot the observable state of a scope (+ whether a specific anchor element is still present)
  function snapshot(scopeEl, anchorStep) {
    let has = null;
    if (anchorStep) { try { const r = S.matchStep(scopeEl.ownerDocument, anchorStep, { gate: false }); has = r.verdict === 'heal'; } catch (e) {} }
    return { url: location.href, domHash: hash(scopeEl.innerHTML), text: (scopeEl.textContent || '').replace(/\s+/g, ' ').trim(), has };
  }

  // perform a real action on a located element (synthetic events — fine for our fixture's handlers)
  function act(el, action, value) {
    if (action === 'fill') {
      el.focus(); el.value = value == null ? '' : value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    if (action === 'click') { el.click(); return true; }   // real click → fires the page's handlers
    return false;
  }

  // firstTry: did the RECORDED bestLocator still uniquely resolve to the element we ended up acting on?
  // If yes → the primary anchor held; no heal was needed (firstTry=true). If no (locator missing, gone,
  // or now resolves to a different element) → the matcher had to lean on descriptor scoring to relocate
  // (firstTry=false, i.e. a heal occurred). Returns null when the recorded anchor never had a bestLocator
  // (no-anchor descriptor) — that case is inherently "no primary anchor to try first" so we honestly say
  // unknown, not false. Additive READ-ONLY observation over already-recorded fields — selfheal-core.js
  // is unchanged.
  function firstTryFromLocator(doc, anchor, actedEl) {
    const bl = anchor && anchor.target && anchor.target.bestLocator;
    if (!bl || !actedEl) return null;
    if (String(bl).indexOf('role=') === 0) return null;   // core's role+name pseudo-selector is not a real CSS selector; we can't reproduce that fallback here honestly
    try {
      const list = doc.querySelectorAll(bl);
      return list.length === 1 && list[0] === actedEl;
    } catch (e) { return null; }
  }

  // resolve an OpenTest.ai step's NL target via its captured _anchor (heal-aware), then act.
  // opts.brain/opts.ladder/opts.testId are OPTIONAL (S8) — see header. Omitting any of them falls back
  // to the original always-matcher path unchanged.
  //
  // P2 T5.1 (S9 lever wiring): ASYNC now (temporal-wait polls on a real timer) — every caller has been
  // updated to `await` this. When the base match doesn't heal, the diagnosed CATEGORY picks a named
  // lever, never a guess: TEMPORAL-shaped failures (change-diagnosis.js's REMOVAL, honestly ambiguous
  // between "removed" and "not yet rendered") get a BOUNDED wait; AMBIGUITY/REMOVAL get a scope-widened
  // search. Both levers mirror matchStep's own result shape and carry their OWN safety gates (identity
  // floor, exact-anchor-or-strong-tier-only auto-accept) — this function never loosens them, it only
  // decides WHEN to ask. If neither lever is loaded (older callers / lever-tests.html's standalone
  // harness) behaviour is byte-identical to before this change.
  async function locateAndAct(scopeEl, step, opts) {
    opts = opts || {};
    if (!step._anchor) return { located: false, acted: false, reason: 'no anchor', firstTry: null };
    const stepId = step._anchor.stepId;
    const doc = scopeEl.ownerDocument;

    if (opts.brain && opts.ladder && opts.testId && stepId && opts.ladder.tier(opts.testId, stepId) === 'L2') {
      const hit = opts.brain.get(opts.testId, stepId, doc);   // re-verifies live uniqueness itself
      if (hit) {
        // Capture firstTry BEFORE act() — a submit-click can replace the DOM, retroactively voiding
        // the recorded bestLocator ("form submitted → success page → #cSubmit gone") and mis-labelling
        // a clean first-try match as a heal. Snapshot uniqueness at act time, not after side effects.
        const ft = firstTryFromLocator(doc, step._anchor, hit.el);
        const ok = act(hit.el, step.action, step.value);
        return { located: true, acted: ok, el: hit.el, stepId, servedBy: 'brain', firstTry: ft };
      }
      // L2 but the brain came up cold (element gone/now-ambiguous) -> never guess, fall through to matcher below
    }

    // K19/K27 wiring (P2 T4.1): when the candidate-generation pipeline module is loaded, route through
    // disambiguateByContext instead of a bare matchStep — it calls matchStep internally and ONLY
    // changes the outcome when a margin-TIE exists and the step's captured `context` (rowText/ordinal)
    // can safely break it (see candidate-generation.js's floor+margin safety gates). When there is no
    // tie, or no context was recorded, it returns matchStep's own base result unchanged — so every
    // existing archetype (forms/login) is byte-identical, and only row-action archetypes gain the lever.
    let r = (CG && typeof CG.disambiguateByContext === 'function')
      ? CG.disambiguateByContext(doc, step._anchor, { gate: true })
      : S.matchStep(doc, step._anchor, { gate: true });
    let lever = null;

    if (r.verdict !== 'heal' || !r.best) {
      const diag0 = (DG && DG.diagnoseFailure(r)) || { category: 'UNKNOWN' };
      if (diag0.category === 'REMOVAL' && TW && typeof TW.waitAndMatch === 'function') {
        lever = 'temporal-wait';                        // mark TRIED before the call — a failed attempt is still an attempt
        const waited = await TW.waitAndMatch(doc, step._anchor, {});
        r = waited;                                    // adopt it either way — richer diagnosis on timeout too
      }
      if (r.verdict !== 'heal' || !r.best) {
        const diag1 = (DG && DG.diagnoseFailure(r)) || diag0;
        if ((diag1.category === 'AMBIGUITY' || diag1.category === 'REMOVAL') && SP && typeof SP.searchAndPick === 'function') {
          lever = 'search-and-pick';                    // supersedes temporal-wait: this is the lever that produced the FINAL result
          const widened = SP.searchAndPick(doc, step._anchor, {});
          r = widened;
        }
      }
    }

    if (r.verdict !== 'heal' || !r.best) return { located: false, acted: false, verdict: r.verdict, result: r, stepId, servedBy: 'matcher', firstTry: null, lever };
    const ft = firstTryFromLocator(doc, step._anchor, r.best.el);
    const ok = act(r.best.el, step.action, step.value);
    return { located: true, acted: ok, el: r.best.el, stepId, servedBy: lever || 'matcher', firstTry: ft, via: r.via || lever || null };
  }

  // confidence of the effect we can verify (mirrors outcome-verification.CONFIDENCE)
  function pickExpect(test, navigatedAway, dashboardText) {
    // positive flows that unmount the recorded field → elementGone (HIGH). else text presence (MEDIUM).
    if (test.kind !== 'negative' && navigatedAway) return { type: 'elementGone' };
    return { type: 'textPresent', value: dashboardText };
  }

  // execute a whole OpenTest.ai test LIVE against a scope element; return the verified 3-way outcome.
  // opts (OPTIONAL, S8): { brain, ladder } — threaded into locateAndAct so brain-first only kicks in
  // when both are supplied AND the ladder has promoted this specific step. Omit opts entirely (as every
  // pre-S8 caller does) for byte-identical behaviour.
  // P2 T5.1: now ASYNC (locateAndAct awaits temporal-wait's real timer) — every caller must `await` this.
  async function executeLive(scopeEl, test, opts) {
    opts = opts || {};
    const steps = []; let blocked = null;
    // sentinel anchor = the test's first fill target (the field that should disappear on success)
    const sentinel = (test.steps.find(s => s.action === 'fill') || {})._anchor || null;
    const before = snapshot(scopeEl, sentinel);

    for (const st of test.steps) {
      const row = { action: st.action, target: st.target, value: st.value || null, located: null, acted: false, firstTry: null };
      if (st.action === 'navigate') { row.acted = true; steps.push(row); continue; }
      if (st.action === 'assert') { steps.push(row); continue; }     // assert has no locate-and-heal semantics; firstTry stays null so aggregators exclude it
      const a = await locateAndAct(scopeEl, st, { brain: opts.brain, ladder: opts.ladder, testId: test.id });
      row.located = a.located; row.acted = a.acted; row.stepId = a.stepId || null; row.servedBy = a.servedBy || null;
      row.firstTry = (typeof a.firstTry === 'boolean') ? a.firstTry : null;
      row.via = a.via || null;   // 'context' when K19/K27 row-text disambiguation broke a margin tie
      row.lever = a.lever || null;   // 'temporal-wait' | 'search-and-pick' when a P2 T5.1 lever was tried
      steps.push(row);
      if (!a.located) { blocked = { st, r: a.result }; break; }
    }

    // firstTry aggregation across locate-only steps (assert/navigate excluded — the runtime already
     //   set their firstTry to null above, so this filter is redundant *now* but keeps the aggregate
     //   correct if a caller extends the action set later). Semantics:
     //     any locate step firstTry===false  → test firstTry=false (heal occurred somewhere)
     //     every locate step firstTry===true → test firstTry=true  (matcher's first choice held throughout)
     //     otherwise (all null / mixed null with none false, or no locate steps at all) → null (unknown; not counted)
    function aggregateFirstTry(rows) {
      const loc = rows.filter(s => s.action !== 'assert' && s.action !== 'navigate');
      if (loc.some(s => s.firstTry === false)) return false;
      if (loc.length > 0 && loc.every(s => s.firstTry === true)) return true;
      return null;
    }

    if (blocked) {
      const d = root.SELFHEAL_DIAGNOSIS.diagnoseFailure(blocked.r);
      const leverNote = blocked.r && blocked.r.lever ? (' (tried ' + blocked.r.lever + ' — still no safe match)') :
        (blocked.r && blocked.r.timedOut ? ' (tried temporal-wait — timed out)' : '');
      return { id: test.id, title: test.title, kind: test.kind, goal: test.goal, steps,
               located: false, outcome: blocked.r.verdict === 'abstain' ? 'ABSTAIN' : 'FAILED',
               category: d.category, confidence: 'NONE', verified: false,
               verify_confidence: 'NONE', firstTry: aggregateFirstTry(steps),
               prescription: (d.reason || 'add a stable test-id / container hint') + leverNote };
    }

    // observe + verify-by-effect (REAL state change)
    const after = snapshot(scopeEl, sentinel);
    const navigatedAway = before.has === true && after.has === false;     // recorded field gone → real nav
    const assertStep = test.steps.find(s => s.action === 'assert');
    const dashKw = assertStep ? assertStep.target : null;

    let verified, confidence, outcome, category;
    if (test.kind === 'negative') {
      // negative passes when the error condition appears AND we did NOT navigate to success
      const errPresent = assertStep ? new RegExp(dashKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(after.text) : false;
      verified = errPresent && !/dashboard/i.test(after.text);
      confidence = 'MEDIUM'; category = verified ? 'NEG_OK' : 'APP_BUG';
      outcome = verified ? 'PASS' : 'FAILED';
    } else if (!assertStep) {
      // smoke: acted, but no business effect declared → unverifiable → PASS_WARNING (queue human, OV#4)
      verified = null; confidence = 'NONE'; category = 'SMOKE';
      const decSmoke = V.decide(true, { passed: false, confidence: 'NONE' });
      outcome = decSmoke.outcome === 'PASSED_WARNING' ? 'PASS_WARNING' : decSmoke.outcome;   // same translation as below — one outcome vocabulary
    } else if (test.verifyType === 'urlChange') {
      // nav/menus archetype (T4.2): verify-by-effect on BOTH the URL and the DOM — corroborating
      // signals, not either alone. urlChange uses core's OWN verifyEffect (pristine, unmodified);
      // the DOM half reuses the same textPresent check as every other archetype. HIGH confidence only
      // when BOTH moved — a click that changes the URL but shows the wrong view (or vice versa) is
      // exactly the kind of partial/false effect this project exists to catch, so it stays MEDIUM.
      const urlOk = S.verifyEffect(before, after, { type: 'urlChange' });
      const domOk = S.verifyEffect(before, after, { type: 'textPresent', value: dashKw });
      verified = urlOk && domOk;
      confidence = verified ? 'HIGH' : 'MEDIUM';
      const dec = V.decide(true, { passed: verified, confidence });
      outcome = dec.outcome === 'PASSED' ? 'PASS' : (dec.outcome === 'PASSED_WARNING' ? 'PASS_WARNING' : 'FAILED');
      category = verified ? 'VERIFIED' : 'APP_BUG';
    } else {
      const expect = pickExpect(test, navigatedAway, dashKw);
      // build before/after for core verifyEffect (elementGone uses .has; textPresent uses .text)
      verified = S.verifyEffect(before, after, expect);
      confidence = expect.type === 'elementGone' ? 'HIGH' : 'MEDIUM';
      const dec = V.decide(true, { passed: verified, confidence });
      outcome = dec.outcome === 'PASSED' ? 'PASS' : (dec.outcome === 'PASSED_WARNING' ? 'PASS_WARNING' : 'FAILED');
      category = verified ? 'VERIFIED' : 'APP_BUG';
    }

    return { id: test.id, title: test.title, kind: test.kind, goal: test.goal, steps,
             located: true, navigatedAway, outcome, category, verified,
             confidence, verify_confidence: confidence,
             firstTry: aggregateFirstTry(steps),
             prescription: outcome === 'FAILED' ? 'App defect — assertion failed after a REAL action; file a bug' :
                           outcome === 'PASS_WARNING' ? 'unverifiable (no effect declared) — queue for human review' : '—' };
  }

  root.__RUNTIME = { snapshot, act, locateAndAct, executeLive, firstTryFromLocator };
})(typeof window !== 'undefined' ? window : globalThis);
