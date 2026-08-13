import { createInvoicePdf } from "./_invoice-pdf.js";
import { clean, db, json, requireEmployee, setCors } from "./_invoice-core.js";

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed." });

  try {
    const { token } = await requireEmployee(req);
    const id = clean(req.query?.id, 80);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json(res, 400, { error: "A valid invoice is required." });
    const rows = await db(`invoices?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, {}, token);
    const invoice = rows?.[0];
    if (!invoice) return json(res, 404, { error: "Invoice not found." });
    const bytes = await createInvoicePdf(invoice);
    const filename = `${invoice.invoice_number || "Prestige-Luxor-Invoice"}.pdf`;
    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.end(Buffer.from(bytes));
  } catch (error) {
    return json(res, error.status || 500, { error: error.message || "Could not generate invoice PDF." });
  }
}
