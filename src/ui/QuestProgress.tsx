import type { GameState } from '../game/types';
import type { DayState } from '../game/dayTypes';
import { destinations } from '../game/content';
import { workAmount } from './format';
import type { Navigate, Navigation } from './navigation';

export function QuestProgress({
  state,
  day,
  navigate,
}: {
  state: GameState;
  day: DayState;
  navigate: Navigate;
}) {
  const hired = state.adventurers.find((entry) => entry.hired);
  const trip = state.adventurers.find((entry) => entry.trip)?.trip;
  const done = [
    !!hired,
    state.stats.expeditions > 0,
    state.stats.crafted > 0,
    state.stats.sold > 0,
    state.research.length > 0,
  ];
  let title: string;
  let hint: string;
  let navigation: Navigation;
  if (!hired) {
    title = 'イリスを雇って素材集めを頼もう';
    hint = '20金貨で雇用。派遣費用はかかりません。';
    navigation = {
      screen: 'expeditions',
      target: { type: 'hire', adventurer: 'iris' },
    };
  } else if (!state.stats.expeditions && !trip) {
    title = '冒険者を森へ派遣しよう';
    hint = '帰還すると薬草と清水を自動で持ち帰ります。';
    navigation = {
      screen: 'expeditions',
      target: { type: 'dispatch', adventurer: hired.id },
    };
  } else if (!state.stats.expeditions && trip) {
    title = `${destinations[trip.destination].name}からの帰還まであと${workAmount(trip.remaining)}`;
    hint = '初期素材で釜の稼働を準備し、「1日営業する」で進めましょう。';
    navigation = { screen: 'workshop', target: { type: 'equipment' } };
  } else if (!state.stats.crafted) {
    title = '釜で傷薬を作ろう';
    hint = '設備を選び、自動合成を開始。完成すると知識も得られます。';
    navigation = { screen: 'workshop', target: { type: 'equipment' } };
  } else if (!state.stats.sold) {
    title = day.shop.shelves.some((s) => s.quantity > 0)
      ? '営業してお客さまを迎えよう'
      : '完成した傷薬を棚へ陳列しよう';
    hint =
      '店・在庫で倉庫から棚へ品と数量を移し、1日営業するとお客さまが購入します。';
    navigation = {
      screen: 'inventory',
      target: { type: 'stock', item: 'potion' },
    };
  } else if (!state.research.length) {
    title = '金貨と知識で最初の研究を進めよう';
    hint = '最初の研究は20金貨と3知識。傷薬を3個作ると届きます。';
    navigation = {
      screen: 'research',
      target: { type: 'research', id: 'gathering-1' },
    };
  } else {
    title = '工房の第一歩、達成！';
    hint = '新しい研究と設備で、自動化の組み方を広げましょう。';
    navigation = { screen: 'research' };
  }
  return (
    <section className="quest" aria-labelledby="quest-title">
      <div className="quest-copy">
        <h2 id="quest-title">{title}</h2>
        <p>{hint}</p>
      </div>
      <span className="quest-count" aria-label="初回目標の達成数">
        {done.filter(Boolean).length} / 5
      </span>
      <button onClick={() => navigate(navigation)} aria-label="次の一歩を開く">
        開く →
      </button>
    </section>
  );
}
