import { useState } from 'react';
import { useGame } from './useGame';
import { number } from './format';
import { WorkshopPanel } from './WorkshopPanel';
import { InventoryPanel } from './InventoryPanel';
import { ExpeditionPanel } from './ExpeditionPanel';
import { Journal } from './Journal';
import { ResearchTree } from './ResearchTree';
import { QuestProgress } from './QuestProgress';
export function App() {
  const game = useGame();
  const { state, send } = game;
  const [resetEpoch, setResetEpoch] = useState(0);
  const reset = () => {
    if (game.reset()) setResetEpoch((value) => value + 1);
  };
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brand-mark" aria-hidden="true">
            ⚗
          </span>
          <span>
            星灯りの錬金工房<small>ALCEMY SIM · 工房経営</small>
          </span>
        </a>
        <div className="resources">
          <div className="resource">
            <span className="gold-symbol" aria-hidden="true">
              ◉
            </span>
            <span>
              <small>金貨</small>
              <strong data-testid="gold">{number(state.gold)}</strong>
            </span>
          </div>
          <div className="resource">
            <span className="knowledge-symbol" aria-hidden="true">
              ✧
            </span>
            <span>
              <small>知識</small>
              <strong data-testid="knowledge">{number(state.knowledge)}</strong>
            </span>
          </div>
        </div>
      </header>
      {game.blocked ? (
        <main className="recovery">
          <h1>工房の記録を確認してください</h1>
          <p role="alert">{game.saveError}</p>
          <p>新規開始を選ぶまで、元のデータを自動保存で上書きしません。</p>
          <button
            className="primary"
            onClick={reset}
            disabled={game.role !== 'owner'}
          >
            新しい工房を始める
          </button>
        </main>
      ) : (
        <>
          <nav className="navigation" aria-label="工房のメニュー">
            <a href="#workshop">♨ 工房</a>
            <a href="#expeditions">♧ 冒険者</a>
            <a href="#inventory">▤ 在庫・販売</a>
            <a href="#research">✧ 研究</a>
            <span className="save-state" role="status">
              {game.role !== 'owner'
                ? '保存保護のため待機中'
                : game.saveError
                  ? '保存に失敗'
                  : game.saved
                    ? '● 保存済み'
                    : '5秒ごとに自動保存'}
            </span>
          </nav>
          <main>
            {game.role !== 'owner' && (
              <div className="message" role="note">
                {game.role === 'unsupported'
                  ? 'このブラウザーでは保存の排他制御が利用できません。最新のChrome・Firefox・Safariで開いてください。'
                  : '別のタブで工房が開かれています。このタブは待機中です。先のタブを閉じると、最新の記録から再開します。'}
              </div>
            )}
            <fieldset
              className="game-controls"
              disabled={game.role !== 'owner'}
            >
              <div className="page-heading">
                <div>
                  <p className="eyebrow">THE STARLIT ATELIER</p>
                  <h1>今日も、ひとつの発見を。</h1>
                  <p>
                    素材を集め、釜に火を灯し、あなただけの工房を育てましょう。
                  </p>
                </div>
                <div className="edition">
                  遊べるプロトタイプ
                  <span>画面表示中に進行 · オフライン進行なし</span>
                </div>
              </div>
              {game.saveError && (
                <div className="message error" role="alert">
                  {game.saveError}
                  <button onClick={game.save}>保存を再試行</button>
                </div>
              )}
              {game.notice && (
                <div className="message error" role="alert">
                  {game.notice}
                </div>
              )}
              <QuestProgress state={state} />
              <div className="management-layout">
                <div className="workshop-column">
                  <WorkshopPanel key={resetEpoch} state={state} send={send} />
                  <InventoryPanel state={state} send={send} />
                </div>
                <aside className="adventure-column">
                  <ExpeditionPanel key={resetEpoch} state={state} send={send} />
                  <Journal state={state} />
                </aside>
              </div>
              <ResearchTree state={state} send={send} />
              <footer>
                <p>
                  星灯りの錬金工房 · MVP 0.1{' '}
                  <span>
                    画面を閉じている間は進行しません。セーブはこのブラウザーに保存されます。
                  </span>
                </p>
                <div>
                  <button className="subtle" onClick={game.save}>
                    今すぐ保存
                  </button>
                  <button className="subtle danger" onClick={reset}>
                    工房を初期化
                  </button>
                </div>
              </footer>
            </fieldset>
          </main>
        </>
      )}
    </div>
  );
}
