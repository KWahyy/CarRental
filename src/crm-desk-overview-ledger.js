// Keep payment allocation across the whole history. A refundable security
// deposit above the rental subtotal must never become a second rental receipt.
export const positive = value => Math.max(0, Number(value) || 0);
export const financeNote = row => {
  try { return JSON.parse(String(row?.notes || "").match(/\[PL_FINANCE\]([^\n]+)/)?.[1] || "{}"); }
  catch { return {}; }
};

export function acquisitionSource(lead) {
  const message = String(lead?.message || "");
  const source = message.match(/^Acquisition source: ([^\r\n]+)/m)?.[1]?.trim();
  const channel = message.match(/^Acquisition channel: ([^\r\n]+)/m)?.[1]?.trim();
  if (!source) return lead?.source || "";
  if (source === "direct_or_unknown") return "Direct or unknown";
  return [source,channel?.replaceAll("_"," ")].filter(Boolean).join(" · ");
}

const byId = rows => new Map(rows.map(row => [String(row.id), row]));
export function rentalLedger(model) {
  let balance = 0;
  const leads = byId(model.quotes), proposals = byId(model.proposals), bookings = byId(model.bookings);
  const agreements = byId(model.agreements);
  const invoices = byId(model.invoices);
  const invoiceForBooking = new Map(), payments = new Map(), ledger = [];
  for (const invoice of model.invoices) {
    if (invoice.source_type === "booking") invoiceForBooking.set(String(invoice.source_id), invoice);
  }
  for (const payment of model.invoicePayments) {
    const id = String(payment.invoice_id);
    if (!payments.has(id)) payments.set(id, []);
    payments.get(id).push(payment);
  }
  for (const invoice of model.invoices) {
    if (["draft", "void", "refunded"].includes(invoice.status)) continue;
    balance += Math.max(0, positive(invoice.subtotal) - positive(invoice.amount_paid));
    const sourceId = String(invoice.source_id || "");
    const proposal = proposals.get(String(invoice.quote_id || (invoice.source_type === "quote" && sourceId)));
    const booking = invoice.source_type === "booking" && bookings.get(sourceId);
    const lead = leads.get(String(proposal?.lead_id || booking?.quote_request_id || (invoice.source_type === "quote" && sourceId)));
    const source = acquisitionSource(lead) || proposal?.lead_source || invoice.lead_source || "";
    const rows = payments.get(String(invoice.id));
    let remaining = positive(invoice.subtotal);
    const history = rows ? rows.slice().sort((a,b) => String(a.paid_at).localeCompare(String(b.paid_at)) || String(a.id).localeCompare(String(b.id)))
      : [{amount: invoice.amount_paid, paid_at: invoice.paid_at || invoice.updated_at}];
    for (const row of history) {
      const amount = Math.min(positive(row.amount), remaining);
      remaining -= amount;
      if (amount && row.paid_at) ledger.push({invoice_id:invoice.id, amount, date:row.paid_at, source, leadId:lead?.id, legacy:!rows, bookingKey:booking ? 'booking:'+booking.id : proposal ? 'quote:'+proposal.id : 'invoice:'+invoice.id});
    }
  }
  for (const row of model.bookings) {
    const finance = financeNote(row);
    const agreement = agreements.get(String(finance.agreement_id));
    const invoice = invoiceForBooking.get(String(row.id)) || (agreement?.source_type === "invoice" && invoices.get(String(agreement.source_id)));
    if (invoice || finance.cancelled || row.payment_status === "refunded" || agreement?.status === "cancelled") continue;
    balance += Math.max(0, positive(row.total_amount) - positive(row.amount_paid));
    const amount = Math.min(positive(row.amount_paid), row.total_amount == null ? Infinity : positive(row.total_amount));
    const date = finance.payment_date || row.booked_on;
    const lead = leads.get(String(row.quote_request_id));
    if (amount && date) ledger.push({booking:row, amount, date, source:acquisitionSource(lead) || agreement?.lead_source || "", leadId:lead?.id, bookingKey:'booking:'+row.id});
  }
  return {receipts:ledger,balance};
}
