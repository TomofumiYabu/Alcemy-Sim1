import { CONTENT_VERSION } from '../game/contentVersions';
import { stateSchema } from '../game/types';
import type { GameState } from '../game/types';
import { legacyV1Schema } from './legacyV1';

export function migrateSave(raw: unknown): GameState {
  if (raw !== null && typeof raw === 'object' && 'schemaVersion' in raw && raw.schemaVersion === 1) {
    const legacy = legacyV1Schema.parse(raw);
    return stateSchema.parse({
      ...legacy, schemaVersion: 2, contentVersion: CONTENT_VERSION,
      equipment: legacy.equipment.map((entry) => ({ ...entry, job: entry.job ? { ...entry.job, contentVersion: 1 } : null })),
      adventurers: legacy.adventurers.map((entry) => ({ ...entry, trip: entry.trip ? { ...entry.trip, contentVersion: 1 } : null })),
    });
  }
  return stateSchema.parse(raw);
}
