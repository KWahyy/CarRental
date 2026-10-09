import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import handler,{publicPagePath} from '../api/public-page.js';
import {renderPublicDocument} from '../src/public-render.js';
import {readFileSync} from 'node:fs';
const fixture={slug:'mclaren-720s-spider-rental',name:'McLaren 720S Spider',make:'McLaren',model:'720S Spider',category:'supercar convertible',category_label:'Exotic convertible',price:1345,car_photos:[{position:0,url:'/fresh-photo.jpg'}],tags:[],details:[],updated_at:'2026-10-09T12:00:00Z'};
function response(){return {code:200,headers:{},status(code){this.code=code;return this;},setHeader(k,v){this.headers[k]=v;return this;},send(body){this.body=body;return this;},end(body){this.body=body;return this;}};}
const request=(page,token)=>({query:{page,...(token?{token}:{})},headers:{host:'localhost'},method:'GET'});
test('route allowlist rejects traversal and nonpublic files',()=>{for(const path of ['../.env','admin/index','cars/../../admin','/api/quotes','cars/x?secret'])assert.equal(publicPagePath(path),null);assert.equal(publicPagePath('cars/mclaren-720s-spider-rental'),'cars/mclaren-720s-spider-rental');});
test('response uses current fleet without a client inventory replacement and has a complete outage fallback',async t=>{
 t.mock.method(globalThis,'fetch',async url=>new Response(JSON.stringify(String(url).includes('/cars?')?[fixture]:[]),{status:200}));
 const res=response();await handler(request('index'),res);assert.equal(res.code,200);assert.equal(res.headers['X-Inventory-Source'],'live');const d=parseHTML(res.body).document;assert.equal(d.querySelector('.home-fleet-card img').getAttribute('src'),'/fresh-photo.jpg');assert.equal(JSON.parse(d.querySelector('#public-page-state').textContent).fleet[0].price,1345);
 globalThis.fetch=async()=>{throw Error('offline')};const fallback=response();await handler(request('index'),fallback);assert.equal(fallback.headers['X-Inventory-Source'],'build-fallback');assert.ok(parseHTML(fallback.body).document.querySelector('.home-fleet-card'));assert.ok(parseHTML(fallback.body).document.querySelector('#public-page-state'));
});
test('private quote authorization is reused and only public data is embedded',async t=>{
 const old=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='server-test-key';t.after(()=>{if(old===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=old;});
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify([{id:'private-id',access_token:'a'.repeat(48),status:'viewed',viewed_at:'2026-10-01',quote_number:'TEST-001',customer_name:'Test Renter',vehicle_name:'McLaren 720S',rental_total:1345,internal_notes:'DO NOT EXPOSE',partner_cost:900,amount_required:100,remaining_balance:1345}]),{status:200}));
 const res=response();await handler(request('quote','a'.repeat(48)),res);assert.equal(res.headers['Cache-Control'],'private, no-store');const d=parseHTML(res.body).document;assert.match(d.querySelector('main').textContent,/McLaren 720S/);assert.ok(d.querySelector('[data-accept-quote]'));assert.ok(!res.body.includes('DO NOT EXPOSE'));assert.ok(!res.body.includes('partner_cost'));
});
test('signed private agreement begins on the signed step; bad tokens never expose records',async t=>{
 const old=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='server-test-key';t.after(()=>{if(old===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=old;});
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response(JSON.stringify([{agreement_number:'TEST-RA',status:'signed',opened_at:'2026-10-01',customer_name:'Test Renter',vehicle_name:'McLaren',terms:'Terms',important_terms:[],initials:{},internal_notes:'DO NOT EXPOSE'}]),{status:200})});
 const res=response();await handler(request('agreement','a'.repeat(48)),res);const d=parseHTML(res.body).document;assert.equal(d.querySelector('[data-sign-step="4"]').hidden,false);assert.equal(d.querySelector('[data-sign-step="0"]').hidden,true);assert.ok(!res.body.includes('DO NOT EXPOSE'));
 const invalid=response();await handler(request('agreement','invalid'),invalid);assert.equal(calls,1);assert.match(parseHTML(invalid.body).document.querySelector('[data-sign-error-message]').textContent,/invalid/);
});
test('URL trip/search state is present before JavaScript',()=>{
 const search='deliveryCity=Palm+Springs&pickup=2026-11-10&return=2026-11-12';
 const home=parseHTML(renderPublicDocument(readFileSync('server-pages/index.html','utf8'),[fixture],{search})).document;assert.equal(home.querySelector('.hero-city-trigger span').textContent,'Palm Springs');assert.equal(home.querySelector('[name="pickup"]').getAttribute('value'),'2026-11-10');
 const fleet=parseHTML(renderPublicDocument(readFileSync('server-pages/fleet.html','utf8'),[fixture],{search:search+'&search=missing'})).document;assert.match(fleet.querySelector('.fleet-empty-state').textContent,/No vehicles found/);assert.equal(fleet.querySelectorAll('.rental-trip-banner').length,1);
});
test('compiled response templates cannot shadow Vercel rewrites',async()=>{
 const {existsSync}=await import('node:fs');
 const config=JSON.parse(readFileSync('vercel.json','utf8'));
 assert.equal(config.functions['api/public-page.js'].includeFiles,'server-pages/**/*');
 for(const page of ['index','fleet','lamborghini','ferrari','quote','agreement','cars/mclaren-720s-spider-rental']){
  assert.equal(existsSync('dist/'+page+'.html'),false,'Static file shadows '+page);
  assert.equal(existsSync('server-pages/'+page+'.html'),true,'Missing private template '+page);
 }
});

test('deployment stays within the Hobby function limit and routes the live sitemap', async()=>{
 const {readdirSync}=await import('node:fs');
 const config=JSON.parse(readFileSync('vercel.json','utf8'));
 assert.ok(readdirSync('api').filter(name=>/^[a-z].*\.js$/.test(name)).length<=12);
 assert.equal(config.rewrites.find(route=>route.source==='/sitemap.xml').destination,'/api/public-page?page=sitemap');
});
