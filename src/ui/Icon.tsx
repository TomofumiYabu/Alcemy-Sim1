export type IconName =
  | 'workshop'
  | 'adventurers'
  | 'inventory'
  | 'research'
  | 'settings'
  | 'coin'
  | 'knowledge'
  | 'move'
  | 'play'
  | 'stop'
  | 'leaf'
  | 'clock'
  | 'book'
  | 'route'
  | 'check'
  | 'lock';
const paths: Record<IconName, string> = {
  workshop:
    'M5 9h14v5a7 7 0 0 1-14 0Zm-2 1H1v4h3m16-4h3v4h-3M7 21l1-2m9 2-1-2M9 6V2m6 4V2',
  adventurers:
    'M7 7a5 5 0 1 0 10 0 5 5 0 0 0-10 0ZM3 22v-3a9 9 0 0 1 18 0v3M7 21v-4m10 4v-4',
  inventory: 'M3 7h18v14H3ZM1 3h22v4H1Zm9 8h4',
  research: 'M9 2h6M10 2v7L3 20q-1 2 2 2h14q3 0 2-2L14 9V2M7 15h10',
  settings:
    'm10 2 4 0 1 3 3 1 3-1 2 4-2 3v3l2 3-2 4-3-1-3 1-1 3h-4l-1-3-3-1-3 1-2-4 2-3v-3L1 9l2-4 3 1 3-1ZM9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z',
  coin: 'M2 12a10 10 0 1 0 20 0 10 10 0 0 0-20 0ZM12 5v14m4-11h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8',
  knowledge: 'm12 1 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z',
  move: 'M12 1v22M1 12h22M8 5l4-4 4 4M8 19l4 4 4-4M5 8l-4 4 4 4m14-8 4 4-4 4',
  play: 'm6 3 15 9-15 9Z',
  stop: 'M6 3v18M18 3v18',
  leaf: 'M3 21 17 7M4 18C-1 3 12 2 22 2c0 13-4 21-16 16',
  clock: 'M2 12a10 10 0 1 0 20 0 10 10 0 0 0-20 0ZM12 6v7l4 2',
  book: 'M12 5C8 2 3 2 1 3v17c5-1 8 0 11 2 3-2 6-3 11-2V3c-2-1-7-1-11 2Zm0 0v17',
  route: 'M4 4h5v5H4ZM15 15h5v5h-5ZM9 6h6a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h3',
  check: 'm3 12 6 6L21 4',
  lock: 'M5 10h14v12H5ZM8 10V6a4 4 0 0 1 8 0v4m-4 5v3',
};
export function Icon({
  name,
  className = '',
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      className={`ui-icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
