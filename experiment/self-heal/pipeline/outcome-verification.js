/* self-heal/pipeline/outcome-verification.js — Step 5: confirm the heal produced the expected effect.
 *
 * Ledger I24. The three-way outcome rule:
 *   verify possible & PASSES   → accept heal
 *   verify possible & FAILS    → mark FAILED ("heal verification failed") — do NOT pass on the wrong element
 *   verify NOT possible        → PASS with WARNING ("heal unverified"); never auto-promote to a
 *                                persistent override; queue for human review.
 *
 * STATUS: PARTIAL.
 *   verify(before, after, expect)  delegates to core `verifyEffect` — LOGIC ONLY, tested on MODELLED
 *                                  before/after state objects (as in PHASE1 E5), NOT a live round-trip.
 *   The real act → snapshot → observe → compare round-trip needs a runtime driver → P2
 *   (`selfheal-runtime.js`). `verifyConfidence` mirrors the I24/OV#4 guard so P2 can filter.
 */
(function (root) {
  // prefer an already-loaded global (browser); fall back to CommonJS require (Node). [review finding #3]
  let S = (root && root.SELFHEAL) || null;
  if (!S && typeof module !== 'undefined' && module.exports) { try { S = require('../../selfheal-core.js'); } catch (e) { /* fall through */ } }
  S = S || (root && root.SELFHEAL);

  // Confidence of a verification approach (Ledger OV#4 / doc2 Step 5). Only HIGH should ever bump
  // learning stats; everything else is advisory until a real runtime confirms it.
  const CONFIDENCE = { urlChange: 'HIGH', elementGone: 'HIGH', textPresent: 'MEDIUM', domChange: 'MEDIUM', none: 'NONE' };

  function verify(before, after, expect) {
    const passed = S.verifyEffect(before, after, expect);
    const confidence = (expect && CONFIDENCE[expect.type]) || 'NONE';
    return { passed, confidence };
  }

  // Apply the three-way rule to a (heal, verification) pair → a test outcome.
  function decide(healHappened, verification) {
    if (!healHappened) return { outcome: 'FAILED', reason: 'no heal attempted' };
    if (verification.confidence === 'NONE') return { outcome: 'PASSED_WARNING', reason: 'heal unverified — queue for human review' };
    return verification.passed
      ? { outcome: 'PASSED', reason: 'heal verified (' + verification.confidence + ')' }
      : { outcome: 'FAILED', reason: 'heal verification failed — wrong element likely' };
  }

  const API = { verify, decide, CONFIDENCE };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.SELFHEAL_VERIFY = API;
})(typeof window !== 'undefined' ? window : globalThis);
