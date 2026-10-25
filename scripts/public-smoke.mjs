import { verificationFixtures } from './lib/game-fixtures.mjs';
import { verificationOptions } from './lib/verification-options.mjs';
import { chromium, devices, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const run = promisify(execFile);
const options = verificationOptions('public-smoke');
const { origin, url, output: root } = options;
const { advanced: advancedFixture, encode } = await verificationFixtures();
mkdirSync(root, { recursive: true });
const artifacts = new Map();
const results = {
  commit: options.commit,
  workingTreeDirty: options.workingTreeDirty,
  url,
  transport:
    'HTTP responses fetched by curl with inherited proxy and CA validation, then passed to Chromium at the public HTTPS origin',
  artifacts: [],
  checks: [],
  errors: [],
};
const sha = (value) => createHash('sha256').update(value).digest('hex');
async function download(resource) {
  const key = sha(resource).slice(0, 16);
  const bodyPath = `${root}/${key}.body`;
  const headerPath = `${root}/${key}.headers`;
  const { stdout } = await run('curl', [
    '--fail',
    '--silent',
    '--show-error',
    '--location',
    '--compressed',
    '--max-time',
    '30',
    '--header',
    'Cache-Control: no-cache',
    '--dump-header',
    headerPath,
    '--output',
    bodyPath,
    '--write-out',
    '%{http_code}',
    resource,
  ]);
  assert.equal(stdout, '200', resource);
  const body = readFileSync(bodyPath);
  const contentType = [
    ...readFileSync(headerPath, 'utf8').matchAll(/^content-type:\s*(.+)$/gim),
  ]
    .at(-1)?.[1]
    .trim();
  assert.ok(contentType, `Missing content type for ${resource}`);
  const response = { status: 200, body, contentType };
  artifacts.set(new URL(resource).pathname, response);
  results.artifacts.push({
    url: resource,
    status: 200,
    bytes: body.length,
    sha256: sha(body),
    contentType,
  });
  return body;
}
const html = (await download(url)).toString('utf8');
assert.equal(
  sha(Buffer.from(html)),
  sha(readFileSync(`${options.dist}/index.html`)),
  'The served HTML must match the expected build',
);
const resources = [
  ...new Set(
    [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(
      (match) => new URL(match[1], url).href,
    ),
  ),
];
resources.push(
  ...readdirSync(`${options.dist}/assets`)
    .filter((name) => name.endsWith('.webp'))
    .map((name) => url + 'assets/' + name),
);
await Promise.all(
  resources.map(async (resource) => {
    assert.equal(new URL(resource).origin, origin);
    const body = await download(resource);
    const relative = new URL(resource).pathname.slice(
      new URL(url).pathname.length,
    );
    assert.equal(
      sha(body),
      sha(readFileSync(`${options.dist}/${relative}`)),
      'Served file differs from the expected build',
    );
  }),
);
const browser = await chromium.launch({
  executablePath: options.executablePath,
});
try {
  async function context(options) {
    const ctx = await browser.newContext({
      ...options,
      reducedMotion: 'reduce',
    });
    ctx.on('page', (page) => {
      page.on('pageerror', (error) => results.errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') results.errors.push(message.text());
      });
      page.on('requestfailed', (request) =>
        results.errors.push(
          `${request.url()}: ${request.failure()?.errorText}`,
        ),
      );
    });
    await ctx.route(origin + '/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      const response = artifacts.get(path);
      if (!response) {
        results.errors.push('Unexpected public resource: ' + path);
        await route.abort();
        return;
      }
      await route.fulfill(response);
    });
    return ctx;
  }
  async function open(page) {
    await page.clock.install({ time: new Date('2026-10-24T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-24T00:00:01Z'));
    const response = await page.goto(url);
    assert.equal(response.status(), 200);
    await page.bringToFront();
  }
  async function close(page) {
    for (const title of ['設備の詳細', '設定とヘルプ', '工房の記録']) {
      const dialog = page.getByRole('dialog', { name: title, exact: true });
      if (await dialog.isVisible())
        await dialog
          .getByRole('button', { name: title + 'を閉じる', exact: true })
          .click();
    }
  }
  async function go(page, name) {
    await close(page);
    await page
      .getByRole('navigation')
      .getByRole('button', { name, exact: true })
      .click();
  }
  async function equipment(page, name = '調合釜 #1') {
    await go(page, '工房');
    await page.getByRole('button', { name, exact: true }).click();
  }
  async function settings(page) {
    await close(page);
    await page.getByRole('button', { name: '設定', exact: true }).click();
  }
  for (const profile of ['desktop', 'mobile']) {
    const ctx = await context(
      profile === 'desktop'
        ? { viewport: { width: 1440, height: 900 } }
        : { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    );
    const page = await ctx.newPage();
    await open(page);
    await page
      .getByRole('button', { name: '次の一歩を開く', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'イリスを雇う', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'イリスを派遣', exact: true })
      .click();
    await equipment(page);
    await page
      .getByRole('button', { name: '自動合成を開始', exact: true })
      .click();
    await go(page, '研究');
    await page.clock.fastForward(8_100);
    await expect(page.locator('[data-feedback="crafted"]')).toContainText(
      '傷薬 +1',
    );
    await page.clock.fastForward(17_900);
    await expect(page.getByTestId('knowledge')).toHaveText('3');
    await go(page, '在庫・販売');
    await expect(page.getByTestId('inventory-potion')).toHaveText('3');
    await page.getByRole('button', { name: '傷薬を販売', exact: true }).click();
    await expect(page.getByTestId('gold')).toHaveText('116');
    await expect(page.locator('[data-feedback="sold"]')).toContainText(
      '金貨 +36',
    );
    await go(page, '研究');
    await page
      .getByRole('button', { name: '森の恵みを研究', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: '工房の第一歩、達成！' }),
    ).toBeVisible();
    await expect(page.locator('[data-feedback="researched"]')).toContainText(
      '森の恵み',
    );
    await equipment(page);
    await page.getByTestId('equipment-detail').locator('summary').click();
    await page
      .getByRole('button', { name: 'この設備を移動', exact: true })
      .click();
    await page
      .getByRole('button', { name: '空きマス 1-1', exact: true })
      .click();
    await page
      .getByRole('button', { name: '調合釜を購入・配置', exact: true })
      .click();
    await page
      .getByRole('button', { name: '空きマス 2-1', exact: true })
      .click();
    await settings(page);
    await page.getByRole('button', { name: '今すぐ保存', exact: true }).click();
    await close(page);
    await expect(page.getByTestId('gold')).toHaveText('71');
    await page.reload();
    await expect(
      page.getByRole('button', { name: '調合釜 #2', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.feedback-card')).toHaveCount(0);
    await page
      .locator('[data-art] img')
      .evaluateAll((images) => Promise.all(images.map((img) => img.decode())));
    await expect(page.getByTestId('gold')).toHaveText('71');
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({ path: `${root}/${profile}.png`, fullPage: true });
    await go(page, '研究');
    await expect(page.getByTestId('research-gathering-1')).toContainText(
      '研究済み',
    );
    results.checks.push({
      profile,
      loop: true,
      placementAndMove: true,
      restore: true,
      noHorizontalOverflow: true,
      artworkDecoded: true,
      liveFeedback: true,
      noReplay: true,
    });
    if (profile === 'desktop') {
      const other = await ctx.newPage();
      await open(other);
      await expect(other.getByRole('note')).toContainText('待機中');
      await settings(other);
      await expect(
        other.getByRole('button', { name: '今すぐ保存', exact: true }),
      ).toBeDisabled();
      await page.close();
      await expect(
        other.getByRole('button', { name: '今すぐ保存', exact: true }),
      ).toBeEnabled();
      await close(other);
      await expect(other.getByTestId('gold')).toHaveText('71');
      results.checks.push({ profile, tabHandoff: true });
    }
    await ctx.close();
  }
  const legacy = readFileSync('tests/fixtures/v1-inflight.json', 'utf8');
  const ctx = await context({ viewport: { width: 1366, height: 768 } });
  await ctx.addInitScript(
    ({ origin, value }) => {
      if (
        location.origin === origin &&
        !localStorage.getItem('alcemy-sim-save-v1')
      )
        localStorage.setItem('alcemy-sim-save-v1', value);
    },
    { origin, value: legacy },
  );
  const page = await ctx.newPage();
  await open(page);
  await settings(page);
  await page.getByRole('button', { name: '今すぐ保存', exact: true }).click();
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem('alcemy-sim-save-v1-legacy-backup'),
    ),
    legacy,
  );
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('alcemy-sim-save-v1')).schemaVersion,
    ),
    2,
  );
  await close(page);
  await page.reload();
  await go(page, '在庫・販売');
  await page.clock.runFor(5_100);
  await expect(page.getByTestId('inventory-potion')).toHaveText('1');
  await expect(page.getByTestId('knowledge')).toHaveText('1');
  results.checks.push({
    legacyV1: true,
    originalBackup: true,
    restoredJobCompleted: true,
  });
  await ctx.close();
  for (const profile of ['desktop', 'mobile']) {
    const state = advancedFixture;
    const advanced = await context(
      profile === 'desktop'
        ? { viewport: { width: 1366, height: 768 } }
        : { ...devices['Pixel 7'], viewport: { width: 320, height: 740 } },
    );
    await advanced.addInitScript(
      ({ origin, value }) => {
        if (
          location.origin === origin &&
          !localStorage.getItem('alcemy-sim-save-v1')
        )
          localStorage.setItem('alcemy-sim-save-v1', value);
      },
      { origin, value: encode(state) },
    );
    const p = await advanced.newPage();
    await open(p);
    await expect(p.locator('.save-state')).toContainText(/自動保存|保存済み/);
    await equipment(p);
    await p
      .getByRole('button', { name: '蒸留器で薬草エキスを作る →', exact: true })
      .click();
    await expect(
      p.getByTestId('equipment-detail').getByRole('heading'),
    ).toContainText('蒸留器 #2');
    await p
      .getByRole('button', { name: '自動合成を開始', exact: true })
      .click();
    await p.clock.runFor(100);
    await p
      .getByRole('button', { name: '次の合成を停止', exact: true })
      .click();
    await expect(p.getByTestId('equipment-detail')).toContainText('仕上げ中');
    await p.clock.runFor(12000);
    await go(p, '在庫・販売');
    await expect(p.getByTestId('inventory-extract')).toHaveText('1');
    await equipment(p);
    await p
      .getByRole('button', { name: '月影の遺跡への派遣を開く →', exact: true })
      .click();
    await expect(p.getByLabel('イリスの探索先')).toHaveValue('ruins');
    await p.getByRole('button', { name: 'イリスを派遣', exact: true }).click();
    await p.clock.runFor(30000);
    await expect(p.getByTestId('adventurer-iris')).toContainText('待機中');
    await settings(p);
    await p.getByLabel('動きを控えめにする', { exact: true }).check();
    await p.getByLabel('文字の大きさ', { exact: true }).selectOption('largest');
    await p.getByLabel('出来事の音を鳴らす', { exact: true }).check();
    await close(p);
    await p.reload();
    await settings(p);
    await expect(p.getByLabel('文字の大きさ', { exact: true })).toHaveValue(
      'largest',
    );
    await expect(
      p.getByLabel('出来事の音を鳴らす', { exact: true }),
    ).toBeChecked();
    await close(p);
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await go(p, '冒険者');
    await p
      .locator('[data-art] img')
      .evaluateAll((images) => Promise.all(images.map((img) => img.decode())));
    await p.screenshot({
      path: `${root}/${profile}-advanced.png`,
      fullPage: true,
    });
    results.checks.push({
      profile,
      allArtworkDecoded: true,
      stillFinishing: true,
      materialRoutes: true,
      ruinsReturn: true,
      preferencesRestored: true,
    });
    await advanced.close();
  }
} finally {
  await browser.close();
}
assert.deepEqual(results.errors, []);
writeFileSync(root + '/result.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
