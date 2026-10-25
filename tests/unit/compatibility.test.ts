import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { destinations, recipes } from '../../src/game/content';
import { CONTENT_VERSION, currentRules } from '../../src/game/contentVersions';
import {
  advanceTicks,
  applyCommand,
  createGame,
  getCraftPreview,
  getExpeditionPreview,
} from '../../src/game/engine';
import {
  decodeSave,
  encodeSave,
  LEGACY_BACKUP_KEY,
  SAVE_KEY,
  saveGame,
} from '../../src/persistence/save';

const fixture = (name: string) =>
  readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8');
const original = {
  ticks: recipes.potion.ticks,
  knowledge: recipes.potion.knowledge,
  tripTicks: destinations.forest.ticks,
  rewards: destinations.forest.rewards,
};
afterEach(() => {
  recipes.potion.ticks = original.ticks;
  recipes.potion.knowledge = original.knowledge;
  destinations.forest.ticks = original.tripTicks;
  destinations.forest.rewards = original.rewards;
});

describe('published v1 compatibility and historical job rules', () => {
  it.each(['v2-inflight', 'v2-researched'])(
    'restores fixed published %s work and completes it without changing captured conditions',
    (name) => {
      const raw = fixture(name);
      const original = JSON.parse(raw);
      const restored = decodeSave(raw);
      expect(restored).toEqual(original);
      expect(decodeSave(encodeSave(restored))).toEqual(original);
      const paused = structuredClone(restored);
      for (const entry of paused.equipment) entry.enabled = false;
      for (const entry of paused.adventurers) entry.auto = false;
      const crafts = paused.equipment.filter((entry) => entry.job);
      const trips = paused.adventurers.filter((entry) => entry.trip);
      const ticks = Math.max(
        0,
        ...crafts.map((entry) => entry.job!.remaining),
        ...trips.map((entry) => entry.trip!.remaining),
      );
      const completed = advanceTicks(paused, ticks);
      expect(completed.stats.crafted - paused.stats.crafted).toBe(
        crafts.length,
      );
      expect(completed.stats.expeditions - paused.stats.expeditions).toBe(
        trips.length,
      );
      expect(completed.knowledge - paused.knowledge).toBe(
        crafts.reduce((sum, entry) => sum + entry.job!.knowledge, 0),
      );
      expect(decodeSave(encodeSave(completed))).toEqual(completed);
    },
  );
  it.each(['v1-initial', 'v1-inflight', 'v1-researched'])(
    'migrates fixed %s data without changing inventory, research or remaining work',
    (name) => {
      const raw = fixture(name);
      const old = JSON.parse(raw);
      const migrated = decodeSave(raw);
      expect(migrated.schemaVersion).toBe(2);
      expect(migrated.contentVersion).toBe(CONTENT_VERSION);
      expect(migrated.inventory).toEqual(old.inventory);
      expect(migrated.research).toEqual(old.research);
      expect(migrated.tick).toBe(old.tick);
      expect(migrated.gold).toBe(old.gold);
      for (const [i, entry] of migrated.equipment.entries()) {
        if (entry.job)
          expect(entry.job).toEqual({
            ...old.equipment[i].job,
            contentVersion: 1,
          });
      }
      for (const [i, entry] of migrated.adventurers.entries()) {
        if (entry.trip)
          expect(entry.trip).toEqual({
            ...old.adventurers[i].trip,
            contentVersion: 1,
          });
      }
      expect(decodeSave(encodeSave(migrated))).toEqual(migrated);
      expect(decodeSave(encodeSave(advanceTicks(migrated, 20)))).toEqual(
        advanceTicks(migrated, 20),
      );
    },
  );
  it('accepts an old running job after current recipe duration and knowledge values change', () => {
    const raw = fixture('v1-inflight');
    const v2 = encodeSave(decodeSave(raw));
    recipes.potion.ticks = 81;
    recipes.potion.knowledge = 2;
    for (const save of [raw, v2]) {
      const restored = decodeSave(save);
      expect(restored.equipment[0]!.job).toMatchObject({
        total: 80,
        remaining: 51,
        knowledge: 1,
      });
      const completed = advanceTicks(restored, 51);
      expect(completed.stats.crafted).toBe(1);
      expect(completed.knowledge).toBe(1);
    }
  });
  it('accepts old expedition rewards and time after the current destination is balanced', () => {
    const raw = fixture('v1-inflight');
    destinations.forest.ticks = 200;
    destinations.forest.rewards = { herb: 7, water: 3 };
    const restored = decodeSave(raw);
    expect(restored.adventurers[0]!.trip).toMatchObject({
      total: 150,
      remaining: 120,
      rewards: { herb: 4, water: 2 },
    });
    const completed = advanceTicks(restored, 120);
    expect(completed.stats.expeditions).toBe(1);
    expect(completed.inventory.herb).toBe(4); // other herbs have been reserved by the running cauldron
  });
  it('continues rejecting inflated legacy job rewards and unknown content versions', () => {
    const old = JSON.parse(fixture('v1-inflight'));
    old.equipment[0].job.knowledge = 3;
    expect(() => decodeSave(JSON.stringify(old))).toThrow();
    const state = decodeSave(fixture('v1-inflight'));
    state.equipment[0]!.job!.contentVersion = 999;
    expect(() => decodeSave(encodeSave(state))).toThrow();
    state.contentVersion = 999;
    expect(() => decodeSave(encodeSave(state))).toThrow();
  });
  it('backs up the original v1 bytes once before writing a migrated save', () => {
    const original = fixture('v1-inflight');
    const values = new Map([[SAVE_KEY, original]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const state = decodeSave(original);
    expect(saveGame(storage, state)).toBeNull();
    expect(values.get(LEGACY_BACKUP_KEY)).toBe(original);
    expect(JSON.parse(values.get(SAVE_KEY)!).schemaVersion).toBe(2);
    saveGame(storage, advanceTicks(state, 10));
    expect(values.get(LEGACY_BACKUP_KEY)).toBe(original);
  });
  it('does not replace v1 data when its backup cannot be saved', () => {
    const old = fixture('v1-inflight');
    let writes = 0;
    const storage = {
      getItem: (key: string) => (key === SAVE_KEY ? old : null),
      setItem: () => {
        writes++;
        throw new Error('quota');
      },
    };
    expect(saveGame(storage, decodeSave(old))).toContain('保存に失敗');
    expect(writes).toBe(1);
  });
  it('uses the same preview when starting a craft or expedition', () => {
    let state = createGame();
    const preview = getCraftPreview(state, 'potion');
    state = advanceTicks(
      applyCommand(state, { type: 'toggle', id: 1 }).state,
      1,
    );
    expect(state.equipment[0]!.job).toEqual({
      ...preview,
      remaining: preview.total,
    });
    state = applyCommand(state, { type: 'hire', id: 'iris' }).state;
    const trip = getExpeditionPreview(state, 'forest');
    state = applyCommand(state, {
      type: 'dispatch',
      id: 'iris',
      destination: 'forest',
    }).state;
    expect(state.adventurers[0]!.trip).toEqual({
      ...trip,
      remaining: trip.total,
    });
  });
  it('requires current content to match its published rules entry', () => {
    for (const [id, rule] of Object.entries(currentRules.recipes))
      expect(recipes[id as keyof typeof recipes]).toMatchObject(rule);
    for (const [id, rule] of Object.entries(currentRules.destinations))
      expect(destinations[id as keyof typeof destinations]).toMatchObject(rule);
  });
});
