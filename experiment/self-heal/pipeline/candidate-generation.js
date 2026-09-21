/* self-heal/pipeline/candidate-generation.js — Step 2: heal-candidate finding + disambiguation.
 *
 * Depends on the validated matcher core (window.SELFHEAL / require('../../selfheal-core.js')).
 * Does NOT modify the core.
 *
 * WHY this is the highest-surface / least-code lever (Ledger K8–K9, verified):
 *   Name-only controls already clear the heal floor on role+tag alone (score 0.737 > TH.heal 0.62);
 *   a full-text-drift form input scores ~0.898. So the matcher ALREADY heals through text change —
 *   what makes it abstain on a duplicate set is MARGIN (a tie), not the threshold. Healing is
 *   therefore mostly a *disambiguation* problem.
 *
 * STATUS:
 *   eliminate(tied, desc)            P1 — safety filter (heal-NEUTRAL on default path; Ledger K12).
 *   disambiguate(doc, step, opts)    P1 — eliminate-based wrapper (safety; see K12).
 *   disambiguateByContext(...)       P1 — heal-ADDING: breaks ties via container row-text (Clue-2, K13/K19).
 *   temporalLocality / structuralDiff P2 — STUB (need runtime / record-time snapshots).
 */
(function (root) {
  // Resolve the matcher core: prefer an already-loaded global (browser) so a stray AMD/bundler
  // `require` can't hijack us; fall back to CommonJS require (Node). [review finding #3]
  let S = (root && root.SELFHEAL) || null;
  if (!S && typeof module !== 'undefined' && module.exports) { try { S = require('../../selfheal-core.js'); } catch (e) { /* fall through */ } }
  S = S || (root && root.SELFHEAL);
  // resolveScope/scoreEx are no longer needed here: rankAndTie now reuses matchStep's scored set. [perf]
  const { TH, WEB, descFromStep, verdict, isEnabled } = S;

  // ---- shared text helpers (token-Jaccard, NOT core fuzzy: row-text is long free text, where
  // fuzzy's substring boost manufactures coincidental matches — the bug the core fix killed for
  // short names would return at the row level). [review finding #2] -----------------------------
  const norm = s => (s || '').replace(/\s+/g, ' ').trim();
  const tokens = s => norm(s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  // Jaccard over token sets, with `exclude` tokens removed from BOTH sides (drops the shared
  // control label so it doesn't dominate — symmetric, no string surgery). [review finding #8]
  function jaccard(a, b, exclude) {
    const ex = new Set(exclude || []);
    const A = new Set(tokens(a).filter(t => !ex.has(t)));
    const B = new Set(tokens(b).filter(t => !ex.has(t)));
    if (!A.size || !B.size) return 0;
    let i = 0; A.forEach(x => { if (B.has(x)) i++; });
    return i / new Set([...A, ...B]).size;
  }

  // word-boundaried so "Feedback"/"Background"/"Closet" are NOT treated as dismissive. [finding #5]
  const DISMISS_NAME = /\b(cancel|back|close|dismiss|delete|remove|skip)\b/i;

  // ---- shared: replay-side scope + rank + tied-band (one impl for both disambiguators) [finding #6]
  // Returns {done:true, base} when there's nothing to disambiguate, else {base, desc, ranked, top, tied}.
  function rankAndTie(doc, step, opts) {
    const base = S.matchStep(doc, step, opts);
    if (base.verdict === 'heal' || base.best === null) return { done: true, base };
    // Reuse matchStep's already-scored, already-sorted candidate set instead of re-scanning the
    // DOM and re-scoring every candidate. [perf: was a second full scan per heal attempt]
    const ranked = base.ranked || [];
    if (ranked.length < 2) return { done: true, base };
    const desc = descFromStep(step.target.descriptor);
    const top = ranked[0].conf;
    const tied = ranked.filter(r => (top - r.conf) < TH.margin);
    return { done: false, base, desc, ranked, top, tied };
  }

  // ---- elimination (Idea 5): drop tied candidates that violate a constraint the target satisfies.
  // SAFETY filter. Heal-NEUTRAL on the default path (resolveScope already drops disabled; name/inForm
  // are scored signals so equal-at-tie) — genuine value is only the scopeVisible:false path (K12).
  function eliminate(tied, desc) {
    if (!tied || tied.length < 2) return tied || [];
    const tName = desc.signals.name ? String(desc.signals.name.value) : null;
    const tDismiss = tName ? DISMISS_NAME.test(tName) : false;
    const wantForm = !!(desc.signals.inForm && desc.signals.inForm.value === true);
    return tied.filter(r => {
      if (!isEnabled(r.el)) return false;
      if (r.ex.name && DISMISS_NAME.test(r.ex.name) && !tDismiss) return false;
      if (wantForm && r.ex.inForm !== true) return false;
      return true;
    });
  }

  function disambiguate(doc, step, opts) {
    opts = opts || {};
    const t = rankAndTie(doc, step, opts);
    if (t.done || t.tied.length < 2) return t.base;
    const kept = eliminate(t.tied, t.desc);
    if (kept.length < 1 || kept.length >= t.tied.length) return t.base;     // no genuine reduction
    const ranked2 = t.ranked.filter(r => kept.indexOf(r) !== -1 || (t.top - r.conf) >= TH.margin)
                            .sort((a, b) => b.conf - a.conf);
    const vd2 = verdict(ranked2);
    if (vd2.v !== 'heal') return t.base;                                    // still tied among survivors → safe abstain
    if (opts.gate !== false) {
      const act = WEB.actionable(vd2.best.el);
      if (!act.usable) return { verdict: 'abstain', best: vd2.best, margin: vd2.margin, gated: true, diagnosis: act.reason || 'not-usable', disambiguated: true };
    }
    return { verdict: 'heal', best: vd2.best, margin: vd2.margin, diagnosis: null, disambiguated: true };
  }

  // ---- Clue-2 context: the GENUINE deterministic disambiguator (Ledger K13) --------------------
  const ROW_TAGS = ['tr', 'li', 'td', 'th', 'article', 'section', 'fieldset', 'dd', 'dt'];
  const ROW_ROLES = ['row', 'listitem', 'gridcell', 'group'];

  const INTERACTIVE_SEL = 'a[href],button,input,select,textarea,[role=button],[role=link],[onclick],[tabindex]';
  function containerOf(el) {
    // 1) semantic row container, if present (tables / lists)
    let n = el.parentElement;
    while (n && n.nodeType === 1) {
      const tag = n.tagName.toLowerCase();
      const role = n.getAttribute && n.getAttribute('role');
      if (ROW_TAGS.indexOf(tag) !== -1 || (role && ROW_ROLES.indexOf(role) !== -1)) return n;
      n = n.parentElement;
    }
    // 2) div-soup fallback (Ledger K25): nearest ancestor that is one of >=2 structurally-similar
    //    siblings (same tag) each containing an interactive control — i.e. the repeating "row" unit.
    n = el.parentElement;
    while (n && n.parentElement && n.nodeType === 1) {
      const sibs = [].slice.call(n.parentElement.children).filter(c => c.tagName === n.tagName);
      if (sibs.length >= 2) {
        const rich = sibs.filter(s => s.querySelector(INTERACTIVE_SEL));
        if (rich.length >= 2 && rich.indexOf(n) !== -1) return n;   // n is one of the repeated units
      }
      n = n.parentElement;
    }
    return el.parentElement || el;
  }
  // raw distinguishing text of the element's container (the control's own label is removed
  // symmetrically at comparison time via the `exclude` token set, not by string surgery).
  function rowTextOf(el) { return norm(containerOf(el).textContent); }

  // CAPTURE-TIME (Clue-2): attach to the recorded step → `step.context = captureContext(el)`.
  function captureContext(el) {
    if (!el || !el.ownerDocument) return { rowText: '', ordinal: -1, count: 0 };   // [review finding #6]
    const doc = el.ownerDocument;
    const ex = WEB.extract(el, doc);
    const sig = (ex.role || '') + '::' + (ex.name || '');
    const peers = WEB.candidates(doc).filter(c => {
      const e = WEB.extract(c, doc); return (e.role || '') + '::' + (e.name || '') === sig;
    });
    return { rowText: rowTextOf(el), ordinal: peers.indexOf(el), count: peers.length };
  }

  // Heuristic, UNCALIBRATED context thresholds (per honesty rule — not derived). Conservative.
  const CTX = { floor: 0.30, margin: 0.15 };

  // Break a margin tie using recorded container row-text. Heal-ADDING. SAFE by construction:
  //   (a) only fires when the tied band is a STRONG-but-tied set (top clears TH.heal) — so a
  //       removed/weak element can never be context-healed [review finding #1];
  //   (b) heals only when ONE candidate's row-text clearly wins (floor + margin);
  //   (c) `margin` stays in identity units for contract consistency; context separation is a
  //       distinct `contextMargin` field [review finding #4].
  function disambiguateByContext(doc, step, opts) {
    opts = opts || {};
    const rec = step.context;
    const t = rankAndTie(doc, step, opts);
    if (t.done || t.tied.length < 2) return t.base;
    if (!rec) return t.base;
    if (t.top < TH.heal) return t.base;                            // identity floor — never rescue weak/removed [#1]

    // (A) ROW-TEXT context [preferred] — distinct-content repeats (K27/K19). Only when rowText recorded.
    if (norm(rec.rowText)) {
      const excl = tokens(t.desc.signals.name ? t.desc.signals.name.value : '');
      const scored = t.tied.map(r => ({ r, s: jaccard(rec.rowText, rowTextOf(r.el), excl) }))
                           .sort((a, b) => b.s - a.s);
      const win = scored[0], runner = scored[1];
      const sep = win.s - (runner ? runner.s : 0);
      if (win.s >= CTX.floor && sep >= CTX.margin) {
        if (opts.gate !== false) {
          const act = WEB.actionable(win.r.el);
          if (!act.usable) return { verdict: 'abstain', best: win.r, margin: t.base.margin, gated: true, diagnosis: act.reason || 'not-usable', disambiguated: true, via: 'context', contextMargin: +sep.toFixed(2) };
        }
        return { verdict: 'heal', best: win.r, margin: t.base.margin, diagnosis: null, disambiguated: true, via: 'context', contextMargin: +sep.toFixed(2) };
      }
    }

    // (B) ORDINAL fallback [K30] — identical-content twins row-text can't separate (Amplitude funnel
    // steps / segments). SAFE: fires ONLY when the duplicate set is structurally unchanged (same
    // count) AND names unchanged (sig match) — so position is trustworthy; else abstain.
    // SAFETY: only when the tied candidates are byte-identical by row-text → genuinely indistinguishable
    // twins, so position is the sole signal and healing any is outcome-equivalent. If their row-texts
    // merely failed to cross the distinguish threshold (partial difference), they are different-but-
    // ambiguous → ordinal is NOT safe (a reorder would false-heal) → abstain.
    const tiedTexts = new Set(t.tied.map(r => norm(rowTextOf(r.el))));
    const genuineTwins = tiedTexts.size === 1;
    if (genuineTwins && rec.ordinal >= 0 && rec.count > 0) {
      const sig = (t.desc.signals.role ? t.desc.signals.role.value : '') + '::' + (t.desc.signals.name ? t.desc.signals.name.value : '');
      const peers = WEB.candidates(doc).filter(el => { const ex = WEB.extract(el, doc); return (ex.role || '') + '::' + (ex.name || '') === sig; });
      if (peers.length === rec.count && rec.ordinal < peers.length) {   // set unchanged → ordinal trustworthy
        const cand = peers[rec.ordinal], cex = WEB.extract(cand, doc);
        if (opts.gate !== false) {
          const act = WEB.actionable(cand);
          if (!act.usable) return { verdict: 'abstain', best: { el: cand, ex: cex, conf: t.top }, margin: t.base.margin, gated: true, diagnosis: act.reason || 'not-usable', disambiguated: true, via: 'ordinal' };
        }
        return { verdict: 'heal', best: { el: cand, ex: cex, conf: t.top }, margin: t.base.margin, diagnosis: null, disambiguated: true, via: 'ordinal' };
      }
    }
    return t.base;                                                 // neither lever could safely distinguish → abstain
  }

  // ---- P2 generators — documented, NOT implemented (no runtime in P1). Throw to block silent fake use.
  function temporalLocality() {
    throw new Error('temporalLocality: P2 — needs runtime interaction history (spatial prior; Idea 6 / I21).');
  }
  function structuralDiff() {
    throw new Error('structuralDiff: P2 — needs record-time DOM snapshot + stable ancestor anchors (Idea 2).');
  }

  const API = { eliminate, disambiguate, captureContext, disambiguateByContext, containerOf, rowTextOf, temporalLocality, structuralDiff };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.SELFHEAL_CANDGEN = API;
})(typeof window !== 'undefined' ? window : globalThis);
