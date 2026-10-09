import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {vehicleRentalInfoMarkup} from '../src/vehicle-rental-info.js';
assert.match(vehicleRentalInfoMarkup({price:795,tags:['$676 3–5 days','$636 6–7 days'],mileage:'100 miles/day'}),/\$676\/day/);
assert.match(vehicleRentalInfoMarkup({price:1745,tags:[]}),/\$1,745\/day/);
assert.doesNotMatch(vehicleRentalInfoMarkup({price:1745,tags:[]}),/\$795|\$4\//);
assert.match(vehicleRentalInfoMarkup({price:1745,tags:[]}),/\$5\/mile/);
assert.match(vehicleRentalInfoMarkup({price:1745,tags:[]}),/From \$1,000/);
assert.match(vehicleRentalInfoMarkup({price:1745,tags:[]}),/1 year/);
const b=await chromium.launch({channel:'chrome',headless:true});
try{for(const width of [1440,768,390]){
const p=await b.newPage({viewport:{width,height:1100}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:8775/cars/ferrari-f8-tributo-rental');
const section=p.locator('[data-vehicle-rental-info]');assert.equal(await section.locator('dl > div').count(),7);assert.equal(await section.locator('h3').count(),4);assert.match(await section.innerText(),/\$1,745\/day/);
assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
await section.screenshot({path:`output/gallery-refresh/rental-info-${width}.png`});await section.getByRole('link',{name:'Request a quote'}).first().click();assert.match(p.url(),/#vehicle-request/);assert.deepEqual(errors,[]);await p.close();console.log(width,'passed');
}}finally{await b.close();}
