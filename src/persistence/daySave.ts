import { createDayGame, applyDayCommand } from '../game/dayEngine';
import { daySchema } from '../game/dayTypes';
import type { DayState, DayCommand, Shelf } from '../game/dayTypes';
import { recipeIds } from '../game/types';
import {
  availableProducts,
  customerPlans,
  DAY_WORK,
  demandFor,
  emptyProducts,
  pricesFor,
  purchase,
  shelfCapacity,
  shopLevel,
  stableSeed,
} from '../game/shop';
import { decodeSave, SAVE_KEY, LEGACY_BACKUP_KEY } from './save';
import type { SaveStorage } from './save';
export { SAVE_KEY } from './save';
export const DAY_BACKUP_KEY = `${SAVE_KEY}-before-day-turn-v3`;

const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
export function validateDayState(input: unknown): DayState {
  const state = daySchema.parse(input);
  state.world = decodeSave(JSON.stringify(state.world));
  const reject = (condition: boolean) => {
    if (condition) throw new Error('Inconsistent daily save');
  };
  const validateShelves = (
    shelves: Shelf[],
    sales: number,
    available: readonly string[],
  ) => {
    reject(
      shelves.length > shopLevel(sales) ||
        new Set(shelves.map((s) => s.item)).size !== shelves.length,
    );
    reject(
      shelves.some(
        (s) => !available.includes(s.item) || s.quantity > shelfCapacity(sales),
      ),
    );
  };
  const available = availableProducts(state);
  validateShelves(state.shop.shelves, state.shop.salesTotal, available);
  reject(
    state.shop.salesTotal > state.world.stats.sold ||
      state.shop.fame > Math.min(100, state.shop.salesTotal),
  );
  for (const item of recipeIds)
    reject(
      !Number.isSafeInteger(
        state.world.inventory[item] +
          (state.shop.shelves.find((s) => s.item === item)?.quantity ?? 0),
      ),
    );
  for (const a of state.world.adventurers) {
    const repeat = state.repeatDestinations[a.id];
    reject(
      !!repeat &&
        (!a.hired ||
          (repeat === 'ruins' &&
            !state.world.research.includes('gathering-3'))),
    );
    reject(!!a.trip && a.trip.destination !== repeat);
  }
  const report = state.lastReport;
  reject((state.completedDays === 0) !== (report === null));
  if (!report) {
    reject(
      state.phase !== 'planning' ||
        state.shop.salesTotal !== 0 ||
        state.shop.fame !== 0,
    );
    return state;
  }
  reject(report.fameBefore > Math.min(100, report.salesBefore));
  reject(state.completedDays > Math.floor(state.world.tick / DAY_WORK));
  reject(
    report.day !== state.completedDays ||
      report.endTick - report.startTick !== DAY_WORK ||
      report.endTick !== state.world.tick,
  );
  reject(
    report.available[0] !== 'potion' ||
      new Set(report.available).size !== report.available.length ||
      report.available.some((id) => !available.includes(id)),
  );
  if (state.phase === 'report') reject(!equal(report.available, available));
  reject(!equal(report.demand, demandFor(state.seed, report.day)));
  const bonus = equal(report.prices, pricesFor(true));
  reject(!bonus && !equal(report.prices, pricesFor(false)));
  reject(bonus && !state.world.research.includes('knowledge-3'));
  if (state.phase === 'report')
    reject(bonus !== state.world.research.includes('knowledge-3'));
  validateShelves(report.openingShelves, report.salesBefore, report.available);
  const shelves = structuredClone(report.openingShelves);
  const plans = customerPlans(
    state.seed,
    report.day,
    report.salesBefore,
    report.fameBefore,
    report.available,
  );
  const customers = plans.map((plan) => purchase(plan, shelves, report.prices));
  reject(
    !equal(customers, report.customers) ||
      !equal(shelves, report.closingShelves),
  );
  const sold = emptyProducts();
  let earned = 0,
    buyers = 0;
  for (const c of customers)
    if (c.reason === 'purchased') {
      sold[c.item]++;
      earned += c.earned;
      buyers++;
    }
  reject(
    !equal(sold, report.sold) ||
      earned !== report.earned ||
      report.closingGold !== report.openingGold + earned,
  );
  reject(
    report.salesAfter !== report.salesBefore + buyers ||
      state.shop.salesTotal !== report.salesAfter,
  );
  reject(
    report.fameAfter !==
      Math.min(100, report.fameBefore + Math.min(3, buyers)) ||
      state.shop.fame !== report.fameAfter,
  );
  if (state.phase === 'report')
    reject(
      !equal(state.shop.shelves, report.closingShelves) ||
        state.world.gold !== report.closingGold ||
        !equal(state.world.inventory, report.closingInventory),
    );
  return state;
}
export function decodeDaySave(text: string): DayState {
  if (text.length > 200_000) throw new Error('Save too large');
  const raw: unknown = JSON.parse(text);
  if (
    raw &&
    typeof raw === 'object' &&
    'schemaVersion' in raw &&
    (raw.schemaVersion === 1 || raw.schemaVersion === 2)
  ) {
    return validateDayState(
      createDayGame(stableSeed(text), decodeSave(text), true),
    );
  }
  return validateDayState(raw);
}
export function loadDayGame(
  storage: SaveStorage,
  seed = 1,
): { state: DayState; blocked: boolean; message: string | null } {
  try {
    const text = storage.getItem(SAVE_KEY);
    return {
      state: text === null ? createDayGame(seed) : decodeDaySave(text),
      blocked: false,
      message: null,
    };
  } catch {
    return {
      state: createDayGame(seed),
      blocked: true,
      message:
        '記録を読み込めません。破損または未対応の形式です。元のデータは上書きしていません。',
    };
  }
}
export function saveDayGame(
  storage: SaveStorage,
  state: DayState,
  reset = false,
): string | null {
  try {
    const next = JSON.stringify(validateDayState(state));
    const previous = storage.getItem(SAVE_KEY);
    if (previous !== null) {
      let version: unknown;
      try {
        version = JSON.parse(previous)?.schemaVersion;
      } catch {
        if (!reset) throw new Error('Protected save');
      }
      if (version === 1 || version === 2) {
        if (!reset) decodeDaySave(previous);
        if (version === 1 && storage.getItem(LEGACY_BACKUP_KEY) === null)
          storage.setItem(LEGACY_BACKUP_KEY, previous);
        if (storage.getItem(DAY_BACKUP_KEY) === null)
          storage.setItem(DAY_BACKUP_KEY, previous);
      } else if (!reset) decodeDaySave(previous);
    }
    storage.setItem(SAVE_KEY, next);
    return null;
  } catch {
    return '保存に失敗しました。容量と保存設定を確認し、再試行してください。この操作は確定していません。';
  }
}
/** One storage transaction. Failure leaves the exact pre-command state and feedback untouched. */
export function commitDayCommand(
  storage: SaveStorage,
  current: DayState,
  command: DayCommand,
) {
  const fail = (error: string) => ({ state: current, error, events: [] });
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw !== null && JSON.parse(raw)?.schemaVersion === 3) {
      const saved = decodeDaySave(raw);
      if (saved.revision !== current.revision || saved.seed !== current.seed)
        return fail('記録が更新されました。再読み込みしてください。');
    }
  } catch {
    return fail('保存済みの記録を確認できません。この操作は確定していません。');
  }
  const candidate = applyDayCommand(current, command);
  if (candidate.error) return candidate;
  const error = saveDayGame(storage, candidate.state);
  return error ? fail(error) : candidate;
}
