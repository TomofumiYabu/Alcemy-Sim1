import { useState } from 'react';
import {
  adventurerTypes,
  destinations,
  equipmentTypes,
  items,
  recipes,
  research,
} from '../game/content';
import {
  missingMaterials,
  recipeTicks,
  researchReason,
  salePrice,
  unlocked,
} from '../game/engine';
import { itemIds, recipeIds, researchIds } from '../game/types';
import type {
  AdventurerId,
  DestinationId,
  EquipmentKind,
  RecipeId,
} from '../game/types';
import { useGame } from './useGame';

const number = (value: number) => value.toLocaleString('ja-JP');
const seconds = (ticks: number) => `${(ticks / 10).toFixed(1)}秒`;
type Placement =
  { type: 'buy'; kind: EquipmentKind } | { type: 'move'; id: number } | null;

export function App() {
  const game = useGame();
  const { state, send } = game;
  const [selected, setSelected] = useState(1);
  const [placement, setPlacement] = useState<Placement>(null);
  const [destination, setDestination] = useState<
    Record<AdventurerId, DestinationId>
  >({ iris: 'forest', rowan: 'forest' });
  const reset = () => {
    if (game.reset()) {
      setSelected(1);
      setPlacement(null);
      setDestination({ iris: 'forest', rowan: 'forest' });
    }
  };
  const equipment =
    state.equipment.find((entry) => entry.id === selected) ??
    state.equipment[0]!;
  const tasks = [
    {
      label: '冒険者を雇う',
      done: state.adventurers.some((entry) => entry.hired),
      target: '#expeditions',
    },
    {
      label: '森から素材を持ち帰る',
      done: state.stats.expeditions > 0,
      target: '#expeditions',
    },
    {
      label: '設備で傷薬を作る',
      done: state.stats.crafted > 0,
      target: '#workshop',
    },
    {
      label: '製品を販売する',
      done: state.stats.sold > 0,
      target: '#inventory',
    },
    {
      label: '最初の研究を完成させる',
      done: state.research.length > 0,
      target: '#research',
    },
  ];
  const nextTask = tasks.find((task) => !task.done);
  const place = (x: number, y: number) => {
    if (placement?.type === 'buy') {
      const id = state.nextEquipmentId;
      if (send({ type: 'buy', kind: placement.kind, x, y })) {
        setSelected(id);
        setPlacement(null);
      }
    } else if (placement?.type === 'move') {
      if (send({ type: 'move', id: placement.id, x, y })) setPlacement(null);
    } else {
      const entry = state.equipment.find(
        (entry) => entry.x === x && entry.y === y,
      );
      if (entry) setSelected(entry.id);
    }
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
          <button className="primary" onClick={reset}>
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
              {game.saveError
                ? '保存に失敗'
                : game.saved
                  ? '● 保存済み'
                  : '5秒ごとに自動保存'}
            </span>
          </nav>
          <main>
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
            <section
              className={`quest ${!nextTask ? 'complete' : ''}`}
              aria-labelledby="quest-title"
            >
              <div className="quest-heading">
                <span aria-hidden="true">✦</span>
                <div>
                  <p className="eyebrow">はじめての工房</p>
                  <h2 id="quest-title">
                    {nextTask ? (
                      <>
                        次の一歩：<a href={nextTask.target}>{nextTask.label}</a>
                      </>
                    ) : (
                      '工房の第一歩、達成！'
                    )}
                  </h2>
                </div>
                <span className="quest-count">
                  {tasks.filter((task) => task.done).length} / 5
                </span>
              </div>
              <ol className="quest-steps">
                {tasks.map((task, index) => (
                  <li key={task.label} className={task.done ? 'done' : ''}>
                    <span>{task.done ? '✓' : index + 1}</span>
                    {task.label}
                  </li>
                ))}
              </ol>
              {!nextTask && (
                <p>
                  最初の循環ができました。蒸留器・遺跡・魔力薬を解放して、さらに工房を広げましょう。
                </p>
              )}
            </section>
            <div className="management-layout">
              <div className="workshop-column">
                <section
                  id="workshop"
                  className="panel"
                  aria-labelledby="workshop-title"
                >
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">WORKSHOP</p>
                      <h2 id="workshop-title">錬金術工房</h2>
                    </div>
                    <span className="badge">
                      {state.equipment.length} / 24 設備
                    </span>
                  </div>
                  <p className="muted">
                    設備を選んで操作。新しい設備は空きマスに配置できます。
                  </p>
                  <div className="workshop-floor" aria-label="6列4行の工房">
                    {Array.from({ length: 24 }, (_, index) => {
                      const x = index % 6;
                      const y = Math.floor(index / 6);
                      const entry = state.equipment.find(
                        (entry) => entry.x === x && entry.y === y,
                      );
                      return (
                        <button
                          key={index}
                          className={`floor-cell ${entry ? 'occupied' : ''} ${entry?.id === selected ? 'selected' : ''} ${placement && !entry ? 'placeable' : ''}`}
                          aria-label={
                            entry
                              ? `${equipmentTypes[entry.kind].name} #${entry.id}`
                              : `空きマス ${x + 1}-${y + 1}`
                          }
                          aria-pressed={entry?.id === selected}
                          onClick={() => place(x, y)}
                        >
                          {entry ? (
                            <>
                              <span
                                aria-hidden="true"
                                className={`equipment-icon ${entry.job ? 'working' : ''}`}
                              >
                                {equipmentTypes[entry.kind].icon}
                              </span>
                              <span className="cell-name">
                                {equipmentTypes[entry.kind].name}
                              </span>
                              <small>
                                {entry.job
                                  ? '合成中'
                                  : entry.enabled
                                    ? '素材待ち'
                                    : '停止中'}
                              </small>
                              {entry.job && (
                                <progress
                                  max={entry.job.total}
                                  value={entry.job.total - entry.job.remaining}
                                  aria-label={`設備${entry.id}の進捗`}
                                />
                              )}
                            </>
                          ) : (
                            <span aria-hidden="true">
                              {placement ? '+' : '·'}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="equipment-shop">
                    {(Object.keys(equipmentTypes) as EquipmentKind[]).map(
                      (kind) => {
                        const data = equipmentTypes[kind];
                        const locked = !unlocked(state, data.requires);
                        return (
                          <div key={kind}>
                            <button
                              aria-label={`${data.name}を購入・配置`}
                              disabled={locked || state.gold < data.price}
                              onClick={() =>
                                setPlacement({ type: 'buy', kind })
                              }
                            >
                              {data.icon} {data.name}
                              <span>{data.price}金貨</span>
                            </button>
                            <small className="muted">
                              {locked
                                ? '「蒸留の技法」で解放'
                                : state.gold < data.price
                                  ? '金貨が足りません'
                                  : '配置先の決定時に購入'}
                            </small>
                          </div>
                        );
                      },
                    )}
                  </div>
                  {placement && (
                    <div className="message placement" role="status">
                      {placement.type === 'buy'
                        ? `${equipmentTypes[placement.kind].name}を置く空きマスを選択`
                        : `設備 #${placement.id} の移動先を選択（無料）`}
                      <button onClick={() => setPlacement(null)}>
                        配置をキャンセル
                      </button>
                    </div>
                  )}
                  <div
                    className="equipment-detail"
                    data-testid="equipment-detail"
                  >
                    <div className="detail-heading">
                      <h3>
                        {equipmentTypes[equipment.kind].name}{' '}
                        <span>#{equipment.id}</span>
                      </h3>
                      <button
                        className="subtle"
                        onClick={() =>
                          setPlacement({ type: 'move', id: equipment.id })
                        }
                      >
                        この設備を移動
                      </button>
                    </div>
                    <label className="select-label">
                      合成するレシピ
                      <select
                        aria-label="合成するレシピ"
                        disabled={equipment.job !== null}
                        value={equipment.recipe}
                        onChange={(event) =>
                          send({
                            type: 'recipe',
                            id: equipment.id,
                            recipe: event.target.value as RecipeId,
                          })
                        }
                      >
                        {recipeIds
                          .filter((id) => recipes[id].kind === equipment.kind)
                          .map((id) => (
                            <option
                              key={id}
                              value={id}
                              disabled={!unlocked(state, recipes[id].requires)}
                            >
                              {recipes[id].name}
                              {unlocked(state, recipes[id].requires)
                                ? ''
                                : '（研究で解放）'}
                            </option>
                          ))}
                      </select>
                    </label>
                    <p className="recipe-formula">
                      {Object.entries(recipes[equipment.recipe].inputs)
                        .map(
                          ([id, count]) =>
                            `${items[id as keyof typeof items].name} ×${count}`,
                        )
                        .join(' ＋ ')}{' '}
                      <span>→</span> {recipes[equipment.recipe].name} ×1
                    </p>
                    <div className="production-meta">
                      <span>
                        ◷{' '}
                        {seconds(
                          equipment.job?.total ??
                            recipeTicks(state, equipment.recipe),
                        )}{' '}
                        / 個
                      </span>
                      <span>
                        ✧ 知識 +
                        {equipment.job?.knowledge ??
                          recipes[equipment.recipe].knowledge +
                            (unlocked(state, 'knowledge-1') ? 1 : 0)}
                      </span>
                    </div>
                    {equipment.job ? (
                      <>
                        <progress
                          aria-label="選択中の設備の合成進捗"
                          max={equipment.job.total}
                          value={equipment.job.total - equipment.job.remaining}
                        />
                        <p className="production-status">
                          {equipment.enabled
                            ? '合成中'
                            : '仕上げ中（次の合成は停止）'}{' '}
                          · あと{seconds(equipment.job.remaining)}
                          {equipment.job.total !==
                            recipeTicks(state, equipment.recipe) &&
                            '（開始時の速度）'}
                        </p>
                        <small className="muted">
                          レシピは現在の合成が終わると変更できます。
                        </small>
                      </>
                    ) : (
                      <p className="production-status">
                        {!equipment.enabled
                          ? '停止中 · 開始すると素材を使って繰り返し合成します'
                          : missingMaterials(state, equipment).length
                            ? `素材待ち：${missingMaterials(state, equipment).join(' / ')} 不足`
                            : '次の合成を準備しています'}
                      </p>
                    )}
                    <button
                      className={
                        equipment.enabled ? 'secondary wide' : 'primary wide'
                      }
                      onClick={() => send({ type: 'toggle', id: equipment.id })}
                    >
                      {equipment.enabled ? '次の合成を停止' : '自動合成を開始'}
                    </button>
                  </div>
                </section>
                <section
                  id="inventory"
                  className="panel"
                  aria-labelledby="inventory-title"
                >
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">STOCK & MARKET</p>
                      <h2 id="inventory-title">在庫と販売</h2>
                    </div>
                    <span className="badge">
                      売上累計 {number(state.stats.earned)}金貨
                    </span>
                  </div>
                  <p className="muted">
                    素材は工房で共有。製品を売ると金貨になります。
                  </p>
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
                        <strong
                          className="item-count"
                          data-testid={`inventory-${id}`}
                        >
                          {number(state.inventory[id])}
                        </strong>
                        {items[id].price > 0 ? (
                          <button
                            className="sell-button"
                            aria-label={`${items[id].name}を販売`}
                            disabled={state.inventory[id] === 0}
                            onClick={() =>
                              send({ type: 'sell', item: id as RecipeId })
                            }
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
              </div>
              <aside className="adventure-column">
                <section
                  id="expeditions"
                  className="panel"
                  aria-labelledby="expeditions-title"
                >
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">EXPEDITIONS</p>
                      <h2 id="expeditions-title">冒険者ギルド</h2>
                    </div>
                    <span className="badge">
                      {state.adventurers.filter((entry) => entry.hired).length}{' '}
                      / 2 雇用
                    </span>
                  </div>
                  <p className="muted">
                    派遣費用は無料。素材は帰還時に自動回収します。
                  </p>
                  {state.adventurers.map((entry) => {
                    const data = adventurerTypes[entry.id];
                    const target =
                      entry.trip?.destination ?? destination[entry.id];
                    const area = destinations[target];
                    return (
                      <article
                        className="adventurer-card"
                        key={entry.id}
                        data-testid={`adventurer-${entry.id}`}
                      >
                        <div className="adventurer-heading">
                          <span
                            className={`portrait portrait-${entry.id}`}
                            aria-hidden="true"
                          >
                            {data.initials}
                          </span>
                          <div>
                            <h3>{data.name}</h3>
                            <small>{data.title}</small>
                          </div>
                          <span
                            className={`badge ${entry.trip ? 'active-badge' : ''}`}
                          >
                            {!entry.hired
                              ? '未雇用'
                              : entry.trip
                                ? '探索中'
                                : '待機中'}
                          </span>
                        </div>
                        {!entry.hired ? (
                          <>
                            <p>
                              雇用すると、森や遺跡の素材集めを任せられます。
                            </p>
                            <button
                              className="secondary wide"
                              aria-label={`${data.name}を雇う`}
                              disabled={state.gold < data.price}
                              onClick={() =>
                                send({ type: 'hire', id: entry.id })
                              }
                            >
                              {data.name}を雇う · {data.price}金貨
                            </button>
                            {state.gold < data.price && (
                              <small className="muted">金貨が足りません</small>
                            )}
                          </>
                        ) : (
                          <>
                            <label className="select-label">
                              探索先
                              <select
                                aria-label={`${data.name}の探索先`}
                                value={target}
                                disabled={entry.trip !== null}
                                onChange={(event) =>
                                  setDestination({
                                    ...destination,
                                    [entry.id]: event.target
                                      .value as DestinationId,
                                  })
                                }
                              >
                                {(
                                  Object.keys(destinations) as DestinationId[]
                                ).map((id) => (
                                  <option
                                    key={id}
                                    value={id}
                                    disabled={
                                      !unlocked(
                                        state,
                                        destinations[id].requires,
                                      )
                                    }
                                  >
                                    {destinations[id].name}
                                    {unlocked(state, destinations[id].requires)
                                      ? ''
                                      : '（研究で解放）'}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <p className="expedition-reward">
                              {Object.entries(
                                entry.trip?.rewards ?? area.rewards,
                              )
                                .filter(([, count]) => count > 0)
                                .map(
                                  ([id, count]) =>
                                    `${items[id as keyof typeof items].name} +${count + (!entry.trip && id === 'herb' && target === 'forest' && unlocked(state, 'gathering-1') ? 1 : 0)}`,
                                )
                                .join(' / ')}{' '}
                              <span>· {seconds(area.ticks)}</span>
                            </p>
                            {entry.trip && (
                              <>
                                <progress
                                  aria-label={`${data.name}の探索進捗`}
                                  max={entry.trip.total}
                                  value={
                                    entry.trip.total - entry.trip.remaining
                                  }
                                />
                                <p className="production-status">
                                  帰還まであと{seconds(entry.trip.remaining)} ·
                                  報酬は出発時に確定
                                </p>
                              </>
                            )}
                            <button
                              className="primary wide"
                              aria-label={`${data.name}を派遣`}
                              disabled={entry.trip !== null}
                              onClick={() =>
                                send({
                                  type: 'dispatch',
                                  id: entry.id,
                                  destination: target,
                                })
                              }
                            >
                              {entry.trip ? '探索中…' : `${data.name}を派遣`}
                            </button>
                            {unlocked(state, 'gathering-2') ? (
                              <label className="checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={entry.auto}
                                  onChange={() =>
                                    send({ type: 'auto', id: entry.id })
                                  }
                                />
                                {data.name}の自動再派遣
                              </label>
                            ) : (
                              <small className="muted">
                                「帰り道の約束」の研究で自動再派遣
                              </small>
                            )}
                          </>
                        )}
                      </article>
                    );
                  })}
                </section>
                <section
                  className="panel journal"
                  aria-labelledby="journal-title"
                >
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">WORKSHOP JOURNAL</p>
                      <h2 id="journal-title">工房の記録</h2>
                    </div>
                  </div>
                  <ol>
                    {state.log.slice(0, 8).map((entry, index) => (
                      <li key={`${entry.tick}-${index}`}>
                        <time>
                          {Math.floor(entry.tick / 600)}:
                          {String(Math.floor(entry.tick / 10) % 60).padStart(
                            2,
                            '0',
                          )}
                        </time>
                        <span>{entry.message}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              </aside>
            </div>
            <section
              id="research"
              className="panel research-panel"
              aria-labelledby="research-title"
            >
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">KNOWLEDGE TREE</p>
                  <h2 id="research-title">錬金術の研究</h2>
                </div>
                <span className="badge">
                  {state.research.length} / 9 研究済み
                </span>
              </div>
              <p className="muted">
                発見を知識に、知識を次の可能性に。研究の効果はずっと工房に残ります。
              </p>
              <div className="research-branches">
                {['採集', '生産', '知識'].map((branch, branchIndex) => (
                  <div className="research-branch" key={branch}>
                    <h3>
                      <span aria-hidden="true">
                        {['♧', '♨', '✧'][branchIndex]}
                      </span>
                      {branch}の道
                    </h3>
                    {researchIds
                      .filter((id) => research[id].branch === branch)
                      .map((id, index) => {
                        const data = research[id];
                        const done = state.research.includes(id);
                        const reason = researchReason(state, id);
                        return (
                          <article
                            className={`research-card ${done ? 'researched' : ''} ${!reason ? 'available' : ''}`}
                            key={id}
                            data-testid={`research-${id}`}
                          >
                            <div className="research-name">
                              <span>{done ? '✓' : `0${index + 1}`}</span>
                              <h4>{data.name}</h4>
                            </div>
                            <p>{data.description}</p>
                            <div className="research-cost">
                              ◉ {data.gold}金貨{' '}
                              <span>✧ {data.knowledge}知識</span>
                            </div>
                            <button
                              className={
                                done ? 'subtle wide' : 'secondary wide'
                              }
                              aria-label={`${data.name}を研究`}
                              disabled={reason !== null}
                              onClick={() => send({ type: 'research', id })}
                            >
                              {done ? '研究済み' : '研究する'}
                            </button>
                            <small className="research-reason">
                              {reason ?? '研究できます'}
                            </small>
                          </article>
                        );
                      })}
                  </div>
                ))}
              </div>
            </section>
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
          </main>
        </>
      )}
    </div>
  );
}
