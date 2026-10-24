import type { GameState } from '../game/types';
export function QuestProgress({ state }: { state: GameState }) {
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
  return (
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
  );
}
