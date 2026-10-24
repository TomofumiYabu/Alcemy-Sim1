import { useCallback, useEffect, useRef, useState } from 'react';
import type { Feedback } from './feedback';
import type { Preferences } from './preferences';

export function useFeedbackSound(
  feedback: Feedback[],
  preferences: Preferences,
) {
  const audio = useRef<AudioContext | null>(null);
  const current = useRef(preferences);
  current.current = preferences;
  const lastSeen = useRef(0);
  const [unavailable, setUnavailable] = useState(false);
  const unlock = useCallback(() => {
    if (!current.current.sound) return;
    try {
      if (!audio.current) audio.current = new AudioContext();
      if (audio.current.state === 'suspended')
        void audio.current.resume().catch(() => setUnavailable(true));
    } catch {
      setUnavailable(true);
    }
  }, []);
  useEffect(() => {
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      void audio.current?.close();
      audio.current = null;
    };
  }, [unlock]);
  useEffect(() => {
    const latest = feedback.filter((event) => event.id > lastSeen.current);
    for (const event of feedback)
      lastSeen.current = Math.max(lastSeen.current, event.id);
    const context = audio.current;
    if (
      !latest.length ||
      !preferences.sound ||
      !preferences.volume ||
      document.hidden ||
      context?.state !== 'running'
    )
      return;
    // One short tone per batch, even when 24 machines finish together.
    const event = latest.at(-1)!;
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(
        event.type === 'researched'
          ? 784
          : event.type === 'returned'
            ? 523.25
            : event.type === 'sold'
              ? 659.25
              : 440,
        start,
      );
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(
        (preferences.volume / 100) * 0.08,
        start + 0.012,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.19);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.2);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    } catch {
      setUnavailable(true);
    }
  }, [feedback, preferences.sound, preferences.volume]);
  return { unavailable };
}
