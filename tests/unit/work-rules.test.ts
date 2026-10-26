import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contentVersions, currentRules } from '../../src/game/contentVersions';
import { advanceTicks } from '../../src/game/engine';
import type { GameState, ResearchId } from '../../src/game/types';
import { craftOutcome, expeditionOutcome } from '../../src/game/workRules';
import { decodeSave, encodeSave } from '../../src/persistence/save';

const fixed = () =>
  JSON.parse(
    readFileSync(
      new URL('../fixtures/v2-inflight.json', import.meta.url),
      'utf8',
    ),
  ) as GameState;
const stages: { research: ResearchId[]; accepted: number[] }[] = [
  { research: [], accepted: [80] },
  { research: ['production-1'], accepted: [80, 72] },
  {
    research: ['production-1', 'production-2', 'production-3'],
    accepted: [80, 72, 64],
  },
];

describe('captured work retains the released save contract', () => {
  it.each(stages)(
    'accepts prior craft speeds for owned research $research and rejects unearned rewards',
    ({ research, accepted }) => {
      for (const knowledgeResearch of [false, true]) {
        const state = fixed();
        state.research = [
          ...research,
          ...(knowledgeResearch ? ['knowledge-1' as const] : []),
        ];
        const valid: { total: number; knowledge: number }[] = [];
        for (const total of [63, 64, 65, 71, 72, 73, 79, 80, 81]) {
          for (const knowledge of [1, 2, 3]) {
            state.equipment[0]!.job = {
              contentVersion: 1,
              recipe: 'potion',
              total,
              remaining: 5,
              knowledge,
            };
            try {
              decodeSave(encodeSave(state));
              valid.push({ total, knowledge });
            } catch {
              /* rejected candidate */
            }
          }
        }
        const expected = accepted.flatMap((total) =>
          (knowledgeResearch ? [1, 2] : [1]).map((knowledge) => ({
            total,
            knowledge,
          })),
        );
        expect(valid).toEqual(
          expected.sort(
            (a, b) => a.total - b.total || a.knowledge - b.knowledge,
          ),
        );
      }
    },
  );

  it.each([false, true])(
    'accepts earlier expedition rewards with forest research %s and rejects inflated other materials',
    (owned) => {
      const state = fixed();
      state.research = owned ? ['gathering-1'] : [];
      const accepted: number[] = [];
      for (const herb of [3, 4, 5, 6]) {
        state.adventurers[0]!.trip!.rewards.herb = herb;
        try {
          decodeSave(encodeSave(state));
          accepted.push(herb);
        } catch {
          /* rejected candidate */
        }
      }
      expect(accepted).toEqual(owned ? [4, 5] : [4]);
      state.adventurers[0]!.trip!.rewards.herb = 4;
      state.adventurers[0]!.trip!.rewards.water = 3;
      expect(() => decodeSave(encodeSave(state))).toThrow();
    },
  );

  it('restores and completes work from two registered rule versions without recalculating its captured outcomes', () => {
    const second = structuredClone(currentRules);
    second.recipes.potion = { ticks: 90, knowledge: 2 };
    second.destinations.forest = { ticks: 170, rewards: { herb: 7, water: 3 } };
    Object.defineProperty(contentVersions, 99, {
      value: second,
      configurable: true,
    });
    try {
      const state = fixed();
      state.equipment[0]!.enabled = false;
      const craft = craftOutcome(second.recipes.potion, [], second);
      state.equipment.push({
        id: 2,
        kind: 'cauldron',
        x: 0,
        y: 0,
        recipe: 'potion',
        enabled: false,
        job: { ...craft, contentVersion: 99, recipe: 'potion', remaining: 20 },
      });
      state.nextEquipmentId = 3;
      const trip = expeditionOutcome(
        second.destinations.forest,
        'forest',
        [],
        second,
      );
      state.adventurers[1]!.hired = true;
      state.adventurers[1]!.trip = {
        ...trip,
        contentVersion: 99,
        destination: 'forest',
        remaining: 170,
      };
      const restored = decodeSave(encodeSave(state));
      expect(
        restored.equipment.map((entry) => entry.job?.contentVersion),
      ).toEqual([1, 99]);
      const progressed = advanceTicks(restored, 120);
      expect(progressed.inventory.potion).toBe(2);
      expect(progressed.knowledge).toBe(3);
      expect(progressed.adventurers[1]!.trip).toMatchObject({
        total: 170,
        remaining: 50,
        rewards: { herb: 7, water: 3 },
      });
      expect(decodeSave(encodeSave(progressed))).toEqual(progressed);
      expect(advanceTicks(progressed, 50).inventory.herb).toBe(13);
    } finally {
      Reflect.deleteProperty(contentVersions, 99);
    }
  });

  it('keeps a captured batch through later research purchases and movement', () => {
    const state = fixed();
    state.research = [
      'production-1',
      'production-2',
      'production-3',
      'knowledge-1',
    ];
    state.equipment[0]!.x = 0;
    state.equipment[0]!.y = 0;
    const restored = decodeSave(encodeSave(state));
    expect(restored.equipment[0]!.job).toEqual(state.equipment[0]!.job);
    expect(advanceTicks(restored, 51).knowledge).toBe(1);
    const impossible = structuredClone(restored);
    impossible.equipment[0]!.job!.total = 63;
    expect(() => decodeSave(encodeSave(impossible))).toThrow();
  });
});
