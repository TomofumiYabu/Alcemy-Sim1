import { describe, expect, it } from 'vitest';
import { createGame, getCraftPreview } from '../../src/game/engine';
import {
  DEFAULT_PREFERENCES,
  parsePreferences,
} from '../../src/ui/preferences';
import { materialSource } from '../../src/ui/materialSources';
import { researchExample } from '../../src/ui/researchPresentation';

describe('UI preferences stay separate from game progress', () => {
  it('rejects corrupt, future and incomplete records', () => {
    for (const raw of [
      null,
      '{',
      'null',
      '[]',
      '{}',
      JSON.stringify({ ...DEFAULT_PREFERENCES, version: 2 }),
      JSON.stringify({ ...DEFAULT_PREFERENCES, motion: 'invalid' }),
    ])
      expect(parsePreferences(raw)).toEqual(DEFAULT_PREFERENCES);
  });
  it('rejects invalid volume and boolean values', () => {
    for (const patch of [
      { volume: -1 },
      { volume: 101 },
      { volume: null },
      { notifications: 'true' },
      { sound: 1 },
      { textSize: 'giant' },
    ])
      expect(
        parsePreferences(JSON.stringify({ ...DEFAULT_PREFERENCES, ...patch })),
      ).toEqual(DEFAULT_PREFERENCES);
  });
  it('keeps valid opt-in preferences and strips unrelated game fields', () => {
    const value = {
      ...DEFAULT_PREFERENCES,
      motion: 'reduced',
      textSize: 'largest',
      sound: true,
      volume: 100,
    };
    expect(
      parsePreferences(JSON.stringify({ ...value, gold: 999, inventory: {} })),
    ).toEqual(value);
    expect(
      parsePreferences(JSON.stringify({ ...DEFAULT_PREFERENCES, volume: 0 }))
        .volume,
    ).toBe(0);
  });
});
describe('material routes and research previews', () => {
  it('sends raw materials to their actual unlocked source or its required research', () => {
    const state = createGame();
    expect(materialSource(state, 'herb').target).toBe('expedition:forest');
    expect(materialSource(state, 'water').target).toBe('expedition:forest');
    expect(materialSource(state, 'crystal').target).toBe(
      '[data-testid="research-gathering-3"]',
    );
    state.research = ['gathering-1', 'gathering-2', 'gathering-3'];
    expect(materialSource(state, 'crystal').target).toBe('expedition:ruins');
  });
  it('takes an intermediate through unlock, placement and the existing machine', () => {
    const state = createGame();
    expect(materialSource(state, 'extract').target).toBe(
      '[data-testid="research-production-2"]',
    );
    state.research = ['production-1', 'production-2'];
    expect(materialSource(state, 'extract').target).toBe(
      '[aria-label="蒸留器を購入・配置"]',
    );
    state.equipment.push({
      id: 2,
      kind: 'still',
      x: 1,
      y: 0,
      recipe: 'extract',
      enabled: false,
      job: null,
    });
    expect(materialSource(state, 'extract').target).toBe('equipment:still');
  });
  it('uses the engine’s current preview and leaves progress untouched', () => {
    const state = createGame();
    const original = structuredClone(state);
    expect(researchExample(state, 'production-1')).toBe('傷薬 8.0秒 → 7.2秒');
    state.research = ['production-1'];
    expect(researchExample(state, 'production-3')).toContain(
      `${getCraftPreview(state, 'potion').total / 10}秒 → 6.4秒`,
    );
    state.research = [];
    expect(state).toEqual(original);
  });
});
