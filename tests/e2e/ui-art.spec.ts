import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';
import { createGame } from '../../src/game/engine';
import { encodeSave, SAVE_KEY } from '../../src/persistence/save';
import { closeOverlay, equipment, go, settings } from './navigation';

async function open(page: Page, owner = true) {
  await page.clock.install({ time: new Date('2026-10-25T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-25T00:00:01Z'));
  await page.goto('./');
  if (owner)
    await expect(page.getByRole('status')).toContainText(/自動保存|保存済み/);
}

test('room, cauldron and Iris load and the cauldron only lights while a batch is running', async ({
  page,
}) => {
  await open(page);
  for (const name of ['workshop', 'cauldron', 'iris']) {
    const image = page.locator(`[data-art="${name}"] img`).first();
    await expect(image).toBeAttached();
    await expect
      .poll(() =>
        image.evaluate((element) => (element as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
  }
  await expect(page.locator('.cauldron-fire')).toHaveCount(0);
  await equipment(page);
  await page
    .getByRole('button', { name: '自動合成を開始', exact: true })
    .click();
  await page.clock.runFor(100);
  await expect(
    page.getByTestId('equipment-detail').locator('.cauldron-artwork'),
  ).toHaveAttribute('data-active', 'true');
  await page
    .getByRole('button', { name: '次の合成を停止', exact: true })
    .click();
  await expect(page.getByTestId('equipment-detail')).toContainText('仕上げ中');
  await expect(
    page.getByTestId('equipment-detail').locator('.cauldron-fire'),
  ).toHaveCount(1);
  await page.clock.runFor(8_000);
  await expect(page.locator('.cauldron-fire')).toHaveCount(0);
  await expect(page.getByTestId('equipment-detail')).toContainText('停止中');
  await go(page, '店・在庫');
  for (const name of ['herb', 'water', 'potion'])
    await expect(
      page.locator(`#inventory [data-art="${name}"]`),
    ).toHaveAttribute('data-failed', 'false');
});

test('real completion, return, sale and research show their results and a reload replays none', async ({
  page,
}) => {
  await open(page);
  await go(page, '冒険者');
  await page.getByRole('button', { name: 'イリスを雇う', exact: true }).click();
  await page.getByRole('button', { name: 'イリスを派遣', exact: true }).click();
  await equipment(page);
  await page
    .getByRole('button', { name: '自動合成を開始', exact: true })
    .click();
  await closeOverlay(page);
  await page.clock.runFor(8_100);
  await expect(page.locator('[data-feedback="crafted"]')).toContainText(
    '傷薬 +1',
  );
  await expect(page.locator('.craft-pop')).toContainText('+1');
  await page.clock.runFor(6_900);
  await expect(page.locator('[data-feedback="returned"]')).toContainText(
    'イリスが帰還',
  );
  await expect(page.locator('[data-feedback="returned"]')).toContainText(
    '薬草 +4',
  );
  await page.clock.runFor(9_300);
  await go(page, '店・在庫');
  await expect(page.getByTestId('inventory-potion')).toHaveText('3');
  await page.getByRole('button', { name: '傷薬を販売', exact: true }).click();
  await expect(page.locator('[data-feedback="sold"]')).toContainText(
    '金貨 +36',
  );
  await expect(page.getByTestId('gold')).toHaveText('116');
  await go(page, '研究');
  await page
    .getByRole('button', { name: '森の恵みを研究', exact: true })
    .click();
  await expect(page.locator('[data-feedback="researched"]')).toContainText(
    '森の恵み',
  );
  const saved = JSON.parse(
    await page.evaluate((key) => localStorage.getItem(key)!, SAVE_KEY),
  );
  expect(saved).not.toHaveProperty('events');
  expect(saved).not.toHaveProperty('feedback');
  await page.reload();
  await expect(page.locator('.feedback-card')).toHaveCount(0);
  await page.clock.runFor(3_000);
  await expect(page.locator('.feedback-card')).toHaveCount(0);
  await expect(page.getByTestId('gold')).toHaveText('96');
});

test('twenty-four simultaneous completions produce one accurate message and clear when hidden', async ({
  page,
}) => {
  const state = createGame();
  state.inventory.herb = 500;
  state.inventory.water = 250;
  state.equipment = Array.from({ length: 24 }, (_, i) => ({
    id: i + 1,
    kind: 'cauldron',
    x: i % 6,
    y: Math.floor(i / 6),
    recipe: 'potion',
    enabled: true,
    job: null,
  }));
  state.nextEquipmentId = 25;
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    { key: SAVE_KEY, value: encodeSave(state) },
  );
  await open(page);
  await page.clock.runFor(8_100);
  await expect(page.locator('.feedback-card')).toHaveCount(1);
  await expect(page.locator('[data-feedback="crafted"]')).toContainText(
    '傷薬 +24',
  );
  await expect(page.locator('[data-feedback="crafted"]')).toContainText(
    '知識 +24',
  );
  await expect(page.locator('.floor-cell[data-state="working"]')).toHaveCount(
    24,
  );
  await expect(page.locator('.craft-pop')).toHaveCount(1);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.feedback-card')).toHaveCount(0);
  await page.clock.runFor(60_000);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.feedback-card')).toHaveCount(0);
  await go(page, '店・在庫');
  await expect(page.getByTestId('inventory-potion')).toHaveText('24');
});

test('failed artwork retains names, controls, production and selling', async ({
  page,
}) => {
  // A corrupt HTTP-200 image exercises decoding failure without suppressing browser errors.
  await page.route('**/*.webp', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/webp',
      body: 'invalid image payload',
    }),
  );
  await open(page);
  await expect(page.locator('[data-art="workshop"]')).toHaveAttribute(
    'data-failed',
    'true',
  );
  await expect(page.locator('[data-art="iris"]').first()).toHaveAttribute(
    'data-failed',
    'true',
  );
  await equipment(page);
  await expect(
    page.getByTestId('equipment-detail').locator('[data-art="cauldron"]'),
  ).toHaveAttribute('data-failed', 'true');
  await page
    .getByRole('button', { name: '自動合成を開始', exact: true })
    .click();
  await page.clock.runFor(8_100);
  await go(page, '店・在庫');
  await expect(page.getByTestId('inventory-potion')).toHaveText('1');
  await page.getByRole('button', { name: '傷薬を販売', exact: true }).click();
  await expect(page.getByTestId('gold')).toHaveText('112');
});

test('system and manual reduced motion keep results readable with animation disabled', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page);
  await equipment(page);
  await page
    .getByRole('button', { name: '自動合成を開始', exact: true })
    .click();
  await page.clock.runFor(100);
  expect(
    await page
      .locator('.cauldron-liquid i')
      .first()
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('brew-bubble');
  await settings(page);
  await page.getByLabel('動きを控えめにする', { exact: true }).check();
  await closeOverlay(page);
  await expect(page.locator('.app-shell')).toHaveAttribute(
    'data-motion',
    'reduced',
  );
  expect(
    await page
      .locator('.cauldron-liquid i')
      .first()
      .evaluate((element) => getComputedStyle(element).display),
  ).toBe('none');
  await page.clock.runFor(8_000);
  await expect(page.locator('[data-feedback="crafted"]')).toContainText(
    '傷薬 +1',
  );
  expect(
    await page
      .locator('[data-feedback="crafted"]')
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('none');
  await settings(page);
  await page.getByLabel('動きを控えめにする', { exact: true }).uncheck();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(
    page.getByLabel('動きを控えめにする', { exact: true }),
  ).not.toBeChecked();
  await page
    .getByRole('button', { name: '動きを端末の設定に合わせる', exact: true })
    .click();
  await expect(
    page.getByLabel('動きを控えめにする', { exact: true }),
  ).toBeChecked();
});

test('a waiting tab and the next owner never replay another session’s feedback', async ({
  page,
  context,
}) => {
  const state = createGame();
  state.inventory.potion = 3;
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    { key: SAVE_KEY, value: encodeSave(state) },
  );
  await open(page);
  await go(page, '店・在庫');
  await page.getByRole('button', { name: '傷薬を販売', exact: true }).click();
  await expect(page.locator('[data-feedback="sold"]')).toBeVisible();
  const other = await context.newPage();
  await open(other, false);
  await expect(other.getByRole('note')).toContainText('待機中');
  await expect(other.locator('.feedback-card')).toHaveCount(0);
  await page.close();
  await expect(other.getByRole('status')).toContainText(/自動保存|保存済み/);
  await expect(other.getByTestId('gold')).toHaveText('136');
  await expect(other.locator('.feedback-card')).toHaveCount(0);
  await equipment(other);
  await other
    .getByRole('button', { name: '自動合成を開始', exact: true })
    .click();
  await other.clock.runFor(8_100);
  await expect(other.locator('[data-feedback="crafted"]')).toContainText(
    '傷薬 +1',
  );
});
