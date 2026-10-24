import { useCallback, useEffect, useRef, useState } from 'react';
import {
  advanceTicks,
  applyCommand,
  createGame,
  TICK_MS,
} from '../game/engine';
import type { Command, GameState } from '../game/types';
import { loadGame, saveGame } from '../persistence/save';

export function useGame() {
  const [initial] = useState(() => {
    try {
      return loadGame(window.localStorage);
    } catch {
      return {
        state: createGame(),
        blocked: true,
        message:
          '保存領域を読み込めません。新しい工房を保存なしで始められます。',
      };
    }
  });
  const [state, setState] = useState(initial.state);
  const current = useRef(state);
  const [blocked, setBlocked] = useState(initial.blocked);
  const [saveError, setSaveError] = useState<string | null>(initial.message);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const persist = useCallback((next: GameState) => {
    let error: string | null;
    try {
      error = saveGame(window.localStorage, next);
    } catch {
      error = '保存に失敗しました。ブラウザーの保存設定を確認してください。';
    }
    setSaveError(error);
    setSaved(error === null);
  }, []);
  const update = useCallback((next: GameState) => {
    current.current = next;
    setState(next);
  }, []);
  const send = useCallback(
    (command: Command) => {
      if (blocked) return false;
      const result = applyCommand(current.current, command);
      setNotice(result.error);
      if (!result.error) {
        update(result.state);
        persist(result.state);
      }
      return result.error === null;
    },
    [blocked, update, persist],
  );
  useEffect(() => {
    if (blocked) return;
    let last = performance.now();
    let remainder = 0;
    const resetClock = () => {
      last = performance.now();
      remainder = 0;
      persist(current.current);
    };
    const interval = window.setInterval(() => {
      const now = performance.now();
      if (document.hidden) {
        last = now;
        remainder = 0;
        return;
      }
      remainder += Math.min(Math.max(now - last, 0), 60_000);
      last = now;
      const ticks = Math.floor(remainder / TICK_MS);
      if (ticks > 0) {
        remainder -= ticks * TICK_MS;
        update(advanceTicks(current.current, ticks));
      }
    }, TICK_MS);
    const autosave = window.setInterval(() => persist(current.current), 5_000);
    document.addEventListener('visibilitychange', resetClock);
    window.addEventListener('pagehide', resetClock);
    return () => {
      window.clearInterval(interval);
      window.clearInterval(autosave);
      document.removeEventListener('visibilitychange', resetClock);
      window.removeEventListener('pagehide', resetClock);
    };
  }, [blocked, update, persist]);
  const reset = () => {
    if (!window.confirm('工房の進行を初期化します。よろしいですか？'))
      return false;
    const next = createGame();
    update(next);
    setBlocked(false);
    setNotice(null);
    persist(next);
    return true;
  };
  return {
    state,
    blocked,
    saveError,
    notice,
    saved,
    send,
    reset,
    save: () => persist(current.current),
  };
}
