import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {mapCar} from '../src/supabase-fleet.js';
import {toPublicCar} from '../src/admin-store.js';
import {renderPublicDocument} from '../src/public-render.js';
const urls=Array.from({length:27},(_,i)=>`https://example.com/car-${i}.jpg`);
const row={slug:'porsche-911-gt3-rs-rental',name:'Porsche 911 GT3 RS',make:'Porsche',model:'911 GT3 RS',category:'supercar',category_label:'Exotic',price:1745,seats:2,tags:[],details:[],image_url:urls[0],car_photos:urls.map((url,i)=>({url,position:i+1}))};
test('all ordered listing photos survive the public and CRM mappings',()=>{
 assert.deepEqual(mapCar(row).gallery,urls);
 assert.deepEqual(toPublicCar({gallery:urls}).gallery,urls);
});
test('server gallery contains all photos, a compact strip and an accessible full-screen viewer',()=>{
 const template=readFileSync('server-pages/cars/porsche-911-gt3-rs-rental.html','utf8');
 const {document:d}=parseHTML(renderPublicDocument(template,[row],{path:'/cars/'+row.slug}));
 assert.equal(d.querySelectorAll('[data-gallery-thumbs] button').length,27);
 assert.equal(d.querySelector('[data-gallery-count]').textContent,'1 / 27');
 assert.ok(d.querySelector('[data-gallery-open]'));
 assert.ok(d.querySelector('dialog[data-gallery-dialog][aria-labelledby]'));
 assert.equal(d.querySelectorAll('[data-gallery-thumbs] [aria-pressed="true"]').length,1);
});

test('CRM save persists a large gallery and removes only positions omitted by the editor',async()=>{
 const {runInNewContext}=await import('node:vm');
 const code=readFileSync('src/admin.js','utf8');
 const normalize=code.slice(code.indexOf('function normalizePhotoOrder()'),code.indexOf('function updatePhotoPreview()'));
 const save=code.slice(code.indexOf('async function savePhotos('),code.indexOf('async function verifySavedCarPhotos('));
 const calls=[];
 const query={upsert(rows,options){calls.push({op:'upsert',rows,options});return this;},delete(){calls.push({op:'delete'});return this;},eq(k,v){calls.push({op:'eq',k,v});return this;},not(k,operator,value){calls.push({op:'not',k,operator,value});return this;}};
 const context={photos:urls.map(url=>({url})),supabase:{from(table){assert.equal(table,'car_photos');return query;}},runQuery:async q=>q};
 const result=await runInNewContext(normalize+save+';savePhotos("test-car", "test-slug")',context);
 assert.equal(result.length,27);assert.equal(calls[0].rows.length,27);
 assert.equal(calls.find(c=>c.op==='eq').v,'test-car');
 assert.equal(calls.find(c=>c.op==='not').value,'('+Array.from({length:27},(_,i)=>i+1).join(',')+')');
});

test('optimized partner photos and thumbnails all exist',async()=>{
 const {galleryAssets}=await import('../src/vehicle-gallery-assets.js');
 const {existsSync}=await import('node:fs');
 for(const key of Object.values(galleryAssets))for(const size of ['view','thumb','large'])assert.ok(existsSync(`assets/vehicle-gallery/${key}-${size}.webp`));
});
