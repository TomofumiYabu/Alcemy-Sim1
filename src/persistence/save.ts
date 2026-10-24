import {
  adventurerTypes,
  destinations,
  equipmentTypes,
  recipes,
  research,
} from '../game/content';
import {
  createGame,
  emptyInventory,
  recipeTicks,
  unlocked,
} from '../game/engine';
import { itemIds, stateSchema } from '../game/types';
import type { GameState } from '../game/types';

export const SAVE_KEY = 'alcemy-sim-save-v1';
export type SaveStorage = Pick<Storage, 'getItem' | 'setItem'>;
export function decodeSave(text: string): GameState {
  if (text.length > 100_000) throw new Error('Save is too large');
  const state = stateSchema.parse(JSON.parse(text));
  const reject = (condition: boolean) => {
    if (condition) throw new Error('Save has inconsistent game data');
  };
  reject(new Set(state.research).size !== state.research.length);
  for (const id of state.research)
    reject(
      research[id].requires.some((entry) => !state.research.includes(entry)),
    );
  reject(
    new Set(state.equipment.map((entry) => entry.id)).size !==
      state.equipment.length,
  );
  reject(
    new Set(state.equipment.map((entry) => `${entry.x},${entry.y}`)).size !==
      state.equipment.length,
  );
  reject(
    state.nextEquipmentId !==
      Math.max(...state.equipment.map((entry) => entry.id)) + 1,
  );
  reject(
    !state.equipment.some(
      (entry) => entry.id === 1 && entry.kind === 'cauldron',
    ),
  );
  for (const entry of state.equipment) {
    reject(!unlocked(state, equipmentTypes[entry.kind].requires));
    reject(
      recipes[entry.recipe].kind !== entry.kind ||
        !unlocked(state, recipes[entry.recipe].requires),
    );
    if (entry.job) {
      const job = entry.job;
      const recipe = recipes[job.recipe];
      reject(job.recipe !== entry.recipe || job.remaining > job.total);
      reject(
        job.total < recipeTicks(state, job.recipe) ||
          ![
            recipe.ticks,
            Math.round(recipe.ticks * 0.9),
            Math.round(recipe.ticks * 0.8),
          ].includes(job.total),
      );
      reject(
        job.knowledge !== recipe.knowledge &&
          !(
            unlocked(state, 'knowledge-1') &&
            job.knowledge === recipe.knowledge + 1
          ),
      );
    }
  }
  reject(
    new Set(state.adventurers.map((entry) => entry.id)).size !==
      Object.keys(adventurerTypes).length,
  );
  for (const entry of state.adventurers) {
    reject(!entry.hired && (entry.trip !== null || entry.auto));
    reject(entry.auto && !unlocked(state, 'gathering-2'));
    if (entry.trip) {
      const trip = entry.trip;
      const data = destinations[trip.destination];
      reject(
        !unlocked(state, data.requires) ||
          trip.total !== data.ticks ||
          trip.remaining > trip.total,
      );
      const expected = { ...emptyInventory(), ...data.rewards };
      for (const id of itemIds) {
        if (
          id === 'herb' &&
          trip.destination === 'forest' &&
          unlocked(state, 'gathering-1') &&
          trip.rewards.herb === 5
        )
          continue;
        reject(trip.rewards[id] !== expected[id]);
      }
    }
  }
  reject(state.log.some((entry) => entry.tick > state.tick));
  return state;
}
export function encodeSave(state: GameState): string {
  return JSON.stringify(state);
}
export function loadGame(storage: SaveStorage): {
  state: GameState;
  blocked: boolean;
  message: string | null;
} {
  try {
    const saved = storage.getItem(SAVE_KEY);
    if (saved === null)
      return { state: createGame(), blocked: false, message: null };
    try {
      return { state: decodeSave(saved), blocked: false, message: null };
    } catch {
      return {
        state: createGame(),
        blocked: true,
        message:
          'セーブデータを読み込めません。破損、または未対応のバージョンです。元のデータは上書きしていません。',
      };
    }
  } catch {
    return {
      state: createGame(),
      blocked: true,
      message:
        'ブラウザーの保存領域にアクセスできません。保存を許可するか、新しい工房を保存なしで始められます。',
    };
  }
}
export function saveGame(
  storage: SaveStorage,
  state: GameState,
): string | null {
  try {
    storage.setItem(SAVE_KEY, encodeSave(state));
    return null;
  } catch {
    return '保存に失敗しました。ブラウザーの保存許可や空き容量を確認してください。進行はこの画面内で続けられます。';
  }
}
