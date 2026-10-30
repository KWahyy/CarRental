import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {bookingRows, showBookingReceipt} from '../src/booking-receipt.js';
test('receipt retains submitted trip and server reference', () => {
 const rows = bookingRows({vehicle:'Huracán',date:'2026-11-09',message:'Return date: 2026-11-10\nDelivery city or ZIP: Newport Beach'}, 'server-id');
 assert.deepEqual(rows, [['Vehicle','Huracán'],['Pickup','Nov 9, 2026'],['Return','Nov 10, 2026'],['Delivery','Newport Beach'],['Request reference','server-id']]);
});
test('receipt uses safe text and remains explicitly pending', () => {
 const {document} = parseHTML('<p id="status" role="status"></p>');
 const target=document.getElementById('status');
 showBookingReceipt(target,{vehicle:'<img src=x onerror=alert(1)>'},undefined);
 assert.equal(target.querySelector('img'),null);
 assert.match(target.textContent,/Awaiting confirmation/);
 assert.match(target.textContent,/No payment taken/);
 assert.doesNotMatch(target.textContent,/undefined|Request reference/);
});
