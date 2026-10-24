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
import type {
  Adventurer,
  Command,
  DestinationId,
  Equipment,
  GameState,
  Inventory,
  ItemId,
  RecipeId,
  ResearchId,
} from './types';

export const TICK_MS = 100;
export const emptyInventory = (): Inventory => ({
  herb: 0,
  water: 0,
  crystal: 0,
  potion: 0,
  extract: 0,
  mana: 0,
});
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
  const multiplier = unlocked(state, 'production-3')
    ? currentRules.production.final
    : unlocked(state, 'production-1')
      ? currentRules.production.first
      : 1;
  return Math.round(recipes[recipe].ticks * multiplier);
}
export const salePrice = (state: GameState, item: RecipeId) =>
  Math.floor(items[item].price * (unlocked(state, 'knowledge-3') ? currentRules.saleMultiplier : 1));
export function getCraftPreview(state: GameState, recipe: RecipeId) {
  return { contentVersion: CONTENT_VERSION, recipe, total: recipeTicks(state, recipe), knowledge: recipes[recipe].knowledge + (unlocked(state, 'knowledge-1') ? currentRules.knowledgeBonus : 0) };
}
export function getExpeditionPreview(state: GameState, destination: DestinationId) {
  const data = destinations[destination];
  const rewards = { ...emptyInventory(), ...data.rewards };
  if (destination === 'forest' && unlocked(state, 'gathering-1')) rewards.herb += currentRules.forestBonus;
  return { contentVersion: CONTENT_VERSION, destination, total: data.ticks, rewards };
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
export function applyCommand(
  current: GameState,
  command: Command,
): { state: GameState; error: string | null } {
  const state = structuredClone(current);
  const fail = (error: string) => ({ state: current, error });
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
      log(state, `研究「${data.name}」が完成しました。${data.description}。`);
      break;
    }
  }
  return { state, error: null };
}

export function advanceTicks(current: GameState, count: number): GameState {
  if (!Number.isSafeInteger(count) || count < 0)
    throw new Error('Tick count must be a nonnegative safe integer');
  if (count === 0) return current;
  const state = structuredClone(current);
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
  return state;
}
