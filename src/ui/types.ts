import type { GameState } from '../game/types';
import type { DayCommand } from '../game/dayTypes';
export type PanelProps = {
  state: GameState;
  send: (command: DayCommand) => boolean;
};
export type { Navigate, Screen } from './navigation';
