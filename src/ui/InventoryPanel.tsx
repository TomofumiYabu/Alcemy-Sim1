import { items } from '../game/content';
import { salePrice } from '../game/engine';
import { itemIds } from '../game/types';
import type { RecipeId } from '../game/types';
import { number } from './format';
import type { PanelProps } from './types';

export function InventoryPanel({ state, send }: PanelProps) {
  return (
    <section id="inventory" className="panel" aria-labelledby="inventory-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">STOCK & MARKET</p>
          <h2 id="inventory-title">在庫と販売</h2>
        </div>
        <span className="badge">売上累計 {number(state.stats.earned)}金貨</span>
      </div>
      <p className="muted">素材は工房で共有。製品を売ると金貨になります。</p>
      <div className="inventory-list">
        {itemIds.map((id) => (
          <div className={`inventory-row item-${id}`} key={id}>
            <span className="item-icon" aria-hidden="true">
              {items[id].icon}
            </span>
            <div className="item-name">
              <strong>{items[id].name}</strong>
              <small>
                {items[id].category}
                {items[id].price > 0 &&
                  ` · ${salePrice(state, id as RecipeId)}金貨 / 個`}
              </small>
            </div>
            <strong className="item-count" data-testid={`inventory-${id}`}>
              {number(state.inventory[id])}
            </strong>
            {items[id].price > 0 ? (
              <button
                className="sell-button"
                aria-label={`${items[id].name}を販売`}
                disabled={state.inventory[id] === 0}
                onClick={() => send({ type: 'sell', item: id as RecipeId })}
              >
                すべて売る
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
