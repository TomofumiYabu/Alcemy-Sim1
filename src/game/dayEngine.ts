import {
  createGame,
  applyCommand,
  advanceWorkUnit,
  startIdleEquipment,
  startTrip,
} from './engine';
import { daySchema } from './dayTypes';
import type { DayCommand, DayState, DayReport } from './dayTypes';
import type { GameState } from './types';
import { recipeIds, itemIds } from './types';
import type { GameEvent } from './events';
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
} from './shop';
import { emptyInventory } from './workRules';

export function createDayGame(
  seed = 1,
  world: GameState = createGame(),
  migrated = false,
): DayState {
  return {
    schemaVersion: 3,
    contentVersion: 2,
    world,
    completedDays: 0,
    revision: 0,
    phase: 'planning',
    migrated,
    seed,
    repeatDestinations: {
      iris:
        world.adventurers.find((a) => a.id === 'iris')?.trip?.destination ??
        null,
      rowan:
        world.adventurers.find((a) => a.id === 'rowan')?.trip?.destination ??
        null,
    },
    shop: {
      shelves: migrated ? [] : [{ item: 'potion', quantity: 0 }],
      reserve: { potion: 0, extract: 2, mana: 0 },
      salesTotal: 0,
      fame: 0,
    },
    lastReport: null,
  };
}
function resolveDay(state: DayState, events: GameEvent[]) {
  const world = state.world,
    day = state.completedDays + 1;
  const available = availableProducts(state),
    plans = customerPlans(
      state.seed,
      day,
      state.shop.salesTotal,
      state.shop.fame,
      available,
    );
  const report: DayReport = {
    day,
    rulesVersion: 2,
    startTick: world.tick,
    endTick: world.tick + DAY_WORK,
    available,
    demand: demandFor(state.seed, day),
    prices: pricesFor(world.research.includes('knowledge-3')),
    openingShelves: structuredClone(state.shop.shelves),
    closingShelves: [],
    customers: [],
    sold: emptyProducts(),
    earned: 0,
    produced: emptyProducts(),
    gathered: emptyInventory(),
    knowledgeGained: 0,
    closingInventory: emptyInventory(),
    openingGold: world.gold,
    closingGold: world.gold,
    salesBefore: state.shop.salesTotal,
    salesAfter: state.shop.salesTotal,
    fameBefore: state.shop.fame,
    fameAfter: state.shop.fame,
  };
  for (const a of world.adventurers) {
    const target = state.repeatDestinations[a.id];
    if (a.hired && a.auto && !a.trip && target) startTrip(world, a, target);
  }
  startIdleEquipment(world);
  for (let at = 1; at <= DAY_WORK; at++) {
    advanceWorkUnit(world, events, at < DAY_WORK);
    for (const plan of plans.filter((p) => p.at === at)) {
      const outcome = purchase(plan, state.shop.shelves, report.prices);
      report.customers.push(outcome);
      if (outcome.reason === 'purchased') {
        world.gold += outcome.earned;
        world.stats.sold++;
        world.stats.earned += outcome.earned;
        state.shop.salesTotal++; // The only S increment; closing derives level, never adds B again.
        report.sold[outcome.item]++;
        report.earned += outcome.earned;
        events.push({
          type: 'sold',
          tick: world.tick,
          item: outcome.item,
          amount: 1,
          earned: outcome.earned,
        });
      }
    }
  }
  for (const event of events) {
    if (event.type === 'crafted') {
      report.produced[event.item]++;
      report.knowledgeGained += event.knowledge;
    }
    if (event.type === 'returned')
      for (const id of itemIds) report.gathered[id] += event.rewards[id];
  }
  const buyers = report.customers.filter(
    (c) => c.reason === 'purchased',
  ).length;
  state.shop.fame = Math.min(100, state.shop.fame + Math.min(3, buyers));
  report.salesAfter = state.shop.salesTotal;
  report.fameAfter = state.shop.fame;
  report.closingGold = world.gold;
  report.closingInventory = { ...world.inventory };
  report.closingShelves = structuredClone(state.shop.shelves);
  state.completedDays++;
  state.phase = 'report';
  state.lastReport = report;
  world.log.unshift({
    tick: world.tick,
    message: `第${day}日 営業終了。${buyers}人が購入、売上 ${report.earned}金貨。`,
  });
  world.log = world.log.slice(0, 30);
}
export function applyDayCommand(
  current: DayState,
  command: DayCommand,
): { state: DayState; error: string | null; events: GameEvent[] } {
  const fail = (error: string) => ({ state: current, error, events: [] });
  if (command.type === 'sell')
    return fail(
      '売上は営業中のお客さまの購入で確定します。商品を棚へ陳列してください。',
    );
  if (command.type === 'finish-day' || command.type === 'ack-report') {
    if (
      command.completedDays !== current.completedDays ||
      command.revision !== current.revision
    )
      return fail('記録が更新されました。現在の日付を確認してください。');
  }
  if (current.phase === 'report' && command.type !== 'ack-report')
    return fail('日報を確認して翌日の準備へ進んでください。');
  const state = structuredClone(current);
  let events: GameEvent[] = [];
  try {
    switch (command.type) {
      case 'finish-day':
        resolveDay(state, events);
        break;
      case 'ack-report':
        if (state.phase !== 'report')
          return fail('この日の日報は確認済みです。');
        state.phase = 'planning';
        break;
      case 'stock':
      case 'unstock':
      case 'remove-shelf':
      case 'reserve': {
        if (!recipeIds.includes(command.item))
          return fail('この品は陳列できません。');
        if (!availableProducts(state).includes(command.item))
          return fail('先に商品の研究を解放してください。');
        const shelf = state.shop.shelves.find((s) => s.item === command.item);
        if (command.type === 'remove-shelf') {
          if (!shelf) return fail('棚がありません。');
          state.world.inventory[command.item] += shelf.quantity;
          state.shop.shelves = state.shop.shelves.filter(
            (s) => s.item !== command.item,
          );
          break;
        }
        if (!Number.isSafeInteger(command.amount) || command.amount < 0)
          return fail('数量は0以上の整数で指定してください。');
        if (command.type === 'reserve') {
          state.shop.reserve[command.item] = command.amount;
          break;
        }
        if (command.amount === 0)
          return fail('移す数量を1個以上指定してください。');
        if (command.type === 'unstock') {
          if (!shelf || shelf.quantity < command.amount)
            return fail('棚の商品が足りません。');
          shelf.quantity -= command.amount;
          state.world.inventory[command.item] += command.amount;
          break;
        }
        if (
          command.amount >
          Math.max(
            0,
            state.world.inventory[command.item] -
              state.shop.reserve[command.item],
          )
        )
          return fail('倉庫の在庫または製作用の確保数を確認してください。');
        if (
          !shelf &&
          state.shop.shelves.length >= shopLevel(state.shop.salesTotal)
        )
          return fail(
            '棚枠がいっぱいです。品目を倉庫へ戻すか、店を成長させましょう。',
          );
        if (
          (shelf?.quantity ?? 0) + command.amount >
          shelfCapacity(state.shop.salesTotal)
        )
          return fail('棚の数量容量を超えています。');
        state.world.inventory[command.item] -= command.amount;
        if (shelf) shelf.quantity += command.amount;
        else
          state.shop.shelves.push({
            item: command.item,
            quantity: command.amount,
          });
        break;
      }
      default: {
        const result = applyCommand(state.world, command);
        if (result.error) return fail(result.error);
        state.world = result.state;
        events = result.events;
        if (command.type === 'dispatch')
          state.repeatDestinations[command.id] = command.destination;
      }
    }
    state.revision++;
    daySchema.parse(state);
    for (const id of recipeIds)
      if (
        !Number.isSafeInteger(
          state.world.inventory[id] +
            (state.shop.shelves.find((s) => s.item === id)?.quantity ?? 0),
        )
      )
        return fail(
          '数量が保存できる上限に達しました。陳列と在庫を確認してください。',
        );
    return { state, error: null, events };
  } catch {
    return fail(
      '保存できる数値の上限を超えるため、この操作は確定していません。',
    );
  }
}
