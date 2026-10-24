import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';
import { createGame } from '../../src/game/engine';
import { encodeSave, SAVE_KEY } from '../../src/persistence/save';
import { closeOverlay, equipment, go } from './navigation';

async function open(page: Page) {
  await page.clock.install({ time: new Date('2026-10-24T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-24T00:00:01Z'));
  await page.goto('./');
}
async function keyboardActivate(page: Page, name: string) {
  const target = page.getByRole('button', { name, exact: true });
  for (let index = 0; index < 80; index++) {
    if (
      await target.evaluate((element) => element === document.activeElement)
    ) {
      await page.keyboard.press('Enter');
      return;
    }
    await page.keyboard.press('Tab');
  }
  throw new Error(`Keyboard could not reach ${name}`);
}

test('target viewports keep the HUD and navigation visible with usable workshop cells', async ({
  page,
  isMobile,
}) => {
  await open(page);
  for (const [width, height] of isMobile
    ? [
        [390, 844],
        [320, 740],
      ]
    : [
        [1440, 900],
        [1366, 768],
      ]) {
    await page.setViewportSize({ width: width!, height: height! });
    await expect(page.getByTestId('gold')).toBeInViewport();
    await expect(page.getByRole('navigation')).toBeInViewport();
    await expect(
      page.getByRole('button', { name: '次の一歩を開く' }),
    ).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width!);
    const cells = await page.locator('.floor-cell').evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }),
    );
    expect(cells.every((cell) => cell.width >= 44 && cell.height >= 44)).toBe(
      true,
    );
    if (!isMobile) {
      await expect(page.locator('.workshop-floor')).toBeInViewport({
        ratio: 1,
      });
      await expect(
        page.getByRole('button', { name: '自動合成を開始', exact: true }),
      ).toBeInViewport({ ratio: 1 });
    }
    for (const name of ['冒険者', '在庫・販売', '研究', '工房'] as const) {
      await go(page, name);
      await expect(
        page.getByRole('navigation').getByRole('button', { name, exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      await expect(
        page.getByRole('main').locator('.screen:visible'),
      ).toHaveCount(1);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width!);
    }
  }
});

test('guidance leads to hire, dispatch and crafting and the detail sheet returns focus', async ({
  page,
  isMobile,
}) => {
  await open(page);
  await page.getByRole('button', { name: '次の一歩を開く' }).click();
  await expect(
    page.getByRole('button', { name: 'イリスを雇う', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.quest')).toContainText('森へ派遣');
  await page.getByRole('button', { name: '次の一歩を開く' }).click();
  await expect(
    page.getByRole('button', { name: 'イリスを派遣', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.quest')).toContainText('帰還まであと');
  await page.getByRole('button', { name: '次の一歩を開く' }).click();
  await expect(
    page.getByRole('button', { name: '自動合成を開始', exact: true }),
  ).toBeVisible();
  if (isMobile) {
    await expect(
      page.getByRole('dialog', { name: '設備の詳細', exact: true }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await equipment(page);
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('button', { name: '調合釜 #1', exact: true }),
    ).toBeFocused();
  }
});

test('keyboard alone completes the first loop, places and moves machines, and cancels placement', async ({
  page,
  isMobile,
}) => {
  await open(page);
  await keyboardActivate(page, '次の一歩を開く');
  await expect(
    page.getByRole('button', { name: 'イリスを雇う', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await keyboardActivate(page, 'イリスを派遣');
  await keyboardActivate(page, '工房');
  await keyboardActivate(page, '調合釜 #1');
  await keyboardActivate(page, '自動合成を開始');
  if (isMobile) await page.keyboard.press('Escape');
  await keyboardActivate(page, '研究');
  await page.clock.fastForward(26_000);
  await keyboardActivate(page, '在庫・販売');
  await keyboardActivate(page, '傷薬を販売');
  await keyboardActivate(page, '研究');
  await keyboardActivate(page, '森の恵みを研究');
  await expect(
    page.getByRole('heading', { name: '工房の第一歩、達成！' }),
  ).toBeVisible();
  await keyboardActivate(page, '工房');
  await keyboardActivate(page, '調合釜を購入・配置');
  await expect(
    page.getByRole('button', { name: '調合釜 #1', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  if (isMobile) await page.keyboard.press('Escape');
  await expect(page.getByTestId('gold')).toHaveText('71');
  // Buying again then cancelling must not spend money.
  await keyboardActivate(page, '調合釜を購入・配置');
  await page.keyboard.press('Escape');
  await expect(page.getByText(/の配置先を選択/)).toHaveCount(0);
  await expect(page.getByTestId('gold')).toHaveText('71');
  // Reopen #2 from its current grid position and expand management with Enter.
  await page.keyboard.press('Enter');
  const summary = page.getByTestId('equipment-detail').locator('summary');
  for (let index = 0; index < 20; index++) {
    if (await summary.evaluate((element) => element === document.activeElement))
      break;
    await page.keyboard.press('Tab');
  }
  await expect(summary).toBeFocused();
  await page.keyboard.press('Enter');
  await keyboardActivate(page, 'この設備を移動');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  const moved = await page.evaluate(
    (key) =>
      JSON.parse(localStorage.getItem(key)!).equipment.find(
        (entry: { id: number }) => entry.id === 2,
      ),
    SAVE_KEY,
  );
  expect(moved).toMatchObject({ x: 0, y: 0 });
});

test('200 percent text remains operable and each screen keeps its scroll position', async ({
  page,
  isMobile,
}) => {
  await page.setViewportSize(
    isMobile ? { width: 320, height: 740 } : { width: 1366, height: 768 },
  );
  await open(page);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  for (const name of ['冒険者', '在庫・販売', '研究', '工房'] as const) {
    await go(page, name);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await expect(
      page.getByRole('heading', {
        name:
          name === '冒険者'
            ? '冒険者ギルド'
            : name === '在庫・販売'
              ? '在庫と販売'
              : name === '研究'
                ? '錬金術の研究'
                : '錬金術工房',
        exact: true,
      }),
    ).toBeVisible();
  }
  await equipment(page);
  await page
    .getByRole('button', { name: '自動合成を開始', exact: true })
    .click();
  await closeOverlay(page);
  await go(page, '研究');
  const research = page.locator('#view-research');
  await research.evaluate((element) => {
    element.scrollTop = 600;
  });
  const before = await research.evaluate((element) => element.scrollTop);
  expect(before).toBeGreaterThan(0);
  await go(page, '工房');
  await go(page, '研究');
  expect(await research.evaluate((element) => element.scrollTop)).toBe(before);
});

test('waiting tabs can inspect and close equipment details without changing the game', async ({
  page,
  context,
}) => {
  await open(page);
  await expect(page.getByRole('status')).toContainText(/自動保存|保存済み/);
  const other = await context.newPage();
  await open(other);
  await expect(other.getByRole('note')).toContainText('待機中');
  await equipment(other);
  await expect(
    other.getByRole('button', { name: '自動合成を開始', exact: true }),
  ).toBeDisabled();
  await closeOverlay(other);
  await go(other, '研究');
  await expect(
    other.getByRole('button', { name: '森の恵みを研究', exact: true }),
  ).toBeDisabled();
});

test('stopping a batch shows finishing and a missing-material route opens expeditions', async ({
  page,
}) => {
  const state = createGame();
  state.inventory.herb = 2;
  state.inventory.water = 1;
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    { key: SAVE_KEY, value: encodeSave(state) },
  );
  await open(page);
  await equipment(page);
  await page
    .getByRole('button', { name: '自動合成を開始', exact: true })
    .click();
  await page.clock.runFor(100);
  await page
    .getByRole('button', { name: '次の合成を停止', exact: true })
    .click();
  await expect(page.getByTestId('equipment-detail')).toContainText(
    '仕上げ中（次の合成は停止）',
  );
  await page.clock.runFor(8_000);
  await page
    .getByRole('button', { name: '自動合成を開始', exact: true })
    .click();
  await expect(page.getByTestId('equipment-detail')).toContainText('素材待ち');
  await page
    .getByRole('button', { name: '素材を集める · 冒険者を開く →', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '冒険者ギルド' }),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
