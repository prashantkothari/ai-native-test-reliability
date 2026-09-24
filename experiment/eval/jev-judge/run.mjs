// Main harness: for each of the 20 cases, rank candidates (shared generator),
// then ask Jev to judge each candidate against the original descriptor.
// Compares Jev's pick to the ranker-only baseline pick and to ground truth.

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
const TAU = 0.7;

async function withRetry(fn, { attempts = 4, baseDelayMs = 1500 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const transient = /503|529|timed out|timeout/i.test(e.message || '');
      if (!transient || i === attempts - 1) throw e;
      const delay = baseDelayMs * 2 ** i;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

async function judgeCandidate(descriptor, candidate, domSlice) {
  const t = Date.now();
  const res = await withRetry(() => client.systemOne({
    state: {
      descriptor: { role: descriptor.role, name: descriptor.name, container: descriptor.container, href: descriptor.href },
      candidate: { role: candidate.role, name: candidate.name, container: candidate.container, href: candidate.href, html: candidate.outerHTML },
      nearby_dom: domSlice,
    },
    questions: {
      same_element: {
        type: 'noul',
        instructions:
          'The user originally targeted the element in `descriptor`. The page changed. Is `candidate` the same logical element (same purpose/target), even if its class, wrapper, sibling order, or exact markup differs?',
        criteria: {
          true: 'Same role and same or equivalent accessible name/purpose, in a consistent container context (or the container context also plausibly shifted the same way).',
          false: 'Different role, different destination (href) or purpose, or it is a near-duplicate decoy element placed next to the real one.',
        },
      },
    },
  }));
  return {
    noul: res.answers.same_element.noul,
    latency_ms: Date.now() - t,
    usage: res.usage,
  };
}

async function runCase(caseDef) {
  const html = readFileSync(resolve(__dirname, caseDef.dom_html), 'utf8');
  const { document } = parseHTML(html);

  const candidates = rank(document, caseDef.descriptor, K);
  const truthCandidateIndex = candidates.findIndex((c) => c.isTruth);

  // Baseline: top-of-ranker pick (index 0), no judge.
  const baselinePick = 0;
  const baselineCorrect = truthCandidateIndex === baselinePick;

  // Jev: judge every candidate, pick argmax.
  const domSlice = redactTruthMarker(html.slice(0, 3000));
  const jevResults = [];
  for (const cand of candidates) {
    const r = await judgeCandidate(caseDef.descriptor, cand, domSlice);
    jevResults.push(r);
  }
  const jevProbs = jevResults.map((r) => r.noul);
  const jevArgmax = jevProbs.indexOf(Math.max(...jevProbs));
  const jevTopProb = jevProbs[jevArgmax];
  const jevAbstain = jevTopProb < TAU;
  const jevCorrect = !jevAbstain && jevArgmax === truthCandidateIndex;
  const jevWrongConfident = !jevAbstain && jevArgmax !== truthCandidateIndex;

  const totalLatency = jevResults.reduce((s, r) => s + r.latency_ms, 0);
  const totalTokensIn = jevResults.reduce((s, r) => s + (r.usage?.input_tokens || 0), 0);
  const totalTokensOut = jevResults.reduce((s, r) => s + (r.usage?.output_tokens || 0), 0);

  return {
    id: caseDef.id,
    control_type: caseDef.control_type,
    drift: caseDef.drift,
    target_id: caseDef.target_id,
    candidate_count: candidates.length,
    truth_found_in_candidates: truthCandidateIndex !== -1,
    truth_index: truthCandidateIndex,
    baseline: {
      pick_index: baselinePick,
      correct: baselineCorrect,
    },
    jev: {
      probs: jevProbs.map((p) => Number(p.toFixed(3))),
      argmax_index: jevArgmax,
      top_prob: Number(jevTopProb.toFixed(3)),
      abstained: jevAbstain,
      correct: jevCorrect,
      wrong_confident: jevWrongConfident,
      latency_ms_total: totalLatency,
      latency_ms_median: median(jevResults.map((r) => r.latency_ms)),
      tokens_in: totalTokensIn,
      tokens_out: totalTokensOut,
    },
  };
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

async function main() {
  mkdirSync(resolve(__dirname, 'results'), { recursive: true });
  const results = [];
  for (const caseDef of manifest) {
    process.stdout.write(`Running ${caseDef.id} (${caseDef.drift})... `);
    try {
      const r = await runCase(caseDef);
      results.push(r);
      console.log(`baseline=${r.baseline.correct ? 'OK' : 'WRONG'} jev=${r.jev.abstained ? 'ABSTAIN' : r.jev.correct ? 'OK' : 'WRONG'} (p=${r.jev.top_prob})`);
      // checkpoint after every case
      writeFileSync(resolve(__dirname, 'results/run-results.json'), JSON.stringify(results, null, 2));
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      results.push({ id: caseDef.id, error: e.message });
      writeFileSync(resolve(__dirname, 'results/run-results.json'), JSON.stringify(results, null, 2));
    }
  }
  console.log(`\nDone. ${results.length} cases. Wrote results/run-results.json`);
}

main().catch((e) => {
  console.error('fatal:', e);
  process.exit(1);
});
