import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

test('homepage header has no divider at the top and retains it when scrolled', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage();
    const styles = await Promise.all(['styles.css', 'site-navigation.css'].map(name =>
      readFile(new URL(`../src/${name}`, import.meta.url), 'utf8')));
    await page.setContent('<body class="home-page"><header class="site-header shared-site-header" data-home="true"></header></body>');
    for (const content of styles) await page.addStyleTag({ content });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const header = page.locator('header');
      await header.evaluate(el => el.classList.remove('scrolled'));
      assert.equal(await header.evaluate(el => getComputedStyle(el).borderBottomWidth), '0px', `divider at top, width ${width}`);
      await header.evaluate(el => el.classList.add('scrolled'));
      assert.equal(await header.evaluate(el => getComputedStyle(el).borderBottomWidth), '1px', `scrolled divider, width ${width}`);
    }
  } finally { await browser.close(); }
});
