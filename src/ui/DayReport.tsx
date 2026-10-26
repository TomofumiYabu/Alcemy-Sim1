import type { DayReport as Report } from '../game/dayTypes';
import { items } from '../game/content';
import { recipeIds, itemIds } from '../game/types';
import { shopLevel } from '../game/shop';
import { number } from './format';

const reasons = {
  browsing: '見送り',
  unlisted: '希望品の取扱なし',
  outOfStock: '希望品の欠品',
} as const;
export function DayReport({
  report,
  error,
  onContinue,
  readOnly = false,
  disabled = false,
}: {
  report: Report;
  error: string | null;
  onContinue: () => void;
  readOnly?: boolean;
  disabled?: boolean;
}) {
  const buyers = report.customers.filter(
    (c) => c.reason === 'purchased',
  ).length;
  return (
    <div className="day-report" data-testid="day-report">
      {error && (
        <p className="message error" role="alert">
          {error}
        </p>
      )}
      <p className="report-summary">
        来客 <strong>{report.customers.length}人</strong> · 購入{' '}
        <strong>{buyers}人</strong> · 売上{' '}
        <strong>{number(report.earned)}金貨</strong>
      </p>
      <div className="report-table-wrap">
        <table>
          <caption>第{report.day}日の商品別販売</caption>
          <thead>
            <tr>
              <th>商品</th>
              <th>販売</th>
              <th>売上</th>
              <th>棚残数</th>
            </tr>
          </thead>
          <tbody>
            {recipeIds.map((id) => (
              <tr key={id}>
                <th scope="row">{items[id].name}</th>
                <td data-label="販売">{report.sold[id]}個</td>
                <td data-label="売上">
                  {number(report.sold[id] * report.prices[id])}金貨
                </td>
                <td data-label="棚残数">
                  {report.closingShelves.find((s) => s.item === id)?.quantity ??
                    0}
                  個
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        終了時の金貨 {number(report.closingGold)} · 知識 +
        {report.knowledgeGained}
      </p>
      <p>
        店Lv {shopLevel(report.salesBefore)} → {shopLevel(report.salesAfter)} ·
        知名度 {report.fameBefore} → {report.fameAfter} · 店舗販売累計{' '}
        {report.salesAfter}個
      </p>
      <p>成長は翌日の集客と棚容量に反映します。</p>
      <h3>工房と探索</h3>
      <ul>
        {recipeIds
          .filter((id) => report.produced[id] > 0)
          .map((id) => (
            <li key={id}>
              {items[id].name} {report.produced[id]}個完成 → 倉庫へ
            </li>
          ))}
        {itemIds
          .filter((id) => report.gathered[id] > 0)
          .map((id) => (
            <li key={id}>
              {items[id].name} {report.gathered[id]}個を探索で入手
            </li>
          ))}
      </ul>
      <p>完成品は翌日の準備で陳列できます。売れ残りは棚に残っています。</p>
      <h3>買わずに帰ったお客さま</h3>
      <ul>
        {Object.entries(reasons).map(([reason, label]) => (
          <li key={reason}>
            {label}：
            {report.customers.filter((c) => c.reason === reason).length}人
          </li>
        ))}
      </ul>
      <details>
        <summary>お客さまの希望と結果</summary>
        <ol>
          {report.customers.map((c, i) => (
            <li key={i}>
              {items[c.item].name}を希望：
              {c.reason === 'purchased' ? '1個購入' : reasons[c.reason]}
            </li>
          ))}
        </ol>
      </details>
      <button
        className="primary day-continue"
        onClick={onContinue}
        disabled={disabled}
      >
        {readOnly ? '閉じる' : '翌日の準備へ'}
      </button>
    </div>
  );
}
