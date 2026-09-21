/* self-heal/pipeline/failure-reporter.js — Step 4: intelligent failure messages.
 *
 * P1 BUILT (deterministic). Ledger I2: a named, actionable failure ("3 identical 'Add to Cart',
 * cannot disambiguate") saves triage time; a silent "element not found" does not.
 * Pure mapping from a diagnosis (change-diagnosis.diagnoseFailure) to a human report.
 */
(function (root) {
  const HEADLINE = {
    DRIFT:       'HEALED automatically.',
    AMBIGUITY:   'ABSTAINED — multiple identical candidates. Add a container/row hint (Clue-2) to disambiguate.',
    REMOVAL:     'FAILED — element not found. Likely feature removal or a renamed/removed control; review the test step.',
    STATE_ISSUE: 'FAILED — element exists but is not interactable (disabled / hidden / overlay). Add a step to reveal it.',
    TEMPORAL:    'RETRY — element may appear after a wait; needs runtime wait-and-retry.',
    FLOW_CHANGE: 'FAILED — interaction flow may have changed; human review needed.',
    UNKNOWN:     'FAILED — unclassified failure; see diagnosis detail.'
  };

  function report(diagnosis, step) {
    const stepName = (step && (step.intent || step.stepId)) || 'step';
    return {
      step: stepName,
      category: diagnosis.category,
      headline: HEADLINE[diagnosis.category] || HEADLINE.UNKNOWN,
      detail: diagnosis.reason
    };
  }

  const API = { report };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.SELFHEAL_REPORTER = API;
})(typeof window !== 'undefined' ? window : globalThis);
