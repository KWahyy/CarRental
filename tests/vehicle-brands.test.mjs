import test from 'node:test';
import assert from 'node:assert/strict';
import {brandFor} from '../src/vehicle-brands.js';
import {filterHomeFleet} from '../src/home-fleet-model.js';
test('brand aliases resolve consistently and explicit future makes survive',()=>{
 for(const [make,expected] of [['Mercedes AMG','Mercedes-Benz'],['Maybach','Mercedes-Benz'],['Range Rover','Land Rover'],['Chevy','Chevrolet'],[' McLaren ','McLaren'],['Rolls Royce','Rolls-Royce'],['Aston Martin','Aston Martin'],['Bugatti','Bugatti']]) assert.equal(brandFor({make}),expected);
 assert.equal(brandFor({make:'Ford',name:'Ford with Ferrari styling'}),'Ford');
 assert.equal(brandFor({name:'2025 Lamborghini Urus'}),'Lamborghini');
});
test('brand browsing matches canonical identity, not unrelated title text',()=>{
 const cars=[{make:'Chevy',name:'Corvette'},{make:'Chevrolet',name:'Camaro'},{make:'Ford',name:'Ford Chevrolet comparison'},{make:'Bugatti',name:'Chiron'}];
 assert.deepEqual(filterHomeFleet(cars,'Chevrolet','All','Chevrolet'),cars.slice(0,2));
 assert.deepEqual(filterHomeFleet(cars,'Bugatti','All','Bugatti'),[cars[3]]);
});

test('a new Supabase make appears in the initial homepage with its count and safe label',async()=>{
 const {renderPublicDocument}=await import('../src/public-render.js');
 const {readFileSync}=await import('node:fs');
 const {parseHTML}=await import('linkedom');
 const rows=[{slug:'future-bugatti',name:'Bugatti Chiron',make:'Bugatti',model:'Chiron',category:'supercar',category_label:'Exotic',price:1000,tags:[],details:[],car_photos:[]},{slug:'future-unknown',name:'New vehicle',make:'New & Future',category:'luxury',price:1000,tags:[],details:[],car_photos:[]}];
 const {document}=parseHTML(renderPublicDocument(readFileSync('index.html','utf8'),rows,{path:'/'}));
 const tile=document.querySelector('[data-shop-filter="brand:Bugatti"]');assert.ok(tile);assert.match(tile.textContent,/1 car/);
 assert.equal(document.querySelector('[data-shop-filter="brand:New & Future"] .brand-name').textContent,'New & Future');
});

test('featured brands lead in the requested order, followed by all other makes',async()=>{
 const {sortBrands,featuredBrands}=await import('../src/vehicle-brands.js');
 assert.deepEqual(sortBrands(['BMW',...featuredBrands.slice().reverse(),'Audi','Porsche']),[...featuredBrands,'Audi','BMW']);
 assert.deepEqual(sortBrands(['BMW','Ferrari']),['Ferrari','BMW']);
});
