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

let ready = false;
export function registerSection(section, load) {
  const nav = document.querySelector(`[data-crm-section="${section}"]`);
  const prepare = () => { if (ready) load().catch(() => {}); };
  nav?.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse' || event.pointerType === 'pen') prepare();
  }, {passive:true});
  nav?.addEventListener('focus', prepare);
}
export function prepareWorkspace(signedIn) {
  ready = signedIn;
}
