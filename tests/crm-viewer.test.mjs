import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { canUseEmployeeApi, canViewFinancials } from '../src/crm-permissions.js';
import { installViewerGuard } from '../src/crm-viewer.js';
import { renderOwnedFleet } from '../src/owned-fleet-view.js';

test('viewers can only use explicitly enabled read endpoints, even if accidentally added to write roles',()=>{
 for(const method of ['POST','PUT','PATCH','DELETE',undefined]) assert.equal(canUseEmployeeApi('viewer',method,true,['viewer']),false);
 assert.equal(canUseEmployeeApi('viewer','GET'),false);
 assert.equal(canUseEmployeeApi('viewer','GET',true),true);
 assert.equal(canUseEmployeeApi('staff','POST'),true);
 assert.equal(canUseEmployeeApi('staff','DELETE',false,['owner']),false);
 assert.equal(canUseEmployeeApi(undefined,'GET',true),false);
 assert.equal(canViewFinancials('viewer'),true);
});

test('read-only owned fleet includes revenue and breakdown but no expense creation',()=>{
 const model={cars:[{id:'owned',name:'Huracan',ownership_type:'prestige'}]};
 const html=renderOwnedFleet(model,{start:new Date('2026-11-01'),end:new Date('2026-11-30')},{readOnly:true});
 assert.match(html,/Rental income/);assert.match(html,/View financial breakdown/);assert.match(html,/data-owned-vehicle/);assert.doesNotMatch(html,/data-owned-expense/);
});

test('viewer UI preserves browsing, disables editing, catches new controls, and restores owner view',async()=>{
 const {document,window}=parseHTML('<html><head></head><body><div data-login-view><input name="password"></div><main data-admin-view><button data-crm-section="vehicles">Fleet</button><input data-fleet-search><button data-new-quote>Create</button><form><input name="amount"><button type="submit">Save</button></form><button data-detail-action="pdf">Download</button></main></body></html>');
 globalThis.MutationObserver=window.MutationObserver;
 const setRole=installViewerGuard(document);setRole('viewer');
 assert.equal(document.querySelector('[data-new-quote]').hasAttribute('data-viewer-hidden'),true);
 assert.equal(document.querySelector('[name="amount"]').disabled,true);
 assert.equal(Boolean(document.querySelector('[data-fleet-search]').disabled),false);
 assert.equal(document.querySelector('[data-crm-section]').hasAttribute('data-viewer-hidden'),false);
 assert.equal(document.querySelector('[data-detail-action]').hasAttribute('data-viewer-hidden'),false);
 assert.equal(Boolean(document.querySelector('[name="password"]').disabled),false);
 const button=document.createElement('button');button.textContent='Future write action';document.querySelector('main').append(button);
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(button.hasAttribute('data-viewer-hidden'),true);
 setRole('owner');assert.equal(button.hasAttribute('data-viewer-hidden'),false);assert.equal(document.querySelector('[name="amount"]').disabled,false);
});
