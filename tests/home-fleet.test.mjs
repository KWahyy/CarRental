import test from 'node:test';
import assert from 'node:assert/strict';
import { filterHomeFleet, fleetCategory, homeFleetCard, sortHomeFleet } from '../src/home-fleet-model.js';
const cars = [
 {name:'Cadillac Escalade',color:'Black',category:'suv luxury'},
 {name:'Cadillac Escalade',color:'White',category:'suv luxury'},
 {name:'Lamborghini Huracán Spyder',category:'supercar convertible'},
 {name:'Tesla Cybertruck',category:'suv luxury'},
];
test('search combines terms across fields and respects category filters',()=>{
 assert.deepEqual(filterHomeFleet(cars,'black escalade','SUV'),[cars[0]]);
 assert.deepEqual(filterHomeFleet(cars,'huracan','Exotic'),[cars[2]]);
 assert.equal(filterHomeFleet(cars,'Escalade','Exotic').length,0);
 assert.equal(fleetCategory(cars[3]),'Truck');
 assert.equal(fleetCategory({name:'Ford F-150 Raptor R',category:'truck'}),'Truck');
});
test('card escapes inventory text and keeps the supplied rate',()=>{
 const html=homeFleetCard({name:'2026 Test <car>',slug:'test',price:495,color:'Black',image:'/car.jpg',category:'exotic'});
 assert.ok(html.includes('Test &lt;car&gt;'));
 assert.ok(html.includes('$495'));
 assert.ok(html.includes('href="/cars/test"'));
});

test('featured mix leads with requested exotics without losing or duplicating inventory',()=>{
 const inventory=[
  {slug:'audi-r8-rental',name:'Audi R8',make:'Audi',model:'R8'},
  {slug:'lamborghini-urus-performante-rental',name:'Lamborghini Urus Performante'},
  {slug:'porsche-911-gt3-rs-rental',name:'Porsche 911 GT3 RS'},
  {slug:'lamborghini-huracan-evo-spyder-rental',name:'Lamborghini Huracan EVO Spyder'},
  {slug:'mclaren-720s-spider-rental',name:'McLaren 720S Spider'},
 ];
 const result=sortHomeFleet(inventory);
 assert.deepEqual(result.map(c=>c.slug),[inventory[4].slug,inventory[2].slug,inventory[3].slug,inventory[1].slug,inventory[0].slug]);
 assert.equal(new Set(result).size,inventory.length);
 assert.equal(inventory[0].slug,'audi-r8-rental');
 assert.deepEqual(sortHomeFleet(inventory.filter(c=>!c.slug.includes('mclaren'))).map(c=>c.slug),result.slice(1).map(c=>c.slug));
});

test('overlapping customer categories include classics and convertibles without misclassifying SUVs',async()=>{
 const {fleetCategories,homeFleetFilters}=await import('../src/home-fleet-model.js');
 assert.deepEqual(fleetCategories({name:'Lamborghini Huracan EVO Spyder',category:'supercar convertible'}),['Exotics','Convertibles']);
 assert.deepEqual(fleetCategories({name:'1967 Cadillac Coupe DeVille Convertible',category:'exotic'}),['Convertibles','Classics']);
 assert.deepEqual(fleetCategories({name:'Lamborghini Urus',category:'suv luxury'}),['Luxury SUVs']);
 assert.deepEqual(fleetCategories({name:'Mercedes-Maybach S580',category:'luxury'}),['Luxury sedans']);
 assert.deepEqual(fleetCategories({name:'Rolls-Royce Spectre',category:'luxury'}),['Luxury coupes']);
 assert.ok(!homeFleetFilters([cars[2]]).some(f=>f.category==='Trucks'));
 assert.equal(homeFleetFilters(cars).find(f=>f.category==='Convertibles').count,1);
 assert.deepEqual(filterHomeFleet(cars,'','Convertibles'),[cars[2]]);
 assert.equal(homeFleetFilters(cars,'White').find(f=>f.category==='Luxury SUVs').count,1);
});
