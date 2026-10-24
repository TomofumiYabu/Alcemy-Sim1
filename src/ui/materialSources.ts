import {
  destinations,
  equipmentTypes,
  recipes,
  research,
} from '../game/content';
import { unlocked } from '../game/engine';
import type { DestinationId, GameState, ItemId, RecipeId } from '../game/types';
import type { Screen } from './types';
export type MaterialSource = { screen: Screen; target: string; label: string };
export function materialSource(state: GameState, item: ItemId): MaterialSource {
  const expedition = (Object.keys(destinations) as DestinationId[]).find(
    (id) => (destinations[id].rewards[item] ?? 0) > 0,
  );
  if (expedition) {
    const destination = destinations[expedition];
    if (!unlocked(state, destination.requires))
      return {
        screen: 'research',
        target: `[data-testid="research-${destination.requires}"]`,
        label: `「${research[destination.requires!].name}」の研究を開く`,
      };
    return {
      screen: 'expeditions',
      target: `expedition:${expedition}`,
      label: `${destination.name}への派遣を開く`,
    };
  }
  const recipe = recipes[item as RecipeId];
  if (recipe) {
    if (!unlocked(state, recipe.requires))
      return {
        screen: 'research',
        target: `[data-testid="research-${recipe.requires}"]`,
        label: `「${research[recipe.requires!].name}」の研究を開く`,
      };
    const equipment = state.equipment.some(
      (entry) => entry.kind === recipe.kind,
    );
    return {
      screen: 'workshop',
      target: equipment
        ? `equipment:${recipe.kind}`
        : `[aria-label="${equipmentTypes[recipe.kind].name}を購入・配置"]`,
      label: equipment
        ? `${equipmentTypes[recipe.kind].name}で${recipe.name}を作る`
        : `${equipmentTypes[recipe.kind].name}の配置を開く`,
    };
  }
  return { screen: 'inventory', target: '', label: '在庫を開く' };
}
