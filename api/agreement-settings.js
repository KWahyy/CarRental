import { clean, db, json, readBody, requireEmployee, setCors } from "./_invoice-core.js";
import { DEFAULT_IMPORTANT_TERMS, DEFAULT_MASTER_AGREEMENT } from "./_agreement-template.js";
import { normalizeImportantTerms } from "./_agreement-core.js";

const defaults = () => ({ template_key: "master", title: "Prestige Luxor Exotic Car Rental Agreement", body: DEFAULT_MASTER_AGREEMENT, important_terms: DEFAULT_IMPORTANT_TERMS, version: 1 });

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    const { user, token } = await requireEmployee(req);
    if (req.method === "GET") {
      const rows = await db("agreement_templates?template_key=eq.master&select=*&limit=1", {}, token).catch(() => []);
      return json(res, 200, { template: rows?.[0] || defaults() });
    }
    if (req.method === "PUT") {
      const body = await readBody(req);
      const current = (await db("agreement_templates?template_key=eq.master&select=*&limit=1", {}, token).catch(() => []))?.[0];
      const template = {
        template_key: "master",
        title: clean(body.title, 180) || "Prestige Luxor Exotic Car Rental Agreement",
        body: clean(body.body, 30000) || DEFAULT_MASTER_AGREEMENT,
        important_terms: normalizeImportantTerms(body.important_terms),
        version: Math.max(Number(current?.version || 0) + 1, 1),
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      };
      const rows = await db("agreement_templates?on_conflict=template_key", { method: "POST", headers: { Prefer: "return=representation,resolution=merge-duplicates" }, body: JSON.stringify(template) }, token);
      return json(res, 200, { template: rows[0] });
    }
    res.setHeader("Allow", "GET, PUT, OPTIONS");
    return json(res, 405, { error: "Method not allowed." });
  } catch (error) {
    return json(res, error.status || 500, { error: error.message || "Agreement settings request failed." });
  }
}
