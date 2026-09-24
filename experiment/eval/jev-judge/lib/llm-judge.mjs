// LLM judge (Sonnet). Same task Jev gets: is `candidate` the same logical element
// as `descriptor`, given the page changed. One call per candidate, JSON output,
// temperature 0. Two few-shot examples baked into the system prompt so the model
// doesn't invent ungrounded reasons (see plan F1 — this must be a real prompt,
// not a strawman, or the comparison is unfair).

import Anthropic from '@anthropic-ai/sdk';

// Lazy-init: module imports are hoisted above any dotenv.config() call in the
// caller, so constructing the client at module load time would read the env
// before it's populated. Build it on first use instead.
let client;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

const SYSTEM = `You are a locator-healing judge for browser test automation. A test recorded an element yesterday (the "descriptor"). Today's page may have shifted — renamed classes, added wrappers, reordered siblings, swapped node types, or planted a near-identical decoy next to the real element. Given a candidate element from today's page, decide if it is the SAME logical element as the descriptor.

Rules:
- Base your reasoning ONLY on the role, name, container, href, and HTML shown. Never invent an attribute that isn't present.
- A decoy will have the same visible text/role as the real element but often differs in class, testid presence, or exact container path — look closely.
- If you are not reasonably sure (confidence would be below 0.7), say same=false and explain what's missing, rather than guessing.
- Respond with ONLY a JSON object: {"same": boolean, "confidence": number between 0 and 1, "reason": "short grounded explanation"}

Example 1:
descriptor: {"role":"button","name":"Sign in","container":{"role":"navigation","name":"Header"}}
candidate: {"role":"button","name":"Sign in","container":{"role":"navigation","name":"Header"},"html":"<button class=\\"c_x7f2\\" data-testid=\\"signin\\">Sign in</button>"}
-> {"same": true, "confidence": 0.97, "reason": "role, name, and container all match; only the class name changed, which is expected drift."}

Example 2:
descriptor: {"role":"link","name":"Docs","container":{"role":"navigation","name":"Global"},"href":"/docs"}
candidate: {"role":"link","name":"Docs","container":{"role":"navigation","name":"Global"},"href":"/docs","html":"<a class=\\"nav-link decoy\\" href=\\"/docs\\">Docs</a>"}
-> {"same": false, "confidence": 0.55, "reason": "role, name, href, and container all match a real element, but the class name includes 'decoy' and there is likely an identical sibling — cannot be confident this is the original without a stronger anchor like a testid."}`;

export async function judgeLLM(descriptor, candidate, domSlice) {
  const t = Date.now();
  const userContent = JSON.stringify({
    descriptor: { role: descriptor.role, name: descriptor.name, container: descriptor.container, href: descriptor.href },
    candidate: { role: candidate.role, name: candidate.name, container: candidate.container, href: candidate.href, html: candidate.outerHTML },
    nearby_dom: domSlice.slice(0, 2000),
  });

  const res = await getClient().messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 300,
    temperature: 0,
    system: SYSTEM,
    messages: [{ role: 'user', content: userContent }],
  });

  const text = res.content[0]?.text ?? '{}';
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    // strip markdown fencing if the model wrapped it despite instructions
    const match = text.match(/\{[\s\S]*\}/);
    parsed = match ? JSON.parse(match[0]) : { same: false, confidence: 0, reason: 'unparseable response' };
  }

  return {
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
    same: !!parsed.same,
    reason: parsed.reason || '',
    latency_ms: Date.now() - t,
    usage: { input_tokens: res.usage.input_tokens, output_tokens: res.usage.output_tokens },
  };
}
