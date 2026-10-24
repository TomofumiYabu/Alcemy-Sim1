import { adventurerTypes } from '../game/content';
import type { GameState } from '../game/types';
import { IrisPortrait } from './Artwork';
import type { Feedback } from './feedback';
import { seconds } from './format';
import type { Navigate } from './types';

export function AdventureBrief({
  state,
  navigate,
  feedback,
}: {
  state: GameState;
  navigate: Navigate;
  feedback: Feedback[];
}) {
  const iris = state.adventurers.find((entry) => entry.id === 'iris')!;
  const returned = feedback.some(
    (event) => event.type === 'returned' && event.adventurerId === 'iris',
  );
  return (
    <button
      className={`adventure-brief ${returned ? 'just-returned' : ''}`}
      aria-label="イリスの冒険者画面を開く"
      onClick={() => navigate('expeditions')}
    >
      <IrisPortrait />
      <span>
        <strong>{adventurerTypes.iris.name}</strong>
        <small>
          {!iris.hired
            ? '採集家を雇って森へ'
            : iris.trip
              ? `帰還まであと${seconds(iris.trip.remaining)}`
              : returned
                ? '素材を持って帰還しました'
                : '待機中 · 次の派遣を選ぶ'}
        </small>
      </span>
      <span aria-hidden="true">→</span>
    </button>
  );
}
