import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameEvent } from '../game/events';
import {
  FEEDBACK_LIFETIME,
  FEEDBACK_LIMIT,
  feedbackKey,
  feedbackPayloads,
} from './feedback';
import type { Feedback } from './feedback';

export function useFeedback() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const sequence = useRef(0);
  const clearFeedback = useCallback(() => setFeedback([]), []);
  const publishFeedback = useCallback((events: GameEvent[]) => {
    if (!events.length) return;
    const now = performance.now();
    const incoming = feedbackPayloads(events).map((event) => ({
      ...event,
      id: ++sequence.current,
      key: feedbackKey(event),
      updatedAt: now,
      expiresAt: now + FEEDBACK_LIFETIME,
    }));
    setFeedback((previous) => {
      const next = previous.filter((event) => event.expiresAt > now);
      for (const event of incoming) {
        const existing = next.find(
          (candidate) =>
            candidate.key === event.key && now - candidate.updatedAt < 700,
        );
        if (existing?.type === 'crafted' && event.type === 'crafted') {
          const equipment = { ...existing.equipment };
          for (const [id, count] of Object.entries(event.equipment))
            equipment[Number(id)] = (equipment[Number(id)] ?? 0) + count;
          next[next.indexOf(existing)] = {
            ...event,
            id: existing.id,
            amount: existing.amount + event.amount,
            knowledge: existing.knowledge + event.knowledge,
            equipment,
          };
        } else next.push(event);
      }
      return next.slice(-FEEDBACK_LIMIT);
    });
  }, []);
  useEffect(() => {
    if (!feedback.length) return;
    const timer = window.setTimeout(
      () => {
        const now = performance.now();
        setFeedback((current) =>
          current.filter((event) => event.expiresAt > now),
        );
      },
      Math.max(
        0,
        Math.min(...feedback.map((event) => event.expiresAt)) -
          performance.now(),
      ),
    );
    return () => window.clearTimeout(timer);
  }, [feedback]);
  return { feedback, publishFeedback, clearFeedback };
}
