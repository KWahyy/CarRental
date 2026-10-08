import test from 'node:test';
import assert from 'node:assert/strict';
import { filterHomeFleet, fleetCategory, homeFleetCard } from '../src/home-fleet-model.js';
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
});
test('card escapes inventory text and keeps the supplied rate',()=>{
 const html=homeFleetCard({name:'2026 Test <car>',slug:'test',price:495,color:'Black',image:'/car.jpg',category:'exotic'});
 assert.ok(html.includes('Test &lt;car&gt;'));
 assert.ok(html.includes('$495'));
 assert.ok(html.includes('href="/cars/test"'));
});
