// Plan §2 step 3 (enchanted-swimming-fern.md): one Choice call per case instead of
// 8 independent Noul calls. Same shared ranker/candidates as run.mjs, same cases,
// same TAU=0.7 — the only variable is the primitive.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config as dotenvConfig } from 'dotenv';
import { parseHTML } from 'linkedom';
import { TypeSafeClient } from '@typesafe-ai/sdk';
import { rank } from './lib/descriptor.mjs';
import { redactTruthMarker } from './lib/redact.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../../../.env.jev') });

const manifest = JSON.parse(readFileSync(resolve(__dirname, 'cases/manifest.json'), 'utf8'));
const client = new TypeSafeClient();

const K = 8;
const TAU_CHOICE = 0.7; // frozen, matches Noul's TAU for apples-to-apples (plan §2)

async function withRetry(fn, { attempts = 4, baseDelayMs = 1500 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const transient = /503|529|timed out|timeout/i.test(e.message || '');
      if (!transient || i === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i));
    }
  }
  throw lastErr;
}

// Raw attributes only, symmetric across candidates — no pre-computed match flags,
// no rules in the instruction. Isolates the primitive as the only variable (plan §2.3).
function criterionFor(candidate) {
  return JSON.stringify({
    role: candidate.role,
    name: candidate.name,
    testid: candidate.testid,
    href: candidate.href,
    container: candidate.container,
    html: candidate.outerHTML,
  });
}

async function judgeCase(caseDef) {
  const html = readFileSync(resolve(__dirname, caseDef.dom_html), 'utf8');
  const { document } = parseHTML(html);
  const candidates = rank(document, caseDef.descriptor, K);
  const truthIndex = candidates.findIndex((c) => c.isTruth);

  const criteria = {};
  candidates.forEach((c, i) => {
    criteria[`c${i}`] = criterionFor(c);
  });

  const domSlice = redactTruthMarker(html.slice(0, 3000));
  const descriptorState = {
    role: caseDef.descriptor.role,
    name: caseDef.descriptor.name,
    testid: caseDef.descriptor.testid,
    href: caseDef.descriptor.href,
    container: caseDef.descriptor.container,
  };

  const t = Date.now();
  const res = await withRetry(() =>
    client.systemOne({
      state: { descriptor: descriptorState, nearby_dom: domSlice },
      questions: {
        which_candidate: {
          type: 'choice',
          instructions:
            'The user originally targeted the element in `descriptor`. The page changed. Which candidate is the same logical element (same purpose/target), even if its class, wrapper, sibling order, or exact markup differs?',
          criteria,
        },
      },
    }),
  );
  const latency_ms = Date.now() - t;

  const answer = res.answers.which_candidate;
  const probsByKey = answer.probabilities;
  const probs = candidates.map((_, i) => probsByKey[`c${i}`] ?? 0);
  const argmax = probs.indexOf(Math.max(...probs));
  const topProb = probs[argmax];
  const abstained = answer.confidence < TAU_CHOICE;
  const correct = !abstained && argmax === truthIndex;
  const wrongConfident = !abstained && argmax !== truthIndex;

  return {
    id: caseDef.id,
    control_type: caseDef.control_type,
    drift: caseDef.drift,
    candidate_count: candidates.length,
    truth_found_in_candidates: truthIndex !== -1,
    truth_index: truthIndex,
    choice: {
      probabilities: probs.map((p) => Number(p.toFixed(3))),
      confidence: Number(answer.confidence.toFixed(3)),
      argmax_index: argmax,
      top_prob: Number(topProb.toFixed(3)),
      abstained,
      correct,
      wrong_confident: wrongConfident,
      latency_ms,
      tokens_in: res.usage.input_tokens,
      tokens_out: res.usage.output_tokens,
    },
  };
}

async function main() {
  mkdirSync(resolve(__dirname, 'results'), { recursive: true });
  const results = [];
  for (const caseDef of manifest) {
    process.stdout.write(`Running ${caseDef.id} (${caseDef.drift})... `);
    try {
      const r = await judgeCase(caseDef);
      results.push(r);
      console.log(
        `${r.choice.abstained ? 'ABSTAIN' : r.choice.correct ? 'OK' : 'WRONG'} (confidence=${r.choice.confidence}, top_prob=${r.choice.top_prob})`,
      );
      writeFileSync(resolve(__dirname, 'results/choice-run.json'), JSON.stringify(results, null, 2));
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      results.push({ id: caseDef.id, error: e.message });
      writeFileSync(resolve(__dirname, 'results/choice-run.json'), JSON.stringify(results, null, 2));
    }
  }
  console.log(`\nDone. ${results.length} cases. Wrote results/choice-run.json`);
}

main().catch((e) => {
  console.error('fatal:', e);
  process.exit(1);
});
