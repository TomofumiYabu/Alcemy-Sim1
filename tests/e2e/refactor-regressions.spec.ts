import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';
import { createGame } from '../../src/game/engine';
import { researchIds } from '../../src/game/types';
import type { GameState } from '../../src/game/types';
import { encodeSave, SAVE_KEY } from '../../src/persistence/save';
import { equipment, go } from './navigation';

async function open(page: Page, state: GameState) {
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    { key: SAVE_KEY, value: encodeSave(state) },
  );
  await page.clock.install({ time: new Date('2026-10-25T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-25T00:00:01Z'));
  await page.goto('./');
  await expect(page.locator('.save-state')).toContainText(/自動保存|保存済み/);
}

test('material guidance follows hiring, dispatch and return instead of keeping an old sentence', async ({
  page,
}) => {
  const state = createGame();
  state.inventory.herb = 0;
  state.inventory.water = 0;
  await open(page, state);
  await equipment(page);
  await page
    .getByRole('button', { name: 'ささやきの森への派遣を開く →', exact: true })
    .click();
  const guidance = page.locator('#expeditions > [role="status"]');
  await expect(guidance).toContainText('まず冒険者を雇いましょう');
  await page.getByRole('button', { name: 'イリスを雇う', exact: true }).click();
  await expect(guidance).toContainText('探索先を確認して派遣してください');
  await page.getByRole('button', { name: 'イリスを派遣', exact: true }).click();
  await expect(guidance).toContainText('探索中');
  await page.clock.runFor(15000);
  await expect(guidance).toContainText('探索先を確認して派遣してください');
});

test('research guidance focuses the card when its purchase button is disabled', async ({
  page,
}) => {
  const state = createGame();
  state.adventurers[0]!.hired = true;
  state.stats.expeditions = 1;
  state.stats.crafted = 1;
  state.stats.sold = 1;
  state.stats.earned = 12;
  state.knowledge = 1;
  await open(page, state);
  await page
    .getByRole('button', { name: '次の一歩を開く', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '森の恵みを研究', exact: true }),
  ).toBeDisabled();
  await expect(page.getByTestId('research-gathering-1')).toBeFocused();
});

test('a failed destination image can be replaced by another successfully loaded image', async ({
  page,
}) => {
  const state = createGame();
  state.research = [...researchIds];
  state.adventurers[0]!.hired = true;
  await page.route('**/forest-*.webp', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/webp',
      body: 'invalid image',
    }),
  );
  await open(page, state);
  await go(page, '冒険者');
  const card = page.getByTestId('adventurer-iris');
  await expect(card.locator('[data-art="forest"]')).toHaveAttribute(
    'data-failed',
    'true',
  );
  await page.getByLabel('イリスの探索先').selectOption('ruins');
  await expect(card.locator('[data-art="ruins"]')).toHaveAttribute(
    'data-failed',
    'false',
  );
  await expect
    .poll(() =>
      card
        .locator('[data-art="ruins"] img')
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
});

test('research routes focus purchases and equipment without buying or changing a recipe', async ({
  page,
  isMobile,
}) => {
  const state = createGame();
  state.gold = 1000;
  state.research = [...researchIds];
  await open(page, state);
  await go(page, '研究');
  await page
    .getByRole('button', { name: '蒸留器の配置を開く →', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '蒸留器を購入・配置', exact: true }),
  ).toBeFocused();
  await expect(page.getByTestId('gold')).toHaveText('1,000');
  await go(page, '研究');
  await page
    .getByRole('button', { name: '釜で魔力薬を作る →', exact: true })
    .click();
  await expect(page.getByLabel('合成するレシピ', { exact: true })).toHaveValue(
    'potion',
  );
  await expect(page.getByTestId('gold')).toHaveText('1,000');
  if (isMobile) {
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('button', { name: '調合釜 #1', exact: true }),
    ).toBeFocused();
  } else
    await expect(
      page.getByRole('button', { name: '自動合成を開始', exact: true }),
    ).toBeFocused();
});
