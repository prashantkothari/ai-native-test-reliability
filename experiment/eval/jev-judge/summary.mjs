import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const results = JSON.parse(readFileSync(resolve(__dirname, 'results/run-results.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(resolve(__dirname, 'cases/manifest.json'), 'utf8'));
const byId = Object.fromEntries(manifest.map((m) => [m.id, m]));

const byControl = {};
for (const r of results) {
  byControl[r.control_type] ??= [];
  byControl[r.control_type].push(r);
}

const verdictWord = (correct, abstained) => (abstained ? 'ABSTAINED' : correct ? 'CORRECT' : 'WRONG');

for (const [control, rows] of Object.entries(byControl)) {
  console.log(`\n${control.toUpperCase()}`);
  for (const r of rows) {
    const m = byId[r.id];
    const name = m.descriptor.name || m.descriptor.href || m.target_id;
    console.log(`[${r.id}] "${name}" · drift = ${r.drift}`);
    console.log(
      `  baseline (top-of-ranker, no confidence): ${r.baseline.correct ? 'picked the right one' : 'picked the WRONG one — no warning given'}`,
    );
    console.log(
      `  jev: ${verdictWord(r.jev.correct, r.jev.abstained)} (confidence ${r.jev.top_prob}${r.jev.abstained ? ', below 0.7 so it declined to act' : ''})`,
    );
    if (!r.baseline.correct && r.jev.correct) {
      console.log(`  -> jev caught a case the plain ranker would have gotten wrong`);
    }
    if (!r.baseline.correct && r.jev.abstained) {
      console.log(`  -> jev didn't get it right, but safely declined instead of guessing wrong`);
    }
  }
}

// NOTE (added during recovery): the hardcoded verdict lines below reflect the
// FIRST run of this eval, before two label leaks were found and fixed (the
// ground-truth marker leaking into judge input, and decoy elements being
// literally classed "...decoy"). That run's "0% wrong-with-confidence" result
// did NOT hold up after the fixes — see results/choice-verdict.md and the
// corrected run for the real numbers (Jev was wrong-with-confidence on 3/20
// after the fix, worse than the no-judge baseline). Don't quote the print
// statements below as current findings; they're preserved as-is from the
// original script for recovery fidelity, not because they're still true.
console.log('\n=== Verdict (STALE — see note above, from the pre-fix run) ===');
console.log(`Jev was never confidently wrong across 20 cases (0/20 wrong-with-confidence@0.7).`);
console.log(`The plain ranker (no judge) was wrong 3/20 times, all on decoy-insertion cases, silently — no signal that it might be wrong.`);
console.log(`Jev caught 2 of those 3 and safely abstained on the 3rd rather than confidently picking the decoy.`);
console.log(`Median judge latency ~368ms; no LLM baseline run this pass (dropped per user call — see plan).`);
