// Warm-up: run the LLM judge on 3 cases only, print raw output, so we can eyeball
// quality before spending the full 160-call budget. Per plan Step 3 / F1.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config as dotenvConfig } from 'dotenv';
import { parseHTML } from 'linkedom';
import { rank } from './lib/descriptor.mjs';
import { judgeLLM } from './lib/llm-judge.mjs';
import { redactTruthMarker } from './lib/redact.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../../../.env.jev') });

const manifest = JSON.parse(readFileSync(resolve(__dirname, 'cases/manifest.json'), 'utf8'));
const warmupIds = ['case-01', 'case-14', 'case-18']; // easy decoy, baseline-wrong decoy, baseline-wrong+abstain decoy

for (const id of warmupIds) {
  const caseDef = manifest.find((m) => m.id === id);
  const html = readFileSync(resolve(__dirname, caseDef.dom_html), 'utf8');
  const { document } = parseHTML(html);
  const candidates = rank(document, caseDef.descriptor, 8);
  const truthIndex = candidates.findIndex((c) => c.isTruth);

  console.log(`\n=== ${id} (${caseDef.drift}) truth@${truthIndex} ===`);
  for (let i = 0; i < candidates.length; i++) {
    const r = await judgeLLM(caseDef.descriptor, candidates[i], redactTruthMarker(html.slice(0, 3000)));
    const mark = i === truthIndex ? '<-- TRUTH' : '';
    console.log(`  [${i}] same=${r.same} conf=${r.confidence} "${r.reason}" ${mark}`);
  }
}
