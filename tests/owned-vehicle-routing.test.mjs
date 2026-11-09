import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('owned Huracan URL reaches its own inventory page instead of a partner listing', () => {
  const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
  const path='/cars/2022-lamborghini-huracan';
  assert.equal(config.redirects.find(rule=>rule.source===path),undefined);
  const html=config.redirects.find(rule=>rule.source===path+'.html');
  assert(!html || html.destination===path);
  assert(config.rewrites.some(rule=>rule.source==='/cars/:slug' && rule.destination==='/api/public-page?page=cars/:slug'));
});
