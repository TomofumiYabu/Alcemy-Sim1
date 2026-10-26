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
const { fresh, rich, dayEncode } = await verificationFixtures();
mkdirSync(root, { recursive: true });
const artifacts = new Map();
const results = {
  commit: options.commit,
  workingTreeDirty: options.workingTreeDirty,
  url,
  transport:
    'HTTP responses fetched by curl with inherited proxy and CA validation, then passed to Chromium at the target origin',
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
    const report = page.getByRole('dialog', { name: /営業日報$/ });
    if (await report.isVisible())
      await report
        .getByRole('button', { name: '翌日の準備へ', exact: true })
        .click();
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
  const read = (p) =>
    p.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      'alcemy-sim-save-v1',
    );
  async function day(p, closeReport = true) {
    await close(p);
    await p.getByRole('button', { name: '1日営業する', exact: true }).click();
    const report = p.getByRole('dialog', { name: /営業日報$/ });
    await expect(report).toBeVisible();
    if (closeReport)
      await report
        .getByRole('button', { name: '翌日の準備へ', exact: true })
        .click();
    return report;
  }
  async function seed(ctx, value) {
    await ctx.addInitScript(
      ({ origin, value }) => {
        if (
          location.origin === origin &&
          !localStorage.getItem('alcemy-sim-save-v1')
        )
          localStorage.setItem('alcemy-sim-save-v1', value);
      },
      { origin, value },
    );
  }
  for (const profile of ['desktop', 'mobile']) {
    const ctx = await context(
      profile === 'desktop'
        ? { viewport: { width: 1440, height: 900 } }
        : { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    );
    await seed(ctx, dayEncode(fresh));
    const p = await ctx.newPage();
    await open(p);
    await expect(p.locator('.save-state')).toHaveText('保存済み');
    const initial = await read(p);
    await p.clock.fastForward(86400000);
    assert.deepEqual(await read(p), initial);
    await go(p, '冒険者');
    await p.getByRole('button', { name: 'イリスを雇う', exact: true }).click();
    await p.getByRole('button', { name: 'イリスを派遣', exact: true }).click();
    await equipment(p);
    await p
      .getByRole('button', { name: '自動合成を開始', exact: true })
      .click();
    await day(p);
    assert.equal((await read(p)).world.inventory.potion, 1);
    await go(p, '店・在庫');
    await p.getByRole('button', { name: '傷薬を棚へ', exact: true }).click();
    await go(p, '冒険者');
    await p.getByRole('button', { name: 'イリスを派遣', exact: true }).click();
    await day(p);
    assert.equal((await read(p)).world.gold, 92);
    await go(p, '研究');
    await p
      .getByRole('button', { name: '森の恵みを研究', exact: true })
      .click();
    await equipment(p);
    const details = p.getByTestId('equipment-detail').locator('details');
    if (!(await details.evaluate((el) => el.open)))
      await details.locator('summary').click();
    await p
      .getByRole('button', { name: 'この設備を移動', exact: true })
      .click();
    await p.getByRole('button', { name: '空きマス 1-1', exact: true }).click();
    await close(p);
    await p
      .getByRole('button', { name: '調合釜を購入・配置', exact: true })
      .click();
    await p.getByRole('button', { name: '空きマス 2-1', exact: true }).click();
    await close(p);
    const saved = await read(p);
    assert.equal(saved.world.gold, 47);
    await p.reload();
    await expect(p.locator('.save-state')).toHaveText('保存済み');
    assert.deepEqual(await read(p), saved);
    await expect(p.locator('.feedback-card')).toHaveCount(0);
    await p
      .locator('[data-art] img')
      .evaluateAll((images) => Promise.all(images.map((img) => img.decode())));
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await p.screenshot({ path: `${root}/${profile}.png` });
    results.checks.push({
      profile,
      loop: true,
      placementAndMove: true,
      restore: true,
      noClockProgress: true,
      noReplay: true,
      artworkDecoded: true,
    });
    if (profile === 'desktop') {
      const other = await ctx.newPage();
      await open(other);
      await expect(other.getByRole('note')).toContainText('待機中');
      await expect(
        other.getByRole('button', { name: '1日営業する', exact: true }),
      ).toBeDisabled();
      await p.close();
      await expect(other.locator('.save-state')).toHaveText('保存済み');
      assert.deepEqual(await read(other), saved);
      results.checks.push({
        profile,
        tabHandoff: true,
        latestDailyState: true,
      });
    }
    await ctx.close();
  }
  {
    const ctx = await context({ viewport: { width: 1366, height: 768 } });
    const legacy = readFileSync(
      new URL('../tests/fixtures/v1-inflight.json', import.meta.url),
      'utf8',
    );
    await seed(ctx, legacy);
    const p = await ctx.newPage();
    await open(p);
    await expect(p.locator('.save-state')).toHaveText('保存済み');
    const before = await read(p);
    assert.equal(before.schemaVersion, 3);
    assert.equal(before.completedDays, 0);
    const backup = await p.evaluate(() => [
      localStorage.getItem('alcemy-sim-save-v1-legacy-backup'),
      localStorage.getItem('alcemy-sim-save-v1-before-day-turn-v3'),
    ]);
    assert.deepEqual(backup, [legacy, legacy]);
    await day(p);
    const after = await read(p);
    assert.ok(after.world.stats.crafted > before.world.stats.crafted);
    assert.equal(after.world.gold, before.world.gold);
    results.checks.push({
      legacyV1: true,
      originalBackup: true,
      dailyMigrationBackup: true,
      restoredJobCompleted: true,
    });
    await ctx.close();
  }
  for (const profile of ['desktop', 'mobile']) {
    const ctx = await context(
      profile === 'desktop'
        ? { viewport: { width: 1366, height: 768 } }
        : { ...devices['Pixel 7'], viewport: { width: 320, height: 740 } },
    );
    await seed(ctx, dayEncode(rich));
    const p = await ctx.newPage();
    await open(p);
    await expect(p.locator('.save-state')).toHaveText('保存済み');
    await equipment(p);
    await p
      .getByRole('button', {
        name: '棚の薬草エキスを倉庫へ戻す →',
        exact: true,
      })
      .click();
    await p
      .getByRole('button', { name: '薬草エキスを倉庫へ', exact: true })
      .click();
    await equipment(p, '蒸留器 #2');
    await p
      .getByRole('button', { name: '自動合成を開始', exact: true })
      .click();
    await day(p);
    await equipment(p, '蒸留器 #2');
    await p
      .getByRole('button', { name: '次の合成を停止', exact: true })
      .click();
    await expect(p.getByTestId('equipment-detail')).toContainText('仕上げ中');
    await day(p);
    assert.ok((await read(p)).world.inventory.extract >= 3);
    await equipment(p);
    await p
      .getByRole('button', { name: '月影の遺跡への派遣を開く →', exact: true })
      .click();
    await expect(p.getByLabel('イリスの探索先')).toHaveValue('ruins');
    await p.getByRole('button', { name: 'イリスを派遣', exact: true }).click();
    await day(p);
    await day(p);
    assert.equal((await read(p)).world.inventory.crystal, 2);
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
    await go(p, '店・在庫');
    await p
      .locator('[data-art] img')
      .evaluateAll((images) => Promise.all(images.map((img) => img.decode())));
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await p.screenshot({ path: `${root}/${profile}-advanced.png` });
    const end = await read(p);
    assert.equal(end.shop.salesTotal, end.world.stats.sold);
    results.checks.push({
      profile,
      storeLevel3: true,
      materialRoutes: true,
      stillFinishing: true,
      ruinsReturn: true,
      preferencesRestored: true,
      noDoubleSales: true,
    });
    await ctx.close();
  }
} finally {
  await browser.close();
}
assert.deepEqual(results.errors, []);
writeFileSync(root + '/result.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
