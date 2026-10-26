import { test, expect } from './fixtures';
import { createDayGame, applyDayCommand } from '../../src/game/dayEngine';
import { researchIds } from '../../src/game/types';
import { openDay, readDay, runDay } from './day-helpers';
import { closeOverlay, equipment, go } from './navigation';

test('daily shop preserves time while preparing and completes a shelf-customer-research loop', async ({
  page,
}) => {
  await openDay(page);
  const initial = await readDay(page);
  await page.clock.fastForward(3 * 24 * 60 * 60 * 1000);
  expect(await readDay(page)).toEqual(initial);
  await go(page, '冒険者');
  await page.getByRole('button', { name: 'イリスを雇う' }).click();
  await page.getByRole('button', { name: 'イリスを派遣', exact: true }).click();
  await equipment(page);
  await page
    .getByRole('button', { name: '自動合成を開始', exact: true })
    .click();
  await runDay(page, false);
  await expect(page.getByTestId('day-report')).toContainText('売上 0金貨');
  const first = await readDay(page);
  expect(first.completedDays).toBe(1);
  expect(first.world.inventory.potion).toBe(1);
  expect(first.world.equipment[0]!.job?.remaining).toBe(10);
  await closeOverlay(page);
  await go(page, '店・在庫');
  await expect(page.getByTestId('inventory-potion')).toHaveText('1');
  await page.getByRole('button', { name: '傷薬を棚へ', exact: true }).click();
  await expect(page.getByTestId('display-potion')).toHaveText('1');
  await go(page, '冒険者');
  await page.getByRole('button', { name: 'イリスを派遣', exact: true }).click();
  await runDay(page, false);
  const second = await readDay(page);
  expect(second.world.stats.crafted).toBe(3);
  expect(second.world.inventory.potion).toBe(2);
  expect(second.shop.salesTotal).toBe(1);
  expect(second.world.gold).toBe(92);
  await closeOverlay(page);
  await go(page, '研究');
  await page
    .getByRole('button', { name: '森の恵みを研究', exact: true })
    .click();
  expect((await readDay(page)).world.gold).toBe(72);
  await page.reload();
  expect((await readDay(page)).world.research).toContain('gathering-1');
  await expect(page.getByTestId('day-label')).toContainText('第3日 準備中');
});

test('manufacturing reserve and physical shelves cannot consume or sell the same extract', async ({
  page,
}) => {
  const data = createDayGame(42);
  data.world.research = [...researchIds];
  data.shop.shelves = [];
  data.world.inventory.extract = 3;
  await openDay(page, data);
  await go(page, '店・在庫');
  await page.getByLabel('薬草エキスを移す数量', { exact: true }).fill('2');
  await expect(
    page.getByRole('button', { name: '薬草エキスを棚へ', exact: true }),
  ).toBeDisabled();
  await page.getByLabel('薬草エキスを移す数量', { exact: true }).fill('1');
  await page
    .getByRole('button', { name: '薬草エキスを棚へ', exact: true })
    .click();
  expect((await readDay(page)).world.inventory.extract).toBe(2);
  await runDay(page);
  const end = await readDay(page);
  expect(end.world.inventory.extract).toBe(2);
  expect(end.shop.salesTotal).toBe(end.world.stats.sold);
  await go(page, '店・在庫');
  if (end.shop.shelves[0]!.quantity)
    await page
      .getByRole('button', { name: '薬草エキスを倉庫へ', exact: true })
      .click();
  await page
    .getByRole('button', { name: '薬草エキスの棚枠を空ける', exact: true })
    .click();
  expect((await readDay(page)).shop.shelves).toEqual([]);
});

test('repeated day clicks and report reopening never settle a second day', async ({
  page,
}) => {
  const data = createDayGame(42);
  data.world.inventory.potion = 4;
  const stocked = applyDayCommand(data, {
    type: 'stock',
    item: 'potion',
    amount: 4,
  }).state;
  await openDay(page, stocked);
  await page
    .getByRole('button', { name: '1日営業する', exact: true })
    .evaluate((el: HTMLButtonElement) => {
      el.click();
      el.click();
    });
  await expect(page.getByRole('dialog', { name: /営業日報$/ })).toBeVisible();
  const settled = await readDay(page);
  expect(settled.completedDays).toBe(1);
  expect(settled.shop.salesTotal).toBe(
    settled.lastReport!.customers.filter((c) => c.reason === 'purchased')
      .length,
  );
  await page.reload();
  expect(await readDay(page)).toEqual(settled);
  await closeOverlay(page);
  const acknowledged = await readDay(page);
  await page.getByRole('button', { name: '前回の日報', exact: true }).click();
  await page
    .getByRole('dialog', { name: /営業日報$/ })
    .getByRole('button', { name: '閉じる', exact: true })
    .click();
  expect(await readDay(page)).toEqual(acknowledged);
});

test('material guidance returns displayed extract to the warehouse before manufacturing can use it', async ({
  page,
}) => {
  const data = createDayGame(42);
  data.world.research = [...researchIds];
  data.world.equipment[0]!.recipe = 'mana';
  data.world.inventory.crystal = 1;
  data.shop.shelves = [{ item: 'extract', quantity: 1 }];
  await openDay(page, data);
  const before = await readDay(page);
  await equipment(page);
  await page
    .getByRole('button', { name: '棚の薬草エキスを倉庫へ戻す →', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '薬草エキスを倉庫へ', exact: true }),
  ).toBeFocused();
  expect(await readDay(page)).toEqual(before);
  await page
    .getByRole('button', { name: '薬草エキスを倉庫へ', exact: true })
    .click();
  expect((await readDay(page)).world.inventory.extract).toBe(1);
  await equipment(page);
  await page
    .getByRole('button', { name: '自動合成を開始', exact: true })
    .click();
  await runDay(page);
  const working = await readDay(page);
  expect(working.world.inventory.extract).toBe(0);
  expect(working.shop.shelves[0]!.quantity).toBe(0);
  expect(working.world.equipment[0]!.job?.remaining).toBe(10);
  await runDay(page);
  expect((await readDay(page)).world.inventory.mana).toBe(1);
});
