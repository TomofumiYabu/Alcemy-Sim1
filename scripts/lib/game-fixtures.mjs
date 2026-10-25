import { createServer } from 'vite';

// Load the real TypeScript engine without adding a runtime TS dependency or opening HMR sockets.
export async function gameModules() {
  const server = await createServer({
    configFile: false,
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  try {
    return {
      engine: await server.ssrLoadModule('/src/game/engine.ts'),
      save: await server.ssrLoadModule('/src/persistence/save.ts'),
      types: await server.ssrLoadModule('/src/game/types.ts'),
    };
  } finally {
    await server.close();
  }
}
export async function verificationFixtures() {
  const { engine, save, types } = await gameModules();
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
  return { key: save.SAVE_KEY, benchmark, advanced, encode: save.encodeSave };
}
