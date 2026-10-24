import { expect, test } from '@playwright/test';

test('built application renders and exposes its first playable goal', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const response = await page.goto('./');
  expect(response?.status()).toBe(200);
  expect(new URL(page.url()).pathname).toBe(process.env.VITE_BASE_PATH ?? '/');
  const favicon = await page.locator('link[rel="icon"]').getAttribute('href');
  expect(favicon).toBe(`${process.env.VITE_BASE_PATH ?? '/'}favicon.svg`);
  const faviconResponse = await page.request.get(favicon!);
  expect(faviconResponse.status()).toBe(200);
  expect(faviconResponse.headers()['content-type']).toContain('image/svg+xml');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('小さな工房から');
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(3);
  const goal = page.getByText('冒険者の派遣 → 素材の回収');
  await expect(goal).toBeHidden();
  await page.getByText('最初のプレイ目標を見る', { exact: true }).click();
  await expect(goal).toBeVisible();
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasOverflow).toBe(false);
  await page.reload();
  await expect(page.getByRole('status')).toContainText('ゲーム機能は次の実装段階');
  expect(errors).toEqual([]);
});
