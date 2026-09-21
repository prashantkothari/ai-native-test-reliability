/* self-heal/pipeline/candidate-validation.js — Step 3: safety checks before accepting a heal.
 *
 * STATUS:
 *   uniqueness(doc, ex)   P1 — BUILT (deterministic): a heal target must resolve uniquely in scope.
 *   roleCongruent(ex,desc)P1 — BUILT (deterministic): role must match the recorded role.
 *   costGate(...)         P2 — STUB. The decision rule  conf*FN_COST > (1-conf)*FP_COST  (the
 *                         "16x cost → ~94% threshold") is sound decision theory, but it requires
 *                         `conf` to be a CALIBRATED probability. `scoreEx` is a weighted signal
 *                         average, NOT P(correct) — see Ledger I23 / R5. Implementing the formula
 *                         on uncalibrated scores would fabricate a confidence we do not have, so it
 *                         THROWS until calibration (P2) exists.
 */
(function (root) {
  // prefer an already-loaded global (browser); fall back to CommonJS require (Node). [review finding #3]
  let S = (root && root.SELFHEAL) || null;
  if (!S && typeof module !== 'undefined' && module.exports) { try { S = require('../../selfheal-core.js'); } catch (e) { /* fall through */ } }
  S = S || (root && root.SELFHEAL);

  // Deterministic: the chosen target's strongest locator must match exactly one element in scope.
  function uniqueness(doc, ex) {
    const loc = S.bestLocator(ex);
    if (!loc || !loc.sel) return { unique: false, tier: loc ? loc.tier : 'none', count: 0 };
    let count;
    try { count = doc.querySelectorAll(loc.sel).length; } catch (e) { return { unique: false, tier: loc.tier, error: String(e) }; }
    return { unique: count === 1, tier: loc.tier, count };
  }

  // Deterministic: role must not have changed (a button must heal to a button-role element).
  function roleCongruent(ex, desc) {
    const want = desc.signals.role && desc.signals.role.value;
    if (!want) return true;            // nothing recorded to enforce
    return ex.role === want;
  }

  // P2 — NOT implemented (needs calibrated probabilities). Throws to block silent fake use.
  function costGate() {
    throw new Error('costGate: P2 — needs CALIBRATED P(correct|score); scoreEx is uncalibrated (I23/R5). ' +
                    'In P1, raise the threshold conservatively instead of quoting a 94% confidence.');
  }

  const API = { uniqueness, roleCongruent, costGate };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.SELFHEAL_VALIDATE = API;
})(typeof window !== 'undefined' ? window : globalThis);
