import { describe, expect, it } from 'vitest';
import {
  destinations,
  equipmentTypes,
  recipes,
  research,
} from '../../src/game/content';
import {
  advanceTicks,
  applyCommand,
  createGame,
  emptyInventory,
  recipeTicks,
  salePrice,
} from '../../src/game/engine';
import { itemIds, researchIds } from '../../src/game/types';
import type { Command, GameState } from '../../src/game/types';
import { decodeSave, encodeSave } from '../../src/persistence/save';

const command = (state: GameState, action: Command) => {
  const result = applyCommand(state, action);
  expect(result.error).toBeNull();
  return result.state;
};
const richGame = () => ({ ...createGame(), gold: 10_000, knowledge: 1_000 });
function allResearch(state: GameState): GameState {
  for (const id of [
    'gathering-1',
    'gathering-2',
    'gathering-3',
    'production-1',
    'production-2',
    'production-3',
    'knowledge-1',
    'knowledge-2',
    'knowledge-3',
  ] as const)
    state = command(state, { type: 'research', id });
  return state;
}
describe('economy and commands', () => {
  it('charges employment once, forbids dispatch before hire, and leaves its input unchanged', () => {
    const state = createGame();
    expect(
      applyCommand(state, {
        type: 'dispatch',
        id: 'iris',
        destination: 'forest',
      }).state,
    ).toBe(state);
    const hired = command(state, { type: 'hire', id: 'iris' });
    expect(hired.gold).toBe(80);
    expect(state.gold).toBe(100);
    expect(applyCommand(hired, { type: 'hire', id: 'iris' }).state).toBe(hired);
    expect(
      applyCommand({ ...state, gold: 0 }, { type: 'hire', id: 'rowan' }).error,
    ).not.toBeNull();
  });
  it('returns the exact promised expedition rewards and rejects duplicate dispatch', () => {
    let state = command(createGame(), { type: 'hire', id: 'iris' });
    state = command(state, {
      type: 'dispatch',
      id: 'iris',
      destination: 'forest',
    });
    expect(
      applyCommand(state, {
        type: 'dispatch',
        id: 'iris',
        destination: 'forest',
      }).state,
    ).toBe(state);
    state = advanceTicks(state, 149);
    expect(state.stats.expeditions).toBe(0);
    state = advanceTicks(state, 1);
    expect(state.stats.expeditions).toBe(1);
    expect(state.inventory.herb).toBe(8);
    expect(state.inventory.water).toBe(4);
    expect(state.adventurers[0]!.trip).toBeNull();
    expect(state.gold).toBe(80);
  });
  it('prevents locked destinations, automatic dispatch, recipes and equipment', () => {
    const state = command(createGame(), { type: 'hire', id: 'iris' });
    for (const action of [
      { type: 'dispatch', id: 'iris', destination: 'ruins' },
      { type: 'auto', id: 'iris' },
      { type: 'recipe', id: 1, recipe: 'mana' },
      { type: 'buy', kind: 'still', x: 0, y: 0 },
    ] satisfies Command[])
      expect(applyCommand(state, action).state).toBe(state);
  });
  it('rejects overlapping, out-of-range, fractional and unaffordable placement without spending', () => {
    const state = createGame();
    for (const [x, y] of [
      [2, 1],
      [-1, 0],
      [6, 0],
      [0, 4],
      [0.5, 0],
      [NaN, 0],
    ]) {
      expect(
        applyCommand(state, { type: 'buy', kind: 'cauldron', x: x!, y: y! })
          .state,
      ).toBe(state);
    }
    const poor = { ...state, gold: 24 };
    expect(
      applyCommand(poor, { type: 'buy', kind: 'cauldron', x: 0, y: 0 }).state,
    ).toBe(poor);
    const bought = command(state, {
      type: 'buy',
      kind: 'cauldron',
      x: 0,
      y: 0,
    });
    expect(bought.gold).toBe(75);
    expect(bought.equipment).toHaveLength(2);
    expect(bought.nextEquipmentId).toBe(3);
  });
  it('sells all existing products at the current price, and cannot sell twice', () => {
    let state = createGame();
    state.inventory.potion = 3;
    state = command(state, { type: 'sell', item: 'potion' });
    expect(state.gold).toBe(136);
    expect(state.inventory.potion).toBe(0);
    expect(state.stats).toMatchObject({ sold: 3, earned: 36 });
    expect(applyCommand(state, { type: 'sell', item: 'potion' }).state).toBe(
      state,
    );
  });
});
describe('automatic production and time', () => {
  it('reserves materials at start and completes at the exact duration', () => {
    let state = command(createGame(), { type: 'toggle', id: 1 });
    state = advanceTicks(state, 1);
    expect(state.inventory.herb).toBe(2);
    expect(state.inventory.water).toBe(1);
    state = advanceTicks(state, 79);
    expect(state.stats.crafted).toBe(0);
    state = advanceTicks(state, 1);
    expect(state.inventory.potion).toBe(1);
    expect(state.knowledge).toBe(1);
    expect(state.equipment[0]!.job?.remaining).toBe(80);
    expect(state.inventory.herb).toBe(0);
  });
  it('does not double spend shared inventory across competing equipment', () => {
    let state = createGame();
    state.inventory.herb = 2;
    state.inventory.water = 1;
    state = command(state, { type: 'buy', kind: 'cauldron', x: 0, y: 0 });
    state = command(command(state, { type: 'toggle', id: 1 }), {
      type: 'toggle',
      id: 2,
    });
    state = advanceTicks(state, 81);
    expect(state.inventory.potion).toBe(1);
    expect(state.stats.crafted).toBe(1);
    expect(state.inventory.herb).toBe(0);
    expect(state.inventory.water).toBe(0);
    expect(state.equipment.every((entry) => entry.job === null)).toBe(true);
  });
  it('finishes the current batch after stopping, preserves it on movement and forbids changing a busy recipe', () => {
    let state = advanceTicks(
      command(createGame(), { type: 'toggle', id: 1 }),
      30,
    );
    const job = structuredClone(state.equipment[0]!.job);
    state = command(state, { type: 'move', id: 1, x: 0, y: 0 });
    expect(state.equipment[0]!.job).toEqual(job);
    expect(
      applyCommand(state, { type: 'recipe', id: 1, recipe: 'potion' }).state,
    ).toBe(state);
    state = advanceTicks(command(state, { type: 'toggle', id: 1 }), 1_000);
    expect(state.stats.crafted).toBe(1);
    expect(state.inventory.herb).toBe(2);
    expect(state.equipment[0]!.job).toBeNull();
  });
  it('gives the same outcome regardless of tick batching and keeps the original immutable', () => {
    let state = allResearch(richGame());
    state = command(command(state, { type: 'hire', id: 'iris' }), {
      type: 'dispatch',
      id: 'iris',
      destination: 'forest',
    });
    state = command(command(state, { type: 'auto', id: 'iris' }), {
      type: 'toggle',
      id: 1,
    });
    const original = encodeSave(state);
    let split = state;
    for (let i = 0; i < 40; i++) split = advanceTicks(split, 150);
    expect(advanceTicks(state, 6_000)).toEqual(split);
    expect(encodeSave(state)).toBe(original);
    expect(Object.values(split.inventory).every((amount) => amount >= 0)).toBe(
      true,
    );
    expect(decodeSave(encodeSave(split))).toEqual(split);
  });
  it('allows a zero-gold hired adventurer to recover an empty inventory without a recurring fee', () => {
    let state = command(createGame(), { type: 'hire', id: 'iris' });
    state.gold = 0;
    state.inventory = emptyInventory();
    state = command(
      command(state, { type: 'dispatch', id: 'iris', destination: 'forest' }),
      { type: 'toggle', id: 1 },
    );
    state = advanceTicks(state, 231);
    state = command(state, { type: 'sell', item: 'potion' });
    expect(state.gold).toBe(12);
    expect(state.stats.expeditions).toBe(1);
  });
  it('processes expedition returns before waiting equipment starts a batch', () => {
    let state = command(createGame(), { type: 'hire', id: 'iris' });
    state.inventory = emptyInventory();
    state = command(
      command(state, { type: 'dispatch', id: 'iris', destination: 'forest' }),
      { type: 'toggle', id: 1 },
    );
    state = advanceTicks(state, 150);
    expect(state.equipment[0]!.job?.remaining).toBe(80);
    expect(state.inventory.herb).toBe(2);
  });
});
describe('research and progression', () => {
  it('rejects missing prerequisites, resources and duplicate purchases atomically', () => {
    let state = richGame();
    expect(
      applyCommand(state, { type: 'research', id: 'knowledge-2' }).state,
    ).toBe(state);
    expect(
      applyCommand(createGame(), { type: 'research', id: 'gathering-1' }).error,
    ).not.toBeNull();
    state = command(state, { type: 'research', id: 'gathering-1' });
    expect(state.gold).toBe(9980);
    expect(state.knowledge).toBe(997);
    expect(
      applyCommand(state, { type: 'research', id: 'gathering-1' }).state,
    ).toBe(state);
  });
  it('applies production and knowledge improvements only to the next batch', () => {
    let state = richGame();
    state.inventory.herb = 20;
    state.inventory.water = 10;
    state = advanceTicks(command(state, { type: 'toggle', id: 1 }), 1);
    state = command(command(state, { type: 'research', id: 'production-1' }), {
      type: 'research',
      id: 'knowledge-1',
    });
    expect(state.equipment[0]!.job).toMatchObject({ total: 80, knowledge: 1 });
    const knowledge = state.knowledge;
    state = advanceTicks(state, 80);
    expect(state.knowledge).toBe(knowledge + 1);
    expect(state.equipment[0]!.job).toMatchObject({ total: 72, knowledge: 2 });
  });
  it('snapshots trip rewards and repeats expeditions only after the research and opt-in', () => {
    let state = command(richGame(), { type: 'hire', id: 'iris' });
    state = command(state, {
      type: 'dispatch',
      id: 'iris',
      destination: 'forest',
    });
    state = command(command(state, { type: 'research', id: 'gathering-1' }), {
      type: 'research',
      id: 'gathering-2',
    });
    state = command(state, { type: 'auto', id: 'iris' });
    state = advanceTicks(state, 150);
    expect(state.inventory.herb).toBe(8);
    expect(state.adventurers[0]!.trip?.rewards.herb).toBe(5);
    state = advanceTicks(state, 150);
    expect(state.inventory.herb).toBe(13);
    expect(state.stats.expeditions).toBe(2);
  });
  it('connects research, the ruins, distillation and multi-stage mana production', () => {
    let state = allResearch(richGame());
    state.inventory.herb = 20;
    state.inventory.water = 20;
    state = command(command(state, { type: 'hire', id: 'rowan' }), {
      type: 'dispatch',
      id: 'rowan',
      destination: 'ruins',
    });
    state = command(state, { type: 'buy', kind: 'still', x: 0, y: 0 });
    state = command(state, { type: 'toggle', id: 2 });
    state = command(command(state, { type: 'recipe', id: 1, recipe: 'mana' }), {
      type: 'toggle',
      id: 1,
    });
    state = advanceTicks(state, 460);
    expect(state.inventory.mana).toBeGreaterThan(0);
    expect(state.stats.expeditions).toBe(1);
    expect(recipeTicks(state, 'mana')).toBe(160);
    expect(salePrice(state, 'mana')).toBe(48);
    expect(decodeSave(encodeSave(state))).toEqual(state);
  });
  it('can complete the first loop from the real initial economy without seeded resources', () => {
    let state = command(createGame(), { type: 'hire', id: 'iris' });
    state = command(
      command(state, { type: 'dispatch', id: 'iris', destination: 'forest' }),
      { type: 'toggle', id: 1 },
    );
    state = advanceTicks(state, 250);
    state = command(state, { type: 'sell', item: 'potion' });
    state = command(state, { type: 'research', id: 'gathering-1' });
    expect(state.stats).toMatchObject({
      expeditions: 1,
      crafted: 3,
      sold: 3,
      earned: 36,
    });
    expect(state.research).toContain('gathering-1');
    expect(state.gold).toBe(96);
    expect(state.knowledge).toBe(0);
  });
  it('can afford and unlock every research node through normal expeditions, production and sales', () => {
    let state = command(createGame(), { type: 'hire', id: 'iris' });
    state = command(state, { type: 'toggle', id: 1 });
    const order = [
      'gathering-1',
      'gathering-2',
      'gathering-3',
      'production-1',
      'production-2',
      'production-3',
      'knowledge-1',
      'knowledge-2',
      'knowledge-3',
    ] as const;
    for (let step = 0; step < 120 && state.research.length < 9; step++) {
      if (!state.adventurers[0]!.trip)
        state = command(state, {
          type: 'dispatch',
          id: 'iris',
          destination: 'forest',
        });
      state = advanceTicks(state, 150);
      if (state.inventory.potion)
        state = command(state, { type: 'sell', item: 'potion' });
      for (const id of order)
        if (!state.research.includes(id))
          state = applyCommand(state, { type: 'research', id }).state;
    }
    expect(state.research).toHaveLength(9);
    expect(state.gold).toBeGreaterThanOrEqual(0);
    expect(state.knowledge).toBeGreaterThanOrEqual(0);
    expect(decodeSave(encodeSave(state))).toEqual(state);
  });
  it('keeps content references valid and every research node reachable in an acyclic graph', () => {
    const seen = new Set<string>();
    for (let pass = 0; pass < researchIds.length; pass++)
      for (const id of researchIds)
        if (research[id].requires.every((entry) => seen.has(entry)))
          seen.add(id);
    expect(seen.size).toBe(9);
    const visit = (id: (typeof researchIds)[number], ancestors: string[]) => {
      expect(ancestors).not.toContain(id);
      for (const prerequisite of research[id].requires)
        visit(prerequisite, [...ancestors, id]);
    };
    for (const id of researchIds) visit(id, []);
    for (const recipe of Object.values(recipes)) {
      expect(Object.keys(equipmentTypes)).toContain(recipe.kind);
      for (const id of Object.keys(recipe.inputs))
        expect(itemIds).toContain(id);
      if (recipe.requires) expect(researchIds).toContain(recipe.requires);
    }
    for (const destination of Object.values(destinations))
      for (const id of Object.keys(destination.rewards))
        expect(itemIds).toContain(id);
  });
});
