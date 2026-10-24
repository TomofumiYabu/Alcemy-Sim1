import { useState } from 'react';
import { adventurerTypes, destinations, items } from '../game/content';
import { getExpeditionPreview, unlocked } from '../game/engine';
import type { AdventurerId, DestinationId } from '../game/types';
import { seconds } from './format';
import type { PanelProps } from './types';

export function ExpeditionPanel({ state, send }: PanelProps) {
  const [destination, setDestination] = useState<
    Record<AdventurerId, DestinationId>
  >({ iris: 'forest', rowan: 'forest' });
  return (
    <section
      id="expeditions"
      className="panel"
      aria-labelledby="expeditions-title"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">EXPEDITIONS</p>
          <h2 id="expeditions-title" tabIndex={-1}>
            冒険者ギルド
          </h2>
        </div>
        <span className="badge">
          {state.adventurers.filter((entry) => entry.hired).length} / 2 雇用
        </span>
      </div>
      <p className="muted">派遣費用は無料。素材は帰還時に自動回収します。</p>
      {state.adventurers.map((entry) => {
        const data = adventurerTypes[entry.id];
        const target =
          entry.trip?.destination ??
          (unlocked(state, destinations[destination[entry.id]].requires)
            ? destination[entry.id]
            : 'forest');
        const preview = entry.trip ?? getExpeditionPreview(state, target);
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
              <span className={`badge ${entry.trip ? 'active-badge' : ''}`}>
                {!entry.hired ? '未雇用' : entry.trip ? '探索中' : '待機中'}
              </span>
            </div>
            {!entry.hired ? (
              <>
                <p>雇用すると、森や遺跡の素材集めを任せられます。</p>
                <button
                  className="secondary wide"
                  aria-label={`${data.name}を雇う`}
                  disabled={state.gold < data.price}
                  onClick={() => send({ type: 'hire', id: entry.id })}
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
                        [entry.id]: event.target.value as DestinationId,
                      })
                    }
                  >
                    {(Object.keys(destinations) as DestinationId[]).map(
                      (id) => (
                        <option
                          key={id}
                          value={id}
                          disabled={!unlocked(state, destinations[id].requires)}
                        >
                          {destinations[id].name}
                          {unlocked(state, destinations[id].requires)
                            ? ''
                            : '（研究で解放）'}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <p className="expedition-reward">
                  {Object.entries(preview.rewards)
                    .filter(([, count]) => count > 0)
                    .map(
                      ([id, count]) =>
                        `${items[id as keyof typeof items].name} +${count}`,
                    )
                    .join(' / ')}{' '}
                  <span>· {seconds(preview.total)}</span>
                </p>
                {entry.trip && (
                  <>
                    <progress
                      aria-label={`${data.name}の探索進捗`}
                      max={entry.trip.total}
                      value={entry.trip.total - entry.trip.remaining}
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
                      onChange={() => send({ type: 'auto', id: entry.id })}
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
  );
}
