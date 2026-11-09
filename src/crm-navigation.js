// Keep requests in memory only. Concurrent navigation shares one request; writes
// requesting a forced refresh still get a fresh request after any active read.
export function singleFlight(task) {
  let pending;
  return function run(...args) {
    if (pending) return args[0] === true ? pending.then(() => run(...args)) : pending;
    pending = Promise.resolve().then(() => task(...args)).finally(() => { pending = null; });
    return pending;
  };
}

const sections = new Map();
let ready = false, generation = 0;
export function registerSection(section, load) {
  sections.set(section, load);
  const nav = document.querySelector(`[data-crm-section="${section}"]`);
  const prepare = () => { if (ready) load().catch(() => {}); };
  nav?.addEventListener('pointerenter', prepare, {passive:true});
  nav?.addEventListener('focus', prepare);
}
export function prepareWorkspace(signedIn) {
  if (!signedIn) { ready = false; generation++; return; }
  if (ready) return;
  ready = true;
  const current = ++generation;
  // Let the visible section paint first, then warm the others one at a time.
  setTimeout(async () => {
    for (const load of sections.values()) {
      if (!ready || current !== generation) return;
      try { await load(); } catch { /* Section retains its own retry UI. */ }
    }
  }, 1200);
}
