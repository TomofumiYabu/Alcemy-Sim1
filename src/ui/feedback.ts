import type { GameEvent } from '../game/events';
import type {
  AdventurerId,
  Inventory,
  RecipeId,
  ResearchId,
} from '../game/types';

export type FeedbackPayload =
  | {
      type: 'crafted';
      item: RecipeId;
      amount: number;
      knowledge: number;
      equipment: Record<number, number>;
    }
  | { type: 'returned'; adventurerId: AdventurerId; rewards: Inventory }
  | { type: 'sold'; item: RecipeId; amount: number; earned: number }
  | { type: 'researched'; researchId: ResearchId };
export type Feedback = FeedbackPayload & {
  id: number;
  key: string;
  updatedAt: number;
  expiresAt: number;
};
export const FEEDBACK_LIFETIME = 2800;
export const FEEDBACK_LIMIT = 4;

/** Batch simultaneous completions without losing their quantities or replaying logs. */
export function feedbackPayloads(events: GameEvent[]): FeedbackPayload[] {
  const grouped: FeedbackPayload[] = [];
  for (const event of events) {
    if (event.type === 'crafted') {
      let entry = grouped.find(
        (candidate) =>
          candidate.type === 'crafted' && candidate.item === event.item,
      );
      if (!entry || entry.type !== 'crafted') {
        entry = {
          type: 'crafted',
          item: event.item,
          amount: 0,
          knowledge: 0,
          equipment: {},
        };
        grouped.push(entry);
      }
      entry.amount++;
      entry.knowledge += event.knowledge;
      entry.equipment[event.equipmentId] =
        (entry.equipment[event.equipmentId] ?? 0) + 1;
    } else if (event.type === 'returned') {
      grouped.push({
        type: 'returned',
        adventurerId: event.adventurerId,
        rewards: event.rewards,
      });
    } else if (event.type === 'sold') {
      grouped.push({
        type: 'sold',
        item: event.item,
        amount: event.amount,
        earned: event.earned,
      });
    } else {
      grouped.push({ type: 'researched', researchId: event.id });
    }
  }
  return grouped;
}

export function feedbackKey(event: FeedbackPayload) {
  return event.type === 'returned'
    ? `returned-${event.adventurerId}`
    : event.type === 'researched'
      ? `researched-${event.researchId}`
      : `${event.type}-${event.item}`;
}
