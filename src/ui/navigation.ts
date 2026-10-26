import type {
  AdventurerId,
  DestinationId,
  EquipmentKind,
  RecipeId,
  ResearchId,
} from '../game/types';

/** Semantic requests are independent of labels, CSS and test IDs. They never execute game commands. */
export type Navigation =
  | {
      screen: 'workshop';
      target?:
        | { type: 'equipment'; kind?: EquipmentKind }
        | { type: 'purchase'; kind: EquipmentKind };
    }
  | {
      screen: 'expeditions';
      target?:
        | { type: 'hire' | 'dispatch'; adventurer: AdventurerId }
        | { type: 'destination'; destination: DestinationId };
    }
  | { screen: 'inventory'; target?: { type: 'stock'; item: RecipeId } }
  | { screen: 'research'; target?: { type: 'research'; id: ResearchId } };
export type Screen = Navigation['screen'];
export type NavigationRequest<S extends Screen = Screen> = Extract<
  Navigation,
  { screen: S }
> & { sequence: number };
export type Navigate = (navigation: Navigation) => void;
export type GuidedAction = { label: string; navigation: Navigation };

export function focusTarget(
  target: HTMLElement | null | undefined,
  fallback: HTMLElement | null | undefined,
  scroll = true,
) {
  const element =
    !target || target.matches(':disabled, [aria-disabled="true"]')
      ? fallback
      : target;
  if (!element) return;
  element.focus({ preventScroll: true });
  if (scroll) element.scrollIntoView({ block: 'nearest' });
}
