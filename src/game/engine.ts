import {
  adventurerTypes,
  destinations,
  equipmentTypes,
  items,
  recipes,
  research,
} from './content';
import { itemIds } from './types';
import { GRID_COLUMNS, GRID_ROWS } from './config';
import { CONTENT_VERSION, currentRules } from './contentVersions';
import { craftOutcome, emptyInventory, expeditionOutcome } from './workRules';
export { emptyInventory } from './workRules';
import type { GameEvent } from './events';
import type {
  Adventurer,
  Command,
  DestinationId,
  Equipment,
  EquipmentKind,
  GameState,
  ItemId,
  RecipeId,
  ResearchId,
} from './types';

export const TICK_MS = 100;
export function createGame(): GameState {
  return {
    schemaVersion: 2,
    contentVersion: CONTENT_VERSION,
    tick: 0,
    gold: 100,
    knowledge: 0,
    inventory: { ...emptyInventory(), herb: 4, water: 2 },
    research: [],
    equipment: [
      {
        id: 1,
        kind: 'cauldron',
        x: 2,
        y: 1,
        recipe: 'potion',
        enabled: false,
        job: null,
      },
    ],
    nextEquipmentId: 2,
    adventurers: [
      { id: 'iris', hired: false, auto: false, trip: null },
      { id: 'rowan', hired: false, auto: false, trip: null },
    ],
    stats: { expeditions: 0, crafted: 0, sold: 0, earned: 0 },
    log: [
      {
        tick: 0,
        message:
          '星灯りの工房へようこそ。まずはイリスを雇って、森へ送り出しましょう。',
      },
    ],
  };
}
export const unlocked = (state: GameState, id: ResearchId | null) =>
  id === null || state.research.includes(id);
export function recipeTicks(state: GameState, recipe: RecipeId): number {
  return craftOutcome(recipes[recipe], state.research, currentRules).total;
}
export const salePrice = (state: GameState, item: RecipeId) =>
  Math.floor(
    items[item].price *
      (unlocked(state, 'knowledge-3') ? currentRules.saleMultiplier : 1),
  );
export function getCraftPreview(state: GameState, recipe: RecipeId) {
  return {
    contentVersion: CONTENT_VERSION,
    recipe,
    ...craftOutcome(recipes[recipe], state.research, currentRules),
  };
}
export function getExpeditionPreview(
  state: GameState,
  destination: DestinationId,
) {
  return {
    contentVersion: CONTENT_VERSION,
    destination,
    ...expeditionOutcome(
      destinations[destination],
      destination,
      state.research,
      currentRules,
    ),
  };
}
export function missingMaterials(
  state: GameState,
  equipment: Equipment,
): string[] {
  return (
    Object.entries(recipes[equipment.recipe].inputs) as [ItemId, number][]
  )
    .filter(([id, count]) => state.inventory[id] < count)
    .map(([id, count]) => `${items[id].name} ${count - state.inventory[id]}`);
}
export function researchReason(
  state: GameState,
  id: ResearchId,
): string | null {
  const data = research[id];
  if (state.research.includes(id)) return '研究済み';
  const missing = data.requires.filter(
    (prerequisite) => !state.research.includes(prerequisite),
  );
  if (missing.length)
    return `前提: ${missing.map((prerequisite) => research[prerequisite].name).join('・')}`;
  if (state.gold < data.gold || state.knowledge < data.knowledge)
    return `必要: ${data.gold}金貨 / ${data.knowledge}知識`;
  return null;
}
function log(state: GameState, message: string) {
  state.log.unshift({ tick: state.tick, message });
  state.log = state.log.slice(0, 30);
}
function startTrip(
  state: GameState,
  adventurer: Adventurer,
  destination: DestinationId,
) {
  const preview = getExpeditionPreview(state, destination);
  adventurer.trip = { ...preview, remaining: preview.total };
}
function cellReason(
  state: GameState,
  x: number,
  y: number,
  exceptId?: number,
): string | null {
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    x >= GRID_COLUMNS ||
    y < 0 ||
    y >= GRID_ROWS
  )
    return '工房の範囲外です';
  if (
    state.equipment.some(
      (equipment) =>
        equipment.id !== exceptId && equipment.x === x && equipment.y === y,
    )
  )
    return '設備があるマスには配置できません';
  return null;
}
export function replacementReason(
  state: GameState,
  id: number,
  kind: EquipmentKind,
): string | null {
  const entry = state.equipment.find((equipment) => equipment.id === id);
  if (!entry) return '設備が見つかりません';
  if (entry.kind === kind) return '同じ種類の設備には交換できません';
  if (entry.enabled || entry.job)
    return '自動合成を停止し、現在の合成が終わるまでお待ちください';
  const target = equipmentTypes[kind];
  if (!unlocked(state, target.requires)) return '設備の研究が必要です';
  if (
    entry.kind === 'cauldron' &&
    state.equipment.filter((equipment) => equipment.kind === 'cauldron')
      .length === 1
  )
    return '調合釜を1台以上残してください';
  if (state.gold < target.price) return '設備を交換する金貨が足りません';
  return null;
}
export function applyCommand(
  current: GameState,
  command: Command,
): { state: GameState; error: string | null; events: GameEvent[] } {
  const state = structuredClone(current);
  const events: GameEvent[] = [];
  const fail = (error: string) => ({ state: current, error, events: [] });
  switch (command.type) {
    case 'hire': {
      const adventurer = state.adventurers.find(
        (entry) => entry.id === command.id,
      );
      if (!adventurer || adventurer.hired)
        return fail('この冒険者は雇用済みです');
      const data = adventurerTypes[command.id];
      if (state.gold < data.price) return fail('雇用する金貨が足りません');
      state.gold -= data.price;
      adventurer.hired = true;
      log(state, `${data.name}が工房の仲間になりました。`);
      break;
    }
    case 'dispatch': {
      const adventurer = state.adventurers.find(
        (entry) => entry.id === command.id,
      );
      if (!adventurer?.hired) return fail('先に冒険者を雇ってください');
      if (adventurer.trip) return fail('この冒険者は探索中です');
      if (!unlocked(state, destinations[command.destination].requires))
        return fail('まだ解放されていない探索先です');
      startTrip(state, adventurer, command.destination);
      log(
        state,
        `${adventurerTypes[adventurer.id].name}を${destinations[command.destination].name}へ派遣しました。`,
      );
      break;
    }
    case 'auto': {
      const adventurer = state.adventurers.find(
        (entry) => entry.id === command.id,
      );
      if (!adventurer?.hired || !unlocked(state, 'gathering-2'))
        return fail('自動再派遣の研究が必要です');
      adventurer.auto = !adventurer.auto;
      break;
    }
    case 'buy': {
      const reason = cellReason(state, command.x, command.y);
      if (reason) return fail(reason);
      const data = equipmentTypes[command.kind];
      if (!unlocked(state, data.requires)) return fail('設備の研究が必要です');
      if (state.gold < data.price) return fail('設備を買う金貨が足りません');
      state.gold -= data.price;
      state.equipment.push({
        id: state.nextEquipmentId++,
        kind: command.kind,
        x: command.x,
        y: command.y,
        recipe: data.recipe,
        enabled: false,
        job: null,
      });
      log(
        state,
        `${data.name}を配置しました。レシピを選び、自動合成を開始できます。`,
      );
      break;
    }
    case 'move': {
      const equipment = state.equipment.find(
        (entry) => entry.id === command.id,
      );
      if (!equipment) return fail('設備が見つかりません');
      const reason = cellReason(state, command.x, command.y, command.id);
      if (reason) return fail(reason);
      equipment.x = command.x;
      equipment.y = command.y;
      break;
    }
    case 'replace': {
      const reason = replacementReason(state, command.id, command.kind);
      if (reason) return fail(reason);
      const entry = state.equipment.find(
        (equipment) => equipment.id === command.id,
      )!;
      const target = equipmentTypes[command.kind];
      const previous = equipmentTypes[entry.kind].name;
      state.gold -= target.price;
      entry.kind = command.kind;
      entry.recipe = target.recipe;
      log(
        state,
        `${previous}を${target.name}に交換しました（${target.price}金貨）。`,
      );
      break;
    }
    case 'recipe': {
      const equipment = state.equipment.find(
        (entry) => entry.id === command.id,
      );
      if (!equipment || recipes[command.recipe].kind !== equipment.kind)
        return fail('この設備では作れません');
      if (!unlocked(state, recipes[command.recipe].requires))
        return fail('レシピの研究が必要です');
      if (equipment.job) return fail('合成が終わってから変更してください');
      equipment.recipe = command.recipe;
      break;
    }
    case 'toggle': {
      const equipment = state.equipment.find(
        (entry) => entry.id === command.id,
      );
      if (!equipment) return fail('設備が見つかりません');
      equipment.enabled = !equipment.enabled;
      break;
    }
    case 'sell': {
      const amount = state.inventory[command.item];
      if (amount <= 0) return fail('販売できる在庫がありません');
      const earned = amount * salePrice(state, command.item);
      state.inventory[command.item] = 0;
      state.gold += earned;
      state.stats.sold += amount;
      state.stats.earned += earned;
      events.push({
        type: 'sold',
        tick: state.tick,
        item: command.item,
        amount,
        earned,
      });
      log(
        state,
        `${items[command.item].name}を${amount}個販売し、${earned}金貨を得ました。`,
      );
      break;
    }
    case 'research': {
      const reason = researchReason(state, command.id);
      if (reason) return fail(reason);
      const data = research[command.id];
      state.gold -= data.gold;
      state.knowledge -= data.knowledge;
      state.research.push(command.id);
      events.push({ type: 'researched', tick: state.tick, id: command.id });
      log(state, `研究「${data.name}」が完成しました。${data.description}。`);
      break;
    }
  }
  return { state, error: null, events };
}

export function advanceTicks(current: GameState, count: number): GameState {
  return advanceWithEvents(current, count).state;
}

export function advanceWithEvents(
  current: GameState,
  count: number,
): {
  state: GameState;
  events: GameEvent[];
} {
  if (!Number.isSafeInteger(count) || count < 0)
    throw new Error('Tick count must be a nonnegative safe integer');
  if (count === 0) return { state: current, events: [] };
  const state = structuredClone(current);
  const events: GameEvent[] = [];
  const equipment = [...state.equipment].sort((a, b) => a.id - b.id);
  const adventurers = [...state.adventurers].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (let tick = 0; tick < count; tick++) {
    state.tick++;
    for (const adventurer of adventurers) {
      const trip = adventurer.trip;
      if (trip && --trip.remaining === 0) {
        for (const item of itemIds) state.inventory[item] += trip.rewards[item];
        state.stats.expeditions++;
        events.push({
          type: 'returned',
          tick: state.tick,
          adventurerId: adventurer.id,
          destination: trip.destination,
          rewards: { ...trip.rewards },
        });
        log(
          state,
          `${adventurerTypes[adventurer.id].name}が帰還。${itemIds
            .filter((id) => trip.rewards[id] > 0)
            .map((id) => `${items[id].name} +${trip.rewards[id]}`)
            .join(' / ')}。`,
        );
        adventurer.trip = null;
        if (adventurer.auto) startTrip(state, adventurer, trip.destination);
      }
    }
    for (const entry of equipment) {
      const job = entry.job;
      if (job && --job.remaining === 0) {
        state.inventory[job.recipe]++;
        state.knowledge += job.knowledge;
        state.stats.crafted++;
        events.push({
          type: 'crafted',
          tick: state.tick,
          equipmentId: entry.id,
          item: job.recipe,
          knowledge: job.knowledge,
        });
        log(state, `${items[job.recipe].name}が完成。知識 +${job.knowledge}。`);
        entry.job = null;
      }
    }
    for (const entry of equipment) {
      if (!entry.enabled || entry.job || missingMaterials(state, entry).length)
        continue;
      for (const [item, amount] of Object.entries(
        recipes[entry.recipe].inputs,
      ) as [ItemId, number][])
        state.inventory[item] -= amount;
      const preview = getCraftPreview(state, entry.recipe);
      entry.job = { ...preview, remaining: preview.total };
    }
  }
  return { state, events };
}
