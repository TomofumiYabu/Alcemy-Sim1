import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';
import { createGame } from '../../src/game/engine';
import { researchIds } from '../../src/game/types';
import type { GameState } from '../../src/game/types';
import { encodeSave, SAVE_KEY } from '../../src/persistence/save';
import { PREFERENCES_KEY } from '../../src/ui/preferences';
import { closeOverlay, equipment, go, settings } from './navigation';

async function open(page: Page, state = createGame()) {
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
function advanced(): GameState {
  const state = createGame();
  state.gold = 1000;
  state.knowledge = 100;
  state.research = [...researchIds];
  state.equipment[0]!.recipe = 'mana';
  state.inventory.extract = 0;
  state.inventory.crystal = 0;
  state.adventurers[0]!.hired = true;
  state.equipment.push({
    id: 2,
    kind: 'still',
    x: 1,
    y: 0,
    recipe: 'extract',
    enabled: false,
    job: null,
  });
  state.nextEquipmentId = 3;
  return state;
}

test('shortages select the matching still and ruins without executing a game command', async ({
  page,
}) => {
  await open(page, advanced());
  await equipment(page);
  const labels = await page
    .getByTestId('equipment-detail')
    .locator('.recipe-ingredient > span:last-child')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        };
      }),
    );
  for (let i = 0; i < labels.length; i++)
    for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i]!;
      const b = labels[j]!;
      expect(
        a.left < b.right &&
          b.left < a.right &&
          a.top < b.bottom &&
          b.top < a.bottom,
        'recipe ingredient labels must not overlap',
      ).toBe(false);
    }
  await page
    .getByRole('button', { name: '蒸留器で薬草エキスを作る →', exact: true })
    .click();
  await expect(
    page.getByTestId('equipment-detail').getByRole('heading'),
  ).toContainText('蒸留器 #2');
  await expect(
    page.getByRole('button', { name: '自動合成を開始', exact: true }),
  ).toBeVisible();
  await equipment(page);
  await page
    .getByRole('button', { name: '月影の遺跡への派遣を開く →', exact: true })
    .click();
  await expect(page.getByLabel('イリスの探索先')).toHaveValue('ruins');
  await expect(
    page.getByRole('button', { name: 'イリスを派遣', exact: true }),
  ).toBeEnabled();
  await expect(page.getByTestId('adventurer-iris')).toBeFocused();
  await expect(page.getByTestId('adventurer-iris')).toContainText('待機中');
});

test('research prerequisites receive keyboard focus and an unlocked destination leads to dispatch', async ({
  page,
}) => {
  const state = createGame();
  state.gold = 1000;
  state.knowledge = 100;
  state.adventurers[0]!.hired = true;
  await open(page, state);
  await go(page, '研究');
  const mana = page.getByTestId('research-knowledge-2');
  await mana
    .getByRole('button', {
      name: '前提研究「月影への地図」を開く',
      exact: true,
    })
    .click();
  await expect(page.getByTestId('research-gathering-3')).toBeFocused();
  for (const name of ['森の恵み', '帰り道の約束', '月影への地図'])
    await page
      .getByRole('button', { name: `${name}を研究`, exact: true })
      .click();
  await page
    .getByRole('button', { name: '遺跡への派遣を開く →', exact: true })
    .click();
  await expect(page.getByLabel('イリスの探索先')).toHaveValue('ruins');
  await page.getByRole('button', { name: 'イリスを派遣', exact: true }).click();
  await expect(page.getByTestId('adventurer-iris')).toContainText('探索中');
});

test('display, notification and sound preferences persist independently without replay', async ({
  page,
}) => {
  await open(page);
  const saved = await page.evaluate(
    (key) => localStorage.getItem(key),
    SAVE_KEY,
  );
  await settings(page);
  await page.getByLabel('動きを控えめにする', { exact: true }).check();
  await page
    .getByLabel('文字の大きさ', { exact: true })
    .selectOption('largest');
  await page.getByLabel('出来事の通知を表示する', { exact: true }).uncheck();
  await page.getByLabel('出来事の音を鳴らす', { exact: true }).check();
  await page.getByLabel('音量', { exact: true }).fill('45');
  expect(
    await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY),
  ).toBe(saved);
  await page.reload();
  await settings(page);
  await expect(
    page.getByLabel('動きを控えめにする', { exact: true }),
  ).toBeChecked();
  await expect(page.getByLabel('文字の大きさ', { exact: true })).toHaveValue(
    'largest',
  );
  await expect(page.getByLabel('音量', { exact: true })).toHaveValue('45');
  await expect(
    page.getByLabel('出来事の音を鳴らす', { exact: true }),
  ).toBeChecked();
  await expect(
    page.getByLabel('出来事の通知を表示する', { exact: true }),
  ).not.toBeChecked();
  await closeOverlay(page);
  await equipment(page);
  await page
    .getByRole('button', { name: '自動合成を開始', exact: true })
    .click();
  await page.clock.runFor(8100);
  await closeOverlay(page);
  await go(page, '在庫・販売');
  await expect(page.getByTestId('inventory-potion')).toHaveText('1');
  await expect(page.locator('.feedback-card')).toHaveCount(0);
});

test('invalid preferences fall back safely and blocked preference storage keeps the active choice', async ({
  page,
}) => {
  await page.addInitScript(
    ({ key }) => {
      localStorage.setItem(key, '{invalid');
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (name === key)
          throw new DOMException('blocked', 'QuotaExceededError');
        original.call(this, name, value);
      };
    },
    { key: PREFERENCES_KEY },
  );
  await open(page);
  await settings(page);
  await expect(
    page.getByLabel('出来事の音を鳴らす', { exact: true }),
  ).not.toBeChecked();
  await page.getByLabel('文字の大きさ', { exact: true }).selectOption('large');
  await expect(page.getByLabel('文字の大きさ', { exact: true })).toHaveValue(
    'large',
  );
  await expect(page.getByRole('alert')).toContainText(
    '設定を保存できませんでした',
  );
  await page.getByRole('button', { name: '今すぐ保存', exact: true }).click();
  await expect(page.locator('.save-state')).toContainText('保存済み');
});

test('sound requires opt-in plus a gesture, stays muted at zero and never replays on reload', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const counts = { contexts: 0, tones: 0 };
    Object.assign(window, { audioTest: counts });
    class FakeAudioContext {
      state = 'running';
      currentTime = 0;
      destination = {};
      constructor() {
        counts.contexts++;
      }
      createOscillator() {
        return {
          type: '',
          frequency: { setValueAtTime() {} },
          connect() {},
          disconnect() {},
          start() {
            counts.tones++;
          },
          stop() {},
          onended: null,
        };
      }
      createGain() {
        return {
          gain: {
            setValueAtTime() {},
            linearRampToValueAtTime() {},
            exponentialRampToValueAtTime() {},
          },
          connect() {},
          disconnect() {},
        };
      }
      resume() {
        return Promise.resolve();
      }
      close() {
        return Promise.resolve();
      }
    }
    Object.assign(window, { AudioContext: FakeAudioContext });
  });
  const state = createGame();
  state.inventory.potion = 3;
  state.inventory.extract = 2;
  state.inventory.mana = 1;
  await open(page, state);
  await go(page, '在庫・販売');
  await page.getByRole('button', { name: '傷薬を販売', exact: true }).click();
  const counts = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            audioTest: { contexts: number; tones: number };
          }
        ).audioTest,
    );
  expect(await counts()).toEqual({ contexts: 0, tones: 0 });
  await settings(page);
  await page.getByLabel('出来事の音を鳴らす', { exact: true }).check();
  expect(await counts()).toEqual({ contexts: 0, tones: 0 });
  await closeOverlay(page);
  await go(page, '在庫・販売');
  await page
    .getByRole('button', { name: '薬草エキスを販売', exact: true })
    .click();
  expect(await counts()).toEqual({ contexts: 1, tones: 1 });
  await settings(page);
  await page.getByLabel('音量', { exact: true }).fill('0');
  await closeOverlay(page);
  await go(page, '在庫・販売');
  await page.getByRole('button', { name: '魔力薬を販売', exact: true }).click();
  expect((await counts()).tones).toBe(1);
  await page.reload();
  expect(await counts()).toEqual({ contexts: 0, tones: 0 });
});

test('all remaining art decodes and a still finishes its reserved batch before going dark', async ({
  page,
}) => {
  const state = advanced();
  state.equipment[0]!.recipe = 'potion';
  await open(page, state);
  await go(page, '冒険者');
  for (const name of [
    'rowan',
    'still',
    'crystal',
    'extract',
    'mana',
    'forest',
    'ruins',
  ]) {
    const image = page.locator(`[data-art="${name}"] img`).first();
    await expect(image).toBeAttached();
    await expect
      .poll(() =>
        image.evaluate((element) => (element as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
  }
  await equipment(page, '蒸留器 #2');
  await page
    .getByRole('button', { name: '自動合成を開始', exact: true })
    .click();
  await page.clock.runFor(100);
  await expect(
    page.getByTestId('equipment-detail').locator('.still-artwork'),
  ).toHaveAttribute('data-active', 'true');
  await page
    .getByRole('button', { name: '次の合成を停止', exact: true })
    .click();
  await expect(page.getByTestId('equipment-detail')).toContainText('仕上げ中');
  await page.clock.runFor(12000);
  await expect(
    page.getByTestId('equipment-detail').locator('.cauldron-fire'),
  ).toHaveCount(0);
  await go(page, '在庫・販売');
  await expect(page.getByTestId('inventory-extract')).toHaveText('1');
});
