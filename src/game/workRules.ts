import { itemIds } from './types';
import type {
  Adventurer,
  DestinationId,
  Equipment,
  Inventory,
  ResearchId,
} from './types';
import type { ContentRules } from './contentVersions';

type CraftBase = { ticks: number; knowledge: number };
type ExpeditionBase = { ticks: number; rewards: Partial<Inventory> };
export const emptyInventory = (): Inventory => ({
  herb: 0,
  water: 0,
  crystal: 0,
  potion: 0,
  extract: 0,
  mana: 0,
});

/** Callers choose current catalog values for new work or frozen values for historical work. */
export function craftOutcome(
  base: CraftBase,
  research: readonly ResearchId[],
  rules: ContentRules,
) {
  const multiplier = research.includes('production-3')
    ? rules.production.final
    : research.includes('production-1')
      ? rules.production.first
      : 1;
  return {
    total: Math.round(base.ticks * multiplier),
    knowledge:
      base.knowledge +
      (research.includes('knowledge-1') ? rules.knowledgeBonus : 0),
  };
}
export function expeditionOutcome(
  base: ExpeditionBase,
  destination: DestinationId,
  research: readonly ResearchId[],
  rules: ContentRules,
) {
  const rewards = { ...emptyInventory(), ...base.rewards };
  if (destination === 'forest' && research.includes('gathering-1'))
    rewards.herb += rules.forestBonus;
  return { total: base.ticks, rewards };
}

/** Owned research is monotonic; a running batch may have started before later purchases. */
export function isCapturedCraftValid(
  job: NonNullable<Equipment['job']>,
  owned: readonly ResearchId[],
  rules: ContentRules,
): boolean {
  const base = rules.recipes[job.recipe];
  const current = craftOutcome(base, owned, rules);
  const stages: readonly (readonly ResearchId[])[] = [
    [],
    ['production-1'],
    ['production-3'],
  ];
  const possibleTimes = stages.map(
    (research) => craftOutcome(base, research, rules).total,
  );
  const possibleKnowledge = [
    craftOutcome(base, [], rules).knowledge,
    current.knowledge,
  ];
  return (
    job.remaining <= job.total &&
    job.total >= current.total &&
    possibleTimes.includes(job.total) &&
    possibleKnowledge.includes(job.knowledge)
  );
}
export function isCapturedExpeditionValid(
  trip: NonNullable<Adventurer['trip']>,
  owned: readonly ResearchId[],
  rules: ContentRules,
): boolean {
  const base = rules.destinations[trip.destination];
  const original = expeditionOutcome(base, trip.destination, [], rules);
  const current = expeditionOutcome(base, trip.destination, owned, rules);
  return (
    trip.remaining <= trip.total &&
    trip.total === original.total &&
    [original, current].some((outcome) =>
      itemIds.every((id) => trip.rewards[id] === outcome.rewards[id]),
    )
  );
}
