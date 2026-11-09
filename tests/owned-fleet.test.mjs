import test from 'node:test';
import assert from 'node:assert/strict';
import { ownedFleet } from '../src/owned-fleet.js';
const range={start:new Date('2026-11-01T00:00:00'),end:new Date('2026-11-30T23:59:59')};
function base(){return {cars:[{id:'a',name:'Ferrari Roma',ownership_type:'prestige'},{id:'b',name:'Partner',ownership_type:'partner'},{id:'c',name:'Unknown'}],partners:[],invoices:[],invoicePayments:[],agreements:[],bookings:[],expenses:[]};}
test('only explicit owned cars, including idle cars; partner records override defaults',()=>{
 const m=base();m.cars.push({id:'d',name:'Partner default',ownership_type:'prestige'});m.partners=[{car_id:'d'}];
 const r=ownedFleet(m,range,new Date('2026-11-30'));assert.deepEqual(r.rows.map(x=>x.id),['a']);assert.equal(r.rows[0].revenue,0);assert.equal(r.rows[0].missing.length,2);
});
test('payments exclude deposits and duplicate linked booking receipts; expenses include car payments once',()=>{
 const m=base();m.invoices=[{id:'i',vehicle_id:'a',subtotal:1000,amount_paid:1200,status:'paid',rental_start:'2026-11-03'}];
 m.invoicePayments=[{id:'p',invoice_id:'i',amount:1200,paid_at:'2026-11-03'}];
 m.agreements=[{id:'r',vehicle_id:'a',source_type:'invoice',source_id:'i',status:'signed',signed_at:'2026-10-20',rental_start:'2026-11-03',rental_end:'2026-11-05'}];
 m.bookings=[{id:'shadow',vehicle:'Ferrari Roma',amount_paid:1000,booked_on:'2026-11-03',notes:'[PL_FINANCE]{"agreement_id":"r"}'}];
 m.expenses=[{id:'e',car_id:'a',category:'insurance',amount:100,expense_date:'2026-11-01'},{id:'f',car_id:'a',category:'car_payment',amount:300,expense_date:'2026-11-01'},{id:'m',car_id:'a',category:'maintenance',amount:50,expense_date:'2026-11-02'}];
 const row=ownedFleet(m,range,new Date('2026-11-30')).rows[0];assert.equal(row.revenue,1000);assert.equal(row.costs,450);assert.equal(row.cash,550);assert.equal(row.rentedDays,2);assert.equal(row.bookings,1);assert.equal(row.missing.length,0);
});
test('caps payments across periods and counts overlapping rental days only once',()=>{
 const m=base();m.invoices=[{id:'i',vehicle_id:'a',subtotal:1000,status:'paid'}];m.invoicePayments=[{id:'p1',invoice_id:'i',amount:800,paid_at:'2026-10-01'},{id:'p2',invoice_id:'i',amount:500,paid_at:'2026-11-01'}];
 m.agreements=[{id:'r1',vehicle_id:'a',status:'signed',rental_start:'2026-10-30',rental_end:'2026-11-04'},{id:'r2',vehicle_id:'a',status:'signed',rental_start:'2026-11-02',rental_end:'2026-11-05'}];
 const row=ownedFleet(m,range,new Date('2026-11-30')).rows[0];assert.equal(row.revenue,200);assert.equal(row.rentedDays,4);
});
test('ambiguous name matches are excluded and reported instead of assigned to wrong car',()=>{
 const m=base();m.cars.push({id:'e',name:'Ferrari Roma',ownership_type:'prestige'});m.bookings=[{id:'b',vehicle:'Ferrari Roma',amount_paid:400,booked_on:'2026-11-02'}];
 const r=ownedFleet(m,range);assert.equal(r.unassigned,1);assert(r.rows.every(x=>x.revenue===0));
});
test('costs remain visible for idle cars and zero car-payment entries clear the missing warning',()=>{
 const m=base();m.expenses=[{id:'e',car_id:'a',category:'insurance',amount:200,expense_date:'2026-11-01'},{id:'p',car_id:'a',category:'car_payment',amount:0,expense_date:'2026-11-01'}];
 const row=ownedFleet(m,range).rows[0];assert.equal(row.cash,-200);assert.deepEqual(row.missing,[]);
});
test('linked ledger costs supersede legacy category; cancellations and future days excluded',()=>{
 const m=base();m.agreements=[{id:'r',vehicle_id:'a',status:'signed',rental_start:'2026-11-08',rental_end:'2026-11-15'}];
 m.bookings=[{id:'b',vehicle:'Ferrari Roma',booked_on:'2026-11-08',notes:'[PL_FINANCE]{"agreement_id":"r","detailing_cost":100}'}];
 m.expenses=[{id:'e',car_id:'a',agreement_id:'r',category:'detail',amount:100,expense_date:'2026-11-08'}];
 const row=ownedFleet(m,range,new Date('2026-11-09T12:00:00')).rows[0];assert.equal(row.costs,100);assert.equal(row.rentedDays,2);assert.equal(row.costOverlap,true);
});
import {renderOwnedFleet} from '../src/owned-fleet-view.js';
test('data failure hides financial figures; customer-controlled text is escaped',()=>{
 assert(!renderOwnedFleet(base(),range,{error:'offline'}).includes('$0'));
 const m=base();m.cars[0].name='<img onerror=alert(1)>';
 assert(renderOwnedFleet(m,range).includes('&lt;img onerror=alert(1)&gt;'));
});
