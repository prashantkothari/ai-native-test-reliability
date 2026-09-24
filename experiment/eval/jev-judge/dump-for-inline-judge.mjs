// Dumps, for every case, the descriptor + ranked candidates + a DOM slice —
// exactly what llm-judge.mjs would send to the Anthropic API per call.
// Used when running the LLM judge "inline" (Claude Code's own model acting as
// the judge) instead of through a separate metered API key.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseHTML } from 'linkedom';
import { rank } from './lib/descriptor.mjs';
import { redactTruthMarker } from './lib/redact.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(__dirname, 'cases/manifest.json'), 'utf8'));

const blindDump = [];
const answerKey = [];

for (const caseDef of manifest) {
  const html = readFileSync(resolve(__dirname, caseDef.dom_html), 'utf8');
  const { document } = parseHTML(html);
  const candidates = rank(document, caseDef.descriptor, 8);
  const truthIndex = candidates.findIndex((c) => c.isTruth);

  // What the judge sees — no truth_index, no drift/control_type labels (those would
  // tell the judge which mutation was applied, including the word "decoy" itself —
  // neither run.mjs nor lib/llm-judge.mjs ever send these fields to a real judge call,
  // so the blind dump must match that exactly).
  blindDump.push({
    id: caseDef.id,
    descriptor: {
      role: caseDef.descriptor.role,
      name: caseDef.descriptor.name,
      container: caseDef.descriptor.container,
      href: caseDef.descriptor.href,
    },
    candidates: candidates.map((c, i) => ({
      index: i,
      role: c.role,
      name: c.name,
      container: c.container,
      href: c.href,
      html: c.outerHTML,
    })),
    nearby_dom: redactTruthMarker(html.slice(0, 3000)),
  });

  // Scoring key — kept separate so judging stays blind. control_type/drift live here,
  // not in the blind dump, since they're only needed for post-hoc grouping/reporting.
  answerKey.push({
    id: caseDef.id,
    truth_index: truthIndex,
    candidate_count: candidates.length,
    control_type: caseDef.control_type,
    drift: caseDef.drift,
  });
}

writeFileSync(resolve(__dirname, 'results/inline-judge-input.json'), JSON.stringify(blindDump, null, 2));
writeFileSync(resolve(__dirname, 'results/inline-judge-answer-key.json'), JSON.stringify(answerKey, null, 2));
console.log(`Dumped ${blindDump.length} cases, ${blindDump.reduce((s, c) => s + c.candidates.length, 0)} candidates total (blind — no truth index).`);
console.log('Answer key written separately to results/inline-judge-answer-key.json.');
