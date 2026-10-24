import {
  adventurerTypes,
  equipmentTypes,
  recipes,
  research,
} from '../game/content';
import {
  createGame,
  emptyInventory,
  unlocked,
} from '../game/engine';
import { itemIds } from '../game/types';
import type { GameState } from '../game/types';
import { CONTENT_VERSION, contentVersions } from '../game/contentVersions';
import { migrateSave } from './migrate';

export const SAVE_KEY = 'alcemy-sim-save-v1';
export const LEGACY_BACKUP_KEY = `${SAVE_KEY}-legacy-backup`;
export type SaveStorage = Pick<Storage, 'getItem' | 'setItem'>;
export function decodeSave(text: string): GameState {
  if (text.length > 100_000) throw new Error('Save is too large');
  const state = migrateSave(JSON.parse(text));
  const reject = (condition: boolean) => {
    if (condition) throw new Error('Save has inconsistent game data');
  };
  reject(!Object.hasOwn(contentVersions, state.contentVersion));
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
      const rules = contentVersions[job.contentVersion];
      if (!rules) throw new Error('Unknown job content version');
      const recipe = rules.recipes[job.recipe];
      reject(job.recipe !== entry.recipe || job.remaining > job.total);
      reject(
        job.total < Math.round(recipe.ticks * (unlocked(state, 'production-3') ? rules.production.final : unlocked(state, 'production-1') ? rules.production.first : 1)) ||
          ![
            recipe.ticks,
            Math.round(recipe.ticks * rules.production.first),
            Math.round(recipe.ticks * rules.production.final),
          ].includes(job.total),
      );
      reject(
        job.knowledge !== recipe.knowledge &&
          !(
            unlocked(state, 'knowledge-1') &&
            job.knowledge === recipe.knowledge + rules.knowledgeBonus
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
      const rules = contentVersions[trip.contentVersion];
      if (!rules) throw new Error('Unknown trip content version');
      const data = rules.destinations[trip.destination];
      reject(
        (trip.destination === 'ruins' && !unlocked(state, 'gathering-3')) ||
          trip.total !== data.ticks ||
          trip.remaining > trip.total,
      );
      const expected = { ...emptyInventory(), ...data.rewards };
      for (const id of itemIds) {
        if (
          id === 'herb' &&
          trip.destination === 'forest' &&
          unlocked(state, 'gathering-1') &&
          trip.rewards.herb === (data.rewards.herb ?? 0) + rules.forestBonus
        )
          continue;
        reject(trip.rewards[id] !== expected[id]);
      }
    }
  }
  reject(state.log.some((entry) => entry.tick > state.tick));
  return { ...state, contentVersion: CONTENT_VERSION };
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
    const previous = storage.getItem(SAVE_KEY);
    let legacy = false;
    try { legacy = previous !== null && JSON.parse(previous)?.schemaVersion === 1; } catch { /* explicit reset can replace corrupt data */ }
    if (legacy && storage.getItem(LEGACY_BACKUP_KEY) === null) storage.setItem(LEGACY_BACKUP_KEY, previous!);
    storage.setItem(SAVE_KEY, encodeSave(state));
    return null;
  } catch {
    return '保存に失敗しました。ブラウザーの保存許可や空き容量を確認してください。進行はこの画面内で続けられます。';
  }
}
