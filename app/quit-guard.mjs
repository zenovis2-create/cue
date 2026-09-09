// Electron's 'before-quit' listener cannot await: a fire-and-forget core.close()
// lets the process exit while the ordered runtime teardown is still deleting
// credential homes. The guard blocks the first quit, awaits the close barrier,
// then re-issues a final quit that must not re-enter the barrier.
//
// A close that rejects means teardown did NOT finish. Quitting anyway would turn
// a failed teardown into a clean-looking exit, so the guard stops at 'failed'
// and leaves the failure visible instead of calling app.quit().
export function registerQuitGuard(app, resolveCore, onFailure) {
  const guard = { state: 'idle' };
  app.on('before-quit', event => {
    if (guard.state === 'done') return;
    event.preventDefault();
    if (guard.state === 'closing' || guard.state === 'failed') return;
    guard.state = 'closing';
    Promise.resolve()
      .then(() => resolveCore()?.close())
      .then(() => { guard.state = 'done'; app.quit(); })
      .catch(error => {
        guard.error = error instanceof Error ? error.message : String(error);
        guard.state = 'failed';
        onFailure?.(error, guard);
      });
  });
  return guard;
}
