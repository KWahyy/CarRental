export function bookingRows(payload, id) {
  const detail = key => String(payload.message || '').split('\n').find(line => line.startsWith(key + ':'))?.slice(key.length + 1).trim();
  const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? new Date(value + 'T12:00:00Z').toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric', timeZone:'UTC'}) : value;
  return [
    ['Vehicle', payload.vehicle],
    ['Pickup', date(payload.date)],
    ['Return', date(detail('Return date'))],
    ['Delivery', detail('Delivery city or ZIP') || detail('Delivery city') || detail('Service area')],
    ['Request reference', id],
  ].filter(([, value]) => value);
}

export function showBookingReceipt(target, payload, id) {
  const doc = target.ownerDocument;
  target.replaceChildren();
  target.dataset.tone = 'success';
  target.style.cssText = 'display:block;padding:22px;border:1px solid #d8d4cc;border-radius:12px;background:#f5f3ee;color:#24241f;text-align:left;line-height:1.55;';
  const add = (text, style) => {
    const node = doc.createElement('span');
    node.textContent = text;
    node.style.cssText = 'display:block;' + style;
    target.append(node);
  };
  add('Awaiting confirmation', 'font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6c5b37;');
  add('Your booking request is received.', 'font-size:22px;line-height:1.25;margin:10px 0;letter-spacing:-.02em;font-weight:600;');
  add('We’ll contact you shortly to finalize your reservation.', 'font-size:14px;margin-bottom:18px;');
  for (const [label, value] of bookingRows(payload, id)) {
    const row = doc.createElement('span');
    row.style.cssText = 'display:grid;grid-template-columns:90px minmax(0,1fr);gap:12px;padding:10px 0;border-top:1px solid #dedbd4;font-size:13px;';
    for (const text of [label, value]) {
      const cell = doc.createElement('span'); cell.textContent = text; cell.style.overflowWrap = 'anywhere'; row.append(cell);
    }
    target.append(row);
  }
  add('No payment taken. Availability and your final total will be confirmed by our team.', 'font-size:12px;color:#625f58;margin-top:14px;');
}
