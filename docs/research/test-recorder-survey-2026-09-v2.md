# Survey v2: OSS browser-extension test recorders — redteamed (2026-09)

Supersedes [`test-recorder-survey-2026-09.md`](./test-recorder-survey-2026-09.md).
This version was rewritten after reading
`/Users/prashant/Documents/playwright_middleware/SELF_HEAL_ARCHITECTURE_v1.md`
(ARCH v1) and `FAILURE-TAXONOMY.md` — much of v1's "recommendation" was
duplicating decisions already made in the arch doc. Redteamed.

## Ground-truth reframe (what v1 missed)

The arch doc changes the question in three ways:

- **The recorder must emit our 11-signal descriptor + T0–T3 anchor tier
  + `fragility` flag** (ARCH row 3, §3b, §3f), not just click/input/submit
  events. A generic recorder that captures a CSS selector per click does
  ~10% of the job. The other 90% is *anchor extraction* on top of the
  capture.
- **The recorded-step format is already specified** (ARCH §3f — Maestro-
  inspired YAML with `anchor.tier`, `fragility`, `verify:`, `intent:`
  at header). Any recorder must serialize to this format, not invent
  its own.
- **HITL is a record-time responsibility, not just an execute-time one**
  (ARCH row ⟂ — "record-time anchor-strengthening" via HITL overlay).
  The recorder is expected to *flag weak/ambiguous anchors as they're
  captured* so the author can strengthen them before ever hitting
  execute. This rules out any "silent" recorder that just logs events.

**Net**: the interesting deliverable is not "a recorder" — it's a
recorder wired to our descriptor extractor, our HITL overlay, and our
YAML serializer. The capture engine underneath is the least novel
part.

## Redteam findings against survey v1

### RT-1. v1 conflated "Selenium IDE the whole tool" with "the recorder subset"

Issue #573 and the v4 wiki say Selenium IDE's *executor* has no clean
MV3 port. They don't say the *recorder* doesn't — content scripts still
receive DOM events fine under MV3. **v1's framing was too pessimistic**;
extracting `side-recorder`'s locator-builder + event capture into an
MV3 skeleton is smaller work than v1 implied. Still not zero work,
because our descriptor is 11-signal not Selenium's 4-tier.

### RT-2. v1 missed rrweb entirely

**rrweb** (github.com/rrweb-io/rrweb, MIT, actively maintained,
production use in PostHog / OpenReplay / LogRocket) records full DOM
mutation streams — clicks, inputs, mutations, scrolls, shadow DOM,
iframes — as replayable event logs. It's content-script-shaped and
MV3-compatible. It doesn't emit "test steps" or anchor tiers, so it
still needs our descriptor extractor + YAML serializer on top, but it
**removes the hardest reinvention risk from a from-scratch build**:
serializing DOM interaction reliably across the browser's weird
corners.

v1's blanket claim "no candidate combines real content-script capture +
MV3 + permissive license + active maintenance" was **wrong** because
rrweb wasn't searched for.

### RT-3. Katalon Recorder dismissal was rushed

v1 flagged the "custom CLA + Apache-2.0" combo as murky and stopped.
A contributor CLA is a grant *from* contributors *to* the project — it
doesn't restrict downstream users. Needs a 30-minute repo-level read of
the shipped `LICENSE` file to confirm plain Apache-2.0, at which point
Katalon Recorder becomes a maintained SideeX fork worth head-to-head
with Selenium IDE. Not resolved.

### RT-4. v1 dismissed the CDP / `chrome.debugger` path too fast

v1 rejected DevTools Recorder because it uses CDP not content scripts,
citing `chrome.debugger` as "invasive." For a **test-authoring**
extension the user *installs to record tests*, an explicit
"attach debugger" prompt is expected UX (Cypress, Playwright codegen
do it). CDP gives us **shadow DOM traversal, iframe capture, cross-
origin capture, network event capture** — the last of which we need
for `verify.network_settled` (ARCH §3f). Content scripts genuinely
struggle with all four. **CDP is a legitimate alternative
architecture**, not disqualified.

### RT-5. Chrome Step Recorder listed as "unconfirmed" is a null result

v1 said "source not locatable, treat as closed." That's not evidence.
Either find it or say "not investigated." Still not investigated.

### RT-6. v1 didn't recognize the arch doc already answered the mobile question

The arch doc's §3g is unambiguous: **do NOT fork Maestro; use Maestro
Studio as an authoring UX and transpile its YAML to ours**. For mobile,
the recorder question is decided. This survey should therefore be
scoped to **web recorder only**, not both — which shrinks the search.

### RT-7. v1 didn't ask "does an authoring UX already exist we could wrap?"

Same trick as ARCH §3g for mobile — for web, is there a permissively-
licensed recorder-with-UI whose output we transpile? Candidates:
- **Playwright codegen** (Apache-2.0, actively maintained) — Node/CLI-
  side, not an extension, but produces a step list we could transpile
  to our YAML the same way §3g proposes for Maestro. Doesn't solve
  in-Chrome authoring, but solves author-time recording for anyone
  already running Playwright locally.
- **DevTools Recorder** (Apache-2.0, ships with Chrome) — its JSON
  export via `puppeteer/replay` is a clean intermediate; a "DevTools
  Recorder → our YAML transpiler + our anchor-tier promoter" is
  potentially the *cheapest* MVP path. Zero extension code to ship.
- v1 mentioned DevTools Recorder only as a data-model reference, not
  as a Studio-style transpile target. That was underscoped.

### RT-8. v1's "false-heal=0" ethos didn't propagate into the recorder rec

Our design ethos is deterministic + explainable + false-heal-0.
A recorder that captures a fragile anchor and silently ships it as
"strong" is the record-time analogue of a false heal. v1's recommen-
dations didn't weight recorders by *how well they'd surface anchor
fragility at capture time*. Selenium IDE ranks locators but doesn't
flag fragility; rrweb doesn't rank at all; DevTools Recorder ranks
weakly. **None do what we need out of the box** — the fragility flag
is a net-new component regardless of which capture engine we pick.
That makes the capture engine less load-bearing than v1 treated it.

### RT-9. Activity dates already stale

v1's "Selenium IDE last commit 2024-11-22" is now 22 months old
(today 2026-09-10). Reclassify as effectively dormant.

### RT-10. v1 didn't consider "no fork, buy nothing, transpile"

Given RT-6 and RT-7, the option-space includes: transpile DevTools
Recorder or Playwright codegen output into our YAML, and build only
the anchor-tier promoter + HITL overlay + fragility flagger. Zero
extension shipped. v1 didn't rank this.

## Updated ranking (v2)

v1's ranking (Selenium IDE logic > DevTools Recorder schema > build from
scratch) is **superseded**. New ranking:

### Rank 1 — Transpile DevTools Recorder output → our YAML + build our anchor-tier promoter as a small companion extension

- **License**: Apache-2.0 (via `puppeteer/replay` schema and Chrome
  DevTools Recorder itself); permissive.
- **Ship surface**: the smallest possible. A CLI/transpiler +
  a tiny MV3 extension that adds our fragility flag + anchor-tier
  promoter + HITL overlay hooks into the Recorder panel via its
  documented extension API (Testing Library already does this — see
  `testing-library/testing-library-recorder-extension`).
- **Why**: skips both the capture engine reinvention AND the authoring
  UX reinvention. Chrome maintains the panel. We contribute only the
  parts that are actually novel to our design (anchor tiers, fragility
  flag, YAML serialization, HITL routing).
- **Trade-offs**: dependent on Chrome's Recorder panel (Chrome-only,
  which we already are); doesn't solve non-Chrome authoring; requires
  users to open DevTools to record.

### Rank 2 — Own MV3 content-script recorder built on rrweb, wired to our descriptor extractor + HITL overlay

- **License**: MIT (rrweb).
- **Ship surface**: a full MV3 extension with rrweb capturing the
  event/mutation stream, our code translating that into
  `(action, descriptor, anchor.tier, fragility, verify)` steps and
  invoking the HITL overlay inline as the user records.
- **Why**: standalone extension, no DevTools requirement, richer signal
  than the Recorder panel exposes (mutation stream feeds P2 structural-
  diff heals per TAXONOMY §C). Someone else maintains the hard capture
  code.
- **Trade-offs**: more code than rank 1; we own the record UX.

### Rank 3 — Selenium IDE `side-recorder` subset port

- **License**: Apache-2.0.
- **Ship surface**: a full MV3 extension, ported from the MV2 side-
  recorder subset (event listeners + locator builder), executor dropped.
- **Why**: only if ranks 1 and 2 both fall over. Selenium IDE's locator
  ranking is decent prior art, but we already have a richer 11-signal
  descriptor, so most of the borrow value is the event-capture code —
  which rrweb (rank 2) does better anyway.

### Also worth 30 min

- **Katalon Recorder license clarification** (RT-3). If plain Apache-2.0,
  slot ahead of Selenium IDE at rank 3.
- **Playwright codegen → our YAML transpiler** as a *parallel* authoring
  path for authors who already run Playwright locally. Complements
  rank 1, not a replacement.

### Not recommended

- Selenium IDE as a whole-tool fork (v1's rank 1) — superseded by ranks
  1 and 2.
- TestCafe Studio, Ranorex — closed source.
- headless-recorder — archived 2022-12.
- Cypress Studio — Node/Electron-side, not an extension.
- Autonoma — BSL 1.1, arch doc §3e forbids fork/copy.

## Open items after v2

- RT-3: read Katalon Recorder's shipped `LICENSE` file directly.
- RT-5: locate Chrome Step Recorder source or explicitly mark
  "not investigated."
- RT-4 / rank 1 vs 2: prototype spike — does rrweb's event stream
  contain enough context to emit our 11-signal descriptor without
  loss? Does DevTools Recorder's panel extension API expose the hooks
  we'd need for the anchor-tier promoter?
- Confirm the recorder isn't already scoped to a specific existing
  effort in the repo — ARCH v1 doesn't name a recorder decision, but
  a follow-on doc might.
