import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {locationPlans,addLocationPlanning} from '../scripts/location-planning.mjs';
test('all ten destinations render distinct planning content with only current fleet records',()=>{
 assert.equal(Object.keys(locationPlans).length,10);
 assert.equal(new Set(Object.values(locationPlans).map(p=>p.delivery)).size,10);
 for(const [slug,plan] of Object.entries(locationPlans)){
  const car={slug:plan.cars[0][0],name:'Current <car>',price:777,image_url:'/assets/test.jpg'};
  const html=addLocationPlanning('<html><head></head><body><main><section id="location-quote"></section></main></body></html>',{slug,area:'Test city'},[car]);
  const {document}=parseHTML(html);
  assert.equal(document.querySelectorAll('.location-planning-car').length,1);
  assert.equal(document.querySelector('.location-planning h3').textContent,'Current <car>');
  assert.ok(html.includes('$777'));assert.ok(html.includes(plan.delivery.replaceAll('&','&amp;')));
  assert.equal(document.querySelector('#location-quote').previousElementSibling.className,'location-planning');
  assert.equal(addLocationPlanning(html,{slug,area:'Test city'},[car]),html);
 }
});
