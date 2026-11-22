import { db } from "./_invoice-core.js";
import { originalRequest, matchColumns } from "../src/request-match.js";

const pacificDay = value => new Intl.DateTimeFormat("en-CA", {
  timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"
}).format(new Date(value));

export async function linkPaymentRequest(record, token, kind = "invoice") {
  try {
    if (kind === "invoice" && record.quote_id) {
      const [parent] = await db(`quotes?id=eq.${encodeURIComponent(record.quote_id)}&lead_id=is.null&select=id,start_at,vehicle_name,customer_phone,customer_email&limit=1`, {}, token);
      if (parent) await linkPaymentRequest(parent, token, "quote");
      return record;
    }
    const quote = kind === "quote";
    if (quote ? record.lead_id : (record.source_id || record.quote_id || record.source_type !== "manual")) return record;
    const date = quote ? pacificDay(record.start_at) : record.rental_start;
    const id = await originalRequest({date,vehicle:record.vehicle_name,phone:record.customer_phone,email:record.customer_email},
      day => db(`quote_requests?select=${matchColumns}&rental_date=eq.${day}&limit=101`, {}, token));
    if (!id) return record;
    const target = quote ? "quotes" : "invoices";
    const guard = quote ? "lead_id=is.null" : "source_type=eq.manual&source_id=is.null&quote_id=is.null";
    const linked = await db(`${target}?id=eq.${encodeURIComponent(record.id)}&${guard}`, {
      method:"PATCH", headers:{Prefer:"return=representation"}, body:JSON.stringify(quote ? {lead_id:id} : {source_type:"quote",source_id:id})
    },token);
    return linked?.[0] || record;
  } catch { console.warn("Automatic request link unavailable for saved payment."); }
  return record;
}
