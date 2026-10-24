import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { equipmentTypes } from '../game/content';
import { GRID_CAPACITY, GRID_COLUMNS, GRID_ROWS } from '../game/config';
import { unlocked } from '../game/engine';
import type { EquipmentKind } from '../game/types';
import { EquipmentDetail } from './EquipmentDetail';
import { Dialog } from './Dialog';
import { useCompactLayout } from './useCompactLayout';
import type { Navigate, PanelProps } from './types';
import { EquipmentArtwork, ItemArtwork, RoomArtwork } from './Artwork';
import { AdventureBrief } from './AdventureBrief';
import type { Feedback } from './feedback';

type Placement =
  { type: 'buy'; kind: EquipmentKind } | { type: 'move'; id: number } | null;
export function WorkshopPanel({
  state,
  send,
  active,
  request,
  navigate,
  disabled,
  feedback,
}: PanelProps & {
  active: boolean;
  request: { sequence: number; kind: EquipmentKind | undefined };
  navigate: Navigate;
  disabled: boolean;
  feedback: Feedback[];
}) {
  const [selected, setSelected] = useState(() => state.equipment[0]!.id);
  const [placement, setPlacement] = useState<Placement>(null);
  const [sheet, setSheet] = useState(false);
  const [cursor, setCursor] = useState(
    () => state.equipment[0]!.y * GRID_COLUMNS + state.equipment[0]!.x,
  );
  const floor = useRef<HTMLDivElement>(null);
  const detail = useRef<HTMLDivElement>(null);
  const lastRequest = useRef(request.sequence);
  const compact = useCompactLayout();
  const equipment =
    state.equipment.find((entry) => entry.id === selected) ??
    state.equipment[0]!;
  useEffect(() => {
    if (!active) setSheet(false);
  }, [active]);
  useEffect(() => {
    if (disabled) setPlacement(null);
  }, [disabled]);
  useEffect(() => {
    if (request.sequence !== lastRequest.current) {
      lastRequest.current = request.sequence;
      const match =
        request.kind &&
        state.equipment.find((entry) => entry.kind === request.kind);
      if (match) {
        setSelected(match.id);
        setCursor(match.y * GRID_COLUMNS + match.x);
      }
      if (compact) setSheet(true);
      else
        detail.current
          ?.querySelector<HTMLButtonElement>('.craft-toggle')
          ?.focus();
    }
  }, [request, compact]);
  const focusCell = (index: number) => {
    setCursor(index);
    floor.current
      ?.querySelector<HTMLButtonElement>(`[data-cell="${index}"]`)
      ?.focus();
  };
  useEffect(() => {
    if (placement) focusCell(cursor);
  }, [placement]);
  const cancel = () => {
    setPlacement(null);
    focusCell(cursor);
  };
  const startPlacement = (next: Placement) => {
    setSheet(false);
    setPlacement(next);
  };
  const place = (x: number, y: number) => {
    if (placement?.type === 'buy') {
      const id = state.nextEquipmentId;
      if (send({ type: 'buy', kind: placement.kind, x, y })) {
        setSelected(id);
        setPlacement(null);
        if (compact) setSheet(true);
      }
    } else if (placement?.type === 'move') {
      if (send({ type: 'move', id: placement.id, x, y })) setPlacement(null);
    } else {
      const entry = state.equipment.find(
        (entry) => entry.x === x && entry.y === y,
      );
      if (entry) {
        setSelected(entry.id);
        if (compact) setSheet(true);
      }
    }
  };
  const gridKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const x = cursor % GRID_COLUMNS;
    const y = Math.floor(cursor / GRID_COLUMNS);
    const next =
      event.key === 'ArrowLeft'
        ? y * GRID_COLUMNS + Math.max(0, x - 1)
        : event.key === 'ArrowRight'
          ? y * GRID_COLUMNS + Math.min(GRID_COLUMNS - 1, x + 1)
          : event.key === 'ArrowUp'
            ? Math.max(0, y - 1) * GRID_COLUMNS + x
            : event.key === 'ArrowDown'
              ? Math.min(GRID_ROWS - 1, y + 1) * GRID_COLUMNS + x
              : event.key === 'Home'
                ? y * GRID_COLUMNS
                : event.key === 'End'
                  ? y * GRID_COLUMNS + GRID_COLUMNS - 1
                  : null;
    if (next !== null) {
      event.preventDefault();
      focusCell(next);
    }
    if (event.key === 'Escape' && placement) {
      event.preventDefault();
      cancel();
    }
  };
  const details = (
    <EquipmentDetail
      state={state}
      send={send}
      equipment={equipment}
      disabled={disabled}
      navigate={(screen, target) => {
        setSheet(false);
        navigate(screen, target);
      }}
      onMove={() => startPlacement({ type: 'move', id: equipment.id })}
    />
  );
  return (
    <section
      id="workshop"
      className="workshop-layout"
      aria-labelledby="workshop-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && placement) {
          event.preventDefault();
          cancel();
        }
      }}
    >
      <div className="panel workshop-main">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">THE STARLIT ATELIER</p>
            <h2 id="workshop-title" tabIndex={-1}>
              錬金術工房
            </h2>
          </div>
          <span className="badge">
            {state.equipment.length} / {GRID_CAPACITY} 設備
          </span>
        </div>
        <p className="muted">
          設備を選んで操作。矢印キーでマスを移動できます。
        </p>
        {placement && (
          <div className="message placement" role="status">
            <span>
              {placement.type === 'buy'
                ? `${equipmentTypes[placement.kind].name}の配置先を選択 · ${equipmentTypes[placement.kind].price}金貨`
                : `設備 #${placement.id} の移動先を選択（無料）`}
            </span>
            <button onClick={cancel}>配置をキャンセル</button>
          </div>
        )}
        <div
          className={`floor-viewport workshop-room ${placement ? 'placing' : ''}`}
          aria-label="工房の配置エリア"
        >
          <RoomArtwork />
          <div
            className="workshop-floor"
            ref={floor}
            onKeyDown={gridKey}
            style={{
              gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(44px, 1fr))`,
            }}
            role="group"
            aria-label={`${GRID_COLUMNS}列${GRID_ROWS}行の工房`}
          >
            {Array.from({ length: GRID_CAPACITY }, (_, index) => {
              const x = index % GRID_COLUMNS;
              const y = Math.floor(index / GRID_COLUMNS);
              const entry = state.equipment.find(
                (entry) => entry.x === x && entry.y === y,
              );
              const status = entry?.job
                ? entry.enabled
                  ? '合成中'
                  : '仕上げ中'
                : entry?.enabled
                  ? '素材待ち'
                  : '停止中';
              const celebration =
                entry?.id === equipment.id
                  ? feedback.findLast(
                      (event) =>
                        event.type === 'crafted' &&
                        !!event.equipment[entry!.id],
                    )
                  : undefined;
              return (
                <button
                  key={index}
                  data-cell={index}
                  data-state={
                    entry
                      ? entry.job
                        ? entry.enabled
                          ? 'working'
                          : 'finishing'
                        : entry.enabled
                          ? 'waiting'
                          : 'stopped'
                      : undefined
                  }
                  tabIndex={cursor === index ? 0 : -1}
                  className={`floor-cell ${entry ? 'occupied' : ''} ${entry?.id === equipment.id ? 'selected' : ''} ${placement && !entry ? 'placeable' : ''}`}
                  aria-label={
                    entry
                      ? `${equipmentTypes[entry.kind].name} #${entry.id}`
                      : `空きマス ${x + 1}-${y + 1}`
                  }
                  aria-description={
                    entry
                      ? status
                      : placement
                        ? '配置できます'
                        : '設備を購入すると配置できます'
                  }
                  aria-pressed={entry?.id === equipment.id}
                  onFocus={() => setCursor(index)}
                  onClick={() => {
                    setCursor(index);
                    place(x, y);
                  }}
                >
                  {entry ? (
                    <>
                      <EquipmentArtwork equipment={entry} />
                      <span className="equipment-number" aria-hidden="true">
                        {entry.id}
                      </span>
                      <span className="cell-name">
                        {equipmentTypes[entry.kind].name}
                      </span>
                      <small className="cell-status" aria-hidden="true">
                        {status}
                      </small>
                      {entry.job && (
                        <progress
                          max={entry.job.total}
                          value={entry.job.total - entry.job.remaining}
                          aria-label={`設備${entry.id}の進捗`}
                        />
                      )}
                      {celebration?.type === 'crafted' && (
                        <span
                          className="craft-pop"
                          key={celebration.id}
                          aria-hidden="true"
                        >
                          <ItemArtwork item={celebration.item} />+
                          {celebration.equipment[entry.id]}
                        </span>
                      )}
                    </>
                  ) : (
                    <span aria-hidden="true">{placement ? '+' : '·'}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <p className="floor-help muted">
          6列 × 4行 ·{' '}
          {compact
            ? '設備をタップして詳細を開く。狭い画面では工房内を横スクロール'
            : '選択した設備の操作は右側に表示'}
        </p>
        <fieldset className="game-controls equipment-shop" disabled={disabled}>
          {(Object.keys(equipmentTypes) as EquipmentKind[]).map((kind) => {
            const data = equipmentTypes[kind];
            const locked = !unlocked(state, data.requires);
            return (
              <div key={kind}>
                <button
                  aria-label={`${data.name}を購入・配置`}
                  disabled={
                    locked ||
                    state.gold < data.price ||
                    state.equipment.length >= GRID_CAPACITY
                  }
                  onClick={() => startPlacement({ type: 'buy', kind })}
                >
                  {data.name}
                  <span>{data.price}金貨</span>
                </button>
                <small className="muted">
                  {locked
                    ? '「蒸留の技法」で解放'
                    : state.gold < data.price
                      ? '金貨が足りません'
                      : state.equipment.length >= GRID_CAPACITY
                        ? '空きマスなし・停止設備の「移動・管理」から交換できます'
                        : '配置先の決定時に購入'}
                </small>
              </div>
            );
          })}
        </fieldset>
      </div>
      {compact ? (
        <>
          <div className="brief-mobile">
            <AdventureBrief
              state={state}
              navigate={navigate}
              feedback={feedback}
            />
          </div>
          <Dialog
            open={sheet && active}
            title="設備の詳細"
            sheet
            onClose={() => setSheet(false)}
          >
            {details}
          </Dialog>
        </>
      ) : (
        <aside
          className="panel equipment-sidebar"
          aria-label="選択設備の詳細"
          ref={detail}
        >
          {details}
          <AdventureBrief
            state={state}
            navigate={navigate}
            feedback={feedback}
          />
        </aside>
      )}
    </section>
  );
}
