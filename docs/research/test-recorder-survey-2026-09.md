# Survey: OSS browser-extension test recorders for fork base (2026-09)

Context: capabilities 3/4/5 (self-healing locator brain, self-healing execution pipeline, reporting) already exist in-repo at `experiment/lib/self-heal/{brain,pipeline,report}/*.js`. Gap is capability 1 (test-authoring UI shell) and capability 2 (live-session recorder capturing click/input/submit as ordered steps in a Chrome MV3 content script). Selenium IDE fork was the prior default assumption — this survey re-examines it against alternatives.

No pre-existing `docs/`, `research/`, or `notes/` convention was found in this repo (a fresh `find` for those directories returned nothing); prior "docs: [arch] §3e/§3f/§3g" commits appear to have been squashed/not present in this worktree. This file establishes `docs/research/` as the location per the task instructions.

## 1. OSS recorder survey

### Selenium IDE (SeleniumHQ/selenium-ide)
- Repo: https://github.com/SeleniumHQ/selenium-ide
- License: Apache-2.0 (confirmed on repo license badge/file).
- Activity: actively maintained but slow-paced; most recent commit on `trunk` observed at 2024-11-22 (per GitHub commit history, https://github.com/SeleniumHQ/selenium-ide/commits/trunk); gaps of months between releases.
- **Critical finding — MV3 blocker**: Issue #573, "Selenium IDE broken in Chrome extensions using Manifest V3" (https://github.com/SeleniumHQ/selenium-ide/issues/573), and the project's own v4 planning wiki (https://github.com/SeleniumHQ/selenium-ide/wiki/Selenium-IDE-v4) state that Selenium IDE v3's core functionality (execute script, assert, store commands mid-page) has **no direct MV3 equivalent** — the maintainers describe staying a pure web-extension as "completely hobbling the capabilities of the tool." As of this survey Selenium IDE has not shipped a general-purpose MV3-compatible recorder; the packages tree (`packages/side-recorder`, `packages/selenium-ide`) is still MV2-shaped Electron+webextension architecture.
- Selector strategy: side-recorder builds a locator-builders ranking (id, name, css, link text, xpath fallbacks) — Apache-2.0, technically forkable code, but the whole extension shell is MV2 and Electron-coupled, meaning "forking Selenium IDE's content-script recorder" in practice means extracting the recorder logic and rewriting the messaging/background-page architecture for MV3 — not a drop-in fork.
- Verdict: permissive license and forkable locator logic, but NOT MV3-shaped out of the box; adopting it means a substantial rewrite of exactly the parts (background page architecture) that make it a "content script".

### Katalon Recorder (katalon-studio/katalon-recorder)
- Repo: https://github.com/katalon-studio/katalon-recorder
- License: dual — Apache License 2.0 file present (inherited from its SideeX origins) alongside a "KATALON RECORDER CONTRIBUTION LICENSE AGREEMENT" and a "KATALON RECORDER OPEN-SOURCE LICENSE AGREEMENT" file in the repo root (https://github.com/katalon-studio/katalon-recorder/blob/master/KATALON%20RECORDER%20OPEN-SOURCE%20LICENSE%20AGREEMENT). The presence of a custom CLA/license agreement alongside Apache-2.0 is a yellow flag — needs legal reading of the custom agreement before treating it as plain Apache-2.0; not confirmed permissive-only.
- Activity: forum announcement of open-sourcing exists (https://forum.katalon.com/t/katalon-recorder-browser-extension-will-become-open-source/17769); could not confirm a 2024-2026 commit from search results alone — needs direct repo check for recent activity, flagged as uncertain.
- Architecture: forked from SideeX (Selenium-IDE-like), same MV2-era content-script/background-page split as Selenium IDE — same MV3 problem class applies.
- Verdict: not clearly better than Selenium IDE; custom license terms need vetting, likely same MV3 rework burden.

### Google Chrome DevTools Recorder / Puppeteer Replay
- Recorder panel ships built into Chromium itself (not a separate installable content script you fork) — chrome://recorder or DevTools "Recorder" tab, replay/export logic lives in the separate library **puppeteer/replay** (https://github.com/puppeteer/replay), which IS Apache-2.0 licensed and OSS.
- Architecture: DevTools Recorder's capture happens via Chrome DevTools Protocol (CDP) instrumentation inside DevTools itself, not a content script injected into the target page. `puppeteer/replay` only consumes/replays/stringifies already-captured JSON recordings (schema at https://github.com/puppeteer/replay) — it is not itself a capture mechanism you can embed as an extension content script.
- MV3 relevance: none directly — this is DevTools-internal CDP tooling, not an extension architecture at all, so "forking" it does not give you an installable content-script recorder; you'd be building your own CDP-based capture (different browser surface than a normal MV3 extension, requires `chrome.debugger` permission, more invasive/privileged than content-script event listening).
- Verdict: excellent as a target *export format* (their step JSON schema is a reasonable reference for ordered-step data model) but not usable as forkable content-script source.

### Cypress Studio
- Not a standalone browser extension; Cypress Studio is a feature built into the Cypress test runner GUI (Node-side Electron app driving the browser via Cypress's own automation layer), removed in Cypress 10.0 and reimplemented in 10.7 (https://github.com/cypress-io/cypress/discussions/21561, "An Update on Cypress Studio" blog https://www.cypress.io/blog/update-on-cypress-studio). Cypress also partnered with Chrome to build a DevTools-Recorder-to-Cypress export plugin — again DevTools-side, not a content-script recorder.
- Verdict: Node/Electron-side tooling, not a real content script; disqualified by the task's own criteria.

### Puppeteer Recorder / Headless Recorder (checkly/headless-recorder)
- Repo: https://github.com/checkly/headless-recorder — archived 2022-12-16, explicitly deprecated by Checkly in favor of Playwright Codegen / Chrome DevTools Recorder (issue #232, "Bye!", https://github.com/checkly/headless-recorder/issues/232).
- Verdict: dead project, do not use as a base. Its stated successor (Playwright Codegen) is Node-side, not a content-script extension either.

### TestCafe Studio
- TestCafe core framework: MIT license, actively maintained (https://github.com/DevExpress/testcafe).
- TestCafe **Studio** (the visual recorder GUI) is a **commercial, closed-source** DevExpress product — confirmed via DevExpress EULA page (https://www.devexpress.com/support/eulas/testcafe-studio.xml) and product page. Not open source at all.
- Verdict: disqualified — the recorder itself is proprietary; only the non-recorder core framework is OSS.

### Ranorex
- Fully commercial/proprietary, no open-source offering found (https://www.ranorex.com/licensing/, support docs describe only paid perpetual/subscription/floating licenses).
- Verdict: disqualified, not OSS at all.

### Other MV3-era candidates found
- **RecordReplay** (tomgallagher/RecordReplay, https://github.com/tomgallagher/RecordReplay): CDP-based, generates CSS/XPath selectors, outputs to Jest/Puppeteer/Selenium/Cypress. Small/low-visibility project; license and MV3-specific status not confirmed from search snippet alone — worth a follow-up direct repo check before ruling in or out.
- **testing-library/testing-library-recorder-extension** (https://github.com/testing-library/testing-library-recorder-extension): a Chrome DevTools Recorder *extension plugin* (adds Testing-Library-style selectors to DevTools Recorder's own export), not a standalone content-script recorder itself — same DevTools-coupling limitation as the Cypress plugin.
- **Chrome Step Recorder** (Chrome Web Store listing, MV3, workflow "Create project → Record → Edit → Manage → Play"): appears to be a real MV3 extension; source-code availability/license not established from the store listing alone — needs direct repo lookup (not found via search) before treating as forkable; treat as unconfirmed/likely closed-source until a repo is located.
- **zero-cost-self-healing-qa** (Renjithnj/zero-cost-self-healing-qa, referenced in arXiv:2603.20358 write-up): this is a *self-healing locator* framework (10-tier priority locator hierarchy: get_by_role, data-testid, ARIA labels, CSS class fragments, visible text, etc.), not a recorder — relevant to capability 3/4 comparison, not capability 1/2. Notable because its locator-ranking approach is a good reference to compare against the in-repo `brain` module, but it doesn't solve the recorder gap.

## 2. Academic literature (arXiv / related)

- **arXiv:2603.20358** — "Beyond LLM-based test automation: A Zero-Cost Self-Healing Approach Using DOM Accessibility Tree Extraction" (also on ResearchGate: https://www.researchgate.net/publication/403070986). Capture: not a recorder paper — assumes existing test scripts. Healing: structured accessibility-tree extraction + priority-ranked locator hierarchy (10 tiers) instead of per-invocation LLM calls, explicitly to avoid the cost-scaling problem of LLM-based healing. Code released: yes, https://github.com/Renjithnj/zero-cost-self-healing-qa.
- **arXiv:2605.01471** — "Practical Limits of Autonomous Test Repair: A Multi-Agent Case Study with LLM-Driven Discovery and Self-Correction." Examines LLM-agent-driven repair of broken UI tests at enterprise scale; documents failure modes of LLM-driven discovery/self-correction (useful as a cautionary reference for the in-repo `pipeline` design). Code release not confirmed from abstract-level search.
- **arXiv:2606.27665** — "LLM-Assisted Model-Based GUI Testing for Vue.js Web Applications." Focuses on model-based test *generation* (not live-session recording) assisted by LLMs for a specific framework (Vue.js); tangential to the recorder gap, more relevant to future test-generation features than to capability 2.
- **arXiv:2602.11724** — "WebTestPilot: Agentic End-to-End Web Testing against Natural Language Specification by Inferring Oracles with Symbolized GUI Elements." Agent infers test oracles from natural-language specs using symbolized GUI elements; generation-oriented, not session-recording-oriented.
- **arXiv:2509.25043** — "Large Language Models for Software Testing: A Research Roadmap." Survey/roadmap paper, useful as a map of the field but not a specific technique.
- Mind2Web / WebArena family (WebArena ICLR 2024, VisualWebArena 2024, per Medium summary and Microsoft/arXiv papers 2504.01382, 2605.31365) are web-*agent* benchmarks for autonomous task completion, not test-recording or selector-healing benchmarks specifically; several 2024-2025 papers (2605.31365 "Learning to Adapt: Self-Improving Web Agent via Cognitive-Aware Exploration", 2509.25140 "ReasoningBank") extend this line toward self-improving agents but do not target the record→replay→heal test-automation use case directly.
- **Net assessment**: no arXiv paper found that specifically addresses "browser-extension-based live-session recording of user interactions into structured test steps" — the recorder problem is treated in industry tooling (Selenium IDE, DevTools Recorder), not academic literature. Academic work clusters instead around (a) LLM/agent-based test *generation* from specs, and (b) selector self-healing, which overlaps with the in-repo `brain`/`pipeline` work already built, not the recorder gap.

## 3. GitHub/HuggingFace scan for recorder + self-healing combos

- No actively-maintained (2024-2026), meaningfully-starred, MV3-native, permissively-licensed **browser-extension recorder** was found beyond what's listed in §1. The space has consolidated around Chrome's built-in DevTools Recorder (CDP-based, not a forkable content script) and Playwright's `codegen` (Node/CLI-side, launches its own browser via CDP — not a content script either, and not a Chrome extension at all).
- Standalone self-healing locator libraries found (headout/autoheal, SanjayPG/autoheal-locator, aashitsharma/self-heal-locators) are all small, recently-created, LLM-dependent projects — none beat the in-repo `brain` module in maturity, and none address the recorder gap.
- No project combining "real MV3 content-script recorder" + "self-healing" + "permissive license" + "active 2024-2026 maintenance" was located. This confirms the gap analysis in the task brief: capability 1/2 remains genuinely unserved by an off-the-shelf fork candidate as clean as originally hoped.

## 4. Final recommendation

**Selenium IDE is not a clean fork base for the recorder**, despite the permissive Apache-2.0 license. The maintainers' own MV3 issue (#573) and v4 planning wiki establish that the parts of Selenium IDE that make it useful (background-page-mediated command execution, assert/store) have no direct MV3 translation — forking it means porting logic across an architecture boundary, not lifting a content script.

Ranked recommendation:

1. **Selenium IDE's `side-recorder` package (locator-ranking logic only) as a reference/logic-extraction source, not a full fork** — Apache-2.0 (https://github.com/SeleniumHQ/selenium-ide, license file), forkable in the legal sense, but only the locator-building code (id/name/css/xpath ranking) is worth lifting; the surrounding extension architecture must be rewritten for MV3 regardless. Best available permissively-licensed prior art for the click/input/submit event-capture logic itself, once extracted from its MV2 messaging plumbing.
2. **Chrome DevTools Recorder's step JSON schema (via puppeteer/replay, Apache-2.0)** as a *data-model* reference, not a code fork — https://github.com/puppeteer/replay. Not forkable as a content-script recorder (it's CDP/DevTools-internal), but its ordered-step JSON schema is a clean, permissively-licensed reference for how to structure captured click/input/submit/navigate steps, which can shortcut the "test-authoring UI shell" data model design (capability 1).
3. **Build the MV3 content-script recorder in-house**, using (1) and (2) as design references rather than forking either. Given no candidate combines "real content script" + "MV3-native" + "permissive license" + "actively maintained" (Katalon Recorder's licensing is murky/dual and architecturally identical to Selenium IDE's MV2 problem; Chrome Step Recorder's source isn't locatable/confirmed OSS; TestCafe Studio, Ranorex, Cypress Studio, headless-recorder are all disqualified by license, architecture, or abandonment), a from-scratch MV3 content script — informed by Selenium IDE's locator ranking and the DevTools Recorder JSON schema, and wired directly into the existing in-repo `brain`/`pipeline`/`report` modules — is lower-risk than "forking" a codebase whose own maintainers say the fork target's core mechanism doesn't survive the MV3 transition.

Report saved to: `docs/research/test-recorder-survey-2026-09.md` (repo-relative), full path `/Users/prashant/Documents/playwright_middleware/.claude/worktrees/happy-sanderson-bb1691/docs/research/test-recorder-survey-2026-09.md`.
