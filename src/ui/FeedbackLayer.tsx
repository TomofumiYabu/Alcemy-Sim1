import { adventurerTypes, items, research } from '../game/content';
import { itemIds } from '../game/types';
import type { Feedback } from './feedback';
import { IrisPortrait, ItemArtwork } from './Artwork';
import { number } from './format';

export function FeedbackLayer({ feedback }: { feedback: Feedback[] }) {
  return (
    <div
      className="feedback-feed"
      role="log"
      aria-live="polite"
      aria-label="工房の出来事"
      aria-relevant="additions text"
    >
      {feedback.slice(-2).map((event) => (
        <div
          key={event.id}
          className={`feedback-card feedback-${event.type}`}
          data-feedback={event.type}
        >
          {event.type === 'crafted' ? (
            <>
              <ItemArtwork item={event.item} />
              <div>
                <strong>
                  {items[event.item].name} +{number(event.amount)}
                </strong>
                <small>合成完了 · 知識 +{number(event.knowledge)}</small>
              </div>
            </>
          ) : event.type === 'returned' ? (
            <>
              {event.adventurerId === 'iris' ? (
                <IrisPortrait />
              ) : (
                <span className="feedback-symbol" aria-hidden="true">
                  R
                </span>
              )}
              <div>
                <strong>
                  {adventurerTypes[event.adventurerId].name}が帰還
                </strong>
                <small>
                  {itemIds
                    .filter((id) => event.rewards[id] > 0)
                    .map((id) => `${items[id].name} +${event.rewards[id]}`)
                    .join(' · ')}
                </small>
              </div>
            </>
          ) : event.type === 'sold' ? (
            <>
              <ItemArtwork item={event.item} />
              <div>
                <strong>金貨 +{number(event.earned)}</strong>
                <small>
                  {items[event.item].name}を{number(event.amount)}個販売
                </small>
              </div>
            </>
          ) : (
            <>
              <span className="feedback-symbol" aria-hidden="true">
                ✧
              </span>
              <div>
                <strong>{research[event.researchId].name}</strong>
                <small>
                  研究完了 · {research[event.researchId].description}
                </small>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
