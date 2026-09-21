/* self-heal/pipeline/search-and-pick.js — S9 lever 1: widen the search scope for AMBIGUITY /
 * some REMOVAL cases (change-diagnosis.js taxonomy) where the recorded element MIGHT still exist
 * on the page, just outside the originally-recorded container (moved to a sibling panel/tab).
 *
 * Depends on the validated matcher core (window.SELFHEAL / require('../../selfheal-core.js')) and
 * consumes ONLY its public surface (matchStep, descFromStep, bestLocator, looksHashed, WEB.actionable).
 * Does NOT modify the core, and does NOT modify any other pipeline/runtime/shell/brain file.
 * STANDALONE / ADDITIVE: nothing currently imports this module; a future wiring session calls it
 * as an alternative strategy when matchStep on the recorded container comes back non-heal.
 *
 * ============================== API CONTRACT (read this, not the code) =====================
 * SELFHEAL_SEARCHPICK.searchAndPick(doc, step, opts) -> result object (SYNCHRONOUS, no Promise)
 *
 *   doc  : Document (or DOM subtree root) to search.
 *   step : the same §9 recorded-step object matchStep(doc, step, opts) accepts elsewhere
 *          (step.target.descriptor, step.scope.container, ...). NOT mutated.
 *   opts : {
 *     container      : CSS selector for the scope to try FIRST (defaults to step.scope.container,
 *                      i.e. "start here" — mirrors captureStep's `container` option). Pass null/''
 *                      explicitly to skip straight to the widened search.
 *     widerContainer : CSS selector for the WIDENED scope (defaults to null = whole visible
 *                      document). Use this to widen to a named broader ancestor instead of the
 *                      whole page (e.g. '#app-shell') if the caller knows one.
 *     gate           : same meaning as matchStep's opts.gate (actionability gate; default on).
 *     scopeVisible   : same meaning as matchStep's opts.scopeVisible (default on).
 *   }
 *
 *   Returns a result shape that MIRRORS matchStep()'s (`{verdict, best, margin, diagnosis, cands,
 *   ranked}`) so a caller can treat this as a drop-in "try again with a wider scope" call, PLUS:
 *     widened   : false if the original/narrow scope already healed (no widening needed),
 *                 true if the result came from the widened search.
 *     scope     : the CSS-selector scope (or null for whole-doc) that produced this result.
 *     lever     : 'search-and-pick' (so a report/log can attribute the heal to this lever).
 *     matchedBy : only set when widened===true and verdict==='heal':
 *                   'strong-anchor'      — exactly one candidate in the wider scope shares the
 *                                          recorded testid (or non-hashed stable id) — the SAFE
 *                                          auto-accept path described in the S9 brief.
 *                   'score+anchor-tier'  — no exact anchor-value match, but the wider-scope
 *                                          score-based winner (a) clears the core's own
 *                                          heal+margin thresholds AND (b) its OWN locator tier
 *                                          is testid/stable-id (bestLocator()). This is an extra
 *                                          safety gate ON TOP of the core's normal heal criteria,
 *                                          appropriate because widened scope raises false-heal
 *                                          risk versus the recorded container.
 *     anchorCount : only set on the 'ambiguous' widened-abstain path — how many exact-anchor
 *                   matches were found (>=2 -> never guess, abstain).
 *
 *   verdict==='heal' from this function is STILL subject to downstream verifyEffect()/outcome
 *   verification — this lever only PROPOSES a candidate, it never bypasses the 3-way verify rule.
 *
 *   NON-GUESS GUARANTEE: if the widened search still yields 2+ tied strong-anchor matches, or only
 *   a weak (role+name-only) score match, this returns verdict:'abstain' (never 'heal') with a
 *   diagnosis explaining why, so the caller can route to HITL instead of guessing. diagnosis values
 *   introduced here ('not-found-widened', 'ambiguous-widened', 'weak-match-widened',
 *   'no-identity-widened') are NEW strings — self-heal/pipeline/change-diagnosis.js is NOT modified
 *   by this session, so today they fall through its switch to UNKNOWN. A future wiring session may
 *   want to fold them into the existing AMBIGUITY/REMOVAL categories there; that decision is left to
 *   whoever wires this in, since it touches a file this session is forbidden from editing.
 * =============================================================================================
 */
(function (root) {
  let S = (root && root.SELFHEAL) || null;
  if (!S && typeof module !== 'undefined' && module.exports) { try { S = require('../../selfheal-core.js'); } catch (e) { /* fall through */ } }
  S = S || (root && root.SELFHEAL);

  // Clone a step with its scope.container overridden — lets us reuse matchStep's own scope→rank→
  // verdict→gate pipeline verbatim for BOTH the narrow and the widened pass, instead of re-
  // implementing scoring here. `container` may be null (whole visible doc) or a CSS selector.
  function scopedStep(step, container) {
    const scope = (step && step.scope) || {};
    return Object.assign({}, step, { scope: Object.assign({}, scope, { container: container || null }) });
  }

  function searchAndPick(doc, step, opts) {
    opts = opts || {};
    const narrowContainer = ('container' in opts) ? opts.container : ((step.scope && step.scope.container) || null);
    const widerContainer = ('widerContainer' in opts) ? opts.widerContainer : null;
    const matchOpts = { gate: opts.gate, scopeVisible: opts.scopeVisible };

    // Phase 1: try the recorded / hinted scope first — no widening needed if it already heals.
    const narrow = S.matchStep(doc, scopedStep(step, narrowContainer), matchOpts);
    if (narrow.verdict === 'heal') {
      return Object.assign({}, narrow, { widened: false, scope: narrowContainer, lever: 'search-and-pick' });
    }

    // Phase 2: widen. Run matchStep's OWN scoring at the wider scope (gate applied later, once we
    // know exactly which candidate we intend to accept) so we get a fully-ranked, comparable set.
    const wide = S.matchStep(doc, scopedStep(step, widerContainer), { gate: false, scopeVisible: opts.scopeVisible });

    if (!wide.ranked || !wide.ranked.length) {
      return { verdict: 'fail', best: null, margin: 0, diagnosis: 'not-found-widened', cands: wide.cands || [], ranked: [], widened: true, scope: widerContainer, lever: 'search-and-pick' };
    }

    const desc = S.descFromStep(step.target.descriptor);
    const targetTestid = desc.signals.testid ? desc.signals.testid.value : null;
    const targetId = desc.signals.id ? desc.signals.id.value : null;
    const targetIdStable = !!(targetId && !S.looksHashed(targetId));

    let anchorMatches = [];
    if (targetTestid) anchorMatches = wide.ranked.filter(r => r.ex.testid === targetTestid);
    else if (targetIdStable) anchorMatches = wide.ranked.filter(r => r.ex.id === targetId);

    // apply the actionability gate (deferred from the matchStep call above) to a SPECIFIC candidate.
    function accept(candidate, matchedBy) {
      const base = { widened: true, scope: widerContainer, ranked: wide.ranked, cands: wide.cands, lever: 'search-and-pick', matchedBy };
      if (opts.gate === false) return Object.assign({ verdict: 'heal', best: candidate, margin: candidate.conf, diagnosis: null }, base);
      const act = S.WEB.actionable(candidate.el);
      if (!act.usable) return Object.assign({ verdict: 'abstain', best: candidate, margin: candidate.conf, gated: true, diagnosis: act.reason || 'not-usable' }, base);
      return Object.assign({ verdict: 'heal', best: candidate, margin: candidate.conf, diagnosis: null }, base);
    }

    if (anchorMatches.length === 1) return accept(anchorMatches[0], 'strong-anchor');
    if (anchorMatches.length >= 2) {
      return { verdict: 'abstain', best: wide.ranked[0], margin: 0, diagnosis: 'ambiguous-widened', widened: true, scope: widerContainer, ranked: wide.ranked, cands: wide.cands, lever: 'search-and-pick', matchedBy: 'strong-anchor', anchorCount: anchorMatches.length };
    }

    // No exact anchor-value match (or the step had none to check). Fall back to the wider scope's
    // own score-based verdict, but ONLY auto-accept if the winner's own locator tier is strong.
    if (wide.verdict === 'heal') {
      const tier = S.bestLocator(wide.best.ex).tier;
      if (tier === 'testid' || tier === 'stable-id') return accept(wide.best, 'score+anchor-tier');
      return { verdict: 'abstain', best: wide.best, margin: wide.margin, diagnosis: 'weak-match-widened', widened: true, scope: widerContainer, ranked: wide.ranked, cands: wide.cands, lever: 'search-and-pick', matchedBy: 'weak' };
    }

    return {
      verdict: wide.verdict === 'abstain' ? 'abstain' : 'fail',
      best: wide.best, margin: wide.margin,
      diagnosis: wide.diagnosis === 'ambiguous' ? 'ambiguous-widened' : 'no-identity-widened',
      widened: true, scope: widerContainer, ranked: wide.ranked, cands: wide.cands, lever: 'search-and-pick'
    };
  }

  const API = { searchAndPick };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.SELFHEAL_SEARCHPICK = API;
})(typeof window !== 'undefined' ? window : globalThis);
