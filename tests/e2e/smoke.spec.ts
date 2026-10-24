import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createGame } from '../../src/game/engine';
import { encodeSave, SAVE_KEY } from '../../src/persistence/save';

async function openGame(page: Page) {
  await page.clock.install({ time: new Date('2026-10-24T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-24T00:00:01Z'));
  const response = await page.goto('./');
  expect(response?.status()).toBe(200);
}

test('new workshop completes the real gather-craft-sell-research loop and restores all work', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await openGame(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '今日も、ひとつの発見を',
  );
  expect(new URL(page.url()).pathname).toBe(process.env.VITE_BASE_PATH ?? '/');
  const favicon = await page.locator('link[rel="icon"]').getAttribute('href');
  expect(favicon).toBe(`${process.env.VITE_BASE_PATH ?? '/'}favicon.svg`);
  const faviconResponse = await page.request.get(favicon!);
  expect(faviconResponse.status()).toBe(200);
  expect(faviconResponse.headers()['content-type']).toContain('image/svg+xml');
  await page.getByRole('button', { name: 'イリスを雇う', exact: true }).click();
  await expect(page.getByTestId('gold')).toHaveText('80');
  await page.getByRole('button', { name: 'イリスを派遣', exact: true }).click();
  await page
    .getByRole('button', { name: '自動合成を開始', exact: true })
    .click();
  await page.clock.fastForward(26_000);
  await expect(page.getByTestId('inventory-potion')).toHaveText('3');
  await expect(page.getByTestId('knowledge')).toHaveText('3');
  await expect(page.getByTestId('adventurer-iris')).toContainText('待機中');
  await page.getByRole('button', { name: '傷薬を販売', exact: true }).click();
  await expect(page.getByTestId('gold')).toHaveText('116');
  await page
    .getByRole('button', { name: '森の恵みを研究', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '工房の第一歩、達成！' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'この設備を移動', exact: true })
    .click();
  await page.getByRole('button', { name: '空きマス 1-1', exact: true }).click();
  await page
    .getByRole('button', { name: '調合釜を購入・配置', exact: true })
    .click();
  await page.getByRole('button', { name: '空きマス 2-1', exact: true }).click();
  await expect(page.getByTestId('gold')).toHaveText('71');
  const saved = await page.evaluate(
    (key) => localStorage.getItem(key),
    SAVE_KEY,
  );
  await page.clock.setSystemTime(new Date('2030-01-01T00:00:00Z'));
  await page.reload();
  await expect(page.getByTestId('gold')).toHaveText('71');
  await expect(page.getByTestId('research-gathering-1')).toContainText(
    '研究済み',
  );
  await expect(
    page.getByRole('button', { name: '調合釜 #2', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY),
  ).toBe(saved);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
});

test('placement is atomic and competing machines cannot consume the same materials', async ({
  page,
}) => {
  await openGame(page);
  await page
    .getByRole('button', { name: '調合釜を購入・配置', exact: true })
    .click();
  await page.getByRole('button', { name: '調合釜 #1', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('設備があるマス');
  await expect(page.getByTestId('gold')).toHaveText('100');
  await page.getByRole('button', { name: '空きマス 1-1', exact: true }).click();
  await page
    .getByRole('button', { name: '自動合成を開始', exact: true })
    .click();
  await page.getByRole('button', { name: '調合釜 #1', exact: true }).click();
  await page
    .getByRole('button', { name: '自動合成を開始', exact: true })
    .click();
  await page.clock.fastForward(9_000);
  await expect(page.getByTestId('inventory-potion')).toHaveText('2');
  await expect(page.getByTestId('inventory-herb')).toHaveText('0');
  await expect(page.getByTestId('inventory-water')).toHaveText('0');
  await expect(page.getByTestId('equipment-detail')).toContainText('素材待ち');
  await page.clock.fastForward(30_000);
  await expect(page.getByTestId('inventory-potion')).toHaveText('2');
});

test('corrupt saves are protected until a confirmed reset and the reset is persistent', async ({
  page,
}) => {
  await page.addInitScript((key) => {
    if (localStorage.getItem(key) === null)
      localStorage.setItem(key, '{broken');
  }, SAVE_KEY);
  await openGame(page);
  await expect(page.getByRole('alert')).toContainText('上書きしていません');
  await page.clock.fastForward(60_000);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY),
  ).toBe('{broken');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: '新しい工房を始める' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '新しい工房を始める' }).click();
  await expect(page.getByTestId('gold')).toHaveText('100');
  await page.reload();
  await expect(page.getByTestId('gold')).toHaveText('100');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('storage quota failure is visible and does not stop the current game', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError');
    };
  });
  await openGame(page);
  await page.getByRole('button', { name: 'イリスを雇う', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('保存に失敗');
  await expect(page.getByTestId('gold')).toHaveText('80');
  await expect(page.getByRole('status')).toHaveText('保存に失敗');
  await page.getByRole('button', { name: 'イリスを派遣', exact: true }).click();
  await page.clock.fastForward(15_000);
  await expect(page.getByTestId('inventory-herb')).toHaveText('8');
});

test('research unlocks automation, distillation, the ruins and a sellable mana potion', async ({
  page,
}) => {
  const fixture = createGame();
  fixture.gold = 1000;
  fixture.knowledge = 100;
  fixture.inventory.herb = 30;
  fixture.inventory.water = 20;
  fixture.inventory.crystal = 4;
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    { key: SAVE_KEY, value: encodeSave(fixture) },
  );
  await openGame(page);
  for (const name of [
    '森の恵み',
    '帰り道の約束',
    '月影への地図',
    '火加減の心得',
    '蒸留の技法',
    '淀みなき調合',
    '観察の手帳',
    '魔力を結ぶ式',
    '工房の名声',
  ]) {
    await page
      .getByRole('button', { name: `${name}を研究`, exact: true })
      .click();
  }
  await page
    .getByRole('button', { name: 'ローワンを雇う', exact: true })
    .click();
  await page
    .getByRole('combobox', { name: 'ローワンの探索先' })
    .selectOption('ruins');
  await page.getByLabel('ローワンの自動再派遣', { exact: true }).check();
  await page
    .getByRole('button', { name: 'ローワンを派遣', exact: true })
    .click();
  await page
    .getByRole('combobox', { name: '合成するレシピ' })
    .selectOption('mana');
  await page
    .getByRole('button', { name: '自動合成を開始', exact: true })
    .click();
  await page
    .getByRole('button', { name: '蒸留器を購入・配置', exact: true })
    .click();
  await page.getByRole('button', { name: '空きマス 1-1', exact: true }).click();
  await page
    .getByRole('button', { name: '自動合成を開始', exact: true })
    .click();
  await page.clock.fastForward(31_000);
  await expect(page.getByTestId('inventory-mana')).toHaveText('1');
  await expect(page.getByTestId('adventurer-rowan')).toContainText('探索中');
  await page.getByRole('button', { name: '魔力薬を販売', exact: true }).click();
  await expect(page.getByTestId('gold')).toHaveText('543');
  await page.reload();
  await expect(page.getByTestId('research-knowledge-3')).toContainText(
    '研究済み',
  );
  await expect(
    page.getByRole('button', { name: '蒸留器 #2', exact: true }),
  ).toBeVisible();
});

test('hidden time is not added when returning to the workshop', async ({
  page,
}) => {
  await openGame(page);
  await page.getByRole('button', { name: 'イリスを雇う', exact: true }).click();
  await page.getByRole('button', { name: 'イリスを派遣', exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(240_000);
  await expect(page.getByTestId('inventory-herb')).toHaveText('4');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(15_000);
  await expect(page.getByTestId('inventory-herb')).toHaveText('8');
});
