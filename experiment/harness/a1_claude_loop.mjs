#!/usr/bin/env node
// Chip C — A1 path: Claude Sonnet in a loop with Playwright MCP as tools.
// Competitor scaffold for the plugin. Emits JSONL rows matching phase_s_final.mjs
// schema (pass, element, drift, path, run, outcome, wall_ms, diagnosis, ...).
//
// Scope: SMOKE ONE CELL — workflow-save-button, DR1 (testid rename).
// Full matrix run belongs to a later chip.
//
// Cost accounting: cumulative Anthropic API $ tracked per trial with a $0.25/trial
// hard cap and a $4.50 chip-wide halt. On cap, trial outcome = abstained_cost_cap.

import { chromium } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'logs/a1_claude_loop.jsonl');
const TRACE_DIR = path.join(ROOT, 'logs/traces');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.mkdirSync(TRACE_DIR, { recursive: true });

// ---- Config ----
const N8N = 'http://localhost:5678';
const LOGIN_EMAIL = 'test@example.local';
const LOGIN_PASSWORD = 'TestPass123';
const MAX_RETRIES = 3;
const PER_TRIAL_CAP_USD = 0.25;
const CHIP_HALT_USD = 4.50;

// Sonnet family prices (per 1M tokens, USD). Published Anthropic pricing.
// If claude-sonnet-5 pricing differs, adjust here.
const PRICE = {
  input:  3.00 / 1_000_000,
  output: 15.00 / 1_000_000,
  cache_read:  0.30 / 1_000_000,
  cache_write: 3.75 / 1_000_000,
};

// Model resolution order.
const MODEL_CANDIDATES = [
  'claude-sonnet-5',
  'claude-sonnet-5-20250929',
  'claude-sonnet-5-20250514',
  // Fallback if the above ids don't exist yet: latest known sonnet family.
  'claude-sonnet-4-5-20250929',
];

// ---- API key gate ----
const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('FATAL: ANTHROPIC_API_KEY env var is not set.');
  console.error('  export ANTHROPIC_API_KEY=sk-ant-...   # your key');
  console.error('  then re-run this script. The key is never read from disk.');
  process.exit(2);
}

const anthropic = new Anthropic({ apiKey: API_KEY });

// ---- Chip-wide spend ----
let CHIP_SPEND = 0;
function bumpSpend(usage) {
  const inTok  = usage?.input_tokens ?? 0;
  const outTok = usage?.output_tokens ?? 0;
  const cRead  = usage?.cache_read_input_tokens ?? 0;
  const cWrite = usage?.cache_creation_input_tokens ?? 0;
  const cost = inTok*PRICE.input + outTok*PRICE.output + cRead*PRICE.cache_read + cWrite*PRICE.cache_write;
  CHIP_SPEND += cost;
  console.log(`  [spend] +$${cost.toFixed(6)}  cumulative=$${CHIP_SPEND.toFixed(4)}`);
  return cost;
}

// ---- Model resolution ----
async function resolveModel() {
  for (const id of MODEL_CANDIDATES) {
    try {
      const r = await anthropic.messages.create({
        model: id, max_tokens: 4,
        messages: [{ role: 'user', content: 'hi' }],
      });
      bumpSpend(r.usage);
      console.log(`  resolved model: ${id}`);
      return id;
    } catch (e) {
      const msg = e?.message || String(e);
      if (/not_found|does not exist|invalid model|model_not_found|404/i.test(msg)) {
        console.log(`  model ${id} -> not_found, trying next`);
        continue;
      }
      throw e;
    }
  }
  throw new Error('No sonnet-5 model id resolved; all candidates 404.');
}

// ---- MCP client (Playwright MCP as tools) ----
async function startMCP() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.join(ROOT, 'node_modules/@playwright/mcp/cli.js'), '--headless', '--isolated'],
  });
  const client = new Client({ name: 'chip-c-a1', version: '0.0.1' });
  await client.connect(transport);
  const { tools } = await client.listTools();
  const anthTools = tools.map(t => ({
    name: t.name,
    description: (t.description || '').slice(0, 1024),
    input_schema: t.inputSchema || { type: 'object', properties: {} },
  }));
  return { client, tools: anthTools };
}

async function loginIfNeeded(page) {
  await page.goto(N8N, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  if (page.url().includes('/signin')) {
    await page.fill('input[type="email"]', LOGIN_EMAIL);
    await page.fill('input[type="password"]', LOGIN_PASSWORD);
    await page.click('[data-test-id="form-submit-button"], button[type="submit"]');
    await page.waitForURL(u => !u.href.includes('/signin'), { timeout: 10000 });
    await page.waitForTimeout(1500);
  }
  if (!page.url().includes('/workflow/new')) {
    await page.goto(N8N + '/workflow/new', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
  }
  await page.evaluate(() => {
    ['nps-survey-modal', 'version-updates-panel'].forEach(id => {
      document.querySelectorAll(`[data-test-id="${id}"]`).forEach(el => el.remove());
    });
    document.querySelectorAll('.el-overlay, .el-dialog__wrapper').forEach(el => el.style.display = 'none');
  });
}

async function applyDR1(page, testid) {
  return page.evaluate(t => {
    const el = document.querySelector(`[data-test-id="${t}"]`);
    if (!el) return { ok: false };
    el.setAttribute('data-phase-target', t);
    const orig = el.getAttribute('data-test-id');
    el.setAttribute('data-test-id', orig + '-DR1');
    return { ok: true };
  }, testid);
}

async function identityMatches(page, sel, marker) {
  if (!sel) return false;
  return page.evaluate(({ s, m }) => {
    try {
      const el = document.querySelector(s);
      return !!el && el.getAttribute('data-phase-target') === m;
    } catch { return false; }
  }, { s: sel, m: marker });
}

async function snapshotAX(page) {
  const snap = await page.accessibility.snapshot({ interestingOnly: true });
  return JSON.stringify(snap).slice(0, 12_000);
}

async function claudeLoop({ model, mcp, tools, testid, stepDesc, page }) {
  const trialStart = Date.now();
  let trialSpend = 0;
  let retries = 0;
  let outcome = 'FAIL';
  let healedSel = null;
  let diagnosis = null;

  const axSnap = await snapshotAX(page);
  const sys = `You are healing a Playwright locator failure. The original selector [data-test-id="${testid}"] no longer resolves. Find the correct DOM selector for the intended element using the Playwright MCP tools. Reply with ONE line: SELECTOR: <css or role selector>. Stop after ${MAX_RETRIES} tool rounds.`;

  const messages = [
    { role: 'user', content:
      `INTENT: ${stepDesc}\n` +
      `FAILED_SELECTOR: [data-test-id="${testid}"]\n` +
      `URL: ${page.url()}\n` +
      `PAGE_AX_SNAPSHOT (truncated):\n${axSnap}\n\n` +
      `Use browser_navigate + browser_snapshot MCP tools if needed. Reply SELECTOR: <selector> when confident.` },
  ];

  while (retries < MAX_RETRIES) {
    if (trialSpend >= PER_TRIAL_CAP_USD) { outcome = 'abstained_cost_cap'; diagnosis = `trial cap $${PER_TRIAL_CAP_USD}`; break; }
    if (CHIP_SPEND >= CHIP_HALT_USD)     { outcome = 'abstained_cost_cap'; diagnosis = `chip halt $${CHIP_HALT_USD}`; break; }

    let resp;
    try {
      resp = await anthropic.messages.create({ model, max_tokens: 1024, system: sys, tools, messages });
    } catch (e) {
      diagnosis = 'anthropic error: ' + (e.message || '').slice(0, 160);
      break;
    }
    const cost = bumpSpend(resp.usage);
    trialSpend += cost;

    const toolUses = (resp.content || []).filter(b => b.type === 'tool_use');
    const textBlocks = (resp.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');

    if (toolUses.length === 0) {
      const m = textBlocks.match(/SELECTOR:\s*(.+)/i);
      if (m) {
        healedSel = m[1].trim();
        const ok = await identityMatches(page, healedSel, testid);
        outcome = ok ? 'PASS' : 'FALSE_HEAL';
        diagnosis = ok ? 'identity match' : 'wrong identity';
      } else {
        diagnosis = 'no SELECTOR: line and no tool use';
      }
      break;
    }

    messages.push({ role: 'assistant', content: resp.content });
    const toolResults = [];
    for (const tu of toolUses) {
      try {
        const r = await mcp.callTool({ name: tu.name, arguments: tu.input || {} });
        const text = (r.content || []).map(c => c.type === 'text' ? c.text : JSON.stringify(c)).join('\n').slice(0, 4000);
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: text });
      } catch (e) {
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: 'ERROR: ' + (e.message||''), is_error: true });
      }
    }
    messages.push({ role: 'user', content: toolResults });
    retries++;
  }

  return {
    outcome, healedSel, diagnosis,
    retries, trial_spend_usd: +trialSpend.toFixed(6),
    wall_ms: Date.now() - trialStart,
  };
}

async function main() {
  console.log('Chip C — A1 scaffold smoke (workflow-save-button, DR1, n8n)');
  console.log(`  logs -> ${path.relative(process.cwd(), OUT)}`);

  const model = await resolveModel();

  console.log('  starting Playwright MCP server (stdio, headless, isolated)...');
  const { client: mcp, tools } = await startMCP();
  console.log(`  MCP tools available: ${tools.length}`);

  console.log('  launching baseline Playwright browser...');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  await ctx.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await ctx.newPage();

  let row;
  try {
    await loginIfNeeded(page);
    const applied = await applyDR1(page, 'workflow-save-button');
    if (!applied.ok) throw new Error('could not find workflow-save-button to drift');

    const baselineHits = await page.locator('[data-test-id="workflow-save-button"]').count();
    if (baselineHits === 1) {
      row = { pass: 'A1', element: 'workflow-save-button', drift: 'DR1', path: 'A1', run: 1,
              outcome: 'PASS_NODRIFT', diagnosis: 'baseline resolved without heal', model,
              chip_spend_usd: +CHIP_SPEND.toFixed(6) };
    } else {
      const r = await claudeLoop({
        model, mcp, tools,
        testid: 'workflow-save-button',
        stepDesc: 'Click the Save button on the n8n workflow editor toolbar',
        page,
      });
      row = {
        pass: 'A1', element: 'workflow-save-button', drift: 'DR1', path: 'A1', run: 1,
        outcome: r.outcome, healedSel: r.healedSel, wall_ms: r.wall_ms, diagnosis: r.diagnosis,
        retries: r.retries, trial_spend_usd: r.trial_spend_usd,
        chip_spend_usd: +CHIP_SPEND.toFixed(6),
        model,
      };
    }
  } catch (e) {
    row = { pass: 'A1', element: 'workflow-save-button', drift: 'DR1', path: 'A1', run: 1,
            outcome: 'ERROR', diagnosis: (e.message||String(e)).slice(0, 200),
            chip_spend_usd: +CHIP_SPEND.toFixed(6), model };
  } finally {
    try { await ctx.tracing.stop({ path: path.join(TRACE_DIR, 'a1_smoke.zip') }); } catch {}
    fs.appendFileSync(OUT, JSON.stringify(row) + '\n');
    console.log('\nJSONL row:');
    console.log(JSON.stringify(row));
    console.log(`\nChip-wide Anthropic spend: $${CHIP_SPEND.toFixed(4)}`);
    try { await mcp.close(); } catch {}
    try { await browser.close(); } catch {}
  }
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
