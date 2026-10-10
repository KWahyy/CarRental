// Shared server/browser markup keeps empty native dates consistent from first paint.
export function decorateDateFields(root) {
  root.querySelectorAll('input[type="date"],input[type="datetime-local"]').forEach(input => {
    if (input.closest('.hero-date-control,.vehicle-date-control,.reservation-date-control')) return;
    if (!input.closest('.site-date-control')) {
      const doc = input.ownerDocument;
      const wrapper = doc.createElement('div');
      wrapper.className = 'site-date-control';
      input.before(wrapper);
      wrapper.append(input);
      const label = doc.createElement('span');
      label.className = 'site-date-placeholder';
      label.setAttribute('aria-hidden', 'true');
      label.textContent = 'Select date';
      wrapper.append(label);
    }
    input.toggleAttribute('data-date-empty', !input.value);
  });
}
export function initDateFields() {
  const sync = () => decorateDateFields(document);
  sync();
  document.addEventListener('input', sync);
  document.addEventListener('change', sync);
  document.addEventListener('focusout', sync);
  document.addEventListener('reset', () => requestAnimationFrame(sync));
  window.addEventListener('pageshow', sync);
  new MutationObserver(records => {
    if (records.some(record => [...record.addedNodes].some(node => node.nodeType === 1 && (node.matches('input') || node.querySelector('input'))))) sync();
  }).observe(document.body, {childList:true,subtree:true});
}
