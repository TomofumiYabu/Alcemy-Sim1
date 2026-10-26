import { z } from 'zod';
import { stateSchema, recipeIds } from './types';
import type { Command, DestinationId } from './types';

export const safeInteger = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const productSchema = z.strictObject({
  potion: safeInteger,
  extract: safeInteger,
  mana: safeInteger,
});
const demandSchema = z.strictObject({
  potion: z.number().int().min(0).max(2),
  extract: z.number().int().min(0).max(2),
  mana: z.number().int().min(0).max(2),
});
export const shelfSchema = z.strictObject({
  item: z.enum(recipeIds),
  quantity: safeInteger,
});
const shelvesSchema = z.array(shelfSchema).max(3);
const destination = z.enum(['forest', 'ruins']).nullable();
const outcomeSchema = z.strictObject({
  at: safeInteger.min(1).max(150),
  item: z.enum(recipeIds),
  reason: z.enum(['purchased', 'browsing', 'unlisted', 'outOfStock']),
  earned: safeInteger,
});
export const reportSchema = z.strictObject({
  day: safeInteger.min(1),
  rulesVersion: z.literal(2),
  startTick: safeInteger,
  endTick: safeInteger,
  available: z.array(z.enum(recipeIds)).min(1).max(3),
  demand: demandSchema,
  prices: productSchema,
  openingShelves: shelvesSchema,
  closingShelves: shelvesSchema,
  customers: z.array(outcomeSchema).min(3).max(12),
  sold: productSchema,
  earned: safeInteger,
  produced: productSchema,
  gathered: stateSchema.shape.inventory,
  knowledgeGained: safeInteger,
  closingInventory: stateSchema.shape.inventory,
  openingGold: safeInteger,
  closingGold: safeInteger,
  salesBefore: safeInteger,
  salesAfter: safeInteger,
  fameBefore: safeInteger.max(100),
  fameAfter: safeInteger.max(100),
});
export const daySchema = z.strictObject({
  schemaVersion: z.literal(3),
  contentVersion: z.literal(2),
  world: stateSchema,
  completedDays: safeInteger,
  revision: safeInteger,
  phase: z.enum(['planning', 'report']),
  migrated: z.boolean(),
  seed: safeInteger.min(1).max(0xffffffff),
  repeatDestinations: z.strictObject({ iris: destination, rowan: destination }),
  shop: z.strictObject({
    shelves: shelvesSchema,
    reserve: productSchema,
    salesTotal: safeInteger,
    fame: safeInteger.max(100),
  }),
  lastReport: reportSchema.nullable(),
});
export type DayState = z.infer<typeof daySchema>;
export type DayReport = z.infer<typeof reportSchema>;
export type Products = z.infer<typeof productSchema>;
export type Demand = z.infer<typeof demandSchema>;
export type Shelf = z.infer<typeof shelfSchema>;
export type Customer = z.infer<typeof outcomeSchema>;
export type DayCommand =
  | Command
  | { type: 'stock'; item: Shelf['item']; amount: number }
  | { type: 'unstock'; item: Shelf['item']; amount: number }
  | { type: 'remove-shelf'; item: Shelf['item'] }
  | { type: 'reserve'; item: Shelf['item']; amount: number }
  | { type: 'finish-day'; completedDays: number; revision: number }
  | { type: 'ack-report'; completedDays: number; revision: number };
export type RepeatDestination = DestinationId | null;
