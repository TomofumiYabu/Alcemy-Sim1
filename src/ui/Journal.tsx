import type { PanelProps } from './types';

export function Journal({ state }: Pick<PanelProps, 'state'>) {
  return (
    <section className="panel journal" aria-labelledby="journal-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">WORKSHOP JOURNAL</p>
          <h2 id="journal-title">工房の記録</h2>
        </div>
      </div>
      <ol>
        {state.log.slice(0, 8).map((entry, index) => (
          <li key={`${entry.tick}-${index}`}>
            <span className="journal-time">{entry.tick}作業</span>
            <span>{entry.message}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
