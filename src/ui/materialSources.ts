import {
  destinations,
  equipmentTypes,
  recipes,
  research,
} from '../game/content';
import { unlocked } from '../game/engine';
import type { DestinationId, GameState, ItemId, RecipeId } from '../game/types';
import type { GuidedAction } from './navigation';
export type MaterialSource = GuidedAction;
export function materialSource(state: GameState, item: ItemId): MaterialSource {
  const expedition = (Object.keys(destinations) as DestinationId[]).find(
    (id) => (destinations[id].rewards[item] ?? 0) > 0,
  );
  if (expedition) {
    const destination = destinations[expedition];
    if (!unlocked(state, destination.requires))
      return {
        navigation: {
          screen: 'research',
          target: { type: 'research', id: destination.requires! },
        },
        label: `「${research[destination.requires!].name}」の研究を開く`,
      };
    return {
      navigation: {
        screen: 'expeditions',
        target: { type: 'destination', destination: expedition },
      },
      label: `${destination.name}への派遣を開く`,
    };
  }
  const recipe = recipes[item as RecipeId];
  if (recipe) {
    if (!unlocked(state, recipe.requires))
      return {
        navigation: {
          screen: 'research',
          target: { type: 'research', id: recipe.requires! },
        },
        label: `「${research[recipe.requires!].name}」の研究を開く`,
      };
    const equipment = state.equipment.some(
      (entry) => entry.kind === recipe.kind,
    );
    return {
      navigation: {
        screen: 'workshop',
        target: equipment
          ? { type: 'equipment', kind: recipe.kind }
          : { type: 'purchase', kind: recipe.kind },
      },
      label: equipment
        ? `${equipmentTypes[recipe.kind].name}で${recipe.name}を作る`
        : `${equipmentTypes[recipe.kind].name}の配置を開く`,
    };
  }
  return { navigation: { screen: 'inventory' }, label: '在庫を開く' };
}
