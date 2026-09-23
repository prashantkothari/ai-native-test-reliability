# Plan — Self-heal with a second-opinion check (P1, final)

Follow-up to the judge bake-off plan (`system-reminder-you-are-operating-mossy-curry.md`). That plan tests which judge is better. This one adds the winning judge into our self-heal flow, safely.

---

## 0. STATUS: REOPENED — the field-omission bug was the real cause, fixed, gate now passes clean

**History, most recent first:** killed → corrected (found the harness never sent `testid` as an explicit field) → reopened, on the strength of a full 20-case rerun with that field fixed, verified directly against `choice-testid-fixed-results.json` before writing this.

| Run | Wrong-confident (of 20) | vs. LLM baseline (0/20) |
|---|---|---|
| Per-candidate independent Noul (this plan's original design, §2) | 3/20 (15%) | 3× worse |
| Multi-candidate batched Choice, `testid` buried in `outerHTML` only | 2/20 (10%) | 2× worse |
| **Multi-candidate batched Choice, `testid` as an explicit field + named in criteria text** | **0/20** | **matches** |

**What changed between the failing Choice run and the passing one — one bundled fix, two parts:** (1) `testid` promoted from "buried inside a truncated 400-char `outerHTML` string" to an explicit field on both `descriptor` and every `candidate` in the state payload; (2) one added sentence in the question instructions naming testid-matching as strong evidence. Same adversarial pairwise framing as the original failing run (all K=8 candidates shown together, one Choice call) — this is not the isolated-classification framing from the `case-01`-only follow-up; it's the framing this plan's seam actually needs, now passing.

**Full 20-case result:** 17/20 correct, 3/20 abstained, **0/20 wrong-confident**. The 3 abstains are `case-14`, `case-18`, `case-19` — all decoy-insertion cases where *neither* candidate has a testid (confirmed against `inline-llm-judgments.json`'s own note about these four cases being genuinely ambiguous from the given fields). Abstaining on a genuinely ambiguous pair is correct behavior, not a miss. No other drift kind (class-rename, wrap-in-div, node-swap, aria-text-edit, sibling-reorder) had any wrong-confident or abstain — all 14/14 correct.

**Gate check (§9/F2):** "Jev's decoy false-heals ≤ half of LLM's." LLM baseline = 0/20. Jev (fixed) = 0/20. **0 ≤ half of 0 → passes.**

**What this does and doesn't establish:** it establishes that the harness's field-omission bug was a real, sufficient explanation for the earlier failures at n=20, not just on the one hand-picked `case-01`. It does not establish that the one-sentence instruction addition ("matching testid is strong evidence") is safe to generalize beyond testid-style anchors — that sentence was written for this dataset's specific decoy shape, and should be reviewed for over-fitting before this becomes the production question text in `createJevChecker` (§2). The decoy-set-size caveat (F13, still n=20-ish here, effectively n=6 decoy cases) still stands — growing it to n≥30 before the production flip gate remains a requirement, unchanged by this result.

**Decision: resume the plan from task 1**, with two amendments to carry forward: (a) `createJevChecker`'s `question` parameter (§2) must include `testid`/stable-id as an explicit field in whatever state payload it builds — this is now a **hard requirement**, not a nice-to-have, add it to hard rule list; (b) before flip-gate evaluation, review whether the instruction-text nudge generalizes or needs to be data-driven per anchor tier rather than hardcoded to testid specifically.

**What stays valid and reusable, independent of which model fills the checker role:** the seam design (§2 `pickAndCheck`, `NO_CHECK` default), the brain-write guard, the fail-open-on-unavailable pattern (§2, hard rule #6 — this generalizes to *any* third-party checker, not just Jev), the test suite (§4), and the flip-gate structure (§4) including the absolute false-heal cap and the accepted-set spot-check. If a different second-opinion checker is chosen later — the blind LLM judge that actually passed this same bake-off (0/20) is the obvious first candidate — this plan's task list and seam are reused as-is, with only `createJevChecker`'s internals swapped for the new checker's client call.

---

## 1. What we're fixing and why

Today's flow does two things in one step: our LLM picks the best candidate for a moved/renamed element, **and** it says "yes, this is the right one". Same model, no second opinion. When it's wrong, the test clicks the wrong thing and passes anyway. That's the single failure our ethos does not tolerate.

**The fix:** after our normal flow picks a candidate, we ask a *different* checker: "is this really the same element the author recorded?" If the checker says no, we drop that candidate and try the next one. If we run out, we stop and ask a human. The checker never gets to *choose* the candidate — it only gets to *reject* it.

**Which checker:** Jev (from TypeSafe). It answers yes/no with a calibrated probability, and it does not produce free-text rationalisation the way an LLM does. That structural difference is what makes it a real second opinion.

**Why "reject" not "select":** if the checker chooses, it can commit a wrong click just like the LLM can. If the checker only rejects, the worst it can do is send us to a human — which is safe.

**Scope for this plan:** web only, full stop. Ship the plumbing dark (no behavior change). Ship the Jev check off by default. Run it in shadow (log-only) for 1–2 weeks. Flip it on only if it meets the safety gates in §4. Mobile is **not** unblocked by this plan — see the corrected claim in §2's driver-adapter section and the honest scope note there. A second-opinion review of this plan (§9) found the original driver-adapter section overclaimed mobile-readiness; that's fixed below.

**Not doing here:** the judge bake-off itself (own plan); the "same page?" and "earlier drift?" checks from Analyzer 2.0; the top-3-agree check; new descriptor design; mobile driver; learning-brain writes beyond one guard.

---

## 2. How it works (design and code)

### The seam — one function, no policy inside it

Lives in `candidate-generation.js`.

```js
// default checker: does nothing, says "yes" — keeps today's behavior
export const NO_CHECK = {
  check: async () => ({ ok: true, prob: null, reason: 'no-check', source: 'noop' }),
};

// element = ElementSummary — a plain object with role/name/testid/ordinal/container/path.
// It is NOT a Playwright handle. That keeps this signature usable for mobile later.
export async function pickAndCheck(page, descriptor, {
  checker = NO_CHECK,
  maxRetries = 2,
  overallBudgetMs = 1500,   // bounds ALL retries, not one call
} = {}) {
  const start = Date.now();
  const attempts = [];
  const rejected = new Set();       // stable ids, not object references
  let candidates = rank(page, descriptor, { k: 8 });

  for (let i = 0; i <= maxRetries; i++) {
    if (Date.now() - start > overallBudgetMs) {
      return { status: 'ASK_HUMAN', reason: 'ran-out-of-time', attempts };
    }
    const pool = candidates.filter(c => !rejected.has(idOf(c)));
    const pick = disambiguateByContext(pool, descriptor);
    if (!pick) return { status: 'ASK_HUMAN', reason: 'no-candidate-left', attempts };

    const summary = summarize(pick.element);
    const domSlice = sliceAround(pick.element, { depth: 2 });
    const result = await checker.check(descriptor, summary, domSlice);

    attempts.push({
      locator: pick.locator, id: idOf(pick),
      prob: result.prob, reason: result.reason, source: result.source,
    });

    if (result.ok) return { status: 'HEAL', locator: pick.locator, check: result, attempts };
    rejected.add(idOf(pick));
  }
  return { status: 'ASK_HUMAN', reason: 'checker-rejected-all', attempts };
}
```

**What's deliberately NOT in this function:**
- Skip rules for strong-anchor tiers (T0/T1). Those live in a wrapper (below). Mixing them in here would put policy inside mechanism.
- Awareness of Jev. This function takes *any* checker.

### The checker stack (compose small pieces)

Wire them together at boot: `pageGuarded( strongAnchorSkip( retryLimiter( cache( jev ) ) ) )`.

```js
// verifiers/strong-anchor-skip.js — skip the check when the anchor is already very strong
export function strongAnchorSkip(inner) {
  return {
    async check(descriptor, element, domSlice) {
      if (element.tier === 'T0' || element.tier === 'T1') {
        return { ok: true, prob: null, reason: `skip-${element.tier}`, source: 'skip' };
      }
      return inner.check(descriptor, element, domSlice);
    },
  };
}

// verifiers/page-guarded.js — only run the check when the "same page?" gate says yes.
// Ships with a stub (`isSamePage: async () => true`) until the real Analyzer-2.0 signal exists.
export function pageGuarded(inner, samePageGate) {
  return {
    async check(descriptor, element, domSlice) {
      if (!(await samePageGate.isSamePage())) {
        return { ok: false, prob: null, reason: 'not-same-page', source: 'page-gate' };
      }
      return inner.check(descriptor, element, domSlice);
    },
  };
}
```

### The Jev checker itself

**Design requirement added after real-world testing (flagged by a peer session running the bake-off):** when the bake-off session actually ran, it hit a live "workspace-scope" key error and then a real "credit balance too low" 400 from a provider key on an unrelated attempt — i.e. "the checker's backend is unavailable" was not hypothetical, it happened during this project's own testing. **If Jev is unavailable for any reason — no key configured, key present but invalid, key valid but out of credits/quota, or the service unreachable — the pipeline must never fail or block.** It must transparently behave as `checker = NO_CHECK` and continue with the existing LLM-only loop. This is distinct from the circuit-breaker (F6): the circuit-breaker handles *transient* outages and retries with a probe every 60s; "no credits" or "invalid key" will not self-heal on a timer, so retrying is wasted latency on every single heal until 20 failures accumulate. A cheap boot-time (or first-call) check catches this before it costs 20 live production failures.

```js
// verifiers/jev.js
import { DescriptorSchema, ElementSummarySchema } from '../schemas.js'; // ONE source of truth
import { classifyError } from './errors.js'; // 'timeout' | 'schema' | 'network' | 'auth' | 'credits' | 'unknown'

function realJevChecker({ apiKey, threshold, timeoutMs, question, log }) {
  const sameElement = new Jev({ apiKey, retry: false }).noul({
    name: 'SameElement', question,
    input: { descriptor: DescriptorSchema, element: ElementSummarySchema, domSlice: z.string() },
  });

  return {
    async check(descriptor, element, domSlice) {
      const t0 = Date.now();
      try {
        const { probability } = await withTimeout(
          sameElement({ descriptor, element, domSlice }),
          timeoutMs,
        );
        return {
          ok: probability >= threshold,
          prob: probability,
          reason: `p=${probability.toFixed(2)} threshold=${threshold}`,
          source: 'jev',
          latencyMs: Date.now() - t0,
        };
      } catch (err) {
        const errorClass = classifyError(err);
        log?.warn({ errorClass, msg: err.message, latencyMs: Date.now() - t0 }, 'jev-check-error');
        // Errors are NOT silently mapped to prob=0. They carry their class through telemetry.
        return { ok: false, prob: null, reason: `error:${errorClass}`, source: 'jev', errorClass };
      }
    },
  };
}

// Async factory — does ONE preflight call (or just format-checks the key if no cheap health
// endpoint exists) before committing to the real checker. On a PERMANENT failure class
// (auth, credits) it falls back to NO_CHECK for the process lifetime — no retry, no probe,
// because "no credits" doesn't self-heal. On a TRANSIENT class (network, timeout) it still
// returns the real checker; the circuit-breaker layer (F6) handles that case with retries.
export async function createJevChecker({
  apiKey,
  threshold,         // required — no default; caller must be explicit
  timeoutMs = 300,
  question = 'Is the candidate element the same one the author originally recorded? A near-duplicate sibling (same text/role, different container or ordinal) is NOT the same.',
  log,
}) {
  if (typeof threshold !== 'number') throw new Error('threshold required');

  if (!apiKey) {
    log?.warn({}, 'jev-unavailable-at-boot: no API key configured — running without second-opinion check');
    return NO_CHECK;
  }

  try {
    await preflightJevAuth({ apiKey, timeoutMs }); // one cheap call: format/auth/credits check
  } catch (err) {
    const errorClass = classifyError(err);
    if (errorClass === 'auth' || errorClass === 'credits') {
      log?.warn({ errorClass, msg: err.message }, 'jev-unavailable-at-boot: running without second-opinion check');
      return NO_CHECK; // PERMANENT fallback for this process — do not retry a key that has no credits
    }
    // transient class (network/timeout/unknown) at boot: proceed anyway, let the circuit-breaker
    // handle it live — a boot-time network blip shouldn't permanently disable the checker.
    log?.warn({ errorClass, msg: err.message }, 'jev-preflight-inconclusive: proceeding, circuit-breaker will catch persistent failures');
  }

  log?.info({ threshold, timeoutMs, question }, 'jev-checker-boot');
  return realJevChecker({ apiKey, threshold, timeoutMs, question, log });
}
```

### The driver-adapter — web-only in this plan; mobile is a separate follow-up

**Corrected claim (a second-opinion review of this plan caught the original version overclaiming this):** the driver-adapter in this plan does **not** unblock mobile. Be precise about what it does and doesn't do:

- `pickAndCheck(page, descriptor, ...)` still takes `page` as its literal first argument, and `page` flows straight into `rank(page, descriptor, {k:8})` untouched by any adapter. `page` is a real Playwright object here, not a placeholder name.
- The only things this plan routes through a driver interface are candidate ranking and DOM-slicing:

```js
// drivers/web.js implements: { rankCandidates(descriptor, k), sliceAround(element, depth) }
// (no drivers/mobile.js in this plan — see scope note below)
```

- `disambiguateByContext`, `summarize`, and `idOf` are **not** routed through any driver — they stay free functions in `candidate-generation.js`, and each would need a mobile-shaped equivalent (working over Appium's XML page source instead of the DOM) before a mobile checker could exist.
- Per the architecture doc (§3e), `selfheal-core` also needs to be extracted into a **dep-free package** before an `engine-mobile` adapter is even structurally possible — that extraction is explicitly P2 work, not part of this plan.

**Honest scope statement:** task 3 in §7 locks *one* naming boundary (`rankCandidates`/`sliceAround`) so that the web implementation doesn't have to be re-touched later. It does **not** close the mobile gap. Closing it requires, at minimum: the dep-free core extraction (arch §3e), mobile-shaped `disambiguateByContext`/`summarize`/`idOf`, and a real `drivers/mobile.js`. That is a separate plan, scoped after this one ships and after `engine-mobile` lands per the architecture doc's own P2 sequencing. Do not treat task 3 as mobile-readiness — it only prevents the *web* driver from being hard-coded name-wise.

### The five hard rules (all covered by tests, not comments)

1. **The checker owns its threshold.** Set at construction, printed on boot. No caller passes it in per-call.
2. **The learning brain writes only when both checks pass:** the pre-action check (this plan) AND the post-action "did the effect happen?" check (existing `outcome-verification.js`). Full check record is passed to the brain-write path; test fixtures cannot fake a bare `{ok: true}` without a valid `source`.
3. **Skip rules live only in `strongAnchorSkip`.** The main seam never looks at `tier`.
4. **The page-gate wrapper is always in the stack**, with a stub until the real "same page?" signal exists.
5. **The checker never sees driver types.** Enforced by an import analyzer with an allow-list (not grep — grep misses re-exports).
6. **Jev being unavailable never blocks or fails a heal.** No key, invalid key, no credits, or unreachable service → boot-time preflight falls back to `NO_CHECK` permanently for that process (no retry — see §2 Jev checker). Only a live, credentialed, funded Jev ever gates a heal.
7. **The checker's state payload must send stable-id fields (`testid`/`id`) explicitly, never only embedded in raw HTML.** Found the hard way (§0): burying `testid` inside a truncated `outerHTML` string instead of a named field was the actual cause of the original bake-off failure — 3/20 and 2/20 wrong-confident, both traced to this, not to Jev being unable to reason about identity. `DescriptorSchema` and `ElementSummarySchema` (§2, task 1) must both carry `testid`/`id` as top-level fields. Enforced by the schema contract test in task 1 — assert the schema has these fields, not just that it matches `WEB.extract()`'s shape structurally.

---

## 3. What could go wrong and how we catch it

| # | Risk | Guard |
|---|---|---|
| F1 | We reject too many good candidates → humans get flooded → they turn the checker off | Shadow mode gate: extra "ask-human" rate ≤ +3% vs baseline |
| F2 | LLM and Jev both get fooled by the same decoy sibling | Bake-off decoy set grown to 30 cases; Jev's decoy false-heals ≤ half of LLM's; production trigger reviews the first 100 real heals after flip |
| F3 | Retries push latency past budget | `overallBudgetMs=1500` caps total; per-call timeout `300ms`; timeouts count as a reject |
| F4 | Cost roughly doubles | Session cache; store real dollars in telemetry (not "tokens × yesterday's price"); gate: ≤ 2× baseline $ per successful heal |
| F5 | Every candidate gets rejected → the seam becomes a human-request generator | Gate: ≥ 80% accepted on first try; ≥ 95% within two retries; "ask-human" ≤ 5% |
| F6 | Jev outage stalls every heal | Two layers, not one: (1) **boot-time preflight** (§2) catches permanent unavailability — no key / invalid key / no credits — before any live call, falls back to `NO_CHECK` for the process, no retry; (2) **circuit-breaker** catches *transient* failures live: after 20 consecutive `timeout`/`network` errors, disable the checker, alert loudly, fall back to today's flow, retry a probe every 60s. `auth`/`credits`-class errors do NOT go through the 60s-probe circuit-breaker — they trip the permanent fallback instead, since a credits shortfall won't self-heal on a timer. Both layers tested as state machines. |
| F7 | Turning the checker on suddenly makes tests "ask human" that used to (wrongly) pass | Shadow mode surfaces these before flip; week-1 requires eyeballing 100% of disagreements |
| F8 | The check runs on already-good picks (skip rule too loose) | Track "% of heals where the check actually ran"; alert if it hits 100% (skip broken) or 0% (checker bypassed); target 10–30% |
| F9 | Wrong clicks committed during enforce mode are unrecoverable | Shadow is mandatory; rollback drill required before flip |
| F10 | Driver types leak into the checker → mobile blocked | Import analyzer with allow-list; blocks CI |
| F11 | Errors get silently mapped to "reject with prob=0", hiding real problems | Every error carries its class through telemetry; per-class dashboard; test per class |
| F12 | Cache gives a stale answer after navigation | Page-navigation event clears cache keys for that page; tested |
| F13 | Bake-off decoy sample too small for the "half" gate | Grow to n=30; treat gate as directional; add the production rollback trigger |

---

## 4. How we test, review, and gate

### Tests that block CI

- **Replay test with `NO_CHECK`:** run the mossy-curry bake-off cases through the new seam. Same locator committed, same "ask-human" outcomes. Latency and token counts go to a separate report — not a pass/fail gate (avoids flaky reruns).
- **Contract test on the seam:** fake checker that flips accept/reject per attempt; asserts retry order, that we filter by stable id (not object reference), that the total budget aborts on time, and the shape of `attempts`.
- **Disambiguator stability:** removing a candidate must not change what the disambiguator returns for the remaining set. Tested — not a code comment.
- **Brain-write guard:** three tests — (a) a `source:'test'` record is rejected; (b) `check.ok && !effect.ok` is rejected; (c) `(check.ok || skip) && effect.ok` is accepted.
- **Import-leak test:** AST analyzer walks the checker files and the `selfheal-core` package with an allow-list. Grep is not enough.
- **Circuit-breaker state machine:** 20 errors → open; probe succeeds → closed; counter resets correctly.
- **Preflight fallback test:** four cases — (a) no `apiKey` → returns `NO_CHECK` immediately, no network call; (b) preflight throws `auth` → returns `NO_CHECK`, no retry attempted; (c) preflight throws `credits` → returns `NO_CHECK`, no retry attempted; (d) preflight throws `network`/`timeout` → returns the real checker anyway (circuit-breaker's job from here). Assert none of (a)-(d) throw or reject — the factory itself must never fail the pipeline.
- **Cache invalidation:** page-nav event drops relevant keys; no cross-page bleed.
- **Error-class test:** one test per class; asserts telemetry field is present; no case ends up as `prob=0` by accident.

### Shadow-mode simulator (offline `threshold` tuning)

A small tool that replays the `heal_attempts` table against a candidate `threshold` and prints all the flip-gate numbers. Re-tuning does not need another live shadow week.

### Human reviews (non-negotiable)

- Design review before task 4 lands — signature, rules list, mobile-track reviewer present.
- Week-1 shadow triage — 20 disagreements eyeballed; if Jev is mostly wrong, we kill the plan.
- Pre-flip review — every gate below is green; HITL card is merged (not "coming soon"); rollback drill is logged; boot-log `threshold` matches config.

### Flip gates (all must be true)

**A second-opinion review of this plan found that the original gate list could go all-green while a wrong click still ships. Fixed below — two gates added, one gate's meaning clarified.**

- **Δ false-heal on decoys ≥ 50% reduction (n ≥ 30) — relative gate, kept.**
- **NEW — absolute false-heal cap:** decoy false-heal rate with the checker on must be **≤ 3% absolute** (not just "50% better than before"). A 50%-relative-reduction gate can pass while going from, say, 4/30 to 2/30 — still a nonzero wrong-click rate shipped to production under the checker's blessing. The absolute cap is the real bar; the relative gate is a secondary sanity check that the checker is actually doing something.
- Δ "ask human" ≤ +3%.
- ≥ 80% accepted on first try; ≥ 95% within two retries.
- **CLARIFIED — T0/T1 agreement gate does not prove T0/T1 correctness.** "On T0/T1 (where enforce would skip), the checker still runs in shadow and agrees ≥ 99%" only measures agreement with the *skip rule's own assumption* that strong anchors are trustworthy — it says nothing about ground-truth correctness, and in enforce mode T0/T1 heals bypass the checker entirely (§2 rule 3), so a wrong T0/T1 heal is never caught by this system at all. This is an **accepted, named risk**, not a closed gap: strong-anchor tiers are trusted because the anchor itself (testid/stable-id) is strong evidence, independent of the checker. Mitigation is task 9's periodic ground-truth spot-check on T0/T1 heals, run on a sample, on an ongoing basis — not a one-time flip gate.
- **NEW — accepted-set spot-check:** the existing "human confirms checker was right to abstain ≥ 70%" gate only covers the *rejected* set. It says nothing about the *accepted* set, which is where a wrong click actually ships. Add: a random 2% sample of ACCEPTED (non-T0/T1) heals per week during shadow gets a human ground-truth check, target ≥ 95% correct. This is the gate that actually looks at where the risk lives.
- Latency and cost inside F3/F4 budgets.
- No single error class > 1% of calls.

**Remaining honest limitation:** even with both new gates, the post-flip 100-heal production trigger (below) is reactive — it fires after wrong clicks are already committed, not before. This system reduces wrong-click *rate*; it does not, and structurally cannot, prevent every wrong click before it happens. §5 already says this about rollback in general; it applies to gates too.

### Post-flip production trigger

First 100 heals after enforce: if the observed false-heal count is above the baseline's upper bound (Wilson interval), automatically flip `SELFHEAL_CHECKER=off` and page on-call. This is the last safety net.

---

## 5. Rollback

| Layer | Action | Time |
|---|---|---|
| Runtime | `SELFHEAL_CHECKER=off` env variable | under a minute |
| Config | Set `checker = NO_CHECK` in runtime config | one commit |
| Code | `git revert` the wiring commit; seam and checker files stay dormant | one PR |
| Automatic | Circuit-breaker (F6); first-100-heal production trigger (§4) | automatic |

Rollback drill happens during shadow week 1: point Jev at a bad URL, confirm the circuit-breaker opens, alert fires, today's flow takes over, drill is recorded in telemetry. **Metrics from the drill window are excluded from flip-gate math** (drill markers in telemetry).

`heal_attempts` table is versioned and frozen at task 6 — no schema changes mid-shadow. Wrong clicks already committed cannot be un-clicked; shadow is the only defence.

---

## 6. Guard against past mistakes

- **Fuzzy substring picks the wrong element (arch §3):** the whole reason for this plan. Guarded by F2 gate.
- **Unverified heals pollute the learning brain (arch §3b):** hard rule #2, three brain-write tests.
- **Confusing "same page?" / "same element?" / "earlier drift?" (Analyzer 2.0, arch §3c):** hard rule #4 forces the page gate to be in the stack.
- **Lifecycle sticky-bit compatibility (arch §3d):** verified heals still flow through with `source=verified`; no change needed.
- **Driver types leaking (mobile blocker):** hard rule #5, import analyzer, driver adapter.
- **Silent error handling (past incidents in CLAUDE.md):** F11, per-class telemetry, per-class test.
- **Third-party dependency unavailable blocking the pipeline (observed live during the actual bake-off run — a peer session hit both an invalid-key error and a real "credit balance too low" 400 mid-test):** hard rule #6, boot-time preflight, permanent fallback to `NO_CHECK` on `auth`/`credits`, preflight-fallback test (§4).

---

## 7. Action plan (ordered, P1 only)

**Foundations — these land before the Jev checker exists:**

1. `[schemas]` `schemas.js`: one canonical `DescriptorSchema` and `ElementSummarySchema`; test they match what `WEB.extract()` actually returns.
2. `[design]` One-page seam + rules + composition doc. Mobile-track reviewer signs off.
3. `[driver]` Driver-adapter interface (`rankCandidates`, `sliceAround`). Web adapter wraps Playwright.
4. `[tests-first]` Land these CI checks BEFORE the seam: replay test, contract test, disambiguator-stability test, import-leak analyzer, the three brain-write guard tests (a/b/c from §4).
5. `[seam+guard, ONE PR]` `pickAndCheck` in `candidate-generation.js` with `NO_CHECK`, **and** the brain-write guard in `outcome-verification.js`, land together as a single mergeable unit — not two PRs in sequence.

**Why merged, not sequential (a second-opinion review of this plan caught this):** the original plan had task 5 (seam) mergeable on its own, gated only by task 4's tests, with the guard arriving later as task 6. But `NO_CHECK` always returns `ok: true`, and the brain-write rule is "write when both checks pass" — so in the gap between a standalone task 5 and a later guard, any heal that also passes the existing effect-check would satisfy the brain-write rule with **zero validation on the record's `source` field**, because the three guard tests (§4: reject `source:'test'`, reject `check.ok && !effect.ok`, accept `(check.ok || skip) && effect.ok`) don't exist yet. Nothing in the original plan enforced the "guard before Jev" ordering except doc prose — there was no CI or branch dependency actually blocking an out-of-order merge. Fix: they ship as one unit. CI for this PR must include all three guard tests before merge; there is no window where the seam is live without the guard.

**Jev landing (all behind `SELFHEAL_CHECKER=off`):**

6. `[telemetry]` `heal_attempts` schema v1, frozen: `case_id, tier, drift_kind, loop_pick, checker_source, checker_prob, checker_ok, error_class, retries, latency_ms, tokens_in, tokens_out, usd_cost, timed_out, budget_exceeded, page_url_hash, drill_marker`. Include a versioned price table for `usd_cost`.
7. `[jev]` `createJevChecker` (async factory with boot-time preflight + permanent fallback on auth/credits) + `strongAnchorSkip` + `pageGuarded(stub)` + circuit-breaker + cache. Per-layer unit tests, error-class test, preflight-fallback test (4 cases, §4), cache-invalidation test, circuit-breaker state-machine test.
8. `[hitl]` "Ask human" card (owner + reviewer NAMED before task 5 merges). Ships as its own PR before task 10.

**Shadow → decide → enforce:**

9. `[shadow]` Enable shadow on pilot tenant. Week-1 disagreement triage. Rollback drill. Tier-misclassification audit (task 3 relies on tier being right; verify it) — **and** a periodic ground-truth spot-check on T0/T1 heals specifically (see §4's flip-gate blind-spot fix), since enforce mode skips the checker on those tiers entirely and shadow-agreement alone doesn't prove correctness.
10. `[sim]` Shadow-mode simulator: replays telemetry against a candidate threshold, prints all flip-gate numbers, including the new absolute false-heal cap (§4).
11. `[enforce]` Pre-flip review. If every gate is green — including the absolute cap, not just the relative-reduction gate — flip `SELFHEAL_CHECKER=on` with the 100-heal production trigger armed.
12. `[decide]` Two weeks after flip: explicit decision meeting — adopt / kill / extend. If skipped, the plan runs forever.

**Explicit non-goals here:** pre-gate variant (Jev decides which candidate), mobile checker/driver (see corrected §2 scope note — this is a separate follow-up plan, not deferred-within-this-plan), screenshot input to Jev, top-3-agree check, real "same page?" signal (stub only), descriptor v2, cross-tenant brain.

---

## 8. Self-review of this plan (checklist against every earlier critique point)

| Earlier concern | Covered here? |
|---|---|
| `NO_VERIFIER` returning `prob:1` poisons telemetry | Now `prob: null` (§2) |
| T0/T1 skip mixes policy into mechanism | Moved to `strongAnchorSkip` wrapper (§2) |
| Reference-equality filter can loop forever | Stable-id filter with `idOf(pick)` (§2) |
| Retries blow the latency budget | `overallBudgetMs=1500` bounds total (§2) |
| Errors silently degraded to `prob=0` | `classifyError` + `errorClass` in telemetry (§2, F11) |
| Threshold ownership is nominal, factory accepts it | Required arg, no default, logged on boot (§2) |
| SDK retries → double billing | `retry:false` on Jev client (§2) |
| Schema drift from `WEB.extract` | `schemas.js` single source of truth + contract test (§2, task 1) |
| Brain-write guard depends on two files agreeing | Full check record passed through; source field required (§2 rule 2, task 6) |
| Same-page gate is unenforceable today | Stub with real replacement blocked on real Q1 signal (§2 rule 4) |
| Threshold in code = "verifier owns τ" is nominal | Config file + boot log makes drift visible (§2) |
| Golden replay byte-identical is flaky | Decision-identical only; latency in separate report (§4) |
| Grep for driver types misses re-exports | AST import analyzer with allow-list (§4, §7 task 4) |
| No circuit-breaker state-machine test | Present (§4) |
| No cache invalidation test | Present (§4) |
| No shadow-mode simulator | Task 11 (§7) |
| Decoy sample too small for gate | Grow to n=30; add production trigger (F13, §4) |
| Task ordering lets Jev land before guard | Seam and guard merged into one PR at task 5 — no window where seam is live without guard (§7, fixed after second-opinion review) |
| Playwright `page` in seam contradicts rule 5 | **Partially — corrected.** `page` itself still flows into `rank()` untouched; only `rankCandidates`/`sliceAround` are routed through a driver, and only for web. Mobile is explicitly out of scope, not "unblocked" (§2, fixed after second-opinion review) |
| HITL is "one-liner in enforce PR" | Task 9 with named owner, ships before task 12 (§7) |
| No explicit kill path | Task 13 (§7) |
| Cost = tokens × yesterday's price | `usd_cost` column + versioned price table (§7 task 7) |
| Drill window contaminates flip-gate math | `drill_marker` in telemetry, excluded (§5, §7 task 7) |
| Tier assignment might be wrong (skip fires when it shouldn't) | Audit in task 10 (§7) |

Two things left honest and open:
- **Threshold `0.75` is a placeholder.** The bake-off + shadow simulator picks the real number. Do not ship until they do.
- **Same-page gate is a stub.** Safe today (stub says "yes, run the check"), unsafe if we later start *reasoning* about it. Enforce that "real gate" is a prerequisite of any Analyzer-2.0-aligned work — not this plan.

---

## 8b. Second-opinion review — findings and fixes

A fresh-context sub-agent reviewed this plan (no memory of how it was written) and answered three adversarial questions. Findings, each now folded into the sections above:

1. **Task ordering — partial hazard, now fixed.** The original task 5 (seam) could merge alone, before task 6 (brain-write guard). Since `NO_CHECK` always returns `ok:true`, that window allowed brain writes with zero validation on the record shape — not a Jev-specific bug, but a real unguarded-write gap. **Fix:** tasks 5 and 6 are now one PR (§7 task 5); no standalone seam merge is possible.
2. **Mobile driver-adapter — overclaimed, now corrected.** `pickAndCheck` still takes a live Playwright `page`; only `rankCandidates`/`sliceAround` were ever going to be routed through a driver, and `disambiguateByContext`/`summarize`/`idOf` were never addressed. Per the architecture doc, `selfheal-core` needs a dep-free extraction (P2) before mobile is even structurally possible. **Fix:** §2's driver-adapter section now states plainly that this plan does not unblock mobile; that's a separate follow-up plan.
3. **Flip gates — closeable with a wrong click still shipping, now closed.** The original "≥50% reduction" gate is relative and can pass with a nonzero absolute false-heal rate. T0/T1 tiers skip the checker in enforce mode, so the "agree ≥99%" gate never touches ground truth there. The human-confirm-abstain gate only covers the rejected set, not the accepted set where the risk lives. **Fix:** §4 now has an absolute false-heal cap (≤3%), a named accepted-risk callout for T0/T1 with an ongoing spot-check (not a one-time gate), and a weekly ground-truth sample on the accepted set.

---

## 9. On using Jev to review this plan

Fair ask, but no — for two honest reasons.

1. **Jev is not the right shape for prose review.** It takes typed inputs and returns a typed answer plus a probability — it is a *judgment* primitive, not a *critique* primitive. Handing it a Markdown plan and asking "is this good?" would either force the plan into an unnatural schema or return a number that means nothing.
2. **We have no key wired in this session** and setting one up just to satisfy the ask is exactly the kind of expensive detour the plan itself argues against.

**Where Jev actually belongs in this workflow** is upstream, in the bake-off plan (mossy-curry): that's where Jev's outputs are the *subject* of evaluation, and where the calibrated probability directly answers a real question ("did Jev say `same element` on cases where the ground truth was yes?"). That plan is the one that must run first. If it fails, this plan does not ship.

**If you want a structured second opinion on this plan today,** the right move is: have another LLM session (fresh context, no memory of this thread) read the plan and answer three narrow questions — "does step ordering allow an unguarded Jev write?", "does the driver adapter cover both web and mobile?", "does the flip-gate list have a way to be all-green while still shipping a wrong click?". Those are the three failure shapes most likely to slip. This was done — see §8b.

---

## 10. Redteam of the fixes themselves

Each fix from §8b is a new claim. New claims can also be wrong. Attacking them:

1. **"Merging task 5+6 into one PR" — does that actually close the gap, or just make the PR bigger and the review more likely to be rubber-stamped?** A single large PR with a seam AND a guard AND three new tests is more code to review at once, which is exactly the condition under which reviewers skim. Mitigation not yet in the plan: the PR description must call out the three guard tests by name in a checklist the reviewer explicitly ticks — not just "tests pass in CI." Added as a note to task 5: reviewer must confirm the three brain-write tests (§4) are present and failing-before/passing-after, not just green.

2. **"Mobile is out of scope now" — does saying so in prose actually prevent scope creep, or does it just move the overclaim from `code comments` to `plan prose`, where it's equally easy to ignore later?** Risk: six months from now, someone reads §2's driver-adapter section, sees `drivers/web.js` and a naming convention, and assumes "oh, `drivers/mobile.js` is a small follow-on" — repeating the exact mistake the second-opinion review caught, just one level up. Real fix is structural, not prose: the follow-up mobile plan (when written) must independently verify `disambiguateByContext`/`summarize`/`idOf` mobile-readiness from scratch rather than trusting this plan's driver boundary as a head start. Noted as a required first step of *that* future plan, not something this plan can enforce today.

3. **"Absolute false-heal cap ≤3%" — is 3% actually safe, or is it an arbitrary number chosen to sound rigorous?** It is arbitrary — no production baseline exists yet to justify 3% over 1% or 5%. Confirmed acceptable-for-now because: (a) it's a gate to *earn* enforce mode, not a permanent target — task 12's decide-point should revisit it with real production numbers; (b) the bake-off (mossy-curry plan) is where this number should actually be derived from ground-truth data, not invented here. **Action:** the mossy-curry plan's metrics (Brier score, false-heal rate at τ) should be the source of the 3% figure, not this plan. If the bake-off's own numbers don't support 3%, this plan's gate must be revised before flip, not after.

4. **"Weekly 2% accepted-set spot-check" — who does this, and does anyone actually check that it happens?** Unstaffed metrics rot. This needs an owner named at task 9 (same rigor as the HITL card in task 8), and the spot-check result needs to feed the task 12 decide-point explicitly, not sit in a dashboard nobody opens. Added as an explicit requirement: task 9's owner is responsible for a weekly written note (pass/fail against the 95% target), not just raw data collection.

**Net effect of this redteam pass:** the three fixes are structurally correct but each introduces a soft dependency on human diligence (careful review, future-plan discipline, revisiting an arbitrary number, weekly follow-through) that the plan does not yet mechanically enforce. That's an accurate, not a comfortable, place to land — flagged rather than hidden.

---

## 11. Update from the real bake-off run (peer session)

A peer session actually ran the mossy-curry bake-off — this plan had only been gated on it hypothetically until now. Two things came back, both verified against the result files in `tools/eval/jev-judge/results/` before folding into this plan (not taken on faith):

1. **Jev was unavailable live, more than once, during that session** — a workspace-scope key error, then a real "credit balance too low" 400. This is why hard rule #6 and the boot-time preflight (§2) exist now: the plan's original error handling (F6's circuit-breaker) was designed for *transient* outages that self-heal on a 60s probe; "out of credits" doesn't self-heal, so 20 wasted live failures before the breaker trips is real cost that a one-time boot check avoids.

2. **The bake-off itself ran and failed F2's gate.** Verified independently (§0): Jev confidently-wrong on 3/20 leak-free cases vs. a blind LLM baseline at 0/20 on the same cases, including a near-miss on a genuinely testid-anchored element (`case-01`, 0.82 vs 0.80). Per this plan's own §9 ("if bake-off fails, this plan does not ship"), **implementation is on hold** — see §0 at the top of this document. The seam design, guard, tests, and gates in this plan remain the target architecture; what's blocked is task 1 onward, until a separate investigation into Jev's comparative (multi-candidate Choice) judgment mode either closes the gap or confirms the per-candidate approach is a dead end for this use case.
