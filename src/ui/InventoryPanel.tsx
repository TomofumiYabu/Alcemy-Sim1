import { useEffect, useRef } from 'react';
import { focusTarget } from './navigation';
import type { NavigationRequest } from './navigation';
import { items } from '../game/content';
import { salePrice } from '../game/engine';
import { itemIds } from '../game/types';
import type { RecipeId } from '../game/types';
import { number } from './format';
import type { PanelProps } from './types';
import { ItemArtwork } from './Artwork';
import type { Feedback } from './feedback';

export function InventoryPanel({
  state,
  send,
  feedback,
  request,
}: PanelProps & {
  feedback: Feedback[];
  request: NavigationRequest<'inventory'> | null;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const rows = useRef<Partial<Record<RecipeId, HTMLElement | null>>>({});
  const buttons = useRef<Partial<Record<RecipeId, HTMLButtonElement | null>>>(
    {},
  );
  useEffect(() => {
    if (!request) return;
    if (request.target)
      focusTarget(
        buttons.current[request.target.item],
        rows.current[request.target.item] ?? heading.current,
      );
    else focusTarget(heading.current, null, false);
  }, [request]);
  return (
    <section id="inventory" className="panel" aria-labelledby="inventory-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">STOCK & MARKET</p>
          <h2 ref={heading} id="inventory-title" tabIndex={-1}>
            在庫と販売
          </h2>
        </div>
        <span className="badge">売上累計 {number(state.stats.earned)}金貨</span>
      </div>
      <p className="muted">素材は工房で共有。製品を売ると金貨になります。</p>
      <div className="inventory-list">
        {itemIds.map((id) => (
          <div
            className={`inventory-row item-${id} ${feedback.some((event) => (event.type === 'crafted' && event.item === id) || (event.type === 'returned' && event.rewards[id] > 0)) ? 'inventory-gain' : ''}`}
            key={id}
            tabIndex={-1}
            ref={(node) => {
              if (items[id].price > 0) rows.current[id as RecipeId] = node;
            }}
          >
            <span className="item-icon" aria-hidden="true">
              <ItemArtwork item={id} />
            </span>
            <div className="item-name">
              <strong>{items[id].name}</strong>
              <small>
                {items[id].category}
                {items[id].price > 0 &&
                  ` · ${salePrice(state, id as RecipeId)}金貨 / 個`}
              </small>
              {id === 'extract' && (
                <small className="intermediate-note">
                  魔力薬の材料にも使います
                </small>
              )}
            </div>
            <strong className="item-count" data-testid={`inventory-${id}`}>
              {number(state.inventory[id])}
            </strong>
            {items[id].price > 0 ? (
              <button
                ref={(node) => {
                  buttons.current[id as RecipeId] = node;
                }}
                className="sell-button"
                aria-label={`${items[id].name}を販売`}
                disabled={state.inventory[id] === 0}
                onClick={() => send({ type: 'sell', item: id as RecipeId })}
              >
                {number(state.inventory[id])}個売却
                <small>
                  +
                  {number(
                    state.inventory[id] * salePrice(state, id as RecipeId),
                  )}
                  金貨
                </small>
              </button>
            ) : (
              <span className="material-badge">素材</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
