// Blocking probe (plan §2 step 1, enchanted-swimming-fern.md): confirm the JS SDK's
// Choice response shape matches what the Python docs describe (probabilities/confidence
// per question) before writing judge-choice.mjs against an assumed shape. Halt if not.

import { config as dotenvConfig } from 'dotenv';
import { TypeSafeClient } from '@typesafe-ai/sdk';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../../../.env.jev') });

const client = new TypeSafeClient();

const res = await client.systemOne({
  state: { fruit: 'a long yellow curved fruit, high in potassium' },
  questions: {
    which_fruit: {
      type: 'choice',
      instructions: 'Which fruit is being described?',
      criteria: {
        banana: 'A banana',
        apple: 'An apple',
        grape: 'A grape',
      },
    },
  },
});

console.log(JSON.stringify(res, null, 2));

const answer = res?.answers?.which_fruit;
const hasProbs = answer && typeof answer.probabilities === 'object';
const hasConfidence = answer && typeof answer.confidence === 'number';
const hasChoice = answer && typeof answer.choice === 'string';

console.log('\n--- shape check ---');
console.log('probabilities object present:', hasProbs, hasProbs ? Object.keys(answer.probabilities) : null);
console.log('confidence number present:', hasConfidence, hasConfidence ? answer.confidence : null);
console.log('choice string present:', hasChoice, hasChoice ? answer.choice : null);

if (!hasProbs || !hasConfidence || !hasChoice) {
  console.log('\nBLOCKED: shape does not match assumption. Halt per plan §4 F1 — do not write judge-choice.mjs yet.');
  process.exit(1);
}
console.log('\nOK — shape matches. Safe to proceed to judge-choice.mjs.');
