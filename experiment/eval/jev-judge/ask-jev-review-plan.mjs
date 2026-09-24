// Ask Jev whether this eval plan is likely to give a reliable answer.
// Independent of the main run. ~1 call, cheap.

import { config as dotenvConfig } from 'dotenv';
import { readFileSync, writeFileSync } from 'node:fs';
import { TypeSafeClient } from '@typesafe-ai/sdk';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../../../.env.jev') });

const plan = readFileSync('/Users/prashant/.claude/plans/system-reminder-you-are-operating-mossy-curry.md', 'utf8');

const client = new TypeSafeClient();
const t = Date.now();
const res = await client.systemOne({
  state: { plan_markdown: plan },
  questions: {
    reliable_answer: {
      type: 'noul',
      instructions:
        'Will running the experiment described in `plan_markdown` produce a reliable answer to the question "is Jev safer than a top-of-ranker baseline for the same-element judgment"?',
      criteria: {
        true: 'The scope, dataset (20 cases with decoy-heavy weighting), shared candidate generator, and safety metric (wrong-with-confidence at threshold 0.7) are aligned with the question. Failure modes are covered.',
        false: 'Sample size too small for the claim, metrics measure the wrong thing, dataset does not exercise the failure mode being tested, or safety metric is inadequate.',
      },
    },
    decoy_weight_correct: {
      type: 'noul',
      instructions:
        'Is weighting decoy-insertion mutations to 6/20 of the dataset an appropriate way to stress-test the "never click the wrong element" safety property?',
    },
  },
});

console.log(JSON.stringify({ latency_ms: Date.now() - t, ...res }, null, 2));
writeFileSync(resolve(__dirname, 'results/jev-plan-review.json'), JSON.stringify(res, null, 2));
