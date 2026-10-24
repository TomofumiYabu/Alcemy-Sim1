import { describe, expect, it } from 'vitest';
import { advanceTicks, applyCommand, createGame } from '../../src/game/engine';
import type { GameState } from '../../src/game/types';
import {
  decodeSave,
  encodeSave,
  loadGame,
  SAVE_KEY,
  saveGame,
} from '../../src/persistence/save';

describe('versioned persistence', () => {
  it('round trips in-flight work, expeditions and purchases without adding offline time', () => {
    let state = applyCommand(createGame(), { type: 'hire', id: 'iris' }).state;
    state = applyCommand(state, {
      type: 'dispatch',
      id: 'iris',
      destination: 'forest',
    }).state;
    state = advanceTicks(
      applyCommand(state, { type: 'toggle', id: 1 }).state,
      30,
    );
    const restored = decodeSave(encodeSave(state));
    expect(restored).toEqual(state);
    expect(restored.equipment[0]!.job?.remaining).toBe(51);
    expect(restored.adventurers[0]!.trip?.remaining).toBe(120);
    expect(advanceTicks(restored, 200)).toEqual(advanceTicks(state, 200));
  });
  const corruptions: [string, (state: GameState) => void][] = [
    [
      'negative currency',
      (state) => {
        state.gold = -1;
      },
    ],
    [
      'fractional inventory',
      (state) => {
        state.inventory.herb = 1.5;
      },
    ],
    [
      'overlapping equipment',
      (state) => {
        state.equipment.push({ ...state.equipment[0]!, id: 2 });
        state.nextEquipmentId = 3;
      },
    ],
    [
      'duplicate adventurers',
      (state) => {
        state.adventurers[1]!.id = 'iris';
      },
    ],
    [
      'invalid research prerequisites',
      (state) => {
        state.research = ['knowledge-2'];
      },
    ],
    [
      'duplicate research',
      (state) => {
        state.research = ['gathering-1', 'gathering-1'];
      },
    ],
    [
      'locked equipment',
      (state) => {
        state.equipment[0]!.kind = 'still';
        state.equipment[0]!.recipe = 'extract';
      },
    ],
    [
      'job reward inflation',
      (state) => {
        state.equipment[0]!.job = {
          contentVersion: 1,
          recipe: 'potion',
          total: 80,
          remaining: 40,
          knowledge: 3,
        };
      },
    ],
    [
      'job duration inflation',
      (state) => {
        state.equipment[0]!.job = {
          contentVersion: 1,
          recipe: 'potion',
          total: 10,
          remaining: 10,
          knowledge: 1,
        };
      },
    ],
    [
      'trip without hire',
      (state) => {
        state.adventurers[0]!.trip = {
          contentVersion: 1,
          destination: 'forest',
          total: 150,
          remaining: 100,
          rewards: {
            herb: 4,
            water: 2,
            crystal: 0,
            potion: 0,
            extract: 0,
            mana: 0,
          },
        };
      },
    ],
  ];
  it.each(corruptions)(
    'rejects %s instead of silently loading it',
    (_, corrupt) => {
      const state = createGame();
      corrupt(state);
      expect(() => decodeSave(encodeSave(state))).toThrow();
    },
  );
  it('refuses unknown versions, broken JSON and unknown IDs', () => {
    expect(() => decodeSave('{')).toThrow();
    expect(() =>
      decodeSave(
        encodeSave(createGame()).replace(
          '"schemaVersion":2',
          '"schemaVersion":99',
        ),
      ),
    ).toThrow();
    expect(() =>
      decodeSave(encodeSave(createGame()).replace('"iris"', '"unknown"')),
    ).toThrow();
  });
  it('preserves corrupt data and blocks automatic overwrite until an explicit new start', () => {
    let data = '{broken';
    let writes = 0;
    const storage = {
      getItem: () => data,
      setItem: (_: string, value: string) => {
        data = value;
        writes++;
      },
    };
    const result = loadGame(storage);
    expect(result.blocked).toBe(true);
    expect(result.message).toContain('上書きしていません');
    expect(writes).toBe(0);
    expect(data).toBe('{broken');
  });
  it('reports denied read and quota failure, and never reports false save success', () => {
    const storage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(loadGame(storage).blocked).toBe(true);
    expect(saveGame(storage, createGame())).toContain('保存に失敗');
  });
  it('uses the stable key and restores a successful save', () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
    };
    expect(loadGame(storage).blocked).toBe(false);
    expect(saveGame(storage, createGame())).toBeNull();
    expect(data.has(SAVE_KEY)).toBe(true);
    expect(loadGame(storage).state).toEqual(createGame());
  });
});
