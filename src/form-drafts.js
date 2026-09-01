const timers = new Map();

function storage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readDraft(key) {
  try {
    const raw = storage()?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeDraft(key, data) {
  try {
    storage()?.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // A full or unavailable browser store should never interrupt the form.
  }
}

export function clearDraft(key) {
  window.clearTimeout(timers.get(key));
  timers.delete(key);
  try {
    storage()?.removeItem(key);
  } catch {
    // Ignore unavailable browser storage.
  }
}

export function draftData(key) {
  return readDraft(key)?.data ?? null;
}

export function serializeForm(form) {
  if (!form) return [];
  return [...form.elements].flatMap((field, index) => {
    const type = String(field.type || "").toLowerCase();
    if (!field.name || field.disabled || ["file", "password", "button", "submit", "reset"].includes(type)) return [];
    return [{
      name: field.name,
      index,
      type,
      value: field.value,
      checked: ["checkbox", "radio"].includes(type) ? field.checked : undefined,
    }];
  });
}

export function restoreForm(form, fields) {
  if (!form || !Array.isArray(fields)) return false;
  let restored = false;
  fields.forEach((saved) => {
    const candidates = [...form.elements].filter((field) => field.name === saved.name);
    const field = form.elements[saved.index]?.name === saved.name
      ? form.elements[saved.index]
      : candidates.find((candidate) => candidate.value === saved.value) || candidates[0];
    if (!field || String(field.type || "").toLowerCase() === "file") return;
    if (["checkbox", "radio"].includes(saved.type)) field.checked = Boolean(saved.checked);
    else field.value = saved.value ?? "";
    restored = true;
  });
  return restored;
}

export function scheduleDraft(key, dataFactory, delay = 180) {
  window.clearTimeout(timers.get(key));
  timers.set(key, window.setTimeout(() => {
    writeDraft(key, dataFactory());
    timers.delete(key);
  }, delay));
}

export function flushDraft(key, data) {
  window.clearTimeout(timers.get(key));
  timers.delete(key);
  writeDraft(key, data);
}
