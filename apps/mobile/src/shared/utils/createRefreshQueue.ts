export function createRefreshQueue(task: () => Promise<void>, delayMs = 150) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight = false;
  let pending = false;
  let disposed = false;

  const schedule = () => {
    if (disposed) return;
    pending = true;
    if (inFlight || timer !== undefined) return;
    timer = setTimeout(() => {
      timer = undefined;
      if (disposed) return;
      pending = false;
      inFlight = true;
      void task().catch(() => {}).finally(() => {
        inFlight = false;
        if (pending) schedule();
      });
    }, delayMs);
  };

  return {
    schedule,
    dispose() {
      disposed = true;
      pending = false;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    },
  };
}
