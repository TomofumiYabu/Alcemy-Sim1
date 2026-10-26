import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyDayCommand, createDayGame } from '../../src/game/dayEngine';
import type { DayCommand, DayState } from '../../src/game/dayTypes';
import {
  customerPlans,
  demandFor,
  draw,
  shelfCapacity,
  shopLevel,
  stableSeed,
  visitorCount,
} from '../../src/game/shop';
import {
  DAY_BACKUP_KEY,
  SAVE_KEY,
  commitDayCommand,
  decodeDaySave,
  loadDayGame,
  saveDayGame,
  validateDayState,
} from '../../src/persistence/daySave';
import { LEGACY_BACKUP_KEY } from '../../src/persistence/save';
import { researchIds } from '../../src/game/types';

const send = (s: DayState, c: DayCommand) => {
  const result = applyDayCommand(s, c);
  expect(result.error).toBeNull();
  return result.state;
};
const finish = (s: DayState) =>
  send(s, {
    type: 'finish-day',
    completedDays: s.completedDays,
    revision: s.revision,
  });
const ack = (s: DayState) =>
  send(s, {
    type: 'ack-report',
    completedDays: s.completedDays,
    revision: s.revision,
  });
const playing = (seed = 1) => {
  let s = createDayGame(seed);
  s = send(s, { type: 'hire', id: 'iris' });
  s = send(s, { type: 'dispatch', id: 'iris', destination: 'forest' });
  return send(s, { type: 'toggle', id: 1 });
};
const storage = () => {
  const map = new Map<string, string>();
  let failure: string | null = null;
  return {
    map,
    fail: (key: string | null) => {
      failure = key;
    },
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (failure === k) throw new Error('quota');
      map.set(k, v);
    },
  };
};
const fixed = (name: string) =>
  readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8');

describe('daily work, display shelves and atomic shop settlement', () => {
  it('finishes one exact day without new work at its end; the first loop retains work and raw stock', () => {
    const initial = playing();
    const frozen = structuredClone(initial);
    let s = finish(initial);
    expect(initial).toEqual(frozen);
    expect(s.world.tick).toBe(150);
    expect(s.completedDays).toBe(1);
    expect(s.world.inventory).toMatchObject({ potion: 1, herb: 4, water: 2 });
    expect(s.world.equipment[0]!.job?.remaining).toBe(10);
    expect(s.world.adventurers[0]!.trip).toBeNull();
    expect(s.shop.salesTotal).toBe(0);
    expect(s.lastReport!.sold.potion).toBe(0);
    s = ack(s);
    s = send(s, { type: 'dispatch', id: 'iris', destination: 'forest' });
    s = send(s, { type: 'stock', item: 'potion', amount: 1 });
    s = finish(s);
    expect(s.world.stats.crafted).toBe(3);
    expect(s.world.knowledge).toBe(3);
    expect(s.world.inventory.potion).toBe(2);
    expect(s.world.equipment[0]!.job?.remaining).toBe(20);
    expect(s.shop.salesTotal).toBe(s.world.stats.sold);
    expect(s.world.gold).toBe(80 + s.lastReport!.earned);
    expect(decodeDaySave(JSON.stringify(s))).toEqual(s);
  });
  it('reserves and returns physical stock without money, sales or time changes', () => {
    let s = createDayGame();
    s.world.research = [...researchIds];
    s.shop.shelves = [];
    s.world.inventory.extract = 3;
    expect(
      applyDayCommand(s, { type: 'stock', item: 'extract', amount: 2 }).error,
    ).toBeTruthy();
    s = send(s, { type: 'stock', item: 'extract', amount: 1 });
    expect(s.world.inventory.extract).toBe(2);
    expect(s.shop.shelves[0]!.quantity).toBe(1);
    const sold = finish(s);
    expect(sold.world.inventory.extract).toBe(2);
    expect(sold.shop.salesTotal).toBe(sold.lastReport!.sold.extract);
    s = send(s, { type: 'unstock', item: 'extract', amount: 1 });
    expect(s.world.inventory.extract).toBe(3);
    expect(s.world.gold).toBe(100);
    s = send(s, { type: 'remove-shelf', item: 'extract' });
    expect(s.shop.shelves).toEqual([]);
    expect(s.completedDays).toBe(0);
    expect(s.world.tick).toBe(0);
    expect(s.shop.salesTotal).toBe(0);
  });
  it('does not sell warehouse products, raw materials, same-day output, or accept direct liquidation', () => {
    const s = playing();
    s.world.inventory.potion = 100;
    expect(
      applyDayCommand(s, { type: 'sell', item: 'potion' }).error,
    ).toBeTruthy();
    const end = finish(s);
    expect(end.world.inventory.potion).toBe(101);
    expect(end.world.gold).toBe(s.world.gold);
    expect(end.shop.salesTotal).toBe(0);
    expect(end.lastReport!.earned).toBe(0);
  });
  it('counts S once, distinguishes real nonbuyers, and retains unsold stock', () => {
    let s = createDayGame(42);
    s.world.inventory.potion = 4;
    s = send(s, { type: 'stock', item: 'potion', amount: 4 });
    const end = finish(s),
      r = end.lastReport!;
    const buyers = r.customers.filter((c) => c.reason === 'purchased').length;
    expect(buyers).toBeGreaterThan(0);
    expect(r.salesAfter - r.salesBefore).toBe(buyers);
    expect(end.shop.salesTotal).toBe(buyers);
    expect(end.shop.shelves[0]!.quantity).toBe(4 - buyers);
    expect(
      r.customers.every((c) =>
        c.reason === 'purchased' ? c.earned === 12 : c.earned === 0,
      ),
    ).toBe(true);
    expect(r.customers.length).toBeGreaterThanOrEqual(buyers);
    expect(end.shop.fame).toBe(Math.min(3, buyers));
    const again = applyDayCommand(end, {
      type: 'finish-day',
      completedDays: 0,
      revision: s.revision,
    });
    expect(again.error).toBeTruthy();
    expect(again.state).toBe(end);
    expect(ack(end).shop.salesTotal).toBe(buyers);
  });
  it('has exact growth/capacity and demand-dependent traffic boundaries', () => {
    expect([9, 10, 39, 40].map(shopLevel)).toEqual([1, 2, 2, 3]);
    expect([0, 10, 40].map(shelfCapacity)).toEqual([4, 6, 8]);
    expect(
      [0, 1, 2].map((d) =>
        visitorCount(0, 0, { potion: d, extract: 1, mana: 1 }, ['potion']),
      ),
    ).toEqual([3, 4, 5]);
    expect(
      visitorCount(40, 100, { potion: 2, extract: 2, mana: 2 }, [
        'potion',
        'extract',
        'mana',
      ]),
    ).toBe(12);
  });
  it('uses versioned deterministic draws unaffected by inventories or unrelated keys', () => {
    const first = customerPlans(42, 3, 0, 0, ['potion', 'extract']);
    draw(42, 3, 'unrelated');
    expect(customerPlans(42, 3, 0, 0, ['potion', 'extract'])).toEqual(first);
    expect(demandFor(42, 3)).toEqual({ potion: 1, extract: 1, mana: 1 });
    expect(stableSeed('hello')).toBe(3942580078);
    expect(first).toEqual([
      { at: 38, item: 'extract', willing: true },
      { at: 75, item: 'potion', willing: true },
      { at: 113, item: 'extract', willing: true },
      { at: 150, item: 'extract', willing: true },
    ]);
    expect(stableSeed('same raw legacy')).toBe(stableSeed('same raw legacy'));
    expect(new Set(first.map((p) => p.at)).size).toBe(first.length);
    expect(first.every((p) => ['potion', 'extract'].includes(p.item))).toBe(
      true,
    );
  });
  it('keeps shortened work exact across days and starts no phantom final batch', () => {
    const counts = [];
    for (const stage of [
      [],
      ['production-1'],
      ['production-1', 'production-2', 'production-3'],
    ] as const) {
      let s = createDayGame();
      s.world.research = [...stage];
      s.world.inventory.herb = 100;
      s.world.inventory.water = 100;
      s = send(s, { type: 'toggle', id: 1 });
      for (let i = 0; i < 10; i++) s = ack(finish(s));
      counts.push(s.world.stats.crafted);
    }
    expect(counts).toEqual([18, 20, 23]);
    let s = createDayGame();
    s.world.inventory.herb = 10;
    s.world.inventory.water = 10;
    s.world.equipment[0]!.job = {
      recipe: 'potion',
      contentVersion: 1,
      total: 80,
      remaining: 70,
      knowledge: 1,
    };
    s.world.equipment[0]!.enabled = true;
    s = finish(s);
    expect(s.world.stats.crafted).toBe(2);
    expect(s.world.equipment[0]!.job).toBeNull();
    expect(s.world.inventory.herb).toBe(8);
  });
  it('retains auto destination across an exact boundary and applies later research only to new work', () => {
    let s = playing();
    s.world.research = ['gathering-1', 'gathering-2'];
    s.world.adventurers[0]!.auto = true;
    s = finish(s);
    expect(s.world.adventurers[0]!.trip).toBeNull();
    expect(s.repeatDestinations.iris).toBe('forest');
    s = finish(ack(s));
    expect(s.world.stats.expeditions).toBe(2);
    expect(s.lastReport!.gathered.herb).toBe(5);
    expect(s.world.adventurers[0]!.trip).toBeNull();
  });
  it.each([
    'v1-initial',
    'v1-inflight',
    'v1-researched',
    'v2-inflight',
    'v2-researched',
  ])(
    'preserves fixed %s and creates both required backups before a schema 3 write',
    (name) => {
      const raw = fixed(name),
        old = JSON.parse(raw),
        store = storage();
      store.map.set(SAVE_KEY, raw);
      const s = loadDayGame(store).state;
      expect(s.schemaVersion).toBe(3);
      expect(s.migrated).toBe(true);
      expect(s.world.gold).toBe(old.gold);
      expect(s.world.inventory).toEqual(old.inventory);
      expect(s.world.equipment.map((e) => e.job?.remaining)).toEqual(
        old.equipment.map(
          (e: { job: { remaining: number } | null }) => e.job?.remaining,
        ),
      );
      expect(s.shop.shelves).toEqual([]);
      expect(s.shop.salesTotal).toBe(0);
      expect(s.completedDays).toBe(0);
      expect(loadDayGame(store).state.seed).toBe(s.seed);
      expect(store.map.has(DAY_BACKUP_KEY)).toBe(false);
      expect(saveDayGame(store, s)).toBeNull();
      expect(store.map.get(DAY_BACKUP_KEY)).toBe(raw);
      if (old.schemaVersion === 1)
        expect(store.map.get(LEGACY_BACKUP_KEY)).toBe(raw);
      expect(decodeDaySave(store.map.get(SAVE_KEY)!)).toEqual(s);
      const end = finish(s);
      expect(end.world.tick).toBe(old.tick + 150);
      expect(decodeDaySave(JSON.stringify(end))).toEqual(end);
    },
  );
  it('fails migration without touching the source when backup storage rejects a write', () => {
    const store = storage(),
      raw = fixed('v2-inflight');
    store.map.set(SAVE_KEY, raw);
    store.fail(DAY_BACKUP_KEY);
    const s = loadDayGame(store).state;
    expect(saveDayGame(store, s)).toBeTruthy();
    expect(store.map.get(SAVE_KEY)).toBe(raw);
    store.fail(null);
    expect(saveDayGame(store, s)).toBeNull();
    expect(store.map.get(DAY_BACKUP_KEY)).toBe(raw);
  });
  it('rolls back all day results on save failure and retries with identical customers/results', () => {
    const store = storage();
    let s = playing(42);
    saveDayGame(store, s);
    const command: DayCommand = {
      type: 'finish-day',
      completedDays: 0,
      revision: s.revision,
    };
    const expected = applyDayCommand(s, command);
    store.fail(SAVE_KEY);
    const failed = commitDayCommand(store, s, command);
    expect(failed.state).toBe(s);
    expect(failed.events).toEqual([]);
    expect(loadDayGame(store).state).toEqual(s);
    store.fail(null);
    const done = commitDayCommand(store, s, command);
    expect(done.state).toEqual(expected.state);
    expect(done.error).toBeNull();
    expect(commitDayCommand(store, s, command).error).toBeTruthy();
    s = loadDayGame(store).state;
    expect(s.phase).toBe('report');
    expect(s.completedDays).toBe(1);
    expect(
      applyDayCommand(s, { type: 'buy', kind: 'cauldron', x: 0, y: 0 }).error,
    ).toBeTruthy();
  });
  it('rejects forged demand, double growth, customer receipts, and unsafe currency atomically', () => {
    const s = finish(playing());
    for (const change of [
      (x: DayState) => x.shop.salesTotal++,
      (x: DayState) => x.lastReport!.customers.pop(),
      (x: DayState) => {
        x.lastReport!.demand.potion = (x.lastReport!.demand.potion + 1) % 3;
      },
    ]) {
      const bad = structuredClone(s);
      change(bad);
      expect(() => validateDayState(bad)).toThrow();
    }
    let rich = createDayGame(42);
    rich.world.gold = Number.MAX_SAFE_INTEGER;
    rich.world.inventory.potion = 4;
    rich = send(rich, { type: 'stock', item: 'potion', amount: 4 });
    const result = applyDayCommand(rich, {
      type: 'finish-day',
      completedDays: 0,
      revision: rich.revision,
    });
    expect(result.error).toBeTruthy();
    expect(result.state).toBe(rich);
  });
  it('completes a funded first loop across seeds without excessive selling or material duplication', () => {
    for (let seed = 1; seed <= 12; seed++) {
      let s = playing(seed),
        researched = false;
      for (let d = 0; d < 12; d++) {
        const shelf = s.shop.shelves.find((x) => x.item === 'potion')!;
        const amount = Math.min(
          s.world.inventory.potion,
          shelfCapacity(s.shop.salesTotal) - shelf.quantity,
        );
        if (amount) s = send(s, { type: 'stock', item: 'potion', amount });
        if (!s.world.adventurers[0]!.trip)
          s = send(s, { type: 'dispatch', id: 'iris', destination: 'forest' });
        s = ack(finish(s));
        if (!researched && s.world.knowledge >= 3 && s.world.gold >= 20) {
          s = send(s, { type: 'research', id: 'production-1' });
          researched = true;
        }
        expect(s.shop.salesTotal).toBe(s.world.stats.sold);
        expect(
          s.world.inventory.potion +
            s.shop.shelves[0]!.quantity +
            s.shop.salesTotal,
        ).toBe(s.world.stats.crafted);
        expect(() => validateDayState(s)).not.toThrow();
      }
      expect(researched).toBe(true);
      expect(s.shop.salesTotal).toBeGreaterThan(0);
    }
  });
});
