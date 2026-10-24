import { research } from '../game/content';
import { researchReason } from '../game/engine';
import { researchIds } from '../game/types';
import type { PanelProps } from './types';

export function ResearchTree({ state, send }: PanelProps) {
  return (
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
          {state.research.length} / {researchIds.length} 研究済み
        </span>
      </div>
      <p className="muted">
        発見を知識に、知識を次の可能性に。研究の効果はずっと工房に残ります。
      </p>
      <div className="research-branches">
        {['採集', '生産', '知識'].map((branch, branchIndex) => (
          <div className="research-branch" key={branch}>
            <h3>
              <span aria-hidden="true">{['♧', '♨', '✧'][branchIndex]}</span>
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
                      ◉ {data.gold}金貨 <span>✧ {data.knowledge}知識</span>
                    </div>
                    <button
                      className={done ? 'subtle wide' : 'secondary wide'}
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
  );
}
