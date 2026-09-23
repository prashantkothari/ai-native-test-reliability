#!/usr/bin/env node
// Phase X — Pass A cross-app baseline on Excalidraw.
// Mirrors harness/phase_s_final.mjs Pass A. 6 elements × 4 drifts × 4 paths × N.
// N is controlled by env N_PER_CELL (default 3 for smoke, 6 for final).
// Emits logs/phase_x_excalidraw.jsonl.

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'logs/phase_x_excalidraw.jsonl');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, '');

const BUNDLE = fs.readFileSync(path.join(ROOT, 'logs/selfheal-bundle.js'), 'utf8');
const URL_TARGET = process.env.URL_TARGET || 'http://localhost:3002/';
const N = parseInt(process.env.N_PER_CELL || '3', 10);

// Excalidraw uses `data-testid` (single-token). The library bundle recognises both
// `data-test-id` (n8n) and `data-testid` (Excalidraw).
const TESTID_ATTR = 'data-testid';
const TRACE_DIR = path.join(ROOT, 'logs/traces');
fs.mkdirSync(TRACE_DIR, { recursive: true });

const ELEMENTS = [
  { id: 'toolbar-rectangle', testid: 'toolbar-rectangle', role: 'button', name: 'Rectangle',
    naiveSel: 'button[aria-label="Rectangle"]' },
  { id: 'toolbar-ellipse',   testid: 'toolbar-ellipse',   role: 'button', name: 'Ellipse',
    naiveSel: 'button[aria-label="Ellipse"]' },
  { id: 'toolbar-diamond',   testid: 'toolbar-diamond',   role: 'button', name: 'Diamond',
    naiveSel: 'button[aria-label="Diamond"]' },
  { id: 'toolbar-arrow',     testid: 'toolbar-arrow',     role: 'button', name: 'Arrow',
    naiveSel: 'button[aria-label="Arrow"]' },
  { id: 'toolbar-line',      testid: 'toolbar-line',      role: 'button', name: 'Line',
    naiveSel: 'button[aria-label="Line"]' },
  { id: 'main-menu-trigger', testid: 'main-menu-trigger', role: 'button', name: null,
    naiveSel: null },
];

async function loadPage(browser) {
  const ctx = await browser.newContext();
  await ctx.addInitScript({ content: BUNDLE });
  const page = await ctx.newPage();
  await page.goto(URL_TARGET, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    document.querySelectorAll('.welcome-screen-menu, .welcome-screen-decor').forEach(e => e.remove?.());
  }).catch(() => {});
  return { ctx, page };
}

function emit(row) { fs.appendFileSync(OUT, JSON.stringify(row) + '\n'); }

async function recordAnchor(page, testid) {
  return await page.evaluate(({ t, attr }) => {
    const el = document.querySelector(`[${attr}="${t}"]`);
    if (!el) return null;
    el.setAttribute('data-phase-x-target', t);
    return window.SELFHEAL.captureStep(el, document, { stepId: t, action: 'click' });
  }, { t: testid, attr: TESTID_ATTR });
}

async function identityMatches(page, sel, targetMarker) {
  if (!sel) return false;
  return await page.evaluate(({ s, m }) => {
    try {
      const el = document.querySelector(s);
      return !!el && el.getAttribute('data-phase-x-target') === m;
    } catch { return false; }
  }, { s: sel, m: targetMarker });
}

async function pluginMatch(page, anchor, brainSeed) {
  return await page.evaluate(({ a, seed }) => {
    if (seed && !window.__BRAIN) {
      window.__BRAIN = window.SELFHEAL_BRAIN.makeBrain(seed);
      window.__LADDER = window.SELFHEAL_LEARN.makeLadder();
    }
    const doc = document;
    let servedBy = 'matcher';
    if (window.__BRAIN && window.__LADDER && window.__LADDER.tier(a.stepId || 'x', a.stepId || 'x') === 'L2') {
      const hit = window.__BRAIN.get(a.stepId || 'x', a.stepId || 'x', doc);
      if (hit) return { servedBy: 'brain', bestLocator: hit.locator, verdict: 'heal' };
    }
    const r = window.SELFHEAL.matchAndEmit(doc, a, { gate: true });
    return {
      servedBy, verdict: r.verdict, bestLocator: r.bestLocator, emitCount: r.emitCount,
      score: r.best?.conf, margin: r.margin, diagnosis: r.diagnosis,
    };
  }, { a: anchor, seed: brainSeed });
}

async function updateBrain(page, testId, stepId, healedSel) {
  await page.evaluate(({ tid, sid, sel }) => {
    if (!window.__BRAIN) return;
    window.__BRAIN.put(tid, sid, sel, { confidence: 'HIGH' });
    window.__LADDER.record(tid, sid, 'PASS', 'HIGH', window.__BRAIN);
  }, { tid: testId, sid: stepId, sel: healedSel });
}

async function applyDrift(page, testid, driftKey) {
  return await page.evaluate(({ t, k, attr }) => {
    const el = document.querySelector(`[${attr}="${t}"]`);
    if (!el) return { ok: false, reason: 'element not found' };
    const drifts = {
      DR1: () => { const o = el.getAttribute(attr); el.setAttribute(attr, o + '-DR1'); return () => el.setAttribute(attr, o); },
      DR2: () => { const o = el.getAttribute('aria-label'); el.setAttribute('aria-label', 'Exécuter'); return () => o ? el.setAttribute('aria-label', o) : el.removeAttribute('aria-label'); },
      DR3: () => {
        const oc = el.className; const ot = el.textContent;
        el.className = 'ab-variant-2 excalidraw-btn';
        for (const c of el.childNodes) if (c.nodeType === 3 && c.textContent.trim()) c.textContent = 'AB Variant';
        return () => { el.className = oc; for (const c of el.childNodes) if (c.nodeType === 3) c.textContent = ot; };
      },
      DR4: () => {
        const p = el.parentNode; const next = el.nextElementSibling;
        if (next && p.children.length > 1) p.insertBefore(next, el);
        return () => { if (next && p.children.length > 1) p.insertBefore(el, next); };
      },
    };
    const revert = drifts[k]();
    window.__REVERT = revert;
    return { ok: true };
  }, { t: testid, k: driftKey, attr: TESTID_ATTR });
}
async function revertDrift(page) {
  await page.evaluate(() => { if (window.__REVERT) { window.__REVERT(); window.__REVERT = null; } });
}

function cyclesFor(o) { return o === 'PASS' ? 0 : 3; }

async function passA(browser) {
  console.log(`\n=== PASS A: 6 elements × 4 drifts × 4 paths × N=${N} = ${6*4*4*N} trials ===`);
  let { ctx, page } = await loadPage(browser);

  const anchors = {};
  for (const el of ELEMENTS) {
    const a = await recordAnchor(page, el.testid);
    if (!a) { console.log(`  WARN: could not record anchor for ${el.id}`); continue; }
    anchors[el.id] = a;
  }
  console.log(`  recorded ${Object.keys(anchors).length} of ${ELEMENTS.length} anchors`);

  async function reopenContext() {
    try { await ctx.close(); } catch {}
    const fresh = await loadPage(browser);
    ctx = fresh.ctx; page = fresh.page;
    for (const el of ELEMENTS) if (anchors[el.id]) await recordAnchor(page, el.testid);
  }

  const DRIFTS = ['DR1', 'DR2', 'DR3', 'DR4'];
  for (const el of ELEMENTS) {
    if (!anchors[el.id]) continue;
    console.log(`\n  element: ${el.id}`);
    for (const drift of DRIFTS) {
      for (const pathName of ['S', 'N', 'L-cold', 'L-brain']) {
        const cellId = `${el.id}__${drift}__${pathName}`;
        try { await ctx.tracing.start({ screenshots: true, snapshots: true, sources: true, title: cellId }); }
        catch (e) { console.log(`  trace start failed for ${cellId}: ${e.message.slice(0,80)}`); }
        for (let run = 1; run <= N; run++) {
          let applied;
          try { applied = await applyDrift(page, el.testid, drift); }
          catch (e) {
            const isCrash = /Target crashed|crashed|closed/i.test(e.message || '');
            emit({ pass: 'A', element: el.id, drift, path: pathName, run,
                   outcome: 'SKIPPED_CRASH', diagnosis: e.message.slice(0, 120), wall_ms: 0, claude_cycles: 0 });
            if (isCrash) await reopenContext();
            continue;
          }
          if (!applied.ok) { console.log(`    [${el.id}][${drift}][${pathName}][${run}] SKIP: ${applied.reason}`); continue; }

          const t0 = Date.now();
          let outcome = 'FAIL', identity = null, healedSel = null, diagnosis = null, extras = {};
          try {
            if (pathName === 'S') {
              const hits = await page.locator(`[${TESTID_ATTR}="${el.testid}"]`).count();
              if (hits === 1) { identity = (await identityMatches(page, `[${TESTID_ATTR}="${el.testid}"]`, el.id)) ? 'MATCH' : 'MISMATCH'; outcome = identity === 'MATCH' ? 'PASS' : 'FALSE_HEAL'; }
              else diagnosis = `strict selector resolved ${hits} elements`;
            } else if (pathName === 'N') {
              if (!el.naiveSel) { diagnosis = 'no naive fallback available'; }
              else {
                try {
                  const hits = await page.locator(el.naiveSel).count();
                  if (hits === 1) { identity = (await identityMatches(page, el.naiveSel, el.id)) ? 'MATCH' : 'MISMATCH'; outcome = identity === 'MATCH' ? 'PASS' : 'FALSE_HEAL'; }
                  else diagnosis = `naive selector resolved ${hits} elements`;
                } catch(e) { diagnosis = 'naive selector error: ' + e.message.slice(0,80); }
              }
            } else if (pathName === 'L-cold') {
              await page.evaluate(() => { delete window.__BRAIN; delete window.__LADDER; });
              const r = await pluginMatch(page, anchors[el.id], null);
              healedSel = r.bestLocator; diagnosis = r.diagnosis; extras = { verdict: r.verdict, score: r.score, margin: r.margin, emitCount: r.emitCount };
              if (r.verdict === 'heal' && r.bestLocator) {
                const match = await identityMatches(page, r.bestLocator, el.id);
                outcome = match ? 'PASS' : 'FALSE_HEAL';
                identity = match ? 'MATCH' : 'MISMATCH';
              } else outcome = r.verdict === 'abstain' ? 'ABSTAIN' : 'FAIL';
            } else {
              const r = await pluginMatch(page, anchors[el.id], undefined);
              healedSel = r.bestLocator; diagnosis = r.diagnosis; extras = { verdict: r.verdict, score: r.score, margin: r.margin, emitCount: r.emitCount, servedBy: r.servedBy };
              if (r.verdict === 'heal' && r.bestLocator) {
                const match = await identityMatches(page, r.bestLocator, el.id);
                outcome = match ? 'PASS' : 'FALSE_HEAL';
                identity = match ? 'MATCH' : 'MISMATCH';
                if (outcome === 'PASS' && r.servedBy === 'matcher') await updateBrain(page, el.id, el.id, r.bestLocator);
              } else outcome = r.verdict === 'abstain' ? 'ABSTAIN' : 'FAIL';
            }
          } catch (e) {
            const isCrash = /Target crashed|crashed|closed/i.test(e.message || '');
            diagnosis = 'trial error: ' + e.message.slice(0, 120);
            if (isCrash) {
              emit({ pass: 'A', element: el.id, drift, path: pathName, run,
                     outcome: 'SKIPPED_CRASH', diagnosis, wall_ms: Date.now()-t0, claude_cycles: 0 });
              await reopenContext();
              continue;
            }
          }
          const wall_ms = Date.now() - t0;
          try { await revertDrift(page); } catch {}
          emit({
            pass: 'A', element: el.id, drift, path: pathName, run,
            outcome, identity_matches_recorded: identity === 'MATCH',
            healedSel, wall_ms, diagnosis, claude_cycles: cyclesFor(outcome), ...extras,
          });
          process.stdout.write(`    [${el.id}][${drift}][${pathName}][${run}] ${outcome} ${wall_ms}ms\n`);
        }
        try { await ctx.tracing.stop({ path: path.join(TRACE_DIR, `${cellId}.zip`) }); }
        catch (e) { console.log(`  trace stop failed for ${cellId}: ${e.message.slice(0,80)}`); }
        if (pathName === 'L-brain') await page.evaluate(() => { delete window.__BRAIN; delete window.__LADDER; });
      }
    }
  }
  await ctx.close();
}

const START = Date.now();
console.log(`Phase X Excalidraw Pass A — N=${N}, logs -> ${path.relative(process.cwd(), OUT)}`);
const browser = await chromium.launch({ headless: true });
try {
  await passA(browser);
} finally {
  await browser.close();
  const rows = fs.readFileSync(OUT, 'utf8').trim().split('\n').filter(Boolean).length;
  console.log(`\nTotal wall time: ${Math.round((Date.now() - START) / 1000)}s`);
  console.log(`Rows: ${rows}`);
}
