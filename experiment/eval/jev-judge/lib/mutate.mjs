// Six drift kinds. Each takes (document, targetEl) and mutates in place.
// domIndex-stable so xpath-ish lookup by position stays valid pre-mutation.

function randomHash() {
  return Math.random().toString(36).slice(2, 10);
}

export const MUTATIONS = {
  'class-rename': (document, el) => {
    el.setAttribute('class', `c_${randomHash()}`);
  },
  'wrap-in-div': (document, el) => {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('class', 'wrapper-' + randomHash());
    el.parentNode.insertBefore(wrapper, el);
    wrapper.appendChild(el);
  },
  'sibling-reorder': (document, el) => {
    const parent = el.parentNode;
    const siblings = Array.from(parent.children);
    if (siblings.length > 1) {
      parent.removeChild(el);
      const insertBefore = siblings.find((s) => s !== el) || null;
      parent.insertBefore(el, insertBefore);
    }
  },
  'aria-text-edit': (document, el) => {
    const current = el.getAttribute('aria-label') || el.textContent;
    const edited = current ? `${current} `.trim() + '​' : current; // zero-width space, same visible text different node text
    if (el.getAttribute('aria-label')) {
      el.setAttribute('aria-label', el.getAttribute('aria-label') + ' (updated)');
    } else if (el.childNodes.length && el.firstChild.nodeType === 3) {
      el.firstChild.textContent = el.firstChild.textContent + ' ​';
    }
  },
  'node-swap': (document, el) => {
    // swap a <button> for role=button <span>, or <a> for role=link <span>, preserving attrs
    const span = document.createElement('span');
    span.setAttribute('role', el.tagName.toLowerCase() === 'a' ? 'link' : 'button');
    span.setAttribute('tabindex', '0');
    for (const attr of Array.from(el.attributes)) {
      if (attr.name !== 'href') span.setAttribute(attr.name, attr.value);
    }
    span.innerHTML = el.innerHTML;
    el.parentNode.replaceChild(span, el);
    return span; // caller should update correct target reference
  },
  'decoy-insertion': (document, el, rng = Math.random) => {
    const decoy = el.cloneNode(true);
    // Near-identical: same role/text, no testid (so a testid anchor still disambiguates
    // when present). The class gets a random hash suffix, NOT a literal "decoy" label —
    // a real duplicate/near-match element in production wouldn't announce itself in its
    // class name, and a judge that can read HTML text would trivially "solve" a labeled
    // decoy, making the hardest cases artificially easy. This mirrors the class-rename
    // mutation's naming scheme exactly, so the two are visually indistinguishable.
    decoy.removeAttribute('data-testid');
    decoy.setAttribute('class', ((el.getAttribute('class') || '') + ` c_${randomHash()}`).trim());
    // Insert BEFORE the real element on a coin flip so DOM-order tie-break doesn't
    // trivially always favor the real one (that would make this mutation toothless).
    if (rng() < 0.5) {
      el.parentNode.insertBefore(decoy, el);
    } else {
      el.parentNode.insertBefore(decoy, el.nextSibling);
    }
  },
};

export const DRIFT_WEIGHTS = {
  'class-rename': 3,
  'wrap-in-div': 3,
  'sibling-reorder': 3,
  'aria-text-edit': 3,
  'node-swap': 2,
  'decoy-insertion': 6,
};
