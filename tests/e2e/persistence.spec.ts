import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures';
import { createDayGame, applyDayCommand } from '../../src/game/dayEngine';
import { SAVE_KEY, LEGACY_BACKUP_KEY } from '../../src/persistence/save';
import { DAY_BACKUP_KEY } from '../../src/persistence/daySave';
import {
  openDay,
  seedRaw,
  readDay,
  runDay,
  rejectWrites,
  allowWrites,
} from './day-helpers';
import { closeOverlay, go } from './navigation';

test('only the owner settles; the next tab resumes the same saved report', async ({
  page,
  context,
}) => {
  await openDay(page);
  await runDay(page, false);
  const first = await readDay(page);
  const waiter = await context.newPage();
  await waiter.goto(page.url());
  await expect(
    waiter.getByText('別のタブで工房が開かれています。', { exact: false }),
  ).toBeVisible();
  await expect(
    waiter.getByRole('button', { name: '1日営業する', exact: true }),
  ).toBeDisabled();
  expect(await readDay(waiter)).toEqual(first);
  await page.close();
  await expect(waiter.getByRole('dialog', { name: /営業日報$/ })).toBeVisible();
  expect(await readDay(waiter)).toEqual(first);
  await closeOverlay(waiter);
  await runDay(waiter, false);
  expect((await readDay(waiter)).completedDays).toBe(2);
});

test('pagehide and reload preserve exact work and an unacknowledged daily report', async ({
  page,
}) => {
  const s = createDayGame(42);
  s.world.equipment[0]!.enabled = true;
  await openDay(page, s);
  await runDay(page, false);
  const report = await readDay(page);
  await page.clock.fastForward(24 * 60 * 60 * 1000);
  expect(await readDay(page)).toEqual(report);
  await page.reload();
  await expect(page.getByRole('dialog', { name: /営業日報$/ })).toBeVisible();
  expect(await readDay(page)).toEqual(report);
  await closeOverlay(page);
  const acknowledged = await readDay(page);
  await page.reload();
  await expect(
    page.getByRole('dialog', { name: /営業日報$/ }),
  ).not.toBeVisible();
  expect(await readDay(page)).toEqual(acknowledged);
});

test('pageshow reacquires ownership without advancing days or losing prepared stock', async ({
  page,
}) => {
  const s = createDayGame(42);
  s.world.inventory.potion = 2;
  await openDay(page, s);
  await go(page, '店・在庫');
  await page.getByRole('button', { name: '傷薬を棚へ', exact: true }).click();
  const prepared = await readDay(page);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
  await expect(page.locator('.save-state')).toHaveText('保存済み');
  expect(await readDay(page)).toEqual(prepared);
  await runDay(page);
  expect((await readDay(page)).completedDays).toBe(1);
});

test('unavailable Web Locks prevent all game writes and daily settlement', async ({
  page,
}) => {
  const raw = JSON.stringify(createDayGame(42));
  await seedRaw(page, raw);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'locks', { get: () => undefined }),
  );
  await page.goto('');
  await expect(
    page.getByText('このブラウザーでは保存の排他制御が利用できません。', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '1日営業する', exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY),
  ).toBe(raw);
});

test('fixed v1 is backed up before migration and its old jobs complete exactly once', async ({
  page,
}) => {
  const raw = readFileSync(
      new URL('../fixtures/v1-inflight.json', import.meta.url),
      'utf8',
    ),
    old = JSON.parse(raw);
  await page.clock.install();
  await seedRaw(page, raw);
  await page.goto('');
  await expect(page.locator('.save-state')).toHaveText('保存済み');
  const migrated = await readDay(page);
  expect(migrated.schemaVersion).toBe(3);
  expect(migrated.world.inventory).toEqual(old.inventory);
  expect(migrated.world.equipment[0]!.job!.remaining).toBe(
    old.equipment[0].job.remaining,
  );
  const backups = await page.evaluate(
    ({ a, b }) => [localStorage.getItem(a), localStorage.getItem(b)],
    { a: LEGACY_BACKUP_KEY, b: DAY_BACKUP_KEY },
  );
  expect(backups).toEqual([raw, raw]);
  await runDay(page, false);
  const end = await readDay(page);
  expect(end.world.stats.crafted).toBeGreaterThan(old.stats.crafted);
  expect(end.world.stats.expeditions).toBeGreaterThan(old.stats.expeditions);
  expect(end.world.gold).toBe(old.gold);
  expect(end.completedDays).toBe(1);
  await page.reload();
  expect(await readDay(page)).toEqual(end);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), DAY_BACKUP_KEY),
  ).toBe(raw);
});

test('migration backup failure preserves the original v2 and succeeds after retry', async ({
  page,
}) => {
  const raw = readFileSync(
    new URL('../fixtures/v2-inflight.json', import.meta.url),
    'utf8',
  );
  await page.clock.install();
  await seedRaw(page, raw);
  await page.addInitScript((key) => {
    const env = window as unknown as { rejectSave: boolean };
    env.rejectSave = true;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (this === localStorage && name === key && env.rejectSave)
        throw new DOMException('quota', 'QuotaExceededError');
      return original.call(this, name, value);
    };
  }, DAY_BACKUP_KEY);
  await page.goto('');
  await expect(page.getByRole('alert')).toContainText('保存に失敗');
  expect(
    await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY),
  ).toBe(raw);
  await allowWrites(page);
  await page.getByRole('button', { name: '保存を再試行', exact: true }).click();
  await expect(page.locator('.save-state')).toHaveText('保存済み');
  expect((await readDay(page)).schemaVersion).toBe(3);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), DAY_BACKUP_KEY),
  ).toBe(raw);
});

test('failed daily save and failed report acknowledgement keep assets and retries consistent', async ({
  page,
}) => {
  const data = createDayGame(42);
  data.world.inventory.potion = 4;
  await openDay(
    page,
    applyDayCommand(data, { type: 'stock', item: 'potion', amount: 4 }).state,
  );
  const before = await readDay(page),
    command = {
      type: 'finish-day' as const,
      completedDays: before.completedDays,
      revision: before.revision,
    };
  const expected = applyDayCommand(before, command).state;
  await rejectWrites(page, SAVE_KEY);
  await page.getByRole('button', { name: '1日営業する', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('保存に失敗');
  expect(await readDay(page)).toEqual(before);
  await expect(
    page.getByRole('dialog', { name: /営業日報$/ }),
  ).not.toBeVisible();
  await allowWrites(page);
  await runDay(page, false);
  expect(await readDay(page)).toEqual(expected);
  await rejectWrites(page, SAVE_KEY);
  await page.getByRole('button', { name: '翌日の準備へ', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /営業日報$/ })).toBeVisible();
  await expect(
    page.getByRole('dialog', { name: /営業日報$/ }).getByRole('alert'),
  ).toContainText('保存に失敗');
  expect(await readDay(page)).toEqual(expected);
  await allowWrites(page);
  await closeOverlay(page);
  expect((await readDay(page)).completedDays).toBe(1);
  expect((await readDay(page)).shop.salesTotal).toBe(expected.shop.salesTotal);
});
