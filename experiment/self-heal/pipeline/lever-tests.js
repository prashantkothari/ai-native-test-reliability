/* self-heal/pipeline/lever-tests.js — S9 pre-registered tests for search-and-pick.js + temporal-wait.js.
 *
 * PRE-REGISTERED (decided BEFORE running, project discipline): each case below states what it
 * expects and why, before the assertion. Loaded by lever-tests.html alongside selfheal-core.js,
 * self-heal/pipeline/change-diagnosis.js (loaded for taxonomy completeness though not directly
 * asserted on), self-heal/pretotype/fixtures.js (read-only reuse — NOT modified), and the two new
 * lever modules. Exposes `runLeverTests()` (async) and, once run, `window.__S9_TESTS`.
 *
 * Cases (see the S9 brief):
 *   1. search-and-pick finds a testid'd element that moved OUTSIDE the recorded container.
 *   2. search-and-pick returns "uncertain" (abstain), never guesses, on 2+ tied anchorless matches.
 *   3. temporal-wait finds a delayed-render element (injected @300ms) — retries>0, elapsedMs sane.
 *   4. temporal-wait times out within its stated (custom, smaller-for-speed) bounded cap — not
 *      immediate, not runaway past the cap.
 *   5. FALSE-HEAL REGRESSION: both levers, run against fixtures.js's own pre-existing AMBIGUOUS
 *      case (the nameless eye-icon button — flagged 'no-anchor' at record, ties against the SSO
 *      button's near-identical descriptor at replay) and a constructed REMOVAL case (that same
 *      element deleted outright, nowhere on the page), must never return verdict:'heal'.
 */
(function (root) {
  function mount(html) { const d = document.createElement('div'); d.innerHTML = html; document.body.appendChild(d); return d; }
  function unmount(d) { if (d && d.parentNode) d.parentNode.removeChild(d); }

  async function runLeverTests() {
    const results = [];
    function record(name, pass, detail) { results.push({ name, pass: !!pass, detail: detail || '' }); }

    // ---- 1: search-and-pick finds a testid'd element outside the recorded container ------------
    {
      const stage = mount('<div id="t1-wrap"><div id="t1-panelA"></div><div id="t1-panelB"></div></div>');
      const panelA = stage.querySelector('#t1-panelA'), panelB = stage.querySelector('#t1-panelB');
      const orig = document.createElement('button'); orig.setAttribute('data-testid', 'save-btn-1'); orig.textContent = 'Save';
      panelA.appendChild(orig);
      const step = SELFHEAL.captureStep(orig, document, { container: '#t1-panelA' });
      panelA.removeChild(orig);                                                   // "removed from recorded container"
      const moved = document.createElement('button'); moved.setAttribute('data-testid', 'save-btn-1'); moved.textContent = 'Save';
      panelB.appendChild(moved);                                                   // "moved to a sibling panel"

      const res = SELFHEAL_SEARCHPICK.searchAndPick(document, step, { container: '#t1-panelA' });
      const ok = res.verdict === 'heal' && res.widened === true && res.matchedBy === 'strong-anchor' && res.best && res.best.el === moved;
      record('1. search-and-pick heals via testid found outside the recorded container',
        ok, JSON.stringify({ verdict: res.verdict, widened: res.widened, matchedBy: res.matchedBy, pickedMoved: res.best && res.best.el === moved }));
      unmount(stage);
    }

    // ---- 2: search-and-pick abstains (never guesses) on 2+ tied anchorless matches --------------
    {
      const stage = mount('<div id="t2-wrap"><div id="t2-panelA"></div><div id="t2-panelB"></div></div>');
      const panelA = stage.querySelector('#t2-panelA'), panelB = stage.querySelector('#t2-panelB');
      const proto = document.createElement('button'); proto.textContent = 'OK';   // no id/testid/name-attr — anchorless
      panelA.appendChild(proto);
      const step = SELFHEAL.captureStep(proto, document, { container: '#t2-panelA' });
      panelA.removeChild(proto);
      const twinA = document.createElement('button'); twinA.textContent = 'OK';
      const twinB = document.createElement('button'); twinB.textContent = 'OK';
      panelB.appendChild(twinA); panelB.appendChild(twinB);                       // two IDENTICAL anchorless candidates

      const res = SELFHEAL_SEARCHPICK.searchAndPick(document, step, { container: '#t2-panelA' });
      const ok = res.verdict !== 'heal' && res.widened === true;
      record('2. search-and-pick abstains on 2+ tied anchorless matches (no arbitrary pick)',
        ok, JSON.stringify({ verdict: res.verdict, diagnosis: res.diagnosis, matchedBy: res.matchedBy }));
      unmount(stage);
    }

    // ---- 3: temporal-wait finds a delayed-render element (injected @300ms) ----------------------
    {
      const stage = mount('<div id="t3-wrap"><div id="t3-panel"></div></div>');
      const panel = stage.querySelector('#t3-panel');
      const proto = document.createElement('button'); proto.setAttribute('data-testid', 't3-target'); proto.textContent = 'Go';
      panel.appendChild(proto);
      const step = SELFHEAL.captureStep(proto, document, { container: '#t3-panel' });
      panel.removeChild(proto);
      setTimeout(() => {
        const injected = document.createElement('button'); injected.setAttribute('data-testid', 't3-target'); injected.textContent = 'Go';
        panel.appendChild(injected);
      }, 300);

      const res = await SELFHEAL_TEMPORALWAIT.waitAndMatch(document, step, { container: '#t3-panel' });
      const ok = res.verdict === 'heal' && res.retries > 0 && !res.timedOut && res.elapsedMs >= 280 && res.elapsedMs < 2000;
      record('3. temporal-wait finds a delayed-render element (retries>0, elapsedMs ~ injection delay)',
        ok, JSON.stringify({ verdict: res.verdict, retries: res.retries, elapsedMs: res.elapsedMs, timedOut: res.timedOut }));
      unmount(stage);
    }

    // ---- 4: temporal-wait bounded timeout — target never appears -------------------------------
    {
      const stage = mount('<div id="t4-wrap"><div id="t4-panel"></div></div>');
      const panel = stage.querySelector('#t4-panel');
      const proto = document.createElement('button'); proto.setAttribute('data-testid', 't4-target'); proto.textContent = 'Go';
      panel.appendChild(proto);
      const step = SELFHEAL.captureStep(proto, document, { container: '#t4-panel' });
      panel.removeChild(proto);                                                   // never comes back

      // smaller schedule/cap than the module default, purely for test speed — same bounded logic.
      const schedule = [100, 100, 100], capMs = 350;                              // sum(schedule)=300 < capMs=350
      const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const res = await SELFHEAL_TEMPORALWAIT.waitAndMatch(document, step, { container: '#t4-panel', schedule, capMs });
      const wall = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
      const ok = res.verdict !== 'heal' && res.timedOut === true && wall >= 250 && wall <= capMs + 200;
      record('4. temporal-wait times out within its bounded cap (not immediate, not runaway)',
        ok, JSON.stringify({ verdict: res.verdict, timedOut: res.timedOut, retries: res.retries, elapsedMs: res.elapsedMs, wallMs: Math.round(wall), capMs }));
      unmount(stage);
    }

    // ---- 5: FALSE-HEAL REGRESSION against fixtures.js's own AMBIGUOUS + a REMOVAL case ---------
    {
      const stage = mount('<div id="t5-wrap"></div>');
      const wrap = stage.querySelector('#t5-wrap');
      wrap.innerHTML = PRETOTYPE_FIXTURES.LOGIN_DOM;
      const eye = wrap.querySelector('[data-oracle="eye"]');
      const step = SELFHEAL.captureStep(eye, document, { container: '#loginForm' });

      // (a) AMBIGUOUS — fixtures.js's own pre-registered case: nameless icon button, 'no-anchor' at
      //     record, ties against the SSO button's near-identical role/tag/type descriptor.
      const spRes = SELFHEAL_SEARCHPICK.searchAndPick(document, step, { container: '#loginForm' });
      const spOk = spRes.verdict !== 'heal';
      record('5a. search-and-pick never false-heals on fixtures.js AMBIGUOUS case (eye icon)',
        spOk, JSON.stringify({ verdict: spRes.verdict, diagnosis: spRes.diagnosis }));

      const twRes = await SELFHEAL_TEMPORALWAIT.waitAndMatch(document, step, { container: '#loginForm', schedule: [30, 60], capMs: 150 });
      const twOk = twRes.verdict !== 'heal';
      record('5b. temporal-wait never false-heals on fixtures.js AMBIGUOUS case (eye icon)',
        twOk, JSON.stringify({ verdict: twRes.verdict, diagnosis: twRes.diagnosis, timedOut: twRes.timedOut }));

      // (b) REMOVAL — the same recorded element genuinely deleted, nowhere on the page.
      eye.parentNode.removeChild(eye);
      const spRes2 = SELFHEAL_SEARCHPICK.searchAndPick(document, step, { container: '#loginForm' });
      const spOk2 = spRes2.verdict !== 'heal';
      record('5c. search-and-pick never false-heals on a genuine REMOVAL case',
        spOk2, JSON.stringify({ verdict: spRes2.verdict, diagnosis: spRes2.diagnosis }));

      const twRes2 = await SELFHEAL_TEMPORALWAIT.waitAndMatch(document, step, { container: '#loginForm', schedule: [30, 60], capMs: 150 });
      const twOk2 = twRes2.verdict !== 'heal';
      record('5d. temporal-wait never false-heals (correctly times out) on a genuine REMOVAL case',
        twOk2, JSON.stringify({ verdict: twRes2.verdict, timedOut: twRes2.timedOut }));

      unmount(stage);
    }

    const passed = results.filter(r => r.pass).length;
    const total = results.length;
    const out = { passed, total, failed: total - passed, results };
    root.__S9_TESTS = out;
    return out;
  }

  root.runLeverTests = runLeverTests;
})(typeof window !== 'undefined' ? window : globalThis);
