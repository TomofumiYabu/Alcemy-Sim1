import type { Command, GameState } from '../game/types';
export type PanelProps = {
  state: GameState;
  send: (command: Command) => boolean;
};
export type Screen = 'workshop' | 'expeditions' | 'inventory' | 'research';
export type Navigate = (screen: Screen, target?: string) => void;
