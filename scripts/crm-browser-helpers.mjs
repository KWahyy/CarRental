export const crmBase = process.env.AUDIT_BASE_URL || "http://127.0.0.1:8775";
export async function openCrmPage(page, section) {
  const button = page.locator(`[data-crm-section="${section}"]`);
  if (!await button.isVisible()) await page.locator("[data-workspace-menu]").click();
  await button.click();
}
