import { useState } from 'react';
import { equipmentTypes } from '../game/content';
import { GRID_CAPACITY, GRID_COLUMNS, GRID_ROWS } from '../game/config';
import { unlocked } from '../game/engine';
import type { EquipmentKind } from '../game/types';
import { EquipmentDetail } from './EquipmentDetail';
import type { PanelProps } from './types';

type Placement =
  { type: 'buy'; kind: EquipmentKind } | { type: 'move'; id: number } | null;
export function WorkshopPanel({ state, send }: PanelProps) {
  const [selected, setSelected] = useState(1);
  const [placement, setPlacement] = useState<Placement>(null);
  const equipment =
    state.equipment.find((entry) => entry.id === selected) ??
    state.equipment[0]!;
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
    <section id="workshop" className="panel" aria-labelledby="workshop-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">WORKSHOP</p>
          <h2 id="workshop-title">錬金術工房</h2>
        </div>
        <span className="badge">
          {state.equipment.length} / {GRID_CAPACITY} 設備
        </span>
      </div>
      <p className="muted">
        設備を選んで操作。新しい設備は空きマスに配置できます。
      </p>
      <div
        className="workshop-floor"
        style={{
          gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`,
        }}
        aria-label={`${GRID_COLUMNS}列${GRID_ROWS}行の工房`}
      >
        {Array.from({ length: GRID_CAPACITY }, (_, index) => {
          const x = index % GRID_COLUMNS;
          const y = Math.floor(index / GRID_COLUMNS);
          const entry = state.equipment.find(
            (entry) => entry.x === x && entry.y === y,
          );
          return (
            <button
              key={index}
              className={`floor-cell ${entry ? 'occupied' : ''} ${entry?.id === equipment.id ? 'selected' : ''} ${placement && !entry ? 'placeable' : ''}`}
              aria-label={
                entry
                  ? `${equipmentTypes[entry.kind].name} #${entry.id}`
                  : `空きマス ${x + 1}-${y + 1}`
              }
              aria-pressed={entry?.id === equipment.id}
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
                <span aria-hidden="true">{placement ? '+' : '·'}</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="equipment-shop">
        {(Object.keys(equipmentTypes) as EquipmentKind[]).map((kind) => {
          const data = equipmentTypes[kind];
          const locked = !unlocked(state, data.requires);
          return (
            <div key={kind}>
              <button
                aria-label={`${data.name}を購入・配置`}
                disabled={locked || state.gold < data.price}
                onClick={() => setPlacement({ type: 'buy', kind })}
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
        })}
      </div>
      {placement && (
        <div className="message placement" role="status">
          {placement.type === 'buy'
            ? `${equipmentTypes[placement.kind].name}を置く空きマスを選択`
            : `設備 #${placement.id} の移動先を選択（無料）`}
          <button onClick={() => setPlacement(null)}>配置をキャンセル</button>
        </div>
      )}
      <EquipmentDetail
        state={state}
        send={send}
        equipment={equipment}
        onMove={() => setPlacement({ type: 'move', id: equipment.id })}
      />
    </section>
  );
}
