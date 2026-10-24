import type { GameState } from '../game/types';
import { destinations } from '../game/content';
import { seconds } from './format';
import type { Navigate, Screen } from './types';

export function QuestProgress({
  state,
  navigate,
}: {
  state: GameState;
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
  let screen: Screen;
  let target: string;
  if (!hired) {
    title = 'イリスを雇って素材集めを頼もう';
    hint = '20金貨で雇用。派遣費用はかかりません。';
    screen = 'expeditions';
    target = '[aria-label="イリスを雇う"]';
  } else if (!state.stats.expeditions && !trip) {
    title = '冒険者を森へ派遣しよう';
    hint = '帰還すると薬草と清水を自動で持ち帰ります。';
    screen = 'expeditions';
    target = `[aria-label="${hired.id === 'iris' ? 'イリス' : 'ローワン'}を派遣"]`;
  } else if (!state.stats.expeditions && trip) {
    title = `${destinations[trip.destination].name}からの帰還まであと${seconds(trip.remaining)}`;
    hint = '待つ間に、初期素材で釜の自動合成を始められます。';
    screen = 'workshop';
    target = 'equipment';
  } else if (!state.stats.crafted) {
    title = '釜で傷薬を作ろう';
    hint = '設備を選び、自動合成を開始。完成すると知識も得られます。';
    screen = 'workshop';
    target = 'equipment';
  } else if (!state.stats.sold) {
    title = '完成した傷薬を販売しよう';
    hint = '在庫・販売で、製品を金貨に換えられます。';
    screen = 'inventory';
    target = '[aria-label="傷薬を販売"]';
  } else if (!state.research.length) {
    title = '金貨と知識で最初の研究を進めよう';
    hint = '最初の研究は20金貨と3知識。傷薬を3個作ると届きます。';
    screen = 'research';
    target = '[aria-label="森の恵みを研究"]';
  } else {
    title = '工房の第一歩、達成！';
    hint = '新しい研究と設備で、自動化の組み方を広げましょう。';
    screen = 'research';
    target = '';
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
      <button
        onClick={() => navigate(screen, target)}
        aria-label="次の一歩を開く"
      >
        開く →
      </button>
    </section>
  );
}
