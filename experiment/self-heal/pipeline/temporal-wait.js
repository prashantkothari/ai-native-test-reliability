/* self-heal/pipeline/temporal-wait.js — S9 lever 2: bounded retry-on-not-ready for the TEMPORAL
 * failure category (change-diagnosis.js: "element not present yet — likely an async/SPA render
 * still in flight"). Retries matchStep on a short, BOUNDED backoff schedule before giving up.
 *
 * Depends on the validated matcher core (window.SELFHEAL / require('../../selfheal-core.js')) and
 * consumes ONLY its public surface (matchStep). Does NOT modify the core, and does NOT modify any
 * other pipeline/runtime/shell/brain file. STANDALONE / ADDITIVE — nothing currently imports this
 * module; a future wiring session calls it as an alternative strategy for TEMPORAL-diagnosed steps.
 *
 * ============================== API CONTRACT (read this, not the code) =====================
 * SELFHEAL_TEMPORALWAIT.waitAndMatch(doc, step, opts) -> Promise<result>
 *
 *   doc  : Document (or DOM subtree root) to poll. Re-queried on every attempt (so a re-render
 *          that replaces nodes is picked up — we never cache the candidate list across attempts).
 *   step : the same §9 recorded-step object matchStep(doc, step, opts) accepts elsewhere. NOT mutated.
 *   opts : {
 *     container : CSS selector scope hint (defaults to step.scope.container) — mirrors
 *                 captureStep's `container` option. Does NOT widen scope (that's search-and-pick's
 *                 job); this lever only adds TIME, not search breadth.
 *     schedule  : array of millisecond delays BEFORE each successive retry. Default
 *                 [100, 250, 500, 1000] — chosen so early polls are cheap/frequent (catches the
 *                 common fast-render case at ~100ms) and later polls back off (don't hammer the
 *                 DOM/CPU while waiting on a slow network round-trip). Cumulative = 1850ms.
 *     capMs     : hard ceiling on TOTAL elapsed time, default 2000ms. Deliberately > the default
 *                 schedule's 1850ms sum (with margin for per-attempt match-scoring overhead) so the
 *                 last scheduled retry is honoured, but a caller who passes a shorter/aggressive
 *                 custom schedule can never blow past this ceiling: before scheduling attempt N+1
 *                 we check (elapsedSoFar + schedule[N]) <= capMs and give up otherwise. This is the
 *                 ANTI-HANG GUARANTEE — there is no path in this function that waits unboundedly;
 *                 every setTimeout is scheduled with a concrete delay and the Promise ALWAYS
 *                 resolves (never rejects, never hangs) once either a heal is found or the
 *                 schedule/cap is exhausted.
 *     gate      : same meaning as matchStep's opts.gate (actionability gate; default on). Applied
 *                 to the match on EVERY attempt (not just the last).
 *     scopeVisible : same meaning as matchStep's opts.scopeVisible (default on).
 *   }
 *
 *   Resolves (never rejects) to a result shape that MIRRORS matchStep()'s (`{verdict, best, margin,
 *   diagnosis, cands, ranked}`), PLUS:
 *     retries   : number of RETRIES performed, i.e. attempts beyond the first immediate try.
 *                 0 means the first (immediate, t=0) attempt already succeeded/failed-for-good.
 *     elapsedMs : total wall-clock time from call to resolution (rounded), via performance.now()
 *                 where available else Date.now().
 *     timedOut  : true only when the schedule/cap was exhausted WITHOUT a heal — lets a caller/
 *                 report distinguish "timed out after N retries" from "found on retry K"
 *                 (verdict:'heal' with retries>0) from "found immediately" (verdict:'heal' with
 *                 retries===0). When timedOut is true, `verdict`/`diagnosis`/`best`/`margin` are
 *                 exactly what the LAST matchStep attempt returned — i.e. the same "not found"
 *                 result the caller would have gotten from a single immediate matchStep call,
 *                 just time-stamped with how long we waited before giving up.
 *     lever     : 'temporal-wait' (so a report/log can attribute the outcome to this lever).
 *
 *   RETRY-ON-WHAT: retries on ANY non-'heal' verdict (fail, abstain — including a gated abstain
 *   like "not-displayed" from a still-fading-in element, and an ambiguous abstain). This is safe
 *   under false-heal=0 because retrying never changes WHAT counts as a heal — every attempt goes
 *   through matchStep's own unchanged heal/margin/gate logic; a bounded retry can only ever find
 *   the SAME kind of heal a fresh single call would have found, just possibly later. Retrying on
 *   ambiguous-abstain is harmless (bounded cost) even though it usually won't resolve a structural
 *   tie; we don't special-case it out because doing so would need a second definition of "genuinely
 *   temporal" that risks becoming a guess.
 * =============================================================================================
 */
(function (root) {
  let S = (root && root.SELFHEAL) || null;
  if (!S && typeof module !== 'undefined' && module.exports) { try { S = require('../../selfheal-core.js'); } catch (e) { /* fall through */ } }
  S = S || (root && root.SELFHEAL);

  const DEFAULT_SCHEDULE = [100, 250, 500, 1000];
  const DEFAULT_CAP_MS = 2000;

  function scopedStep(step, container) {
    const scope = (step && step.scope) || {};
    return Object.assign({}, step, { scope: Object.assign({}, scope, { container: container || null }) });
  }

  function now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

  function waitAndMatch(doc, step, opts) {
    opts = opts || {};
    const schedule = (Array.isArray(opts.schedule) && opts.schedule.length) ? opts.schedule : DEFAULT_SCHEDULE;
    const capMs = (typeof opts.capMs === 'number') ? opts.capMs : DEFAULT_CAP_MS;
    const container = ('container' in opts) ? opts.container : ((step.scope && step.scope.container) || null);
    const effStep = scopedStep(step, container);
    const matchOpts = { gate: opts.gate, scopeVisible: opts.scopeVisible };
    const start = now();

    return new Promise(resolve => {
      let attempt = 0;   // number of retries performed so far (0 = first/immediate try, not yet a retry)
      let timer = null;

      function settle(result, retries, timedOut) {
        if (timer) { clearTimeout(timer); timer = null; }
        resolve(Object.assign({}, result, {
          retries, elapsedMs: Math.round(now() - start), timedOut: !!timedOut, lever: 'temporal-wait'
        }));
      }

      function tick() {
        const result = S.matchStep(doc, effStep, matchOpts);
        if (result.verdict === 'heal') { settle(result, attempt, false); return; }

        const elapsedSoFar = now() - start;
        const nextDelay = schedule[attempt];   // undefined once the schedule is exhausted
        if (nextDelay === undefined || (elapsedSoFar + nextDelay) > capMs) {
          settle(result, attempt, true);
          return;
        }
        timer = setTimeout(() => { attempt += 1; tick(); }, nextDelay);
      }

      tick();
    });
  }

  const API = { waitAndMatch, DEFAULT_SCHEDULE, DEFAULT_CAP_MS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.SELFHEAL_TEMPORALWAIT = API;
})(typeof window !== 'undefined' ? window : globalThis);
