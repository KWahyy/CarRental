import test from 'node:test';
import assert from 'node:assert/strict';
import {originalRequest,linkPaidBooking} from '../src/request-match.js';

const trip = {date:'2026-12-01', vehicle:'2022 Lamborghini Huracán EVO Spyder', email:'Client@example.com', phone:'+1 (949) 555-0100'};
const row = {id:'original', rental_date:trip.date, vehicle:'2022 Lamborghini Huracan', email:'client@example.com', phone:'9495550100'};
const match = (candidates, changes={}) => originalRequest({...trip,...changes}, async () => candidates);
test('requires a unique trip and verified contact match',async()=>{
  assert.equal(await match([row]),row.id);
  assert.equal(await match([{...row,email:null}]),row.id);
  for(const other of [{phone:'3105550100'},{email:'other@example.com'},{vehicle:'2020 Lamborghini Huracan EVO Spyder'},{rental_date:'2026-12-02'}])
    assert.equal(await match([{...row,...other}]),null);
  assert.equal(await match([row,{...row,id:'duplicate'}]),null);
  assert.equal(await match([row],{phone:'',email:''}),null);
});
test('existing links, unpaid records and refunds survive without lookup',async()=>{
  for (const b of [{quote_request_id:'original',amount_paid:250},{amount_paid:0},{payment_status:'refunded',amount_paid:200}])
    assert.equal(await linkPaidBooking(null,b),b);
});
test('paid ledger save writes the original request id only into an unlinked booking',async()=>{
  const booking={id:'booking',start_date:trip.date,vehicle:trip.vehicle,customer_phone:trip.phone,amount_paid:250};
  const db={from(table){
    if(table==='quote_requests') return {select:()=>({eq:()=>({limit:async()=>({data:[row]})})})};
    assert.equal(table,'booking_sales');
    return {update(patch){
      assert.deepEqual(patch,{quote_request_id:row.id});
      return {eq(key,id){
        assert.deepEqual([key,id],['id',booking.id]);
        return {is(field,value){
          assert.deepEqual([field,value],['quote_request_id',null]);
          return {select:()=>({maybeSingle:async()=>({data:{...booking,...patch}})})};
        }};
      }};
    }};
  }};
  assert.equal((await linkPaidBooking(db,booking)).quote_request_id,row.id);
});
