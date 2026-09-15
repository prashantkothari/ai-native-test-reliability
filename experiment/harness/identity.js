// Identity comparator extracted for testability.
// See compare_matrix.js §identityOf for rationale.
//
// Given a Playwright Locator, resolves to an ElementHandle and reads a stable
// seed from the DOM: tag | trimmed text | quantized bounding box | landmark
// chain. aria-label and role are intentionally NOT part of the seed so that
// paths through different attribute-drift channels still agree when they point
// at the same element.

export async function identityOf(locator) {
  let handle = null;
  try {
    handle = await locator.elementHandle({ timeout: 2000 });
    if (!handle) return { seed: null, found: false };
    const seed = await handle.evaluate((el) => {
      const q = (v) => Math.round(v / 5) * 5;
      const r = el.getBoundingClientRect();
      const tag = el.tagName.toLowerCase();
      const txt = (el.textContent || '').trim().slice(0, 64);
      const LANDMARKS = new Set(['main', 'form', 'nav', 'banner', 'contentinfo']);
      const chain = [];
      let p = el.parentElement;
      while (p && p !== document.body) {
        const role = p.getAttribute('role') || p.tagName.toLowerCase();
        if (LANDMARKS.has(role)) { chain.unshift(role); break; }
        p = p.parentElement;
      }
      if (chain.length === 0) chain.push('body');
      return `${tag}|${txt}|${q(r.x)},${q(r.y)},${q(r.width)},${q(r.height)}|${chain.join('>')}`;
    });
    return { seed, found: true };
  } catch {
    return { seed: null, found: false };
  } finally {
    if (handle) { try { await handle.dispose(); } catch {} }
  }
}
