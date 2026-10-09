// Keep the rendered snapshot available if the inventory service is unavailable.
export async function resolveLiveFleet(snapshot, load, timeoutMs = 5000) {
  let timer;
  try {
    const current = await Promise.race([
      Promise.resolve().then(load),
      new Promise(resolve => { timer = setTimeout(() => resolve(null), timeoutMs); }),
    ]);
    return Array.isArray(current) ? current : snapshot;
  } catch {
    return snapshot;
  } finally {
    clearTimeout(timer);
  }
}
