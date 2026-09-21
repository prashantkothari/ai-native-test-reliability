/* self-heal/schemas/false-heal.js — the SINGLE definition of "false-heal" (the project's gating metric).
 *
 * false-heal = the matcher acted on the WRONG element. This is the one number that must stay 0. Because it
 * feeds three places — S4's benchmark classifier, S3's report (via the `false_heal` field it reads), and
 * S8's live flywheel writer — the decision lives HERE, once, so those places can never silently disagree.
 * Writers (S4, S8) call isFalseHeal() to SET the field; readers (S3) just read the boolean it produced.
 *
 * Decision (identity-based — a heal is "false" by where it landed, never by confidence alone):
 *   verdict !== 'heal'                         -> false   (no heal happened → nothing to be false)
 *   verdict === 'heal', expected a heal        -> true iff it resolved to a different element than intended
 *   verdict === 'heal', expected abstain/fail  -> true    (healed at all when it should NOT have)
 *
 * `resolvedIdentity`/`expectedIdentity` are opaque stable keys for "which element" — e.g. a data-oracle
 * in the benchmark, or the captured bestLocator / test-identity at runtime. Compared with ===; callers
 * must pass identities drawn from the same namespace on both sides.
 */
(function (root) {
  function isFalseHeal(o) {
    o = o || {};
    if (o.verdict !== 'heal') return false;
    if (o.expectedVerdict === 'heal') return o.resolvedIdentity !== o.expectedIdentity;
    return true;   // healed when the correct behavior was abstain/fail
  }

  const API = { isFalseHeal };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.SELFHEAL_FALSEHEAL = API;
})(typeof window !== 'undefined' ? window : globalThis);
