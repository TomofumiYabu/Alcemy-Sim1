import type { DestinationId, ItemId, RecipeId } from './types';

export const CONTENT_VERSION = 1;
type Rules = {
  recipes: Record<RecipeId, { ticks: number; knowledge: number }>;
  destinations: Record<
    DestinationId,
    { ticks: number; rewards: Partial<Record<ItemId, number>> }
  >;
  production: { first: number; final: number };
  forestBonus: number;
  knowledgeBonus: number;
  saleMultiplier: number;
};

// Published entries are historical contracts. Add a new version when balancing;
// do not edit an old entry: in-flight work must retain its original rules.
export const contentVersions: Readonly<Record<number, Rules>> = {
  1: {
    recipes: {
      potion: { ticks: 80, knowledge: 1 },
      extract: { ticks: 120, knowledge: 1 },
      mana: { ticks: 200, knowledge: 2 },
    },
    destinations: {
      forest: { ticks: 150, rewards: { herb: 4, water: 2 } },
      ruins: { ticks: 300, rewards: { crystal: 2, water: 2 } },
    },
    production: { first: 0.9, final: 0.8 },
    forestBonus: 1,
    knowledgeBonus: 1,
    saleMultiplier: 1.2,
  },
};
export const currentRules = contentVersions[CONTENT_VERSION]!;
