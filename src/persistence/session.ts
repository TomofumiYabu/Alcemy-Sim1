export type SessionRole = 'waiting' | 'owner' | 'unsupported';
export const SAVE_LOCK = 'alcemy-sim-save-writer';

/** Keep the exclusive Web Lock until the owning page leaves. Never fall back to unsafe writes. */
export function createSaveSession(
  locks: LockManager | undefined,
  acquired: () => void,
  roleChanged: (role: SessionRole) => void,
) {
  let active = true;
  let owner = false;
  let release: (() => void) | undefined;
  const abort = new AbortController();
  if (!locks) roleChanged('unsupported');
  else {
    roleChanged('waiting');
    void locks
      .request(SAVE_LOCK, { signal: abort.signal }, async () => {
        if (!active) return;
        owner = true;
        await new Promise<void>((resolve) => {
          release = resolve;
          acquired();
          roleChanged('owner');
        });
        owner = false;
      })
      .catch(() => {
        if (active) {
          owner = false;
          roleChanged('unsupported');
        }
      });
  }
  return {
    isOwner: () => active && owner,
    dispose: () => {
      active = false;
      owner = false;
      abort.abort();
      release?.();
    },
  };
}
export type SaveSession = ReturnType<typeof createSaveSession>;
