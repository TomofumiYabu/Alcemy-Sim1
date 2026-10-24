import { useEffect, useState } from 'react';

export function useCompactLayout() {
  const [compact, setCompact] = useState(
    () => matchMedia('(max-width: 1000px)').matches,
  );
  useEffect(() => {
    const query = matchMedia('(max-width: 1000px)');
    const update = () => setCompact(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return compact;
}
