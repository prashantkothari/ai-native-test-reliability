/* self-heal/schemas/flywheel-event.schema.js — one row per verified outcome.
 *
 * The training substrate (F1). Everything downstream (brain/learning-loop, calibration, benchmark)
 * reads this shape. Only rows with verify_confidence in {HIGH, MEDIUM} are eligible for the brain
 * (OV#4 guard); NONE/simulated rows are LOGGED but never PROMOTED — the guard enforces that in
 * learning-loop.js, this schema just enumerates the honest values so nothing else can smuggle a
 * non-verified row in as if it were verified.
 *
 * Versioned (F5) — schemaVersion is required so month-9 code can still parse month-1 rows.
 */
(function (root) {
  const eventSchema = {
    $id: 'flywheel-event/v1',
    type: 'object',
    required: ['schemaVersion', 'ts', 'app', 'testId', 'outcome', 'verify_confidence', 'category', 'source'],
    properties: {
      schemaVersion: { const: 'flywheel-event/v1' },
      ts: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}T' },   // ISO-8601 (Z or offset)
      app: { type: 'string', minLength: 1 },                        // 'amplitude'|'testsigma'|'fixture:login' …
      testId: { type: 'string', minLength: 1 },                     // authored-identity key (GA-e / K37)
      stepId: { type: ['string', 'null'] },                         // null when the row is a test-level outcome
      outcome: { type: 'string', enum: ['PASS', 'PASS_WARNING', 'FAILED', 'ABSTAIN'] },   // canonical runtime vocabulary only — NOT outcome-verification's raw 'PASSED'/'PASSED_WARNING'
      verify_confidence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'NONE', 'simulated'] },
      category: { type: 'string', minLength: 1 },                   // VERIFIED|NEG_OK|APP_BUG|DRIFT|AMBIGUITY|REMOVAL|STATE_ISSUE|SMOKE|UNKNOWN — empty string is a producer bug, reject it (don't silently fold into UNKNOWN downstream)
      source: { type: 'string', enum: ['live', 'simulated', 'manual'] },  // live=S7 executor; simulated=drift-only; manual=HITL
      driftKind: { type: ['string', 'null'], enum: ['pristine', 'restyle', 'localize', 'appbug', null] },
      healed: { type: ['boolean', 'null'] },                        // true=matcher had to heal; false=cached; null=n/a
      false_heal: { type: 'boolean' },                              // gating metric — must stay 0 in aggregate
      firstTry: { type: ['boolean', 'null'] },                      // true=recorded bestLocator still resolved uniquely to the acted element; false=matcher had to lean on descriptor scoring to relocate (a heal occurred); null=n/a (assert/navigate, no bestLocator, or role= pseudo-selector). OPTIONAL — absent = unknown, NEVER counted as either in downstream heal-rate.
      diagnosis: { type: ['string', 'null'] },                      // free-form reason for ABSTAIN/FAILED
      hitl_decision: { type: ['string', 'null'] }                   // e.g. 'confirm'|'skip'|'point-to'|null
    },
    additionalProperties: false
  };

  const API = { EVENT: eventSchema, VERSION: 'flywheel-event/v1' };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.SELFHEAL_SCHEMA_FLYWHEEL = API;
})(typeof window !== 'undefined' ? window : globalThis);
