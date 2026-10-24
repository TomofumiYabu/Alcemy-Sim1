import type {
  AdventurerId,
  DestinationId,
  Inventory,
  RecipeId,
  ResearchId,
} from './types';

/** Transient results of a transition. These are never part of a saved GameState. */
export type GameEvent = { tick: number } & (
  | { type: 'crafted'; equipmentId: number; item: RecipeId; knowledge: number }
  | {
      type: 'returned';
      adventurerId: AdventurerId;
      destination: DestinationId;
      rewards: Inventory;
    }
  | { type: 'sold'; item: RecipeId; amount: number; earned: number }
  | { type: 'researched'; id: ResearchId }
);
