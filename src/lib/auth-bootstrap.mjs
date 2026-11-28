/** Prevent a late bootstrap request from overwriting a newer auth event.
 * Each mount owns its own gate; unmount prevents any later state update.
 */
export function createAuthBootstrapGate() {
  let authEventSeen = false;
  let disposed = false;
  return {
    onAuthEvent() { if (!disposed) authEventSeen = true; },
    canApplyBootstrap() { return !disposed && !authEventSeen; },
    isActive() { return !disposed; },
    dispose() { disposed = true; }
  };
}
