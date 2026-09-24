import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const results = JSON.parse(readFileSync(resolve(__dirname, 'results/run-results.json'), 'utf8'));

const n = results.length;
const baselineCorrect = results.filter((r) => r.baseline.correct).length;
const jevCorrect = results.filter((r) => r.jev.correct).length;
const jevAbstained = results.filter((r) => r.jev.abstained).length;
const jevWrongConfident = results.filter((r) => r.jev.wrong_confident).length;
const baselineWrong = results.filter((r) => !r.baseline.correct).length;

const allLatencies = results.flatMap((r) => [r.jev.latency_ms_median]);
const medianOfMedians = median(allLatencies);
const totalTokensIn = results.reduce((s, r) => s + r.jev.tokens_in, 0);
const totalTokensOut = results.reduce((s, r) => s + r.jev.tokens_out, 0);
// jev-1.13.0 pricing not published in docs read so far; report tokens, flag $ as todo.

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

console.log('=== Headline metrics (n=20) ===');
console.log(`Baseline (ranker top-1, no judge)  correct: ${baselineCorrect}/${n} (${pct(baselineCorrect, n)})`);
console.log(`Jev judge                          correct: ${jevCorrect}/${n} (${pct(jevCorrect, n)})`);
console.log(`Jev judge                        abstained: ${jevAbstained}/${n} (${pct(jevAbstained, n)})`);
console.log(`Jev judge   WRONG-WITH-CONFIDENCE (p>=0.7): ${jevWrongConfident}/${n} (${pct(jevWrongConfident, n)})  <- headline safety metric`);
console.log(`Baseline    WRONG (no confidence signal at all): ${baselineWrong}/${n} (${pct(baselineWrong, n)})`);
console.log(`Median per-judgment latency (median across cases): ${medianOfMedians} ms`);
console.log(`Total tokens: ${totalTokensIn} in / ${totalTokensOut} out over ${n} cases (${results.reduce((s,r)=>s+r.jev.probs.length,0)} judge calls)`);

console.log('\n=== By drift kind ===');
const byDrift = {};
for (const r of results) {
  byDrift[r.drift] ??= { total: 0, baselineCorrect: 0, jevCorrect: 0, jevAbstain: 0, jevWrongConfident: 0 };
  const b = byDrift[r.drift];
  b.total++;
  if (r.baseline.correct) b.baselineCorrect++;
  if (r.jev.correct) b.jevCorrect++;
  if (r.jev.abstained) b.jevAbstain++;
  if (r.jev.wrong_confident) b.jevWrongConfident++;
}
console.table(
  Object.entries(byDrift).map(([drift, b]) => ({
    drift,
    n: b.total,
    'baseline correct': `${b.baselineCorrect}/${b.total}`,
    'jev correct': `${b.jevCorrect}/${b.total}`,
    'jev abstain': `${b.jevAbstain}/${b.total}`,
    'jev wrong-confident': `${b.jevWrongConfident}/${b.total}`,
  })),
);

function pct(a, b) {
  return `${((a / b) * 100).toFixed(0)}%`;
}
