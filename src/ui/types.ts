import type { GameState } from '../game/types';
import type { Shelf } from '../game/dayTypes';
import type { DayCommand } from '../game/dayTypes';
export type PanelProps = {
  state: GameState;
  shelves?: readonly Shelf[] | undefined;
  send: (command: DayCommand) => boolean;
};
export type { Navigate, Screen } from './navigation';
