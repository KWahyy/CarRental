import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {vehicleYear,engineForVehicle,accelerationForVehicle,exteriorForVehicle,vehicleListingDisclosure,applyVehicleFactVisibility} from '../src/vehicle-content.js';
import {mapCar} from '../src/supabase-fleet.js';
const spyder={slug:'lamborghini-huracan-evo-spyder-rental',name:'Lamborghini Huracan EVO Spyder'};
test('source-backed Spyder facts fill missing values without conflicting acceleration claims',()=>{
 assert.equal(vehicleYear(spyder),'2020');assert.equal(engineForVehicle(spyder),'5.2L naturally aspirated V10');assert.equal(exteriorForVehicle(spyder),'Black (pictured)');assert.equal(accelerationForVehicle(spyder),'');
});
test('CRM facts override source fallbacks and survive mapping',()=>{
 const car=mapCar({...spyder,year:2021,engine:'Confirmed engine',color:'Blue',acceleration:'3.1 sec',car_photos:[]});
 assert.equal(vehicleYear(car),'2021');assert.equal(engineForVehicle(car),'Confirmed engine');assert.equal(exteriorForVehicle(car),'Blue');assert.equal(accelerationForVehicle(car),'3.1 sec');
});
test('missing facts do not invent a model year or imply a category',()=>{
 const car={slug:'lamborghini-huracan-evo-coupe-white-rental',name:'Lamborghini Huracan EVO Coupe (White)',color:'White'};
 assert.equal(vehicleYear(car),'');assert.equal(exteriorForVehicle(car),'White');assert.match(vehicleListingDisclosure(car),/pictured vehicle/);
 assert.equal(engineForVehicle({name:'Unknown car'}),'');
});
test('explicit category listings describe representative photos without reusing pictured year or color',()=>{
 const car={...spyder,listingType:'category'};
 assert.equal(vehicleYear(car),'Vehicle category');assert.equal(exteriorForVehicle(car),'');assert.match(vehicleListingDisclosure(car),/Photos are representative/);assert.match(vehicleListingDisclosure(car),/model year, exterior, and exact specification vary/);
});
test('empty specification rows are hidden identically in server and browser markup',()=>{
 const {document}=parseHTML('<span data-vehicle-year></span><div class="vehicle-private-specs"><div><span>Engine</span><strong></strong></div><div><span>Seats</span><strong>2 seats</strong></div></div>');
 applyVehicleFactVisibility(document);assert(document.querySelector('[data-vehicle-year]').hidden);assert(document.querySelector('.vehicle-private-specs > div').hidden);assert.equal(document.querySelectorAll('.vehicle-private-specs > div')[1].hidden,false);
});
