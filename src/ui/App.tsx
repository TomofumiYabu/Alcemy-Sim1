import { useCallback, useState } from 'react';
import { useGame } from './useGame';
import { number, seconds } from './format';
import { WorkshopPanel } from './WorkshopPanel';
import { InventoryPanel } from './InventoryPanel';
import { ExpeditionPanel } from './ExpeditionPanel';
import { Journal } from './Journal';
import { ResearchTree } from './ResearchTree';
import { QuestProgress } from './QuestProgress';
import { Dialog } from './Dialog';
import type { Navigate, NavigationRequest } from './navigation';
import { FeedbackLayer } from './FeedbackLayer';
import { ItemArtwork } from './Artwork';
import { Icon } from './Icon';
import { usePreferences } from './usePreferences';
import { useFeedbackSound } from './useFeedbackSound';
import { SettingsControls } from './SettingsControls';

const screens = [
  { id: 'workshop', label: '工房', icon: 'workshop' },
  { id: 'expeditions', label: '冒険者', icon: 'adventurers' },
  { id: 'inventory', label: '在庫・販売', icon: 'inventory' },
  { id: 'research', label: '研究', icon: 'research' },
] as const;

export function App() {
  const game = useGame();
  const { state, send } = game;
  const ui = usePreferences();
  const { preferences, reduceMotion } = ui;
  const sound = useFeedbackSound(game.feedback, preferences);
  const feedback = preferences.notifications ? game.feedback : [];
  const recentSale = game.feedback.findLast((event) => event.type === 'sold');
  const [navigation, setNavigation] = useState<NavigationRequest>({
    screen: 'workshop',
    sequence: 0,
  });
  const active = navigation.screen;
  const [resetEpoch, setResetEpoch] = useState(0);
  const [dialog, setDialog] = useState<'settings' | 'journal' | null>(null);
  const navigate = useCallback<Navigate>((next) => {
    setNavigation((current) => ({ ...next, sequence: current.sequence + 1 }));
  }, []);
  const reset = () => {
    if (game.reset()) {
      setResetEpoch((value) => value + 1);
      setDialog(null);
      setNavigation({ screen: 'workshop', sequence: 0 });
    }
  };
  const roleMessage =
    game.role === 'unsupported'
      ? 'このブラウザーでは保存の排他制御が利用できません。最新のChrome・Firefox・Safariで開いてください。'
      : '別のタブで工房が開かれています。このタブは待機中です。先のタブを閉じると、最新の記録から再開します。';
  const saveStatus =
    game.role !== 'owner'
      ? '保存保護のため待機中'
      : game.saveError
        ? '保存に失敗'
        : game.saved
          ? '保存済み'
          : '5秒ごとに自動保存';
  const exploring = state.adventurers.filter((entry) => entry.trip);
  const waiting = state.equipment.filter(
    (entry) => entry.enabled && !entry.job,
  ).length;
  return (
    <div className="app-shell" data-motion={reduceMotion ? 'reduced' : 'full'}>
      <header className="topbar">
        <h1 className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg
              viewBox="0 0 32 32"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            >
              <circle cx="16" cy="16" r="12" />
              <path d="m16 1 3 12 12 3-12 3-3 12-3-12L1 16l12-3Z" />
              <path d="m6 6 20 20M26 6 6 26" />
            </svg>
          </span>
          星灯りの錬金工房
        </h1>
        <div className="resources">
          <div className="resource">
            <small>金貨</small>
            <strong
              data-testid="gold"
              className={recentSale ? 'resource-gain' : ''}
              key={recentSale?.id ?? 0}
            >
              {number(state.gold)}
            </strong>
          </div>
          <div className="resource">
            <small>知識</small>
            <strong data-testid="knowledge">{number(state.knowledge)}</strong>
          </div>
        </div>
        <span className="save-state" role="status">
          {saveStatus}
        </span>
        <button
          className="settings-button"
          onClick={() => setDialog('settings')}
        >
          <Icon name="settings" />
          設定
        </button>
      </header>
      {game.role !== 'owner' && (
        <div className="message session-message" role="note">
          {roleMessage}
        </div>
      )}
      {game.blocked ? (
        <main className="recovery">
          <h2>工房の記録を確認してください</h2>
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
          <QuestProgress state={state} navigate={navigate} />
          {game.saveError && (
            <div className="message error" role="alert">
              {game.saveError}
              <button disabled={game.role !== 'owner'} onClick={game.save}>
                保存を再試行
              </button>
            </div>
          )}
          {game.notice && (
            <div className="message error" role="alert">
              {game.notice}
            </div>
          )}
          <div className="workspace">
            <nav className="navigation" aria-label="工房のメニュー">
              {screens.map((screen) => (
                <button
                  key={screen.id}
                  aria-label={screen.label}
                  aria-pressed={active === screen.id}
                  aria-controls={`view-${screen.id}`}
                  onClick={() => navigate({ screen: screen.id })}
                >
                  <Icon name={screen.icon} />
                  <span className="nav-label">{screen.label}</span>
                  <span className="nav-short" aria-hidden="true">
                    {screen.id === 'inventory' ? '在庫' : screen.label}
                  </span>
                </button>
              ))}
            </nav>
            <main className="views">
              <div
                id="view-workshop"
                className="screen"
                hidden={active !== 'workshop'}
              >
                <WorkshopPanel
                  key={resetEpoch}
                  state={state}
                  send={send}
                  request={navigation.screen === 'workshop' ? navigation : null}
                  navigate={navigate}
                  disabled={game.role !== 'owner'}
                  feedback={feedback}
                />
              </div>
              <div
                id="view-expeditions"
                className="screen"
                hidden={active !== 'expeditions'}
              >
                <fieldset
                  className="game-controls"
                  disabled={game.role !== 'owner'}
                >
                  <ExpeditionPanel
                    key={resetEpoch}
                    state={state}
                    send={send}
                    feedback={feedback}
                    request={
                      navigation.screen === 'expeditions' ? navigation : null
                    }
                    navigate={navigate}
                  />
                </fieldset>
              </div>
              <div
                id="view-inventory"
                className="screen"
                hidden={active !== 'inventory'}
              >
                <fieldset
                  className="game-controls"
                  disabled={game.role !== 'owner'}
                >
                  <InventoryPanel
                    state={state}
                    send={send}
                    feedback={feedback}
                    request={
                      navigation.screen === 'inventory' ? navigation : null
                    }
                  />
                </fieldset>
              </div>
              <div
                id="view-research"
                className="screen"
                hidden={active !== 'research'}
              >
                <fieldset
                  className="game-controls"
                  disabled={game.role !== 'owner'}
                >
                  <ResearchTree
                    state={state}
                    send={send}
                    navigate={navigate}
                    request={
                      navigation.screen === 'research' ? navigation : null
                    }
                  />
                </fieldset>
              </div>
            </main>
          </div>
          <div className="activity-bar">
            <button
              className="subtle"
              onClick={() => navigate({ screen: 'expeditions' })}
            >
              探索中 {exploring.length}人
              {exploring[0]?.trip
                ? ` · あと${seconds(exploring[0].trip.remaining)}`
                : ''}
            </button>
            <button
              className="subtle"
              onClick={() => navigate({ screen: 'workshop' })}
            >
              素材待ち {waiting}台
            </button>
            <button
              className="subtle stock-summary"
              onClick={() => navigate({ screen: 'inventory' })}
            >
              <ItemArtwork item="herb" />
              薬草 {number(state.inventory.herb)} · <ItemArtwork item="water" />
              清水 {number(state.inventory.water)} ·{' '}
              <ItemArtwork item="potion" />
              傷薬 {number(state.inventory.potion)}
            </button>
            <p className="latest-result">{state.log[0]?.message}</p>
            <button className="subtle" onClick={() => setDialog('journal')}>
              記録
            </button>
          </div>
        </>
      )}
      <FeedbackLayer feedback={feedback} />
      <Dialog
        open={dialog === 'settings'}
        title="設定とヘルプ"
        onClose={() => setDialog(null)}
      >
        <p>
          冒険者を雇って派遣し、集まった素材で合成。製品を売り、金貨と知識で研究を進めましょう。
        </p>
        <p>
          画面表示中に進行します。画面内の切替中も進みますが、画面を閉じている間の進行はありません。セーブはこのブラウザーに保存されます。
        </p>
        <p>
          工房のマスは矢印キーで移動、Enterで選択・配置、Escapeで配置を取り消せます。
        </p>
        <SettingsControls ui={ui} soundUnavailable={sound.unavailable} />
        <fieldset
          className="game-controls settings-actions"
          disabled={game.role !== 'owner'}
        >
          <button onClick={game.save}>今すぐ保存</button>
          <button className="danger" onClick={reset}>
            工房を初期化
          </button>
        </fieldset>
      </Dialog>
      <Dialog
        open={dialog === 'journal'}
        title="工房の記録"
        onClose={() => setDialog(null)}
      >
        <Journal state={state} />
      </Dialog>
    </div>
  );
}
