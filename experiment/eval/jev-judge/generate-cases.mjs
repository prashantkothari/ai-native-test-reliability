// Generates 20 labeled cases: (element descriptor, mutated DOM, correct answer).
// Base page: fixtures/base.html. Ten target elements, six drift kinds, decoy-weighted.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseHTML } from 'linkedom';
import { describe } from './lib/descriptor.mjs';
import { MUTATIONS, DRIFT_WEIGHTS } from './lib/mutate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const baseHtml = readFileSync(resolve(__dirname, 'fixtures/base.html'), 'utf8');

// 10 target elements, identified by a CSS selector into the pristine base page.
const TARGETS = [
  { id: 't-signin', selector: '[data-testid="signin"]', control_type: 'button' },
  { id: 't-menu-toggle', selector: '.icon-btn', control_type: 'button' },
  { id: 't-nav-products', selector: '.nav-link[href="/products"]', control_type: 'link' },
  { id: 't-nav-docs', selector: '.nav-link[href="/docs"]', control_type: 'link' },
  { id: 't-get-started', selector: '[data-testid="get-started"]', control_type: 'link' },
  { id: 't-search-input', selector: '#q', control_type: 'input' },
  { id: 't-search-submit', selector: '.btn-search', control_type: 'button' },
  { id: 't-contributor-bob', selector: '.contributor-link[href="/user/bob"]', control_type: 'link' },
  { id: 't-footer-terms', selector: '.footer-link[href="/legal/terms"]', control_type: 'link' },
  { id: 't-feedback', selector: '[data-testid="feedback"]', control_type: 'button' },
];

// Build a weighted, order-shuffled (seeded) assignment of drift kinds to the 20 case slots.
function buildDriftPlan() {
  const plan = [];
  for (const [kind, count] of Object.entries(DRIFT_WEIGHTS)) {
    for (let i = 0; i < count; i++) plan.push(kind);
  }
  return plan; // length 20
}

function makeSeededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function seededShuffle(arr, seed = 42) {
  const rng = makeSeededRng(seed);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const decoyPositionRng = makeSeededRng(7);

const driftPlan = seededShuffle(buildDriftPlan());
const targetsCycled = Array.from({ length: 20 }, (_, i) => TARGETS[i % TARGETS.length]);

mkdirSync(resolve(__dirname, 'cases'), { recursive: true });

const manifest = [];

driftPlan.forEach((drift, i) => {
  const target = targetsCycled[i];
  const { document } = parseHTML(baseHtml);
  const el = document.querySelector(target.selector);
  if (!el) throw new Error(`target selector not found: ${target.selector}`);

  const descriptor = describe(el);
  const mutateFn = MUTATIONS[drift];
  const maybeNewEl = drift === 'decoy-insertion' ? mutateFn(document, el, decoyPositionRng) : mutateFn(document, el);
  const finalEl = maybeNewEl || el;

  // correct answer = a stable fingerprint we can re-locate post-mutation: prefer testid, else
  // a synthetic marker attribute we stamp before serializing.
  finalEl.setAttribute('data-eval-truth', '1');

  const caseId = `case-${String(i + 1).padStart(2, '0')}`;
  const domHtmlPath = `cases/${caseId}.html`;
  writeFileSync(resolve(__dirname, domHtmlPath), document.toString());

  manifest.push({
    id: caseId,
    target_id: target.id,
    control_type: target.control_type,
    drift,
    descriptor,
    dom_html: domHtmlPath,
    truth_marker: 'data-eval-truth="1"',
  });
});

writeFileSync(resolve(__dirname, 'cases/manifest.json'), JSON.stringify(manifest, null, 2));

console.log(`Generated ${manifest.length} cases.`);
console.table(manifest.map((m) => ({ id: m.id, target: m.target_id, control: m.control_type, drift: m.drift })));
