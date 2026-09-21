# PILOT-RESULTS.md — real-world validation

> **STATUS: AWAITING DATA (D1).** No results yet. This file stays empty of numbers until a real,
> sanitised sample lands. Per the honesty rule: no % without a labelled set behind it.

## What unblocks this file
- **D1 sample:** ~30–50 real **iOS XCUITest** Pattern-A failures (page-source XML), sanitised
  per the protocol below. *(Confirmed obtainable.)*
- **Ground truth:** tenant element-labels = **NOT available** (confirmed). Workarounds (Ledger K5):
  1. **Self-label** a 20–30 subset by reading the XML tree + the recorded step's intent.
  2. Use the **post-fix corrected locator** (a later passing run), if Testsigma stores it, as
     automatic ground truth.
  - Without one of these, **false-heal is unmeasurable** — and that is the gating metric. Until
    then we can only report heal-attempted + diagnosis-accuracy (via POC category labels, K6).

## Sanitisation protocol (what the sample must preserve / strip)
- **KEEP:** tree structure; type/role; identifiers (accessibilityId/`name`-as-id); geometry;
  enabled/visible.
- **STRIP/TOKENISE:** free-text `label`/`value` that may be PII → token preserving **length AND
  whitespace** (a trailing space is itself a failure cause — must survive sanitisation).

## Metrics to report (when data lands) — all tagged `measured` / `proxy`
| Metric | Definition | Gating? |
|---|---|---|
| diagnosis-accuracy | category vs POC label (A–I) | quality |
| heal-attempted-rate | % where disambiguate/eliminate produced a heal | capability |
| correct-heal | healed to the true element (needs ground truth) | **yes** |
| **false-heal** | healed to the WRONG element (needs ground truth) | **GATE** |
| deterministic-vs-residue split | % healed deterministically vs needing LLM/vision | the K10 question |

## Pre-registration (fill BEFORE looking at results)
- Date / operator: _____
- false-heal ceiling (must-not-exceed): _____
- the split hypothesis being tested (e.g. "≥60% of Pattern A heals deterministically"): _____
- rule: broadening any constraint after seeing results is disclosed and the run is marked exploratory.
