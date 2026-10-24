import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';
import { SAVE_KEY } from '../../src/persistence/save';
import { LEGACY_BACKUP_KEY } from '../../src/persistence/save';
import { readFileSync } from 'node:fs';

async function open(page: Page) {
  await page.clock.install({ time: new Date('2026-10-24T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-24T00:00:01Z'));
  await page.goto('./');
}
async function saved(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
}

test('only one tab can change or save progress and the next owner reloads the latest state', async ({ page, context }) => {
  await open(page);
  await expect(page.getByRole('button', { name: 'イリスを雇う', exact: true })).toBeEnabled();
  const other = await context.newPage(); await open(other);
  await expect(other.getByRole('note')).toContainText('待機中');
  await expect(other.getByRole('button', { name: '今すぐ保存', exact: true })).toBeDisabled();
  await expect(other.getByRole('button', { name: '工房を初期化', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'イリスを雇う', exact: true }).click();
  await page.getByRole('button', { name: 'イリスを派遣', exact: true }).click();
  await page.clock.runFor(5_000);
  await expect(other.getByTestId('gold')).toHaveText('80');
  // A waiting page's timers and visibility handlers must never overwrite the owner.
  await other.clock.fastForward(10_000);
  await other.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  expect((await saved(other)).gold).toBe(80);
  await page.close();
  await expect(other.getByRole('button', { name: '今すぐ保存', exact: true })).toBeEnabled();
  await expect(other.getByTestId('gold')).toHaveText('80');
  await other.getByRole('button', { name: '今すぐ保存', exact: true }).click();
  expect((await saved(other)).adventurers[0].hired).toBe(true);
  const third = await context.newPage(); await open(third);
  await expect(third.getByRole('button', { name: '工房を初期化', exact: true })).toBeDisabled();
  other.once('dialog', (dialog) => dialog.accept());
  await other.getByRole('button', { name: '工房を初期化', exact: true }).click();
  await other.close();
  await expect(third.getByRole('button', { name: '今すぐ保存', exact: true })).toBeEnabled();
  await expect(third.getByTestId('gold')).toHaveText('100');
  await expect(third.getByRole('button', { name: 'イリスを雇う', exact: true })).toBeEnabled();
});

test('autosave records elapsed work and pagehide saves the latest remaining time before restore', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'イリスを雇う', exact: true }).click();
  await page.getByRole('button', { name: 'イリスを派遣', exact: true }).click();
  await page.getByRole('button', { name: '自動合成を開始', exact: true }).click();
  await page.clock.runFor(5_300);
  expect((await saved(page)).tick).toBe(50);
  await page.reload();
  await expect(page.getByRole('button', { name: '今すぐ保存', exact: true })).toBeEnabled();
  const restored = await saved(page);
  expect(restored.tick).toBe(53);
  expect(restored.equipment[0].job.remaining).toBe(28);
  expect(restored.adventurers[0].trip.remaining).toBe(97);
  await page.clock.runFor(2_800);
  await expect(page.getByTestId('inventory-potion')).toHaveText('1');
  await page.clock.runFor(6_900);
  await expect(page.getByTestId('adventurer-iris')).toContainText('待機中');
});

test('a restored page can reacquire ownership after pagehide without a stale clock', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'イリスを雇う', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect(page.getByRole('button', { name: '今すぐ保存', exact: true })).toBeDisabled();
  await page.clock.fastForward(60_000);
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
  await expect(page.getByRole('button', { name: 'イリスを派遣', exact: true })).toBeEnabled();
  expect((await saved(page)).tick).toBe(0);
  await expect(page.getByTestId('gold')).toHaveText('80');
});

test('unavailable Web Locks cannot silently fall back to unprotected writes', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'locks', { get: () => undefined }));
  await open(page);
  await expect(page.getByRole('note')).toContainText('排他制御が利用できません');
  await expect(page.getByRole('button', { name: 'イリスを雇う', exact: true })).toBeDisabled();
  await page.clock.fastForward(60_000);
  expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY)).toBeNull();
});

test('the released v1 save is migrated with a backup and its old work continues', async ({ page }) => {
  const legacy = readFileSync(new URL('../fixtures/v1-inflight.json', import.meta.url), 'utf8');
  await page.addInitScript(({ key, value }) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, value); }, { key: SAVE_KEY, value: legacy });
  await open(page);
  await expect(page.getByRole('button', { name: '今すぐ保存', exact: true })).toBeEnabled();
  await expect(page.getByTestId('gold')).toHaveText('80');
  await page.getByRole('button', { name: '今すぐ保存', exact: true }).click();
  expect((await saved(page)).schemaVersion).toBe(2);
  expect(await page.evaluate((key) => localStorage.getItem(key), LEGACY_BACKUP_KEY)).toBe(legacy);
  await page.reload();
  await expect(page.getByRole('button', { name: '今すぐ保存', exact: true })).toBeEnabled();
  await page.clock.runFor(5_100);
  await expect(page.getByTestId('inventory-potion')).toHaveText('1');
  await expect(page.getByTestId('knowledge')).toHaveText('1');
});
