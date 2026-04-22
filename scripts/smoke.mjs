#!/usr/bin/env node
// Headless smoke test for a deployed or locally-served artifact.
//
// Usage: node scripts/smoke.mjs <url> [selector] [screenshotPath]
// Exits 0 if the page loads cleanly (no console errors, no failed requests,
// <selector> visible, no critical axe-core a11y violations); 1 otherwise.

import { chromium } from 'playwright';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const [url, selector = 'body', screenshotPath = 'smoke.png'] = process.argv.slice(2);
if (!url) {
  console.error('usage: node scripts/smoke.mjs <url> [selector] [screenshotPath]');
  process.exit(2);
}

const ignoredHosts = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const isIgnored = (u) => ignoredHosts.some((h) => u.includes(h));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 420, height: 880 } });
const page = await ctx.newPage();

const consoleErrors = [];
const failedRequests = [];

page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(`PageError: ${err.message}`));
page.on('requestfailed', (req) => {
  if (!isIgnored(req.url())) {
    failedRequests.push(`${req.url()} — ${req.failure()?.errorText ?? 'unknown'}`);
  }
});
page.on('response', (res) => {
  const s = res.status();
  if (s >= 400 && !isIgnored(res.url())) failedRequests.push(`${s} ${res.url()}`);
});

let navError = null;
try {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForSelector(selector, { timeout: 5000, state: 'visible' });
} catch (err) {
  navError = err.message;
}

let criticalA11y = [];
if (!navError) {
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  const results = await page.evaluate(async () => await window.axe.run());
  criticalA11y = results.violations.filter((v) => v.impact === 'critical');
  await page.screenshot({ path: screenshotPath, fullPage: true });
}

await browser.close();

const report = {
  url,
  selector,
  navError,
  consoleErrors,
  failedRequests,
  criticalA11y: criticalA11y.map((v) => ({ id: v.id, help: v.help, nodes: v.nodes.length })),
  screenshot: navError ? null : screenshotPath,
};

const pass =
  !navError &&
  consoleErrors.length === 0 &&
  failedRequests.length === 0 &&
  criticalA11y.length === 0;

console.log(JSON.stringify(report, null, 2));
console.log(pass ? '\n✓ smoke passed' : '\n✗ smoke failed');
process.exit(pass ? 0 : 1);
