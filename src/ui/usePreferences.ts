import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_KEY,
  parsePreferences,
} from './preferences';
import type { Preferences } from './preferences';

/** UI preferences have their own key and never write game progress or its backup. */
export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(() => {
    try {
      return parsePreferences(localStorage.getItem(PREFERENCES_KEY));
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  });
  const current = useRef(preferences);
  const [error, setError] = useState<string | null>(null);
  const [systemReduced, setSystemReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const updatePreferences = useCallback(
    (patch: Partial<Omit<Preferences, 'version'>>) => {
      const next = parsePreferences(
        JSON.stringify({ ...current.current, ...patch }),
      );
      current.current = next;
      setPreferences(next);
      try {
        localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next));
        setError(null);
      } catch {
        setError(
          '設定を保存できませんでした。この画面では変更を適用しています。',
        );
      }
    },
    [],
  );
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => setSystemReduced(query.matches);
    query.addEventListener('change', changed);
    const stored = (event: StorageEvent) => {
      if (event.key !== PREFERENCES_KEY) return;
      const next = parsePreferences(event.newValue);
      current.current = next;
      setPreferences(next);
    };
    window.addEventListener('storage', stored);
    return () => {
      query.removeEventListener('change', changed);
      window.removeEventListener('storage', stored);
    };
  }, []);
  useEffect(() => {
    const size =
      preferences.textSize === 'largest'
        ? '125%'
        : preferences.textSize === 'large'
          ? '112.5%'
          : '100%';
    document.documentElement.style.setProperty('--ui-text-size', size);
    return () => {
      document.documentElement.style.removeProperty('--ui-text-size');
    };
  }, [preferences.textSize]);
  const reduceMotion =
    preferences.motion === 'reduced' ||
    (preferences.motion === 'system' && systemReduced);
  return { preferences, updatePreferences, reduceMotion, error };
}
