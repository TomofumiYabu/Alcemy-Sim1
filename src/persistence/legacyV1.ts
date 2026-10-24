// Frozen schema of the released MVP. Do not derive it from current content or schemas.
import { z } from 'zod';

export const itemIds = [
  'herb',
  'water',
  'crystal',
  'potion',
  'extract',
  'mana',
] as const;
export const recipeIds = ['potion', 'extract', 'mana'] as const;
export const researchIds = [
  'gathering-1',
  'gathering-2',
  'gathering-3',
  'production-1',
  'production-2',
  'production-3',
  'knowledge-1',
  'knowledge-2',
  'knowledge-3',
] as const;
export type ItemId = (typeof itemIds)[number];
export type RecipeId = (typeof recipeIds)[number];
export type ResearchId = (typeof researchIds)[number];
export type EquipmentKind = 'cauldron' | 'still';
export type DestinationId = 'forest' | 'ruins';
export type AdventurerId = 'iris' | 'rowan';

const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const inventorySchema = z.strictObject({
  herb: integer,
  water: integer,
  crystal: integer,
  potion: integer,
  extract: integer,
  mana: integer,
});
export const legacyV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  tick: integer,
  gold: integer,
  knowledge: integer,
  inventory: inventorySchema,
  research: z.array(z.enum(researchIds)).max(9),
  equipment: z
    .array(
      z.strictObject({
        id: integer.min(1),
        kind: z.enum(['cauldron', 'still']),
        x: integer.max(5),
        y: integer.max(3),
        recipe: z.enum(recipeIds),
        enabled: z.boolean(),
        job: z
          .strictObject({
            recipe: z.enum(recipeIds),
            remaining: integer.min(1),
            total: integer.min(1),
            knowledge: integer.min(1).max(3),
          })
          .nullable(),
      }),
    )
    .min(1)
    .max(24),
  nextEquipmentId: integer.min(2),
  adventurers: z
    .array(
      z.strictObject({
        id: z.enum(['iris', 'rowan']),
        hired: z.boolean(),
        auto: z.boolean(),
        trip: z
          .strictObject({
            destination: z.enum(['forest', 'ruins']),
            remaining: integer.min(1),
            total: integer.min(1),
            rewards: inventorySchema,
          })
          .nullable(),
      }),
    )
    .length(2),
  stats: z.strictObject({
    expeditions: integer,
    crafted: integer,
    sold: integer,
    earned: integer,
  }),
  log: z
    .array(z.strictObject({ tick: integer, message: z.string().max(200) }))
    .max(30),
});
