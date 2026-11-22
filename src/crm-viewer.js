// Presentation guard only; Supabase RLS and API authorization enforce access.
// Default-deny action controls for viewers, including controls rendered later.
export const VIEWER_READ_CONTROLS = [
  'crm-section','workspace-menu','sign-out','jump-section','action-queue',
  'dashboard-open','dashboard-section','dashboard-toggle','dashboard-range','dashboard-start','dashboard-end',
  'owned-refresh','owned-vehicle','open-vehicle','back-fleet','vehicle-tab',
  'fleet-ownership','fleet-view','fleet-filter','fleet-period','fleet-search','fleet-calendar','calendar-range','retry-fleet',
  'open-reservation','open-document','select-request','request-search','request-filter','request-sort',
  'quote-search','quote-filter','quote-scope','clear-quote-filters','back-quotes','open-quote','open-quote-button','retry-quotes','open-quote-invoice',
  'customer-search','customer-view','customer-key','customer-record','customer-retry','refresh-customers','customer-email-ready',
  'invoice-search','select-invoice','download-invoice',
  'agreement-search','select-agreement','download-agreement','agreement-audit',
  'booking-search','open-booking','retry-bookings','sales-year',
  'car-search','car-sort','car-make-filter','car-view-filter','clear-car-filters',
  'close-booking','close-booking-editor','close-fleet-action','close-fleet-dialog','close-quote-dialog',
];
const readSelector = VIEWER_READ_CONTROLS.map(name=>`[data-${name}]`).join(',');
export function isViewerReadControl(node) {
  return node.matches(readSelector) || node.matches('[data-detail-action="pdf"]');
}
export function installViewerGuard(document) {
  let active = false;
  const controls = 'button,input,select,textarea,[role="button"],a';
  function apply(root = document) {
    if (!active) return;
    const nodes = [...(root.matches?.(controls) ? [root] : []), ...root.querySelectorAll(controls)];
    for (const node of nodes) {
      if (node.closest('[data-login-view]') || isViewerReadControl(node)) continue;
      // Keep navigation to the public website and document downloads available.
      if (node.matches('a') && (node.hasAttribute('download') || node.getAttribute('href') === '/')) continue;
      if (node.matches('input,select,textarea')) {
        if (!node.disabled) { node.disabled = true; node.dataset.viewerDisabled = ''; }
      } else if (!node.hasAttribute('data-viewer-hidden')) {
        node.dataset.viewerHidden = '';
      }
    }
  }
  const style = document.createElement('style');
  style.textContent = '[data-viewer-hidden]{display:none!important}.crm-viewer-notice{padding:10px 16px;margin:12px 0;border:1px solid #d8d7d2;border-radius:8px;color:#555;background:#f4f3ef;font-size:13px}';
  document.head.append(style);
  const observer = new MutationObserver(records=>{
    if (!active) return;
    for (const record of records) {
      if (record.type === 'attributes') apply(record.target);
      else for (const node of record.addedNodes) if (node.nodeType === 1) apply(node);
    }
  });
  observer.observe(document.body, {childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
  document.addEventListener('click', event=>{
    if (!active || event.target.closest('[data-login-view]')) return;
    const control = event.target.closest(controls);
    if (control?.hasAttribute('data-viewer-hidden')) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  document.addEventListener('submit', event=>{
    if (active && !event.target.closest('[data-login-view]')) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  return role => {
    active = role === 'viewer';
    document.documentElement.dataset.crmRole = role || '';
    document.querySelector('[data-viewer-notice]')?.remove();
    if (active) {
      const notice = document.createElement('p');
      notice.dataset.viewerNotice = ''; notice.className = 'crm-viewer-notice'; notice.setAttribute('role','status');
      notice.textContent = 'Read-only access · View reports, rental records and fleet performance.';
      document.querySelector('[data-admin-view]')?.prepend(notice);
      apply();
    } else {
      document.querySelectorAll('[data-viewer-hidden]').forEach(node=>node.removeAttribute('data-viewer-hidden'));
      document.querySelectorAll('[data-viewer-disabled]').forEach(node=>{node.disabled=false;node.removeAttribute('data-viewer-disabled');});
    }
  };
}
