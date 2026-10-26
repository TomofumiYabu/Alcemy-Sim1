import { items, recipes } from './content';
import { recipeIds } from './types';
import type { RecipeId } from './types';
import type { Customer, DayState, Demand, Products, Shelf } from './dayTypes';

export const DAY_WORK = 150;
export const SHOP_RULES_VERSION = 2;
export const emptyProducts = (): Products => ({
  potion: 0,
  extract: 0,
  mana: 0,
});
export const shopLevel = (sales: number) =>
  sales < 10 ? 1 : sales < 40 ? 2 : 3;
export const shelfCapacity = (sales: number) => 2 + 2 * shopLevel(sales);
export function stableSeed(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++)
    value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0 || 1;
}
// Versioned counter-based draws: inventory branches never consume another customer's draw.
export const draw = (seed: number, day: number, key: string) =>
  stableSeed(`2/${seed}/${day}/${key}`) / 0x100000000;
export function demandFor(seed: number, day: number): Demand {
  return Object.fromEntries(
    recipeIds.map((item) => {
      const value = draw(seed, day, `demand/${item}`);
      return [item, value < 0.2 ? 0 : value < 0.8 ? 1 : 2];
    }),
  ) as Demand;
}
export const availableProducts = (state: DayState) =>
  recipeIds.filter(
    (id) =>
      !recipes[id].requires ||
      state.world.research.includes(recipes[id].requires!),
  );
export function visitorCount(
  sales: number,
  fame: number,
  demand: Demand,
  available: readonly RecipeId[],
) {
  const trend = available.some((id) => demand[id] === 2)
    ? 1
    : available.every((id) => demand[id] === 0)
      ? -1
      : 0;
  return Math.max(
    3,
    Math.min(
      12,
      4 + 2 * (shopLevel(sales) - 1) + Math.floor(fame / 25) + trend,
    ),
  );
}
export function customerPlans(
  seed: number,
  day: number,
  sales: number,
  fame: number,
  available: readonly RecipeId[],
) {
  const demand = demandFor(seed, day);
  const count = visitorCount(sales, fame, demand, available);
  const base: Products = { potion: 6, extract: 3, mana: 1 };
  const sum = available.reduce(
    (total, id) => total + base[id] * (demand[id] + 1),
    0,
  );
  return Array.from({ length: count }, (_, i) => {
    let value = draw(seed, day, `wish/${i}`) * sum;
    const item =
      available.find((id) => {
        value -= base[id] * (demand[id] + 1);
        return value < 0;
      }) ?? available.at(-1)!;
    return {
      at: Math.ceil(((i + 1) * DAY_WORK) / count),
      item,
      willing: draw(seed, day, `buy/${i}`) < 0.8,
    };
  });
}
export function purchase(
  plan: ReturnType<typeof customerPlans>[number],
  shelves: Shelf[],
  prices: Products,
): Customer {
  const shelf = shelves.find((row) => row.item === plan.item);
  const reason = !plan.willing
    ? 'browsing'
    : !shelf
      ? 'unlisted'
      : shelf.quantity === 0
        ? 'outOfStock'
        : 'purchased';
  if (reason === 'purchased') shelf!.quantity--;
  return {
    at: plan.at,
    item: plan.item,
    reason,
    earned: reason === 'purchased' ? prices[plan.item] : 0,
  };
}
export const pricesFor = (bonus: boolean): Products =>
  Object.fromEntries(
    recipeIds.map((id) => [
      id,
      Math.floor(items[id].price * (bonus ? 1.2 : 1)),
    ]),
  ) as Products;
export function forecast(state: DayState) {
  const available = availableProducts(state);
  const demand = demandFor(state.seed, state.completedDays + 1);
  return {
    available,
    demand,
    visitors: visitorCount(
      state.shop.salesTotal,
      state.shop.fame,
      demand,
      available,
    ),
  };
}
