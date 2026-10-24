import type { Page } from '@playwright/test';

export async function closeOverlay(page: Page) {
  for (const title of ['設備の詳細', '設定とヘルプ', '工房の記録']) {
    const dialog = page.getByRole('dialog', { name: title, exact: true });
    if (await dialog.isVisible())
      await dialog
        .getByRole('button', { name: `${title}を閉じる`, exact: true })
        .click();
  }
}
export async function go(
  page: Page,
  name: '工房' | '冒険者' | '在庫・販売' | '研究',
) {
  await closeOverlay(page);
  await page
    .getByRole('navigation', { name: '工房のメニュー' })
    .getByRole('button', { name, exact: true })
    .click();
}
export async function equipment(page: Page, name = '調合釜 #1') {
  await go(page, '工房');
  await page.getByRole('button', { name, exact: true }).click();
  return page.getByTestId('equipment-detail');
}
export async function manage(page: Page) {
  const details = page.getByTestId('equipment-detail').locator('details');
  if (
    !(await details.evaluate((element) => (element as HTMLDetailsElement).open))
  )
    await details.locator('summary').click();
}
export async function settings(page: Page) {
  await closeOverlay(page);
  await page.getByRole('button', { name: '設定', exact: true }).click();
}
export async function save(page: Page) {
  await settings(page);
  await page.getByRole('button', { name: '今すぐ保存', exact: true }).click();
  await closeOverlay(page);
}
