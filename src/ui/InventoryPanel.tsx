import { useEffect, useRef, useState } from 'react';
import { items, recipes, research } from '../game/content';
import { salePrice } from '../game/engine';
import { recipeIds } from '../game/types';
import type { RecipeId } from '../game/types';
import type { DayState } from '../game/dayTypes';
import {
  availableProducts,
  forecast,
  shelfCapacity,
  shopLevel,
} from '../game/shop';
import { number } from './format';
import type { PanelProps } from './types';
import { ItemArtwork } from './Artwork';
import type { Feedback } from './feedback';
import { focusTarget } from './navigation';
import type { NavigationRequest } from './navigation';

const demandNames = ['低い', '通常', '高い'];
function ProductShelf({
  item,
  day,
  send,
  cardRef,
  buttonRef,
  returnRef,
}: {
  item: RecipeId;
  day: DayState;
  send: PanelProps['send'];
  cardRef: (el: HTMLElement | null) => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
  returnRef: (el: HTMLButtonElement | null) => void;
}) {
  const [amount, setAmount] = useState(1);
  const [reserve, setReserve] = useState(day.shop.reserve[item]);
  useEffect(() => setReserve(day.shop.reserve[item]), [day.shop.reserve[item]]);
  const shelf = day.shop.shelves.find((s) => s.item === item);
  const available = availableProducts(day).includes(item);
  const warehouse = day.world.inventory[item],
    shelfQty = shelf?.quantity ?? 0;
  const movable = Math.max(0, warehouse - day.shop.reserve[item]);
  const valid = Number.isSafeInteger(amount) && amount > 0;
  const room = shelfCapacity(day.shop.salesTotal) - shelfQty;
  const full =
    !shelf && day.shop.shelves.length >= shopLevel(day.shop.salesTotal);
  const reason = !available
    ? `「${research[recipes[item].requires!].name}」で解放`
    : full
      ? '棚枠がいっぱいです'
      : movable === 0
        ? '倉庫の在庫・製作用確保を確認してください'
        : room === 0
          ? '棚の容量に達しています'
          : null;
  const names = items[item].name;
  return (
    <article
      className="shop-product"
      ref={cardRef}
      tabIndex={-1}
      data-testid={`shelf-${item}`}
    >
      <div className="shop-product-heading">
        <ItemArtwork item={item} />
        <h3>{names}</h3>
        <span>{salePrice(day.world, item)}金貨 / 個</span>
      </div>
      <p>
        需要：<strong>{demandNames[forecast(day).demand[item]]}</strong>
      </p>
      <p>
        倉庫{' '}
        <strong data-testid={`inventory-${item}`}>{number(warehouse)}</strong>個
        · 棚 <strong data-testid={`display-${item}`}>{shelfQty}</strong> /{' '}
        {shelfCapacity(day.shop.salesTotal)}個
      </p>
      <p className="subtle">
        陳列できる在庫 {number(movable)}個 · 製作用に
        {number(day.shop.reserve[item])}個確保
      </p>
      {reason && <p className="disabled-reason">{reason}</p>}
      <label>
        {names}を移す数量
        <input
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
      </label>
      <div className="shop-buttons">
        <button
          ref={buttonRef}
          disabled={!valid || !!reason || amount > movable || amount > room}
          onClick={() => send({ type: 'stock', item, amount })}
        >
          {names}を棚へ
        </button>
        <button
          disabled={!valid || !shelf || amount > shelfQty}
          ref={returnRef}
          onClick={() => send({ type: 'unstock', item, amount })}
        >
          {names}を倉庫へ
        </button>
        <button
          className="subtle"
          disabled={!shelf}
          onClick={() => send({ type: 'remove-shelf', item })}
        >
          {names}の棚枠を空ける
        </button>
      </div>
      <label>
        {names}の製作用確保数
        <input
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          value={reserve}
          onChange={(e) => setReserve(Number(e.target.value))}
        />
      </label>
      <button
        className="subtle"
        disabled={
          !available ||
          !Number.isSafeInteger(reserve) ||
          reserve < 0 ||
          reserve === day.shop.reserve[item]
        }
        onClick={() => send({ type: 'reserve', item, amount: reserve })}
      >
        {names}の確保数を設定
      </button>
    </article>
  );
}
export function InventoryPanel({
  state,
  day,
  send,
  request,
}: {
  day: DayState;
  feedback: Feedback[];
  request: NavigationRequest<'inventory'> | null;
} & PanelProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const cards = useRef<Partial<Record<RecipeId, HTMLElement | null>>>({});
  const buttons = useRef<Partial<Record<RecipeId, HTMLButtonElement | null>>>(
    {},
  );
  const returns = useRef<Partial<Record<RecipeId, HTMLButtonElement | null>>>(
    {},
  );
  useEffect(() => {
    if (!request) return;
    if (request.target)
      focusTarget(
        (request.target.type === 'unstock' ? returns : buttons).current[
          request.target.item
        ],
        cards.current[request.target.item] ?? heading.current,
      );
    else focusTarget(heading.current, null, false);
  }, [request]);
  const market = forecast(day),
    level = shopLevel(day.shop.salesTotal);
  return (
    <section
      className="panel shop-panel"
      id="inventory"
      aria-labelledby="inventory-title"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">SHOP & STOCK</p>
          <h2 ref={heading} id="inventory-title" tabIndex={-1}>
            店と在庫
          </h2>
        </div>
        <span className="badge">店Lv {level}</span>
      </div>
      <div className="shop-overview">
        <p>
          棚 {day.shop.shelves.length} / {level}種類 · 1枠{' '}
          {shelfCapacity(day.shop.salesTotal)}個
        </p>
        <p>
          知名度 {day.shop.fame} / 100 · 店舗販売累計{' '}
          {number(day.shop.salesTotal)}個
        </p>
        <p>
          本日の来客予報 <strong>{market.visitors}人</strong>
        </p>
        {level < 3 && (
          <p>
            次の店Lvまで {(level === 1 ? 10 : 40) - day.shop.salesTotal}個の販売
          </p>
        )}
      </div>
      <p>
        準備中に、倉庫から売り棚へ商品を移しましょう。お客さまは棚の商品から購入します。
      </p>
      <p className="shop-note">
        合成品は倉庫へ届きます。翌日の準備で陳列できます。営業中の棚への補充はありません。
      </p>
      <div className="shop-grid">
        {recipeIds.map((item) => (
          <ProductShelf
            key={item}
            item={item}
            day={day}
            send={send}
            cardRef={(el) => {
              cards.current[item] = el;
            }}
            returnRef={(el) => {
              returns.current[item] = el;
            }}
            buttonRef={(el) => {
              buttons.current[item] = el;
            }}
          />
        ))}
      </div>
      <h3>倉庫の素材</h3>
      <div className="raw-stock">
        {(['herb', 'water', 'crystal'] as const).map((id) => (
          <div className="inventory-row" key={id}>
            <ItemArtwork item={id} />
            <strong>{items[id].name}</strong>
            <span data-testid={`inventory-${id}`}>
              {number(state.inventory[id])}
            </span>
          </div>
        ))}
      </div>
      <p>
        倉庫の素材は製造に使います。金貨は営業中のお客さまの購入で増えます。
      </p>
    </section>
  );
}
