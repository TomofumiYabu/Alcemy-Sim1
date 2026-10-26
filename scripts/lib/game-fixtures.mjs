import { createServer } from 'vite';

// Load the real TypeScript engine without adding a runtime TS dependency or opening HMR sockets.
export async function gameModules() {
  const server = await createServer({
    configFile: false,
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  });
  try {
    return {
      engine: await server.ssrLoadModule('/src/game/engine.ts'),
      day: await server.ssrLoadModule('/src/game/dayEngine.ts'),
      daySave: await server.ssrLoadModule('/src/persistence/daySave.ts'),
      shop: await server.ssrLoadModule('/src/game/shop.ts'),
      save: await server.ssrLoadModule('/src/persistence/save.ts'),
      types: await server.ssrLoadModule('/src/game/types.ts'),
    };
  } finally {
    await server.close();
  }
}
export async function verificationFixtures() {
  const { engine, save, types, day, daySave, shop } = await gameModules();
  const benchmark = engine.createGame();
  benchmark.gold = 1000;
  benchmark.research = ['production-1', 'production-2'];
  Object.assign(benchmark.inventory, {
    herb: 24000,
    water: 12000,
    crystal: 1000,
  });
  benchmark.equipment = Array.from({ length: 24 }, (_, index) => ({
    id: index + 1,
    x: index % 6,
    y: Math.floor(index / 6),
    kind: index % 2 ? 'still' : 'cauldron',
    recipe: index % 2 ? 'extract' : 'potion',
    enabled: true,
    job: null,
  }));
  benchmark.nextEquipmentId = 25;
  for (const adventurer of benchmark.adventurers) adventurer.hired = true;
  const advanced = engine.createGame();
  advanced.gold = 1000;
  advanced.knowledge = 100;
  advanced.research = [...types.researchIds];
  advanced.inventory.herb = 100;
  advanced.equipment[0].recipe = 'mana';
  advanced.equipment.push({
    id: 2,
    x: 1,
    y: 0,
    kind: 'still',
    recipe: 'extract',
    enabled: false,
    job: null,
  });
  advanced.nextEquipmentId = 3;
  advanced.adventurers[0].hired = true;
  for (const state of [benchmark, advanced])
    save.decodeSave(save.encodeSave(state));
  const richWorld = structuredClone(advanced);
  richWorld.inventory.potion = 500;
  richWorld.inventory.extract = 2;
  richWorld.inventory.mana = 2;
  let rich = day.createDayGame(42, richWorld);
  const command = (value) => {
    const result = day.applyDayCommand(rich, value);
    if (result.error) throw new Error(result.error);
    rich = result.state;
  };
  const next = () => {
    command({
      type: 'finish-day',
      completedDays: rich.completedDays,
      revision: rich.revision,
    });
    command({
      type: 'ack-report',
      completedDays: rich.completedDays,
      revision: rich.revision,
    });
  };
  for (let i = 0; i < 100 && rich.shop.fame < 100; i++) {
    const quantity =
      rich.shop.shelves.find((s) => s.item === 'potion')?.quantity ?? 0;
    const amount = shop.shelfCapacity(rich.shop.salesTotal) - quantity;
    if (amount) command({ type: 'stock', item: 'potion', amount });
    next();
  }
  if (rich.shop.fame !== 100)
    throw new Error('Store fixture did not reach its intended maturity');
  while (shop.forecast(rich).visitors < 12) next();
  command({ type: 'remove-shelf', item: 'potion' });
  command({ type: 'stock', item: 'potion', amount: 4 });
  command({ type: 'reserve', item: 'extract', amount: 0 });
  command({ type: 'stock', item: 'extract', amount: 2 });
  command({ type: 'reserve', item: 'extract', amount: 2 });
  command({ type: 'stock', item: 'mana', amount: 2 });
  daySave.validateDayState(rich);
  return {
    key: save.SAVE_KEY,
    benchmark,
    advanced,
    rich,
    fresh: day.createDayGame(42),
    encode: save.encodeSave,
    dayEncode: (state) => JSON.stringify(daySave.validateDayState(state)),
  };
}
