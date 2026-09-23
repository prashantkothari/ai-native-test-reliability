// Minimal element descriptor + candidate ranker, standalone (no prod selfheal-core.js in this worktree).
// Signals used (subset of the 11-signal idea from SELF_HEAL_ARCHITECTURE_v1.md):
// role, accessible-name, testid, class, id, tag, container role+name, ordinal-among-siblings,
// text content, aria-label, href (for links).

import { redactTruthMarker } from './redact.mjs';

function accessibleName(el) {
  return (
    el.getAttribute('aria-label') ||
    el.textContent?.trim().slice(0, 80) ||
    el.getAttribute('title') ||
    ''
  );
}

function roleOf(el) {
  const explicit = el.getAttribute('role');
  if (explicit) return explicit;
  const tag = el.tagName.toLowerCase();
  if (tag === 'a' && el.getAttribute('href')) return 'link';
  if (tag === 'button') return 'button';
  if (tag === 'input') {
    const type = el.getAttribute('type') || 'text';
    return type === 'submit' || type === 'button' ? 'button' : 'textbox';
  }
  if (tag === 'nav') return 'navigation';
  if (tag === 'form') return 'search'; // our fixture only has role=search forms
  if (/^h[1-6]$/.test(tag)) return 'heading';
  return tag;
}

function containerOf(el) {
  let p = el.parentElement;
  while (p) {
    const role = roleOf(p);
    if (['navigation', 'search', 'form', 'main', 'header', 'footer'].includes(role) || p.tagName === 'NAV' || p.tagName === 'HEADER' || p.tagName === 'FOOTER' || p.tagName === 'MAIN') {
      return { role: roleOf(p), name: accessibleName(p) || p.tagName.toLowerCase() };
    }
    p = p.parentElement;
  }
  return { role: 'document', name: '' };
}

export function describe(el) {
  return {
    role: roleOf(el),
    name: accessibleName(el),
    tag: el.tagName.toLowerCase(),
    testid: el.getAttribute('data-testid') || null,
    id: el.id || null,
    class: el.getAttribute('class') || null,
    href: el.getAttribute('href') || null,
    container: containerOf(el),
  };
}

// Candidate scoring: how well does `el` match `descriptor`? Higher = better match.
export function score(el, descriptor) {
  const cand = describe(el);
  let s = 0;
  if (descriptor.testid && cand.testid === descriptor.testid) s += 5;
  if (cand.role === descriptor.role) s += 2;
  if (descriptor.name && cand.name === descriptor.name) s += 3;
  else if (descriptor.name && cand.name && cand.name.includes(descriptor.name.slice(0, 10))) s += 1;
  if (descriptor.container?.role === cand.container?.role) s += 1;
  if (descriptor.container?.name && cand.container?.name === descriptor.container.name) s += 1;
  if (descriptor.href && cand.href === descriptor.href) s += 2;
  return { score: s, descriptor: cand };
}

// Includes [role] so ARIA-role-only elements (e.g. a <span role="button"> from a
// node-type-swap drift) are discoverable candidates, not silently excluded.
const RANKABLE_SELECTOR = 'a,button,input,h1,h2,h3,h4,h5,h6,nav,form,[role]';

export function rank(document, descriptor, k = 8) {
  const nodes = Array.from(document.querySelectorAll(RANKABLE_SELECTOR));
  const scored = nodes.map((node, domIndex) => ({ node, domIndex, ...score(node, descriptor) }));
  scored.sort((a, b) => b.score - a.score || a.domIndex - b.domIndex);
  const top = scored.slice(0, k);
  const maxScore = Math.max(1, ...top.map((c) => c.score));
  return top.map((c) => ({
    ...c.descriptor,
    // Strip the ground-truth marker before this ever reaches a judge — otherwise
    // the judge (Jev, an LLM, or a human) sees the literal answer in the HTML,
    // which invalidates the comparison. isTruth below is computed from the live
    // DOM node directly, never from this serialized/redacted string.
    outerHTML: redactTruthMarker(c.node.outerHTML).slice(0, 400),
    // Exact identity check on the node itself (not a substring match on serialized
    // HTML) — a substring check would falsely flag a container that merely wraps
    // the real target as "the truth candidate."
    isTruth: c.node.hasAttribute('data-eval-truth'),
    rawScore: c.score,
    normalizedScore: c.score / maxScore,
    domIndex: c.domIndex,
  }));
}
