// Minimal fixture test for identityOf: verifies the seed is invariant under
// simulated D4 drift (data-testid and aria-label both renamed). Same button,
// same bounding box, same text, same landmark chain → same seed via three
// different locator paths.

import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { identityOf } from './identity.js';

const HTML = `<!doctype html>
<html><body>
  <main>
    <button id="btn" data-testid="main-menu-trigger" aria-label="Menu">Menu</button>
  </main>
</body></html>`;

const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.setContent(HTML);

  // Baseline: locate via original testid.
  const locBaseline = page.locator('[data-testid="main-menu-trigger"]');
  const seed0 = (await identityOf(locBaseline)).seed;
  assert.ok(seed0, 'baseline seed should be non-null');
  console.log('baseline seed:', seed0);

  // Simulate D4: rename data-testid AND aria-label in place. Element identity
  // (same DOM node, same text, same box, same parent chain) is unchanged.
  await page.evaluate(() => {
    const el = document.getElementById('btn');
    el.setAttribute('data-testid', 'menu-trigger-v2');
    el.setAttribute('aria-label', 'Options');
  });

  // Path S (new strict testid).
  const locS = page.locator('[data-testid="menu-trigger-v2"]');
  const seedS = (await identityOf(locS)).seed;
  console.log('post-drift S seed:', seedS);

  // Path N (getByRole with new aria-label as accessible name).
  const locN = page.getByRole('button', { name: 'Options' });
  const seedN = (await identityOf(locN)).seed;
  console.log('post-drift N seed:', seedN);

  assert.equal(seedS, seed0, 'S-path seed should match baseline post-D4');
  assert.equal(seedN, seed0, 'N-path seed should match baseline post-D4');

  console.log('PASS: identityOf is drift-invariant across S/N paths under D4.');
  await ctx.close();
} finally {
  await browser.close();
}
