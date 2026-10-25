import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verificationFixtures } from './lib/game-fixtures.mjs';
import { verificationOptions } from './lib/verification-options.mjs';
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const options = verificationOptions('benchmark');
const { key, benchmark, encode } = await verificationFixtures();
const fixture = { key, value: encode(benchmark), origin: options.origin };
const browser = await chromium.launch({
  executablePath: options.executablePath,
});
try {
  const errors = [];
  const page = await browser.newPage({
    viewport: { width: 1366, height: 768 },
    reducedMotion: 'no-preference',
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('requestfailed', (request) => errors.push(request.url()));
  await page.addInitScript(({ key, value, origin }) => {
    if (location.origin === origin && !localStorage.getItem(key))
      localStorage.setItem(key, value);
  }, fixture);
  const response = await page.goto(options.url);
  const hash = (value) => createHash('sha256').update(value).digest('hex');
  assert.equal(
    hash(await response.body()),
    hash(readFileSync(`${options.dist}/index.html`)),
    'Measured HTML differs from the expected build',
  );
  await page
    .locator('[data-art] img')
    .evaluateAll((images) => Promise.all(images.map((img) => img.decode())));
  await page.bringToFront();
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.floor-cell[data-state="working"]').length ===
      24,
  );
  const navigation = await page.evaluate(async () => {
    const samples = [];
    for (let i = 0; i < 20; i++) {
      const name = i % 2 ? 'workshop' : 'inventory';
      const before = performance.now();
      document.querySelector(`[aria-controls="view-${name}"]`).click();
      await new Promise(requestAnimationFrame);
      samples.push({
        ms: performance.now() - before,
        rendered: !document.querySelector(`#view-${name}`).hidden,
      });
    }
    return samples;
  });
  await page.waitForFunction(
    () =>
      Number(document.querySelector('[data-testid="knowledge"]').textContent) >=
      24,
    {},
    { timeout: 15000 },
  );
  await page
    .getByRole('navigation')
    .getByRole('button', { name: '工房', exact: true })
    .click();
  await page.screenshot({
    path: `${options.output}/workshop.png`,
    fullPage: true,
  });
  const runtime = await page.evaluate(() => ({
    products: {
      potion: Number(
        document
          .querySelector('[data-testid="inventory-potion"]')
          .textContent.replaceAll(',', ''),
      ),
      extract: Number(
        document
          .querySelector('[data-testid="inventory-extract"]')
          .textContent.replaceAll(',', ''),
      ),
    },
    active: document.querySelectorAll('.floor-cell[data-state="working"]')
      .length,
    knowledge: document.querySelector('[data-testid="knowledge"]').textContent,
    feedbackCount: document.querySelectorAll('.feedback-card').length,
    feedback: document.querySelector('.feedback-feed').textContent,
    latestResultCount: document.querySelectorAll('.latest-result').length,
    latestResult: document.querySelector('.latest-result').textContent,
    transfer: performance.getEntriesByType('resource').map((r) => ({
      name: r.name.split('/').at(-1),
      transferSize: r.transferSize,
      encoded: r.encodedBodySize,
    })),
    documentTransfer: performance.getEntriesByType('navigation').map((r) => ({
      transferSize: r.transferSize,
      encoded: r.encodedBodySize,
      domContentLoadedMs: r.domContentLoadedEventEnd,
    })),
  }));
  const sizes = [
    `${options.dist}/index.html`,
    ...readdirSync(`${options.dist}/assets`).map(
      (x) => `${options.dist}/assets/` + x,
    ),
  ].map((path) => ({
    path,
    raw: statSync(path).size,
    gzip: gzipSync(readFileSync(path)).length,
  }));
  const times = navigation.map((x) => x.ms).sort((a, b) => a - b);
  assert.equal(runtime.active, 24);
  assert.ok(Number(runtime.knowledge) >= 24);
  assert.ok(runtime.products.potion >= 12 && runtime.products.extract >= 12);
  assert.ok(runtime.feedbackCount <= 2);
  assert.deepEqual(errors, []);
  assert.ok(navigation.every((x) => x.rendered));
  const result = {
    commit: options.commit,
    workingTreeDirty: options.workingTreeDirty,
    url: options.url,
    buildHTMLSha256: hash(readFileSync(`${options.dist}/index.html`)),
    browser: browser.version(),
    conditions: {
      viewport: { width: 1366, height: 768 },
      motion: 'full',
      cache: 'fresh browser context',
      measurement:
        'navigation handler click to next requestAnimationFrame, 20 samples',
    },
    scenario:
      'Cloud Chromium / production Pages path / 1366x768 / 12 cauldrons + 12 stills',
    navigation: {
      samples: times.length,
      allRendered: navigation.every((x) => x.rendered),
      meanMs: times.reduce((a, b) => a + b) / times.length,
      p95Ms: times[Math.ceil(times.length * 0.95) - 1],
      maxMs: times.at(-1),
    },
    runtime,
    sizes,
    errors,
  };
  writeFileSync(
    `${options.output}/result.json`,
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
