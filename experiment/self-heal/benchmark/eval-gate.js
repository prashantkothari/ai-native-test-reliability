/* self-heal/benchmark/eval-gate.js — S4 eval-gate harness (roadmap F2: "false-heal cannot regress").
 *
 * window.SELFHEAL_BENCHMARK = { runBenchmark, applyDrift, toFlywheelEvents } (dual export guard,
 * same idiom as self-heal/schemas/validator.js). Depends only on the PUBLIC, unmodified surface of
 * selfheal-core.js (matchStep, captureStep) and self-heal/pipeline/* (diagnoseFailure,
 * disambiguateByContext, captureContext) — never edits them.
 *
 * runBenchmark(corpus, doc, baseline) — for each case: mount capture DOM -> captureStep (+ optional
 * captureContext) -> mount exec DOM -> [apply drift] -> matchStep (or disambiguateByContext) ->
 * diagnoseFailure -> compare {verdict, category, resolved identity} against the case's pre-registered
 * expectation. `baseline` is OPTIONAL — omit it (or call with 2 args, exactly the brief's documented
 * `runBenchmark(corpus, doc)` shape) to run with regressions always []; pass the parsed baseline.json
 * to get real regression detection (eval-gate.html does this).
 *
 * FALSE-HEAL definition is NOT defined here — it is single-sourced in self-heal/schemas/false-heal.js
 * (window.SELFHEAL_FALSEHEAL.isFalseHeal) so the benchmark classifier and S8's live flywheel writer can
 * never disagree on what counts as a false-heal. This file just calls it with data-oracle identities.
 */
(function (root) {
  const S = root.SELFHEAL, CG = root.SELFHEAL_CANDGEN, DG = root.SELFHEAL_DIAGNOSIS, FH = root.SELFHEAL_FALSEHEAL;
  if (!S || !DG) throw new Error('eval-gate.js: SELFHEAL / SELFHEAL_DIAGNOSIS not loaded — load selfheal-core.js + pipeline/change-diagnosis.js first');
  if (!FH) throw new Error('eval-gate.js: SELFHEAL_FALSEHEAL not loaded — load self-heal/schemas/false-heal.js first');

  // ---- drift helper — REIMPLEMENTED here (not imported): flow-pretotype.js documents this exact
  // transform (hash class/id for 'restyle'; reverse text/aria-label/placeholder for 'localize') but
  // keeps it as a private, unexported closure, and flow-pretotype.js is read-only per project rules.
  // Same algorithm, own copy — no new fixture semantics invented, just a reusable utility. ----------
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return 'x' + h.toString(16) + 'bh'; }
  function applyDrift(stageEl, kind) {
    if (!kind || kind === 'pristine') return;
    if (kind === 'restyle') {
      stageEl.querySelectorAll('*').forEach(el => {
        if (el.getAttribute('class')) el.setAttribute('class', hash(el.getAttribute('class')));
        if (el.id) el.id = hash(el.id);
      });
    } else if (kind === 'localize') {
      const rev = s => (s || '').split('').reverse().join('');
      const walker = stageEl.ownerDocument.createTreeWalker(stageEl, NodeFilter.SHOW_TEXT, null);
      const texts = []; let n; while ((n = walker.nextNode())) texts.push(n);
      texts.forEach(t => { if (t.nodeValue.trim()) t.nodeValue = rev(t.nodeValue); });
      stageEl.querySelectorAll('[aria-label],[placeholder]').forEach(el => {
        if (el.getAttribute('aria-label')) el.setAttribute('aria-label', rev(el.getAttribute('aria-label')));
        if (el.getAttribute('placeholder')) el.setAttribute('placeholder', rev(el.getAttribute('placeholder')));
      });
    } else {
      throw new Error('eval-gate.js applyDrift: unknown drift kind "' + kind + '"');
    }
  }

  function getStage(doc) {
    const stage = doc.getElementById('benchStage');
    if (!stage) throw new Error('eval-gate.js: doc needs a <div id="benchStage"></div> mount point (see eval-gate.html)');
    return stage;
  }

  // ---- run one case: mount -> capture -> mount -> drift -> match/diagnose -> classify -----------
  function runCase(c, doc) {
    const base = {
      id: c.id, source: c.source, app: c.app || null, note: c.note, oracle: c.oracle,
      expectedVerdict: c.expectedVerdict, expectedCategory: c.expectedCategory
    };
    try {
      const stage = getStage(doc);

      // 1) capture-time: mount the record-state DOM, capture the recorded step from the oracle element.
      stage.innerHTML = c.captureHtml();
      const capEl = stage.querySelector("[data-oracle='" + c.oracle + "']");
      if (!capEl) {
        return Object.assign({}, base, {
          actualVerdict: 'ERROR', actualCategory: 'ERROR', resolvedOracle: null,
          falseHeal: false, match: false, error: 'capture element not found for oracle "' + c.oracle + '"'
        });
      }
      const step = S.captureStep(capEl, doc, { container: '#benchStage', stepId: c.oracle });
      if (c.context) {
        if (!CG) throw new Error('case requires context disambiguation but SELFHEAL_CANDGEN is not loaded');
        step.context = CG.captureContext(capEl);
      }

      // 2) execute-time: mount the exec-state DOM, apply drift if any.
      stage.innerHTML = c.execHtml();
      applyDrift(stage, c.drift);

      // 3) match (+ pipeline diagnosis) — never touches selfheal-core.js/pipeline source, only calls
      //    their public API, exactly the call shape flow-pretotype.js / payment-pretotype.html use.
      const r = c.context ? CG.disambiguateByContext(doc, step, { gate: true }) : S.matchStep(doc, step, { gate: true });
      const diag = DG.diagnoseFailure(r);
      const actualVerdict = r.verdict;
      const actualCategory = diag.category;
      const resolvedOracle = (actualVerdict === 'heal' && r.best && r.best.el) ? r.best.el.getAttribute('data-oracle') : null;

      // 4) false-heal (single-sourced in schemas/false-heal.js) + match classification.
      const falseHeal = FH.isFalseHeal({
        verdict: actualVerdict, expectedVerdict: c.expectedVerdict,
        resolvedIdentity: resolvedOracle, expectedIdentity: c.oracle
      });
      const identityOk = (c.expectedVerdict === 'heal') ? (resolvedOracle === c.oracle) : true;
      const match = (actualVerdict === c.expectedVerdict) && (actualCategory === c.expectedCategory) && identityOk;

      return Object.assign({}, base, {
        actualVerdict, actualCategory, resolvedOracle, falseHeal, match, error: null, reason: diag.reason
      });
    } catch (e) {
      // A harness exception is a FAILING case, never a silent skip — it must show up in the diff
      // table and must never be counted as a pass or excluded from totalCases/matchCount math.
      return Object.assign({}, base, {
        actualVerdict: 'ERROR', actualCategory: 'ERROR', resolvedOracle: null,
        falseHeal: false, match: false, error: String((e && e.stack) || e)
      });
    }
  }

  // ---- regression detection vs a prior baseline.json snapshot (optional 3rd arg) -----------------
  // Flags TWO kinds of drift, not just the pass/fail-status flip:
  //   (a) b.match !== r.match         — a case's match-vs-expectation status flipped, either
  //                                     direction (brief requirement: "flag both directions").
  //   (b) b.match === r.match === false, but the actual verdict/category changed anyway — the case
  //       was ALREADY not matching its expectation in both runs, but the matcher's failure MODE
  //       silently changed underneath it (e.g. abstain/REMOVAL -> fail/AMBIGUITY). (a) alone would
  //       miss this because b.match !== r.match is false when both sides are false. A brand-new
  //       false-heal is still always caught by the absolute falseHealCount===0 gate regardless of
  //       this function, but this closes the gap for silent drift between two non-matching states.
  function computeRegressions(results, baseline) {
    if (!baseline || !baseline.results) return [];
    const baseById = {};
    baseline.results.forEach(function (b) { baseById[b.id] = b; });
    const regressions = [];
    results.forEach(function (r) {
      const b = baseById[r.id];
      if (!b) return; // new case not present in baseline — not a regression, nothing to compare
      const matchFlipped = b.match !== r.match;
      const outcomeDrifted = b.match === false && r.match === false &&
        (b.actualVerdict !== r.actualVerdict || b.actualCategory !== r.actualCategory);
      if (matchFlipped || outcomeDrifted) {
        regressions.push({
          id: r.id,
          direction: matchFlipped ? ((b.match && !r.match) ? 'REGRESSED' : 'CHANGED') : 'CHANGED', // flag BOTH directions (brief requirement)
          baselineMatch: b.match, currentMatch: r.match,
          baselineVerdict: b.actualVerdict, currentVerdict: r.actualVerdict,
          baselineCategory: b.actualCategory, currentCategory: r.actualCategory
        });
      }
    });
    return regressions;
  }

  function runBenchmark(corpus, doc, baseline) {
    doc = doc || document;
    const results = corpus.map(function (c) { return runCase(c, doc); });
    const falseHealCount = results.filter(function (r) { return r.falseHeal; }).length;
    const matchCount = results.filter(function (r) { return r.match; }).length;
    const totalCases = corpus.length;
    const regressions = computeRegressions(results, baseline);
    return { results, falseHealCount, totalCases, matchCount, regressions };
  }

  // ---- OPTIONAL: flywheel-event/v1 export (self-heal/schemas/flywheel-event.schema.js), so a run
  // of this gate is consumable by the S3 report session as ordinary flywheel rows. verify_confidence
  // is always 'simulated' (never HIGH/MEDIUM) so these benchmark rows are LOGGED but can never be
  // PROMOTED to the brain — this benchmark measures the matcher, it does not train it.
  function toFlywheelEvents(results) {
    const nowIso = new Date().toISOString();
    return results.map(function (r) {
      const outcome = r.actualVerdict === 'heal' ? 'PASS' : (r.actualVerdict === 'abstain' ? 'ABSTAIN' : 'FAILED');
      // `app` is an explicit field the corpus case carries (corpus.js) — not inferred from the
      // human-readable `source` string, so adding a new fixture source can't silently mis-tag it.
      const app = r.app || 'fixture:unknown';
      return {
        schemaVersion: 'flywheel-event/v1', ts: nowIso, app, testId: r.id, stepId: null,
        outcome, verify_confidence: 'simulated', category: r.actualCategory || 'UNKNOWN',
        source: 'simulated', driftKind: null, healed: r.actualVerdict === 'heal',
        false_heal: !!r.falseHeal, diagnosis: r.reason || null, hitl_decision: null
      };
    });
  }

  const API = { runBenchmark, applyDrift, toFlywheelEvents };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.SELFHEAL_BENCHMARK = API;
})(typeof window !== 'undefined' ? window : globalThis);
