/* self-heal/tests/candidate-widening-tests.js
 * Hermetic tests for the K28 candidate widener (pipeline/candidate-widening.js).
 * Browser-run (open the .html via the static server) — layout-dependent, so fixtures mount into
 * the live document (cursor:pointer / size / pointer-root all need real getComputedStyle + layout).
 *
 * Proves: (1) the gap is real — core can't see roleless click targets; (2) the widener FINDS them;
 * (3) the precision guards REJECT the cursor:pointer flood, backdrops, inline text, native-wrappers;
 * (4) it HEALS where core is blind; (5) SAFETY — identical decoys stay abstain (false-heal == 0).
 */
function runWidening() {
  const S = (typeof window !== 'undefined') ? window.SELFHEAL : require('../../selfheal-core.js');
  const W = (typeof window !== 'undefined') ? window.SELFHEAL_WIDEN : require('../pipeline/candidate-widening.js');
  const { WEB, captureStep, matchStep } = S;

  const cases = []; let passed = 0, failed = 0;
  function test(name, fn) { try { fn(); cases.push({ name, ok: true }); passed++; } catch (e) { cases.push({ name, ok: false, err: String(e.message || e) }); failed++; } }
  function ok(c, m) { if (!c) throw new Error(m || 'expected truthy'); }
  function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ` expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); }
  function mount(h) { const d = document.createElement('div'); d.style.cssText = 'position:absolute;left:0;top:0'; d.innerHTML = h; document.body.appendChild(d); return d; }
  function unmount(d) { d && d.remove(); }
  const has = (set, el) => set.indexOf(el) !== -1;
  const metrics = {};

  // a roleless clickable card grid (the Gong-Slides / product-grid shape): cursor:pointer DIVs,
  // no role, no onclick attr, no tabindex — invisible to core WEB.candidates.
  const CARD = (label, w) => `<div class="card" style="cursor:pointer;width:${w || 160}px;height:80px">
    <div class="hd">${label}</div><div class="price">$1</div></div>`;
  // distinct names so the matcher clears the margin floor — this suite tests the WIDENER (can the
  // card even be a candidate?), not disambiguation (covered by adversarial AirPods/div-soup tests).
  const GRID = `<div class="grid">${CARD('AirPods Pro')}${CARD('Galaxy Buds')}${CARD('Sony WF')}</div>`;

  // ============ the gap is real ============
  test('GAP: core WEB.candidates does NOT see roleless cursor:pointer cards', () => {
    const d = mount(GRID);
    try {
      const cards = [].slice.call(d.querySelectorAll('.card'));
      const base = WEB.candidates(d.ownerDocument).filter(el => has(cards, el));
      eq(base.length, 0, 'core sees none of the 3 roleless cards (the K28 gap)');
    } finally { unmount(d); }
  });

  test('FIND: widenCandidates adds exactly the 3 pointer-root cards (not their children)', () => {
    const d = mount(GRID);
    try {
      const cards = [].slice.call(d.querySelectorAll('.card'));
      const inner = [].slice.call(d.querySelectorAll('.hd,.price'));
      const w = W.widenCandidates(d.ownerDocument);
      cards.forEach((c, i) => ok(has(w.candidates, c), 'card ' + i + ' added'));
      inner.forEach(el => ok(!has(w.candidates, el), 'inherited-pointer child NOT added (flood guarded)'));
      eq(w.added, 3, 'exactly the 3 pointer-roots added');
      metrics.cards_found = { value: 3, unit: 'roleless cards recovered (core saw 0)', tag: 'measured' };
    } finally { unmount(d); }
  });

  // ============ precision guards ============
  test('GUARD: cursor:pointer alone on a CHILD is rejected — only the pointer-root is added', () => {
    const d = mount(`<div style="cursor:pointer;width:200px;height:90px"><div style="width:150px;height:40px">inner</div></div>`);
    try {
      const root = d.firstElementChild, child = root.firstElementChild;
      const w = W.widenCandidates(d.ownerDocument);
      ok(has(w.candidates, root), 'outer pointer-root added');
      ok(!has(w.candidates, child), 'inherited-pointer child rejected');
    } finally { unmount(d); }
  });

  test('GUARD: a page-sized cursor:pointer backdrop is rejected (area guard)', () => {
    const d = mount(`<div style="cursor:pointer;width:100vw;height:100vh">backdrop</div>`);
    try {
      const back = d.firstElementChild;
      ok(!has(W.widenCandidates(d.ownerDocument).candidates, back), 'backdrop rejected');
    } finally { unmount(d); }
  });

  test('GUARD: inline styled text (display:inline, cursor:pointer) is rejected', () => {
    const d = mount(`<p>see <span style="cursor:pointer;display:inline">terms</span> now</p>`);
    try {
      const span = d.querySelector('span');
      ok(!has(W.widenCandidates(d.ownerDocument).candidates, span), 'inline text span rejected');
    } finally { unmount(d); }
  });

  test('GUARD: a lone wrapper around a native <button> is rejected (prefer the inner control)', () => {
    const d = mount(`<div style="cursor:pointer;width:140px;height:50px"><button>Buy</button></div>`);
    try {
      const wrap = d.firstElementChild;
      const w = W.widenCandidates(d.ownerDocument);
      ok(!has(w.candidates, wrap), 'lone native-wrapper rejected');
      ok(has(w.candidates, d.querySelector('button')), 'the native button is still a candidate');
    } finally { unmount(d); }
  });

  test('ACCEPT: focusable-roleless (tabindex=0) and aria-* roleless are added (core ignores both)', () => {
    const d = mount(`<div tabindex="0" style="width:120px;height:40px">Menu</div>
                     <div aria-label="Close" style="width:30px;height:30px">x</div>`);
    try {
      const tab = d.children[0], aria = d.children[1];
      // core SEL = input,button,a,select,textarea,[role] — neither tabindex nor aria-* is in it
      eq(WEB.candidates(d.ownerDocument).filter(el => el === tab || el === aria).length, 0, 'core sees neither');
      const w = W.widenCandidates(d.ownerDocument);
      ok(has(w.candidates, tab), 'focusable-roleless added'); ok(has(w.candidates, aria), 'aria-roleless added');
    } finally { unmount(d); }
  });

  // ============ heal where core is blind ============
  test('HEAL: matchStepWidened heals to a roleless card that core cannot even rank', () => {
    const d = mount(GRID);
    try {
      const card2 = d.querySelectorAll('.card')[1];     // "Slide 2"
      const step = captureStep(card2, d.ownerDocument, { action: 'click' });
      const core = matchStep(d.ownerDocument, step, { gate: false });
      ok(core.verdict !== 'heal', 'core cannot heal — the card is not a candidate (verdict=' + core.verdict + ')');
      const w = W.matchStepWidened(d.ownerDocument, step, { gate: false });
      eq(w.verdict, 'heal', 'widened path heals'); eq(w.best.el, card2, 'healed to the exact card'); ok(w.widened === true);
      metrics.healed_roleless = { value: 1, unit: 'correct-heal on roleless card (core: blind)', tag: 'measured' };
    } finally { unmount(d); }
  });

  // ============ SAFETY ============
  test('SAFETY: two IDENTICAL roleless click divs → widened stays abstain (false-heal == 0)', () => {
    const d = mount(`<div class="g"><div class="card" style="cursor:pointer;width:120px;height:60px">Open</div>
      <div class="card" style="cursor:pointer;width:120px;height:60px">Open</div></div>`);
    try {
      const first = d.querySelector('.card');
      const step = captureStep(first, d.ownerDocument, { action: 'click' });
      const w = W.matchStepWidened(d.ownerDocument, step, { gate: false });
      ok(w.verdict !== 'heal', 'identical decoys must NOT heal (got ' + w.verdict + ')');
      metrics.falseHeal_identicalRoleless = { value: 0, unit: 'false-heals on identical roleless set', tag: 'measured' };
    } finally { unmount(d); }
  });

  test('SAFETY: widening does NOT mutate the page or the core candidate set', () => {
    const d = mount(GRID);
    try {
      const before = WEB.candidates(d.ownerDocument).length;
      W.widenCandidates(d.ownerDocument);
      const after = WEB.candidates(d.ownerDocument).length;
      eq(after, before, 'core WEB.candidates unchanged after widening (no DOM mutation)');
      eq(d.querySelectorAll('[role]').length, 0, 'no synthetic role attributes injected');
    } finally { unmount(d); }
  });

  return { passed, failed, total: passed + failed, cases, metrics };
}
if (typeof window !== 'undefined') window.runWidening = runWidening;
if (typeof module !== 'undefined' && module.exports) module.exports = { runWidening };
