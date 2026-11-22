export const crmBase = process.env.AUDIT_BASE_URL || "http://127.0.0.1:8775";
export async function openCrmPage(page, section) {
  const button = page.locator(`[data-crm-section="${section}"]`);
  await page.locator('[data-admin-view]').waitFor();
  if (!await button.isVisible()) {
    await page.locator('[data-workspace-menu]').click();
    await page.locator('#desk-directory').waitFor();
  }
  await button.click();
  await page.locator(`[data-section-panel="${section}"]`).waitFor();
}
