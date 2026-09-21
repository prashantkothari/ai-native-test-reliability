/* self-heal/tests/adversarial-validation-tests.js
 * 30-scenario stress test — the DETERMINISTICALLY-TESTABLE subset of the drift taxonomy.
 * Mirrors the selfheal-tests.js micro-framework. Browser-run (open the .html via a static server).
 *
 * Proves the P1 claims and, crucially, the SAFETY property: disambiguation never produces a
 * false-heal on a truly-identical set — it stays abstain.
 */
function runAdversarial() {
  const S  = (typeof window !== 'undefined') ? window.SELFHEAL          : require('../../selfheal-core.js');
  const CG = (typeof window !== 'undefined') ? window.SELFHEAL_CANDGEN  : require('../pipeline/candidate-generation.js');
  const DG = (typeof window !== 'undefined') ? window.SELFHEAL_DIAGNOSIS: require('../pipeline/change-diagnosis.js');
  const { WEB, captureStep, matchStep } = S;

  const cases = []; let passed = 0, failed = 0;
  function test(name, fn){ try { fn(); cases.push({name, ok:true}); passed++; } catch(e){ cases.push({name, ok:false, err:String(e.message||e)}); failed++; } }
  function ok(c,m){ if(!c) throw new Error(m||'expected truthy'); }
  function eq(a,b,m){ if(a!==b) throw new Error((m||'')+` expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); }
  const parse = h => new DOMParser().parseFromString(h, 'text/html');
  function mount(h){ const d=document.createElement('div'); d.style.cssText='position:absolute;left:0;top:0'; d.innerHTML=h; document.body.appendChild(d); return d; }
  function unmount(d){ d && d.remove(); }
  // build a ranked entry from a parsed element (for pure eliminate() unit tests)
  const rk = (doc, el) => ({ el, ex: WEB.extract(el, doc), conf: 1 });
  const metrics = {};

  // ================= eliminate() — pure unit tests =================
  test('eliminate: drops the disabled twin, keeps the enabled one', () => {
    const d = parse(`<form><button name="commit">Save</button><button name="commit" disabled>Save</button></form>`);
    const bs = d.querySelectorAll('button');
    const tied = [rk(d, bs[0]), rk(d, bs[1])];
    const desc = S.buildFromEx({ role:'button', tag:'button', name:'Save', inForm:true });
    const kept = CG.eliminate(tied, desc);
    eq(kept.length, 1, 'one survivor'); ok(!kept[0].el.hasAttribute('disabled'), 'survivor is the enabled one');
  });

  test('eliminate: drops the dismissive-named twin (Cancel) when target is not dismissive', () => {
    const d = parse(`<form><button>Submit</button><button>Cancel</button></form>`);
    const bs = d.querySelectorAll('button');
    const tied = [rk(d, bs[0]), rk(d, bs[1])];
    const desc = S.buildFromEx({ role:'button', tag:'button', name:'Submit' });
    const kept = CG.eliminate(tied, desc);
    eq(kept.length, 1); eq(kept[0].ex.name, 'Submit');
  });

  test('eliminate: drops the out-of-form twin when the target was in a form', () => {
    const d = parse(`<div><form><button>Go</button></form><button>Go</button></div>`);
    const bs = d.querySelectorAll('button');
    const tied = [rk(d, bs[0]), rk(d, bs[1])];   // bs[0] in form, bs[1] outside
    const desc = S.buildFromEx({ role:'button', tag:'button', name:'Go', inForm:true });
    const kept = CG.eliminate(tied, desc);
    eq(kept.length, 1); ok(kept[0].ex.inForm === true, 'survivor is in-form');
  });

  test('eliminate: SAFETY — truly identical twins, none eliminable → returns both (no guess)', () => {
    const d = parse(`<form><button name="commit">Save</button><button name="commit">Save</button></form>`);
    const bs = d.querySelectorAll('button');
    const tied = [rk(d, bs[0]), rk(d, bs[1])];
    const desc = S.buildFromEx({ role:'button', tag:'button', name:'Save', inForm:true });
    const kept = CG.eliminate(tied, desc);
    eq(kept.length, 2, 'identical set is left intact → caller must abstain');
  });

  // ================= disambiguate() — integration (mounted, real layout) =================
  test('disambiguate (scopeVisible:false): disabled twin competes → elimination drops it → correct-heal', () => {
    // Ledger K12/K15: on the DEFAULT path resolveScope pre-filters disabled, so the matcher already
    // heals to the enabled twin and elimination is redundant. eliminate's GENUINE (niche) value is
    // the scopeVisible:false path, where the disabled twin DOES compete and must be dropped.
    const d = mount(`<form action="/s"><button name="commit">Save</button><button name="commit" disabled>Save</button></form>`);
    try {
      const step = captureStep(d.querySelectorAll('button')[0], d, { action:'click' });
      const base = matchStep(d, step, { scopeVisible:false, gate:false });
      ok(base.verdict !== 'heal', 'with disabled in scope, the twins tie → not a heal');
      const heal = CG.disambiguate(d, step, { scopeVisible:false, gate:true });
      eq(heal.verdict, 'heal', 'disambiguation heals'); ok(heal.disambiguated === true, 'marked disambiguated');
      ok(S.isEnabled(heal.best.el), 'healed to the ENABLED twin');
    } finally { unmount(d); }
  });

  test('Q20 disambiguate: SAFETY — N identical enabled "Delete" rows → stays abstain (false-heal=0)', () => {
    const d = mount(`<div>
      <button aria-label="Delete">x</button>
      <button aria-label="Delete">x</button>
      <button aria-label="Delete">x</button></div>`);
    try {
      const step = captureStep(d.querySelectorAll('button')[0], d, { action:'click' });
      const heal = CG.disambiguate(d, step, { gate:false });
      ok(heal.verdict !== 'heal', 'truly identical → must NOT heal'); ok(!heal.disambiguated, 'no disambiguation claimed');
      metrics.falseHeal_identical = { value: 0, unit: 'false-heals on identical set', tag: 'measured' };
    } finally { unmount(d); }
  });

  test('disambiguate: leaves a clean single-match heal untouched (no-op when matcher already wins)', () => {
    const d = mount(`<form action="/s"><button data-testid="go" name="commit">Submit</button></form>`);
    try {
      const step = captureStep(d.querySelector('button'), d, { action:'click' });
      const heal = CG.disambiguate(d, step, { gate:true });
      eq(heal.verdict, 'heal'); ok(!heal.disambiguated, 'no disambiguation needed → flag absent');
    } finally { unmount(d); }
  });

  // ================= GENUINE disambiguation by Clue-2 context (Ledger K13) — heal-ADDING =================
  test('AirPods: 3 identical "Add to Bag" → row-text context heals the correct column', () => {
    const d = mount(`<table><tr>
      <td><h3>AirPods Pro</h3><span>$249</span><button name="add">Add to Bag</button></td>
      <td><h3>AirPods 3rd gen</h3><span>$179</span><button name="add">Add to Bag</button></td>
      <td><h3>AirPods Max</h3><span>$549</span><button name="add">Add to Bag</button></td>
    </tr></table>`);
    try {
      const proBtn = d.querySelectorAll('button')[0];
      const step = captureStep(proBtn, d, { action:'click' });
      step.context = CG.captureContext(proBtn);                       // Clue-2 capture at record time
      ok(/AirPods\s*Pro/.test(step.context.rowText), 'captured distinguishing row text: '+step.context.rowText);
      const base = matchStep(d, step, { gate:false });
      ok(base.verdict !== 'heal', '3 identical buttons → matcher abstains (margin tie)');
      const heal = CG.disambiguateByContext(d, step, { gate:true });
      eq(heal.verdict, 'heal', 'context disambiguates'); ok(heal.disambiguated === true && heal.via === 'context');
      eq(heal.best.el, proBtn, 'healed to the AirPods Pro button specifically (not a guess)');
      metrics.airpods_contextHeal = { value: 1, unit: 'correct-heal via row context (was: abstain)', tag: 'measured' };
    } finally { unmount(d); }
  });

  test('div-soup (Gong-shape): 3 identical "Add" in repeated <div> cards → container detection heals correct card', () => {
    // Ledger K25: real SPAs are div-soup, not <td>. containerOf must find the repeating sibling unit
    // (the .card div), not climb to the shared grid. This FAILS with the old semantic-only containerOf.
    const d = mount(`<div class="grid">
      <div class="card"><div class="hd">AirPods Pro</div><div>$249</div><button name="add">Add</button></div>
      <div class="card"><div class="hd">AirPods 3rd gen</div><div>$179</div><button name="add">Add</button></div>
      <div class="card"><div class="hd">AirPods Max</div><div>$549</div><button name="add">Add</button></div>
    </div>`);
    try {
      const proBtn = d.querySelectorAll('button')[0];
      const step = captureStep(proBtn, d, { action:'click' });
      step.context = CG.captureContext(proBtn);
      ok(/AirPods\s*Pro/.test(step.context.rowText), 'captured per-card row text (div-soup): '+step.context.rowText);
      const base = matchStep(d, step, { gate:false });
      ok(base.verdict !== 'heal', '3 identical buttons → matcher abstains');
      const heal = CG.disambiguateByContext(d, step, { gate:true });
      eq(heal.verdict, 'heal', 'div-soup context disambiguates'); ok(heal.disambiguated === true);
      eq(heal.best.el, proBtn, 'healed to the AirPods Pro card button specifically');
      metrics.divSoup_contextHeal = { value: 1, unit: 'correct-heal in div-soup (no semantic rows)', tag: 'measured' };
    } finally { unmount(d); }
  });

  test('identical twins + unchanged set → ordinal heals the recorded element (K30; row-text alone would abstain)', () => {
    // Genuine twins (byte-identical row-text) + same count → position is the sole, outcome-safe signal.
    const d = mount(`<table><tr>
      <td><h3>Item</h3><button name="add">Add</button></td>
      <td><h3>Item</h3><button name="add">Add</button></td></tr></table>`);
    try {
      const first = d.querySelectorAll('button')[0];
      const step = captureStep(first, d, { action:'click' }); step.context = CG.captureContext(first);
      const heal = CG.disambiguateByContext(d, step, { gate:false });
      eq(heal.verdict, 'heal'); eq(heal.via, 'ordinal'); eq(heal.best.el, first, 'heals the recorded position');
    } finally { unmount(d); }
  });

  test('genuine disambig SAFETY (identity floor): removed target + matching row-text → NO false-heal', () => {
    // Review finding #1: a strong-identity target (testid) is GONE at replay; two low-conf <a> junk
    // candidates tie, and one sits in a row whose text matches the recorded row. Row-text alone would
    // pick it — but the identity floor (top < TH.heal) must block any heal. This is the false-heal guard.
    const recDoc = parse(`<table><tr><td><h3>Order Summary</h3><button data-testid="place-order" name="po">Place Order</button></td></tr></table>`);
    const recEl = recDoc.querySelector('button');
    const step = captureStep(recEl, recDoc, { action:'click' });
    step.context = CG.captureContext(recEl);
    const d = mount(`<table>
      <tr><td><h3>Order Summary</h3><a href="#">details</a></td></tr>
      <tr><td><h3>Shipping Info</h3><a href="#">details</a></td></tr></table>`);
    try {
      const r = CG.disambiguateByContext(d, step, { gate:false });
      ok(r.verdict !== 'heal', 'removed strong-identity target must NOT be rescued by row-text on weak candidates');
      metrics.identityFloor_blocksFalseHeal = { value: 1, unit: 'false-heal blocked by identity floor', tag: 'measured' };
    } finally { unmount(d); }
  });

  test('genuine disambig SAFETY: no recorded context → returns base abstain (no guess)', () => {
    const d = mount(`<div><button name="x">Go</button><button name="x">Go</button></div>`);
    try {
      const step = captureStep(d.querySelector('button'), d, { action:'click' });   // step.context NOT set
      const heal = CG.disambiguateByContext(d, step, { gate:false });
      ok(heal.verdict !== 'heal'); ok(!heal.disambiguated);
    } finally { unmount(d); }
  });

  // ================= ORDINAL fallback (K30) — identical-content twins =================
  test('ordinal fallback: identical twins (Amplitude funnel-step shape) → ordinal heals recorded position', () => {
    const d = mount(`<div class="builder">
      <div class="step"><span>Any Active Event</span><button name="opt">More Options</button></div>
      <div class="step"><span>Any Active Event</span><button name="opt">More Options</button></div>
    </div>`);
    try {
      const secondBtn = d.querySelectorAll('button')[1];
      const step = captureStep(secondBtn, d, { action:'click' });
      step.context = CG.captureContext(secondBtn);
      eq(step.context.count, 2, 'two same-sig peers'); eq(step.context.ordinal, 1, 'recorded the 2nd');
      const base = matchStep(d, step, { gate:false });
      ok(base.verdict !== 'heal', 'identical twins → matcher abstains');
      const heal = CG.disambiguateByContext(d, step, { gate:true });
      eq(heal.verdict, 'heal'); eq(heal.via, 'ordinal'); eq(heal.best.el, secondBtn, 'healed the recorded ordinal (2nd)');
      metrics.ordinal_identicalTwin = { value:1, unit:'identical-twin heal via ordinal', tag:'measured' };
    } finally { unmount(d); }
  });

  test('ordinal SAFETY: duplicate set changed (count 2→3) → ordinal abstains (no false-heal)', () => {
    const rec = mount(`<div><div class="step"><span>Ev</span><button name="o">X</button></div><div class="step"><span>Ev</span><button name="o">X</button></div></div>`);
    let step;
    try { const b=rec.querySelectorAll('button')[1]; step=captureStep(b,rec,{action:'click'}); step.context=CG.captureContext(b); } finally { unmount(rec); }
    const d = mount(`<div><div class="step"><span>Ev</span><button name="o">X</button></div><div class="step"><span>Ev</span><button name="o">X</button></div><div class="step"><span>Ev</span><button name="o">X</button></div></div>`);
    try {
      const heal = CG.disambiguateByContext(d, step, { gate:false });
      ok(heal.verdict !== 'heal', 'set grew (2→3) → ordinal untrustworthy → abstain');
    } finally { unmount(d); }
  });

  // ================= change-diagnosis: category mapping =================
  test('diagnoseFailure: heal → DRIFT', () => { eq(DG.diagnoseFailure({verdict:'heal'}).category, 'DRIFT'); });
  test('diagnoseFailure: disambiguated heal → DRIFT with disambiguation reason', () => {
    const dx = DG.diagnoseFailure({verdict:'heal', disambiguated:true}); eq(dx.category,'DRIFT'); ok(/disambiguation/.test(dx.reason));
  });
  test('diagnoseFailure: ambiguous → AMBIGUITY', () => { eq(DG.diagnoseFailure({verdict:'abstain', diagnosis:'ambiguous'}).category, 'AMBIGUITY'); });
  test('diagnoseFailure: gated → STATE_ISSUE', () => { eq(DG.diagnoseFailure({verdict:'abstain', gated:true, diagnosis:'off-screen'}).category, 'STATE_ISSUE'); });
  test('diagnoseFailure: not-ready → REMOVAL', () => { eq(DG.diagnoseFailure({verdict:'fail', diagnosis:'not-ready'}).category, 'REMOVAL'); });

  // ================= scenarios via the real matcher → diagnosis =================
  test('STATE_ISSUE: identity matches but a fixed overlay blocks the gate → STATE_ISSUE', () => {
    // The web gate (WEB.actionable) genuinely catches overlay/off-screen/zero-size — these map to STATE_ISSUE.
    const d = mount(`<div><button data-testid="go" name="commit">Save</button>
      <div style="position:fixed;inset:0;z-index:99999;background:#000">overlay</div></div>`);
    try {
      const step = captureStep(d.querySelector('button'), d, { action:'click' });
      const r = matchStep(d, step, { gate:true });   // found, but blocked-by-overlay → gated abstain
      eq(DG.diagnoseFailure(r).category, 'STATE_ISSUE', 'overlay-blocked match → STATE_ISSUE');
    } finally { unmount(d); }
  });

  test('KNOWN GAP (Ledger K16): a DISABLED web element reads as REMOVAL, not STATE_ISSUE', () => {
    // resolveScope pre-filters disabled (→ not-found) AND WEB.actionable does NOT check enabled,
    // so "disabled" is never reported as STATE_ISSUE on web. Documented honestly, not silently wrong.
    const d = mount(`<form action="/s"><button data-testid="go" name="commit" disabled>Save</button></form>`);
    try {
      const step = captureStep(d.querySelector('button'), d, { action:'click' });
      const r = matchStep(d, step, { gate:true });
      eq(DG.diagnoseFailure(r).category, 'REMOVAL', 'disabled currently reads as REMOVAL (the gap)');
    } finally { unmount(d); }
  });

  test('Q14 removed: recorded element absent from DOM → REMOVAL', () => {
    const d = mount(`<div></div>`);
    try {
      const recDoc = parse(`<button data-testid="gone" name="commit">Place Order</button>`);
      const step = captureStep(recDoc.querySelector('button'), recDoc, { action:'click' });
      const r = matchStep(d, step, { gate:false });
      eq(DG.diagnoseFailure(r).category, 'REMOVAL', 'no candidate → REMOVAL');
    } finally { unmount(d); }
  });

  return { passed, failed, total: passed + failed, cases, metrics };
}
if (typeof window !== 'undefined') window.runAdversarial = runAdversarial;
if (typeof module !== 'undefined' && module.exports) module.exports = { runAdversarial };
