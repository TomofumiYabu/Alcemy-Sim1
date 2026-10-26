import type { Page } from '@playwright/test';
import { expect } from './fixtures';
import { createDayGame } from '../../src/game/dayEngine';
import type { DayState } from '../../src/game/dayTypes';
import { validateDayState } from '../../src/persistence/daySave';
import { SAVE_KEY } from '../../src/persistence/save';
import { closeOverlay } from './navigation';
export async function seedRaw(page: Page, raw: string) {
  await page.addInitScript(
    ({ key, raw }) => {
      if (!sessionStorage.getItem('e2e-seeded')) {
        localStorage.setItem(key, raw);
        sessionStorage.setItem('e2e-seeded', 'yes');
      }
    },
    { key: SAVE_KEY, raw },
  );
}
export async function openDay(page: Page, data: DayState = createDayGame(42)) {
  await page.clock.install();
  await seedRaw(page, JSON.stringify(validateDayState(data)));
  await page.goto('');
  await expect(page.locator('.save-state')).toContainText('保存済み');
}
export const readDay = (page: Page): Promise<DayState> =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
export async function runDay(page: Page, close = true) {
  await closeOverlay(page);
  await page.getByRole('button', { name: '1日営業する', exact: true }).click();
  const report = page.getByRole('dialog', { name: /営業日報$/ });
  await expect(report).toBeVisible();
  if (close)
    await report
      .getByRole('button', { name: '翌日の準備へ', exact: true })
      .click();
  return report;
}
export async function rejectWrites(page: Page, key: string) {
  await page.evaluate((key) => {
    const env = window as unknown as { rejectSave: boolean };
    env.rejectSave = true;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (this === localStorage && name === key && env.rejectSave)
        throw new DOMException('quota', 'QuotaExceededError');
      return original.call(this, name, value);
    };
  }, key);
}
export const allowWrites = (page: Page) =>
  page.evaluate(() => {
    (window as unknown as { rejectSave: boolean }).rejectSave = false;
  });
