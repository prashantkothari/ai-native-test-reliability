# rrweb spike — MV3 test recorder (summary, reconstructed 2026-09-24)

> **Provenance.** The original full deliverable was a research doc at
> `docs/research/rrweb-spike-2026-09.md` in the `happy-sanderson-bb1691` worktree.
> That worktree was destroyed on 2026-09-23 by `git worktree remove --force` before the
> doc had been `git add`ed. This file is a summary reconstruction from the parent
> session's transcript (session "Prototype rrweb capture spike for MV3 recorder",
> ID `local_64fd6233`), which captured the subagent's answers to all six spike
> questions but not the underlying full 6-question detail with citations. **Treat
> the verdict + findings below as reliable; treat this doc as a summary, not the
> full evidence trail the original spike produced.**

## Spike question

Can `rrweb` (MIT, github.com/rrweb-io/rrweb) be the capture engine for an MV3 test
recorder that emits the project's 11-signal element descriptor + T0–T3 anchor tier
+ fragility flag into Maestro-inspired YAML? Rank 1 (DevTools Recorder transpile)
vs. Rank 2 (MV3 recorder on rrweb).

## Verdict

**Rank 2 (MV3 + rrweb) over Rank 1 (DevTools Recorder transpile).**

## Key findings (answers to all six original questions)

1. **Fidelity — rrweb event stream → 11-signal descriptor mapping.** rrweb's
   mirror-id system preserves `serializedNodeWithId` per event: tag, all
   attributes (role, aria-*, data-testid, id), textContent, parent tree. Directly
   covers ~6 of the 11 descriptor signals. The remaining 5 (computed a11y role
   and name, container, ordinal, actionability, ambiguity) require a content-script
   sidecar. Rank 1 needs the same sidecar, so this is not a Rank-2 tax — Rank 2
   gets a richer stream (mutations, shadow DOM, cross-origin iframes) at the same
   sidecar cost.

2. **T0–T3 anchor tier assignment at capture time.** T0 (testid), T1 (stable id),
   T2 (id-fragment) computable from rrweb attributes alone. T3 (name-only /
   anchorless) requires the sidecar's computed a11y name.

3. **Fragility flag (strong / weak / ambiguous) at capture time.**
   `fragility=ambiguous` requires one `container.querySelectorAll` per action —
   the standard sidecar query, no additional cost beyond what T3 already needs.

4. **Shadow DOM + same-origin iframes + cross-origin iframes.** Shadow DOM and
   same-origin iframes auto-captured by rrweb. Cross-origin iframes require
   `recordCrossOriginIframes: true` in rrweb config plus `all_frames` and
   `match_origin_as_fallback` in the MV3 manifest. Cheaper than expected — just
   injection config, no separate protocol handshake.

5. **`verify.network_settled` sidecar need.** Remains a sidecar in both ranks
   (rrweb captures DOM, not network). Default implementation: MAIN-world
   fetch/XHR monkey-patch. `chrome.debugger` is available behind a deep-record
   toggle for cases where the monkey-patch is inadequate.

6. **Minimal MV3 packaging shape.** Manifest with `all_frames` +
   `match_origin_as_fallback`, one content script mounting rrweb + the sidecar,
   service worker for message aggregation, batched dispatch to a background
   endpoint for YAML serialization. §6 of the original spike had the full
   manifest sketch; that detail is lost.

## Surprise findings

- **Cross-origin iframe capture is cheaper than expected.** Just injection
  config, no separate protocol setup.
- **rrweb captures computed CSS, but not computed a11y.** Therefore **axe-core
  must ship day-one, not P2** — it's a load-bearing dependency for T3 and for
  `fragility=ambiguous` computation, not an optimization.

## What this reconstruction does not cover

The original 6-question doc cited rrweb source/docs verbatim for each claim. This
summary preserves the conclusions but not those individual citations. If any
specific claim above needs re-verification against upstream rrweb docs before it
influences an architectural decision, do that lookup live — the conclusions here
are load-bearing but should be spot-checked, not treated as authoritative
citations of rrweb's own documentation.

The original also mentioned an optional `spike/` prototype (manifest.json +
~50-line content script). That prototype was not written by the parent
session's subagent (skipped to keep the deliverable tight); the §6 manifest
sketch mentioned above is what would seed it.

## Recovery limits

- **Search transcript** on 2026-09-24: no session's transcript contains the
  full file body — only summaries. Direct Write-tool-call reconstruction (the
  pattern that recovered `experiment/eval/jev-judge/` from `Semantic locator
  healing comparison`'s transcript) is not available here — the parent session
  dispatched a subagent, and the subagent's transcript file (which would have
  the Write calls) is gone from disk.
- **Task-output symlink** at
  `/private/tmp/claude-501/…/practical-ptolemy-2d1f8b/…/tasks/ae7124029e3461c77.output`
  survives but points at a deleted target file.
- **Session process** for `Prototype rrweb capture spike for MV3 recorder` is
  offline as of 2026-09-24 and would need to be reopened by the user, which
  would not itself restore the file — that session's own message history is
  what's rendered in this summary.
