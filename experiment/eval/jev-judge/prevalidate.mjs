// One-shot prevalidation. Proves each critical assumption before we build the eval.
// Env comes from ../../../.env.jev at the worktree root.

import 'dotenv/config';
import { config as dotenvConfig } from 'dotenv';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../../../.env.jev') });

const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? '  — ' + JSON.stringify(detail) : ''}`);
};

async function main() {
  record(
    'typesafe key loaded',
    !!process.env.TYPESAFE_API_KEY,
    process.env.TYPESAFE_API_KEY
      ? { prefix: process.env.TYPESAFE_API_KEY.slice(0, 10) + '...' }
      : null,
  );
  record(
    'anthropic key loaded (optional here)',
    !!process.env.ANTHROPIC_API_KEY,
    process.env.ANTHROPIC_API_KEY
      ? { prefix: process.env.ANTHROPIC_API_KEY.slice(0, 10) + '...' }
      : { note: 'needed later for LLM judge; not required for Jev prevalidation' },
  );

  let TypeSafeClient;
  try {
    const mod = await import('@typesafe-ai/sdk');
    TypeSafeClient = mod.TypeSafeClient;
    record('typesafe sdk imports', !!TypeSafeClient, { exports: Object.keys(mod).slice(0, 12) });
  } catch (e) {
    record('typesafe sdk imports', false, { error: e.message });
    return finish();
  }

  const client = new TypeSafeClient();

  // hello-world noul (docs example)
  try {
    const t = Date.now();
    const res = await client.systemOne({
      state: 'I have asked three times now. Can I please just talk to a real person?',
      questions: {
        is_escalation: {
          type: 'noul',
          instructions: 'Is the customer asking for a human agent?',
        },
      },
    });
    const noul = res?.answers?.is_escalation?.noul;
    record(
      'hello-world noul call',
      typeof noul === 'number' && noul >= 0 && noul <= 1,
      { latency_ms: Date.now() - t, noul, model: res?.model, usage: res?.usage },
    );
  } catch (e) {
    record('hello-world noul call', false, { error: e.message });
    return finish();
  }

  // nested object state (matches the shape our real eval needs)
  try {
    const t = Date.now();
    const res = await client.systemOne({
      state: {
        descriptor: { role: 'button', name: 'Sign in', container: { role: 'nav', name: 'Header' } },
        candidate: { role: 'button', text: 'Sign in', class: 'btn-primary', parent: 'nav.header' },
      },
      questions: {
        same_element: {
          type: 'noul',
          instructions: 'Is `candidate` the same element as `descriptor`?',
          criteria: {
            true: 'Same role, matching accessible name or text, and consistent container context.',
            false: 'Different role, mismatched name, or different container context.',
          },
        },
      },
    });
    const noul = res?.answers?.same_element?.noul;
    record('nested state accepted', typeof noul === 'number', { latency_ms: Date.now() - t, noul, usage: res?.usage });
  } catch (e) {
    record('nested state accepted', false, { error: e.message });
  }

  // ~5KB HTML blob as state
  try {
    const bigHtml = readFileSync(resolve(__dirname, 'fixtures/prevalidate-5kb.html'), 'utf8');
    const t = Date.now();
    const res = await client.systemOne({
      state: { descriptor: { role: 'button', name: 'Submit' }, dom_html: bigHtml },
      questions: {
        has_button: {
          type: 'noul',
          instructions: 'Does the DOM contain any button labeled "Submit"?',
        },
      },
    });
    const noul = res?.answers?.has_button?.noul;
    record('5kb html state accepted', typeof noul === 'number', {
      latency_ms: Date.now() - t,
      noul,
      html_bytes: bigHtml.length,
      usage: res?.usage,
    });
  } catch (e) {
    record('5kb html state accepted', false, { error: e.message });
  }

  finish();
}

function finish() {
  console.log('\n---');
  // Only these count as blockers.
  const criticalNames = new Set([
    'typesafe key loaded',
    'typesafe sdk imports',
    'hello-world noul call',
    'nested state accepted',
    '5kb html state accepted',
  ]);
  const failedCritical = results.filter((r) => !r.ok && criticalNames.has(r.name));
  console.log(`${results.length - results.filter((r) => !r.ok).length}/${results.length} checks passed`);
  if (failedCritical.length) {
    console.log('Blocked. Failing critical checks:', failedCritical.map((r) => r.name).join(', '));
    process.exit(1);
  }
  console.log('OK — safe to proceed with the eval.');
}

main().catch((e) => {
  console.error('unexpected:', e);
  process.exit(1);
});
