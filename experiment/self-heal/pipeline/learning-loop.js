/* self-heal/pipeline/learning-loop.js — Step 6: improve over time from VERIFIED outcomes.
 *
 * STATUS: S8 — IMPLEMENTED (P2 slice). Cross-tenant federation (Ledger I27, P3) is still out of scope —
 * this is a SINGLE-PROCESS, session-lifetime autonomy ladder on top of S2's brain (self-heal/brain/brain.js).
 *
 * ---- The ladder (S8 design — concrete, testable, deliberately conservative) ----
 * Two tiers only. A third tier (skip verify-by-effect too) is NOT built — see "Why no L3" below.
 *
 *   L1 (default / cold)   — brain miss, OR <5 successes-since-last-reset on this key.
 *                            The executor runs the real matcher AND verify-by-effect; outcome feeds
 *                            these counters (promote/demote), but nothing is skipped yet.
 *   L2 (trusted)           — >=5 HIGH-confidence-verified PASS outcomes since the last reset, 0 failures
 *                            since that reset. The executor MAY skip re-matching and act directly on the
 *                            brain's cached locator (self-heal/brain/brain.js get() still re-checks the
 *                            selector resolves to exactly ONE live element — that check is REUSED, never
 *                            re-implemented here). verify-by-effect is NEVER skipped at L2 — that stays
 *                            the false-heal firewall regardless of tier.
 *
 * Thresholds (asserted, not measured — these are policy choices, not numbers derived from a dataset):
 *   PROMOTE_AT = 5  — matches the pre-existing stub comment below ("successes>=5") and the ledger's
 *                     I16 range ("3-5 verified successes"); we pick the conservative end of that range.
 *   DEMOTE_AT  = 1  — DELIBERATE DEVIATION from the stub comment's "failures>=2". The S8 session brief
 *                     is explicit and more recent: "Demotion: 1 failure ... immediately evict ... this
 *                     must be aggressive — the ladder's whole safety case rests on demoting fast and
 *                     promoting slow." One verify-by-effect failure (or a brain-first act that leads to
 *                     FAILED/APP_BUG) evicts the key from the brain and resets its counters to cold.
 *                     When in doubt, demote fast — false-heal=0 is non-negotiable; a slower promotion
 *                     curve costs nothing but re-matching time, a slow demotion curve risks a false heal.
 *
 * Why no L3: an L3 ("skip verify-by-effect too") can only be proven safe if SOMETHING besides the
 * assertion itself confirms the app actually did the right thing — and nothing in this codebase provides
 * that (verify-by-effect IS the false-heal firewall; there is no second independent oracle to cross-check
 * against). Skipping it would mean a stale cached locator could act on the WRONG element, the app could
 * silently no-op, and the test would still report PASS. That is exactly the false-heal shape this whole
 * project exists to prevent. So L3 is not built — L2 is the honest stopping point until a real second
 * signal (e.g. a cross-tenant corroboration store, P3/I27) exists to justify it.
 *
 * ---- OV#4 guard (never learn from unverified outcomes) ----
 * A step only ever counts toward PROMOTION when the WHOLE test's outcome is 'PASS' at verify_confidence
 * 'HIGH' (mirrors self-heal/brain/brain.js's ingestLiveResult — same "all steps that got there are
 * evidence" rationale, documented there). Anything else that is not a failure (PASS_WARNING/ABSTAIN, or
 * a PASS at MEDIUM/NONE/simulated confidence) is NEUTRAL — it neither promotes nor demotes. A FAILED
 * outcome always demotes, regardless of confidence — a failure is a failure signal even when the
 * verification method itself was only MEDIUM confidence; false-heal risk does not wait for HIGH evidence
 * to act, only promotion does.
 *
 * ---- Key scheme ----
 * patternKey MUST be the authored-test-identity key from self-heal/brain/brain.js's key(testId, stepId)
 * convention ("L1:submit", K37/GA-e) — reused via SELFHEAL_BRAIN.key, never a second invented scheme.
 */
(function (root) {
  const B = root.SELFHEAL_BRAIN;

  const PROMOTE_AT = 5;   // >=5 consecutive HIGH-confidence successes since last reset -> L2
  const DEMOTE_AT = 1;    // 1 failure (any confidence) -> immediate evict + reset to cold (aggressive by design)

  function keyOf(testId, stepId) {
    return (B && typeof B.key === 'function') ? B.key(testId, stepId) : (testId + ':' + stepId);
  }

  function makeLadder(seed) {
    const data = Object.assign({}, seed);

    function tierOf(rec) {
      return (rec && rec.successes >= PROMOTE_AT && rec.failures === 0) ? 'L2' : 'L1';
    }

    function get(testId, stepId) { return data[keyOf(testId, stepId)] || null; }
    function tier(testId, stepId) { return tierOf(get(testId, stepId)); }

    // record(testId, stepId, outcome, confidence, brain?) -> { rec, tier, action }
    //   outcome: the runtime's canonical vocabulary — 'PASS' | 'FAILED' | 'PASS_WARNING' | 'ABSTAIN'.
    //   confidence: verify_confidence — 'HIGH' | 'MEDIUM' | 'NONE' | 'simulated'.
    //   brain (optional): if provided and this record demotes past DEMOTE_AT, brain.evict(testId, stepId)
    //     is called so the NEXT brain.get() cold-starts (forces the real matcher again).
    // action is one of: 'success' | 'demote' | 'demote+evict' | 'noop' — 'noop' covers every outcome
    // that is neither a HIGH-confidence PASS nor a FAILED (PASS_WARNING, ABSTAIN, or a PASS that wasn't
    // verified at HIGH confidence) — those are evidence of nothing either way (OV#4 guard).
    function record(testId, stepId, outcome, confidence, brain) {
      const k = keyOf(testId, stepId);
      const rec = data[k] || { successes: 0, failures: 0, observations: 0 };
      rec.observations += 1;
      let action = 'noop';

      if (outcome === 'FAILED') {
        rec.failures += 1;
        action = 'demote';
        if (rec.failures >= DEMOTE_AT) {
          if (brain && typeof brain.evict === 'function') brain.evict(testId, stepId);
          rec.successes = 0; rec.failures = 0;   // cold-start: reset the whole ladder position for this key
          action = 'demote+evict';
        }
      } else if (outcome === 'PASS' && confidence === 'HIGH') {   // OV#4 guard — only HIGH promotes
        rec.successes += 1;
        action = 'success';
      }
      // else: PASS_WARNING / ABSTAIN / PASS-at-non-HIGH-confidence -> neutral, no-op on the counters

      data[k] = rec;
      return { rec: Object.assign({}, rec), tier: tierOf(rec), action };
    }

    function snapshot() {
      const out = {};
      Object.keys(data).forEach(x => { out[x] = Object.assign({}, data[x]); });
      return out;
    }

    return { record, get, tier, tierOf, snapshot };
  }

  // legacy stub entry point kept so any old caller expecting the documented-throw behaviour still gets
  // a clear signal to migrate, rather than silently resolving to something unexpected.
  function learn() {
    throw new Error('learning-loop: learn() is retired — use makeLadder().record(testId, stepId, outcome, ' +
                    'confidence, brain) instead (S8: promote>=' + PROMOTE_AT + ' successes, demote>=' + DEMOTE_AT + ' failure).');
  }

  const API = { makeLadder, learn, PROMOTE_AT, DEMOTE_AT, key: keyOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.SELFHEAL_LEARN = API;
})(typeof window !== 'undefined' ? window : globalThis);
