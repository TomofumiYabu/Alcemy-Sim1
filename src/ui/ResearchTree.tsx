import { useEffect, useRef, useState } from 'react';
import { research } from '../game/content';
import { researchReason } from '../game/engine';
import { researchIds } from '../game/types';
import type { ResearchId } from '../game/types';
import type { Navigate, PanelProps } from './types';
import { focusTarget } from './navigation';
import type { NavigationRequest } from './navigation';
import { Icon } from './Icon';
import {
  researchAction,
  researchExample,
  researchIcons,
} from './researchPresentation';
import { DestinationArtwork, EquipmentArtwork, ItemArtwork } from './Artwork';

export function ResearchTree({
  state,
  send,
  navigate,
  request,
}: PanelProps & {
  navigate: Navigate;
  request: NavigationRequest<'research'> | null;
}) {
  const [highlighted, setHighlighted] = useState<ResearchId | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const cards = useRef<Partial<Record<ResearchId, HTMLElement | null>>>({});
  const buttons = useRef<Partial<Record<ResearchId, HTMLButtonElement | null>>>(
    {},
  );
  useEffect(() => {
    if (!request) return;
    if (request.target) {
      setHighlighted(request.target.id);
      focusTarget(
        buttons.current[request.target.id],
        cards.current[request.target.id] ?? heading.current,
      );
    } else focusTarget(heading.current, null, false);
  }, [request]);
  const focusPrerequisite = (id: ResearchId) => {
    setHighlighted(id);
    focusTarget(cards.current[id], heading.current);
  };
  return (
    <section
      id="research"
      className="panel research-panel"
      aria-labelledby="research-title"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">KNOWLEDGE TREE</p>
          <h2 ref={heading} id="research-title" tabIndex={-1}>
            錬金術の研究
          </h2>
        </div>
        <span className="badge">
          {state.research.length} / {researchIds.length} 研究済み
        </span>
      </div>
      <p className="muted">
        前提の研究から順に解放。新しい道具と仕組みを工房へつなげましょう。
      </p>
      <div className="research-branches">
        {['採集', '生産', '知識'].map((branch, branchIndex) => (
          <div className="research-branch" key={branch}>
            <h3>
              <Icon
                name={
                  branchIndex === 0
                    ? 'leaf'
                    : branchIndex === 1
                      ? 'workshop'
                      : 'book'
                }
              />
              {branch}の道
            </h3>
            {researchIds
              .filter((id) => research[id].branch === branch)
              .map((id) => {
                const data = research[id];
                const done = state.research.includes(id);
                const reason = researchReason(state, id);
                const action = researchAction[id];
                const missingGold = Math.max(0, data.gold - state.gold);
                const missingKnowledge = Math.max(
                  0,
                  data.knowledge - state.knowledge,
                );
                return (
                  <article
                    ref={(node) => {
                      cards.current[id] = node;
                    }}
                    tabIndex={-1}
                    className={`research-card ${done ? 'researched' : ''} ${!reason ? 'available' : ''} ${highlighted === id ? 'research-highlighted' : ''}`}
                    key={id}
                    data-testid={`research-${id}`}
                    onFocus={() => setHighlighted(id)}
                  >
                    <div className="research-name">
                      <span>
                        <Icon name={done ? 'check' : researchIcons[id]} />
                      </span>
                      <h4>{data.name}</h4>
                    </div>
                    <p>{data.description}</p>
                    {id === 'gathering-3' ? (
                      <div className="research-unlock">
                        <DestinationArtwork destination="ruins" />
                        <span>探索先：月影の遺跡</span>
                      </div>
                    ) : id === 'production-2' ? (
                      <div className="research-unlock">
                        <EquipmentArtwork
                          equipment={{
                            id: 0,
                            kind: 'still',
                            x: 0,
                            y: 0,
                            recipe: 'extract',
                            enabled: false,
                            job: null,
                          }}
                        />
                        <span>
                          蒸留器 <span aria-hidden="true">→</span>
                          <ItemArtwork item="extract" />
                          薬草エキス
                        </span>
                      </div>
                    ) : id === 'knowledge-2' ? (
                      <div className="research-unlock">
                        <ItemArtwork item="extract" />
                        <span>＋</span>
                        <ItemArtwork item="crystal" />
                        <span>→</span>
                        <ItemArtwork item="mana" />
                      </div>
                    ) : null}
                    {!done && (
                      <p className="research-example">
                        {researchExample(state, id)}
                      </p>
                    )}
                    {data.requires.length > 0 && (
                      <div className="research-prerequisites">
                        <small>前提研究</small>
                        {data.requires.map((prerequisite) => (
                          <button
                            key={prerequisite}
                            className="prerequisite-link"
                            onClick={() => focusPrerequisite(prerequisite)}
                            aria-label={`前提研究「${research[prerequisite].name}」を開く`}
                          >
                            <Icon
                              name={
                                state.research.includes(prerequisite)
                                  ? 'check'
                                  : 'lock'
                              }
                            />
                            {research[prerequisite].name}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="research-cost">
                      <span>
                        <Icon name="coin" />
                        {data.gold}金貨
                      </span>
                      <span>
                        <Icon name="knowledge" />
                        {data.knowledge}知識
                      </span>
                    </div>
                    {!done && (missingGold > 0 || missingKnowledge > 0) && (
                      <small className="research-deficit">
                        あと
                        {[
                          missingGold ? `${missingGold}金貨` : '',
                          missingKnowledge ? `${missingKnowledge}知識` : '',
                        ]
                          .filter(Boolean)
                          .join('・')}
                      </small>
                    )}
                    <button
                      className={done ? 'subtle wide' : 'secondary wide'}
                      ref={(node) => {
                        buttons.current[id] = node;
                      }}
                      aria-label={`${data.name}を研究`}
                      disabled={reason !== null}
                      onClick={() => send({ type: 'research', id })}
                    >
                      {done ? '研究済み' : '研究する'}
                    </button>
                    <small className="research-reason">
                      {reason ?? '研究できます'}
                    </small>
                    {done && action && (
                      <button
                        className="subtle wide unlock-action"
                        onClick={() => navigate(action.navigation)}
                      >
                        {action.label} →
                      </button>
                    )}
                  </article>
                );
              })}
          </div>
        ))}
      </div>
    </section>
  );
}
