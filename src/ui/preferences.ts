export const PREFERENCES_KEY = 'alcemy-sim-ui-preferences-v1';
export type Preferences = {
  version: 1;
  motion: 'system' | 'reduced' | 'full';
  textSize: 'standard' | 'large' | 'largest';
  notifications: boolean;
  sound: boolean;
  volume: number;
};
export const DEFAULT_PREFERENCES: Preferences = {
  version: 1,
  motion: 'system',
  textSize: 'standard',
  notifications: true,
  sound: false,
  volume: 30,
};
export function parsePreferences(value: string | null): Preferences {
  try {
    const data = JSON.parse(value ?? 'null');
    if (
      data?.version !== 1 ||
      !['system', 'reduced', 'full'].includes(data.motion) ||
      !['standard', 'large', 'largest'].includes(data.textSize) ||
      typeof data.notifications !== 'boolean' ||
      typeof data.sound !== 'boolean' ||
      !Number.isFinite(data.volume) ||
      data.volume < 0 ||
      data.volume > 100
    )
      return { ...DEFAULT_PREFERENCES };
    return {
      version: 1,
      motion: data.motion,
      textSize: data.textSize,
      notifications: data.notifications,
      sound: data.sound,
      volume: data.volume,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}
