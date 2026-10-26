import { useCallback, useEffect, useRef, useState } from 'react';
import { createDayGame } from '../game/dayEngine';
import type { DayCommand, DayState } from '../game/dayTypes';
import {
  commitDayCommand,
  loadDayGame,
  SAVE_KEY,
  saveDayGame,
} from '../persistence/daySave';
import { createSaveSession } from '../persistence/session';
import type { SaveSession, SessionRole } from '../persistence/session';
import { useFeedback } from './useFeedback';

const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0] || 1;
export function useGame() {
  const { feedback, publishFeedback, clearFeedback } = useFeedback();
  const [seed] = useState(newSeed);
  const [initial] = useState(() => loadDayGame(window.localStorage, seed));
  const [day, setDay] = useState(initial.state);
  const current = useRef(day);
  const [blocked, setBlocked] = useState(initial.blocked);
  const blockedRef = useRef(initial.blocked);
  const session = useRef<SaveSession | null>(null);
  const [role, setRole] = useState<SessionRole>('waiting');
  const [saveError, setSaveError] = useState<string | null>(initial.message);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const update = useCallback((next: DayState) => {
    current.current = next;
    setDay(next);
  }, []);
  const persist = useCallback((next: DayState) => {
    if (!session.current?.isOwner() || blockedRef.current) return false;
    const error = saveDayGame(window.localStorage, next);
    setSaveError(error);
    setSaved(error === null);
    return error === null;
  }, []);
  useEffect(() => {
    const reload = () => {
      clearFeedback();
      const loaded = loadDayGame(window.localStorage, seed);
      update(loaded.state);
      blockedRef.current = loaded.blocked;
      setBlocked(loaded.blocked);
      setSaveError(loaded.message);
      setNotice(null);
      setSaved(false);
    };
    const connect = () => {
      if (session.current) return;
      let locks: LockManager | undefined;
      try {
        locks = navigator.locks;
      } catch {
        /* unavailable */
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
    const visible = () => {
      if (document.hidden) clearFeedback();
    };
    connect();
    window.addEventListener('pagehide', leave);
    window.addEventListener('pageshow', connect);
    window.addEventListener('storage', changed);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('pagehide', leave);
      window.removeEventListener('pageshow', connect);
      window.removeEventListener('storage', changed);
      document.removeEventListener('visibilitychange', visible);
      leave();
    };
  }, [seed, update, persist, clearFeedback]);
  // Only persistence uses time. No wall clock advances work, customers, or days.
  useEffect(() => {
    if (blocked || role !== 'owner') return;
    persist(current.current);
    const autosave = window.setInterval(() => persist(current.current), 5000);
    return () => window.clearInterval(autosave);
  }, [blocked, role, persist]);
  const send = useCallback(
    (command: DayCommand) => {
      if (blockedRef.current || !session.current?.isOwner()) return false;
      const result = commitDayCommand(
        window.localStorage,
        current.current,
        command,
      );
      if (result.error) {
        if (result.error.startsWith('保存')) {
          setSaveError(result.error);
          setSaved(false);
          setNotice(null);
        } else setNotice(result.error);
        return false;
      }
      if (command.type === 'finish-day') clearFeedback();
      update(result.state);
      setSaveError(null);
      setSaved(true);
      setNotice(null);
      publishFeedback(result.events);
      return true;
    },
    [update, publishFeedback, clearFeedback],
  );
  const reset = () => {
    if (
      !session.current?.isOwner() ||
      !window.confirm('工房の進行を初期化します。よろしいですか？')
    )
      return false;
    const next = createDayGame(newSeed());
    const error = saveDayGame(window.localStorage, next, true);
    if (error) {
      setSaveError(error);
      return false;
    }
    clearFeedback();
    update(next);
    blockedRef.current = false;
    setBlocked(false);
    setNotice(null);
    setSaveError(null);
    setSaved(true);
    return true;
  };
  return {
    state: day.world,
    day,
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
