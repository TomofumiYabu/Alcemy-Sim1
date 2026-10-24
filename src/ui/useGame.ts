import { useCallback, useEffect, useRef, useState } from 'react';
import {
  advanceWithEvents,
  applyCommand,
  createGame,
  TICK_MS,
} from '../game/engine';
import type { Command, GameState } from '../game/types';
import { loadGame, SAVE_KEY, saveGame } from '../persistence/save';
import { createSaveSession } from '../persistence/session';
import type { SaveSession, SessionRole } from '../persistence/session';
import { useFeedback } from './useFeedback';

export function useGame() {
  const { feedback, publishFeedback, clearFeedback } = useFeedback();
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
  const blockedRef = useRef(initial.blocked);
  const session = useRef<SaveSession | null>(null);
  const [role, setRole] = useState<SessionRole>('waiting');
  const [saveError, setSaveError] = useState<string | null>(initial.message);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const persist = useCallback((next: GameState) => {
    if (!session.current?.isOwner() || blockedRef.current) return;
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
  useEffect(() => {
    const reload = () => {
      clearFeedback();
      let loaded;
      try {
        loaded = loadGame(window.localStorage);
      } catch {
        loaded = {
          state: createGame(),
          blocked: true,
          message: '保存領域を読み込めません。',
        };
      }
      update(loaded.state);
      blockedRef.current = loaded.blocked;
      setBlocked(loaded.blocked);
      setSaveError(loaded.message);
      setSaved(false);
    };
    const connect = () => {
      if (session.current) return;
      let locks: LockManager | undefined;
      try {
        locks = navigator.locks;
      } catch {
        /* unavailable in this browser */
      }
      session.current = createSaveSession(locks, reload, setRole);
    };
    const leave = () => {
      clearFeedback();
      persist(current.current);
      session.current?.dispose();
      session.current = null;
      setRole('waiting');
    };
    const changed = (event: StorageEvent) => {
      if (event.key === SAVE_KEY && !session.current?.isOwner()) reload();
    };
    connect();
    window.addEventListener('pagehide', leave);
    window.addEventListener('pageshow', connect);
    window.addEventListener('storage', changed);
    return () => {
      window.removeEventListener('pagehide', leave);
      window.removeEventListener('pageshow', connect);
      window.removeEventListener('storage', changed);
      leave();
    };
  }, [update, persist, clearFeedback]);
  const send = useCallback(
    (command: Command) => {
      if (blockedRef.current || !session.current?.isOwner()) return false;
      const result = applyCommand(current.current, command);
      setNotice(result.error);
      if (!result.error) {
        update(result.state);
        persist(result.state);
        publishFeedback(result.events);
      }
      return result.error === null;
    },
    [blocked, update, persist, publishFeedback],
  );
  useEffect(() => {
    if (blocked || role !== 'owner') return;
    let last = performance.now();
    let remainder = 0;
    const resetClock = () => {
      if (document.hidden) clearFeedback();
      last = performance.now();
      remainder = 0;
      persist(current.current);
    };
    const interval = window.setInterval(() => {
      const now = performance.now();
      if (document.hidden || !session.current?.isOwner()) {
        last = now;
        remainder = 0;
        return;
      }
      remainder += Math.min(Math.max(now - last, 0), 60_000);
      last = now;
      const ticks = Math.floor(remainder / TICK_MS);
      if (ticks > 0) {
        remainder -= ticks * TICK_MS;
        const result = advanceWithEvents(current.current, ticks);
        update(result.state);
        publishFeedback(result.events);
      }
    }, TICK_MS);
    const autosave = window.setInterval(() => persist(current.current), 5_000);
    document.addEventListener('visibilitychange', resetClock);
    return () => {
      window.clearInterval(interval);
      window.clearInterval(autosave);
      document.removeEventListener('visibilitychange', resetClock);
    };
  }, [blocked, role, update, persist, publishFeedback, clearFeedback]);
  const reset = () => {
    if (!session.current?.isOwner()) return false;
    if (!window.confirm('工房の進行を初期化します。よろしいですか？'))
      return false;
    const next = createGame();
    clearFeedback();
    update(next);
    blockedRef.current = false;
    setBlocked(false);
    setNotice(null);
    persist(next);
    return true;
  };
  return {
    state,
    role,
    blocked,
    saveError,
    notice,
    saved,
    feedback,
    send,
    reset,
    save: () => persist(current.current),
  };
}
