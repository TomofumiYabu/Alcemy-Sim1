import { expect, test } from './fixtures';
import { createGame } from '../../src/game/engine';
import { GRID_CAPACITY, GRID_COLUMNS } from '../../src/game/config';
import { encodeSave, SAVE_KEY } from '../../src/persistence/save';

test('a completely occupied workshop can exchange a stopped machine and continue distilling', async ({
  page,
}) => {
  const state = createGame();
  state.research = ['production-1', 'production-2'];
  state.equipment = Array.from({ length: GRID_CAPACITY }, (_, index) => ({
    id: index + 1,
    kind: 'cauldron',
    x: index % GRID_COLUMNS,
    y: Math.floor(index / GRID_COLUMNS),
    recipe: 'potion',
    enabled: false,
    job: null,
  }));
  state.nextEquipmentId = GRID_CAPACITY + 1;
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    { key: SAVE_KEY, value: encodeSave(state) },
  );
  await page.clock.install({ time: new Date('2026-10-24T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-24T00:00:01Z'));
  await page.goto('./');
  await page.getByRole('button', { name: '蒸留器へ交換', exact: true }).click();
  await expect(page.getByTestId('gold')).toHaveText('55');
  await expect(
    page.getByRole('button', { name: /^(調合釜|蒸留器) #/ }),
  ).toHaveCount(GRID_CAPACITY);
  await expect(
    page.getByRole('button', { name: '蒸留器 #1', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '自動合成を開始', exact: true })
    .click();
  await page.clock.fastForward(11_000);
  await expect(page.getByTestId('inventory-extract')).toHaveText('1');
  await page.getByRole('button', { name: '今すぐ保存', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: '蒸留器 #1', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('inventory-extract')).toHaveText('1');
});
