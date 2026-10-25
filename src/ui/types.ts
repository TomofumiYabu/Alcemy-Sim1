import type { Command, GameState } from '../game/types';
export type PanelProps = {
  state: GameState;
  send: (command: Command) => boolean;
};
export type { Navigate, Screen } from './navigation';
