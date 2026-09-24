// Four-way head-to-head: baseline (ranker top-1) vs Jev-Noul vs inline-LLM (this
// session acting as the judge, since the metered Anthropic API had no billing on
// this key) vs Jev-Choice (plan: enchanted-swimming-fern.md).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const jevResults = JSON.parse(readFileSync(resolve(__dirname, 'results/jev-run-results-unlabeled-decoy.json'), 'utf8'));
const answerKey = JSON.parse(readFileSync(resolve(__dirname, 'results/inline-judge-answer-key.json'), 'utf8'));
const llmJudgments = JSON.parse(readFileSync(resolve(__dirname, 'results/inline-llm-judgments.json'), 'utf8'));
const choiceResults = JSON.parse(readFileSync(resolve(__dirname, 'results/choice-run.json'), 'utf8'));
const choiceById = Object.fromEntries(choiceResults.map((c) => [c.id, c]));

const TAU = 0.7;
const byId = Object.fromEntries(answerKey.map((a) => [a.id, a]));

function scoreJudge(probs, truthIndex) {
  const argmax = probs.indexOf(Math.max(...probs));
  const topProb = probs[argmax];
  const abstained = topProb < TAU;
  const correct = !abstained && argmax === truthIndex;
  const wrongConfident = !abstained && argmax !== truthIndex;
  return { argmax, topProb, abstained, correct, wrongConfident };
}

const rows = jevResults.map((jr) => {
  const key = byId[jr.id];
  const llmProbs = llmJudgments.cases[jr.id];
  const llmScore = scoreJudge(llmProbs, key.truth_index);
  const cr = choiceById[jr.id];
  return {
    id: jr.id,
    control_type: jr.control_type,
    drift: jr.drift,
    truth_index: key.truth_index,
    baseline_correct: jr.baseline.correct,
    jev_correct: jr.jev.correct,
    jev_abstained: jr.jev.abstained,
    jev_wrong_confident: jr.jev.wrong_confident,
    jev_top_prob: jr.jev.top_prob,
    llm_correct: llmScore.correct,
    llm_abstained: llmScore.abstained,
    llm_wrong_confident: llmScore.wrongConfident,
    llm_top_prob: Number(llmScore.topProb.toFixed(2)),
    choice_correct: cr.choice.correct,
    choice_abstained: cr.choice.abstained,
    choice_wrong_confident: cr.choice.wrong_confident,
    choice_top_prob: cr.choice.top_prob,
    choice_tokens_in: cr.choice.tokens_in,
  };
});

console.log('=== Four-way per-case ===');
console.table(
  rows.map((r) => ({
    id: r.id,
    drift: r.drift,
    control: r.control_type,
    baseline: r.baseline_correct ? 'OK' : 'WRONG',
    jev_noul: r.jev_abstained ? `ABSTAIN(${r.jev_top_prob})` : r.jev_correct ? `OK(${r.jev_top_prob})` : `WRONG(${r.jev_top_prob})`,
    llm_inline: r.llm_abstained ? `ABSTAIN(${r.llm_top_prob})` : r.llm_correct ? `OK(${r.llm_top_prob})` : `WRONG(${r.llm_top_prob})`,
    jev_choice: r.choice_abstained ? `ABSTAIN(${r.choice_top_prob})` : r.choice_correct ? `OK(${r.choice_top_prob})` : `WRONG(${r.choice_top_prob})`,
  })),
);

const n = rows.length;
function summarize(prefix) {
  const correct = rows.filter((r) => r[`${prefix}_correct`]).length;
  const abstained = rows.filter((r) => r[`${prefix}_abstained`]).length;
  const wrongConfident = rows.filter((r) => r[`${prefix}_wrong_confident`]).length;
  return { correct, abstained, wrongConfident };
}

const baselineCorrect = rows.filter((r) => r.baseline_correct).length;
const jevSummary = summarize('jev');
const llmSummary = summarize('llm');
const choiceSummary = summarize('choice');

// Cost check (plan §4 F4): Noul = 8 independent calls/case (~ Jev's per-call tokens
// logged in the earlier run); Choice = 1 call/case with all 8 candidates inlined.
const choiceTokensTotal = rows.reduce((s, r) => s + r.choice_tokens_in, 0);
const jevTokensTotal = jevResults.reduce((s, r) => s + (r.jev.tokens_in || 0), 0);

console.log('\n=== Headline (n=20) ===');
console.log(`Baseline (no judge):        correct ${baselineCorrect}/${n} (${pct(baselineCorrect, n)}) — no confidence signal, so no abstain/wrong-confident concept`);
console.log(`Jev-Noul (8 calls/case):    correct ${jevSummary.correct}/${n} (${pct(jevSummary.correct, n)})  abstained ${jevSummary.abstained}/${n}  wrong-with-confidence ${jevSummary.wrongConfident}/${n}`);
console.log(`Inline LLM (Sonnet, this session): correct ${llmSummary.correct}/${n} (${pct(llmSummary.correct, n)})  abstained ${llmSummary.abstained}/${n}  wrong-with-confidence ${llmSummary.wrongConfident}/${n}`);
console.log(`Jev-Choice (1 call/case):   correct ${choiceSummary.correct}/${n} (${pct(choiceSummary.correct, n)})  abstained ${choiceSummary.abstained}/${n}  wrong-with-confidence ${choiceSummary.wrongConfident}/${n}`);

console.log('\n=== Cost check (plan §4 F4) ===');
console.log(`Jev-Noul total input tokens (160 calls):  ${jevTokensTotal}`);
console.log(`Jev-Choice total input tokens (20 calls):  ${choiceTokensTotal}`);
console.log(`Choice tokens as % of Noul: ${pct(choiceTokensTotal, jevTokensTotal)}`);

console.log('\n=== Plan §3 success criterion ===');
const criticalIds = ['case-01', 'case-14', 'case-18'];
const criticalRows = rows.filter((r) => criticalIds.includes(r.id));
const zeroWrongOnCritical = criticalRows.every((r) => !r.choice_wrong_confident);
const noRegression = choiceSummary.correct >= 15;
console.log(`Zero wrong-confident on case-01/14/18: ${zeroWrongOnCritical ? 'PASS' : 'FAIL'}`);
console.log(`Aggregate correct >= 15/20 (no regression from abstaining on easy cases): ${noRegression ? 'PASS' : 'FAIL'} (actual: ${choiceSummary.correct}/20)`);
console.log(`Verdict: Choice ${zeroWrongOnCritical && noRegression ? 'WINS' : 'does NOT win'} per plan's own bar.`);

function pct(a, b) {
  return `${((a / b) * 100).toFixed(0)}%`;
}
