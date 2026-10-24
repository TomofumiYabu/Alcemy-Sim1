import { describe, expect, it } from 'vitest';
import {
  advanceTicks,
  advanceWithEvents,
  applyCommand,
  createGame,
} from '../../src/game/engine';
import { encodeSave } from '../../src/persistence/save';
import { feedbackPayloads } from '../../src/ui/feedback';

describe('transient game results', () => {
  it('reports every simultaneous completion in stable equipment order without changing the input or save contract', () => {
    const state = createGame();
    state.inventory.herb = 200;
    state.inventory.water = 100;
    state.equipment = Array.from({ length: 24 }, (_, i) => ({
      id: i + 1,
      kind: 'cauldron',
      x: i % 6,
      y: Math.floor(i / 6),
      recipe: 'potion',
      enabled: true,
      job: null,
    }));
    state.nextEquipmentId = 25;
    const original = structuredClone(state);
    const result = advanceWithEvents(state, 81);
    expect(result.events).toHaveLength(24);
    expect(
      result.events.map(
        (event) => event.type === 'crafted' && event.equipmentId,
      ),
    ).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(result.state.inventory.potion).toBe(24);
    expect(result.state.knowledge).toBe(24);
    expect(state).toEqual(original);
    expect(JSON.parse(encodeSave(result.state))).not.toHaveProperty('events');
    expect(advanceTicks(state, 81)).toEqual(result.state);
  });

  it('emits the same ordered return and craft events when ticks are split', () => {
    let state = applyCommand(createGame(), { type: 'hire', id: 'iris' }).state;
    state = applyCommand(state, {
      type: 'dispatch',
      id: 'iris',
      destination: 'forest',
    }).state;
    state = applyCommand(state, { type: 'toggle', id: 1 }).state;
    const first = advanceWithEvents(state, 81);
    const second = advanceWithEvents(first.state, 69);
    const third = advanceWithEvents(second.state, 31);
    const combined = advanceWithEvents(state, 181);
    expect([...first.events, ...second.events, ...third.events]).toEqual(
      combined.events,
    );
    expect(combined.events.map((event) => [event.type, event.tick])).toEqual([
      ['crafted', 81],
      ['returned', 150],
      ['crafted', 161],
    ]);
    expect(third.state).toEqual(combined.state);
    expect(advanceWithEvents(state, 0)).toEqual({ state, events: [] });
  });

  it('uses a running batch’s captured reward independently of later research or log wording', () => {
    let state = advanceTicks(
      applyCommand(createGame(), { type: 'toggle', id: 1 }).state,
      1,
    );
    state = {
      ...state,
      research: ['knowledge-1'],
      log: [{ tick: 1, message: '表示文を変更しても演出の判定には使わない' }],
    };
    const result = advanceWithEvents(state, 80);
    expect(result.events).toEqual([
      {
        type: 'crafted',
        tick: 81,
        equipmentId: 1,
        item: 'potion',
        knowledge: 1,
      },
    ]);
    expect(result.state.equipment[0]!.job!.knowledge).toBe(2);
  });

  it('emits sales and research only after a successful atomic command', () => {
    const state = createGame();
    state.inventory.potion = 3;
    state.knowledge = 3;
    const sold = applyCommand(state, { type: 'sell', item: 'potion' });
    expect(sold.events).toEqual([
      { type: 'sold', tick: 0, item: 'potion', amount: 3, earned: 36 },
    ]);
    expect(sold.state.gold - state.gold).toBe(36);
    const empty = applyCommand(sold.state, { type: 'sell', item: 'potion' });
    expect(empty.events).toEqual([]);
    expect(empty.state).toBe(sold.state);
    const researched = applyCommand(sold.state, {
      type: 'research',
      id: 'gathering-1',
    });
    expect(researched.events).toEqual([
      { type: 'researched', tick: 0, id: 'gathering-1' },
    ]);
    expect(
      applyCommand(researched.state, { type: 'research', id: 'gathering-1' })
        .events,
    ).toEqual([]);
  });

  it('groups bursts while retaining per-equipment quantities and exact knowledge', () => {
    expect(
      feedbackPayloads([
        {
          type: 'crafted',
          tick: 81,
          equipmentId: 1,
          item: 'potion',
          knowledge: 1,
        },
        {
          type: 'crafted',
          tick: 81,
          equipmentId: 2,
          item: 'potion',
          knowledge: 2,
        },
        {
          type: 'crafted',
          tick: 161,
          equipmentId: 1,
          item: 'potion',
          knowledge: 1,
        },
        {
          type: 'crafted',
          tick: 121,
          equipmentId: 3,
          item: 'extract',
          knowledge: 1,
        },
      ]),
    ).toEqual([
      {
        type: 'crafted',
        item: 'potion',
        amount: 3,
        knowledge: 4,
        equipment: { 1: 2, 2: 1 },
      },
      {
        type: 'crafted',
        item: 'extract',
        amount: 1,
        knowledge: 1,
        equipment: { 3: 1 },
      },
    ]);
  });
});
