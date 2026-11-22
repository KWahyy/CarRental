import test from 'node:test';
import assert from 'node:assert/strict';
import { deskDay, deskMovements } from '../src/crm-dispatch-data.js';
import handler from '../api/agreements.js';
import { parseHTML } from 'linkedom';
import { renderDeskFollowups } from '../src/crm-desk-followups.js';

const next='2026-11-22';
test('dispatch uses Pacific rental dates and merges booking payment shadows without extra handoffs',()=>{
  const model={agreements:[{id:'r',status:'signed',signed_at:next,vehicle_name:'Huracán',rental_start_at:'2026-11-23T02:00:00Z',rental_end:'2026-11-23',rental_total:1500}],
    bookings:[{id:'shadow',notes:{agreement_id:'r'},amount_paid:900},{id:'manual',start_date:next,end_date:next,vehicle:'Ferrari',total_amount:380,amount_paid:380},{id:'cancel',start_date:next,notes:{cancelled:true}}],
    invoices:[]};
  const rows=deskMovements(model,()=>null,row=>row.notes||{},new Set(['r']),next);
  assert.equal(deskDay('2026-11-23T02:00:00Z'),next);
  assert.equal(rows.length,4);
  assert.equal(rows[0].time,'6:00 PM');
  assert.equal(rows[0].paid,900);
  assert.equal(rows[0].ready,true);
  assert.deepEqual(rows.filter(row=>row.id==='manual').map(row=>row.time),['Time pending','Time pending']);
});

test('missing linked invoices keep balances unknown, and returned vehicles leave the handoff desk',()=>{
  const agreements=['signed','returned','completed','vehicle_out'].map((status,i)=>({id:i,status,source_type:'invoice',source_id:'unavailable',rental_start:next,rental_end:next}));
  const rows=deskMovements({agreements,bookings:[],invoices:[]},()=>null,()=>({}),new Set(),next);
  assert.deepEqual(rows.map(row=>[row.id,row.type,row.total]),[['0','Pickup',null],['0','Return',null],['3','Return',null]]);
});

test('preparing a pickup is an idempotent employee write and does not release the car',async t=>{
  const original=process.env.SUPABASE_URL;process.env.SUPABASE_URL='https://db.example';
  t.after(()=>{if(original)process.env.SUPABASE_URL=original;else delete process.env.SUPABASE_URL;});
  let role='staff',status='signed';const events=[];
  t.mock.method(globalThis,'fetch',async(url,opts={})=>{
    const path=new URL(url).pathname;
    if(path.endsWith('/user'))return Response.json({id:'staff'});
    if(path.endsWith('/admin_profiles'))return Response.json([{role}]);
    if(path.endsWith('/rental_agreements')){assert.equal(opts.method,undefined);return Response.json([{status,signed_at:next}]);}
    if(path.endsWith('/rental_agreement_events')){assert.match(opts.headers.Prefer,/ignore-duplicates/);events.push(JSON.parse(opts.body));return new Response(null,{status:201});}
    throw Error(path);
  });
  const request=async()=>{const res={setHeader(){},status(n){this.code=n;return this},end(body){this.body=body;}};await handler({method:'POST',headers:{authorization:'Bearer '+role},body:{action:'pickup_ready',id:'11111111-1111-4111-8111-111111111111'}},res);return res;};
  assert.equal((await request()).code,200);assert.equal((await request()).code,200);
  assert.equal(events[0].id,events[1].id);
  assert.equal(events[0].event_type,'pickup_ready');
  status='vehicle_out';assert.equal((await request()).code,409);
  role='viewer';assert.equal((await request()).code,403);
  assert.equal(events.length,2);
});

test('follow-ups use open quotes before unanswered pickups and keep duplicate form submissions together',()=>{
  const base = {name:'Mara Lane',status:'new',phone:'(949) 555-0100',vehicle:'Ferrari Roma',rental_date:'2026-11-29',created_at:'2026-11-19T14:00:00Z'};
  const requests = [
    {...base,id:'original'},
    {...base,id:'retry',created_at:'2026-11-20T13:00:00Z'},
    {...base,id:'other-date',rental_date:'2026-11-28'},
    {...base,id:'old-trip',rental_date:'2026-11-20'},
    {...base,id:'future-trip',rental_date:'2026-12-10'},
    {...base,id:'internal',name:'Pixel Test'},
  ];
  const proposal = {id:'open',status:'viewed',customer_first_name:'Sam',vehicle_name:'Rolls-Royce Wraith',start_at:'2026-12-05',sent_at:'2026-11-21'};
  const html = quotes=>renderDeskFollowups({requests,quotes,now:new Date('2026-11-22T16:00:00Z'),today:'2026-11-22'});
  const rows = quotes=>Array.from(parseHTML(html(quotes)).document.querySelectorAll('.desk-followup-row'), row=>[row.dataset.id,row.dataset.urgency]);
  assert.deepEqual(rows([proposal]),[['open','unscheduled']]);
  assert.deepEqual(rows([]),[['other-date','unanswered'],['retry','unanswered']]);
});

test('legacy inquiry reminders already converted or repeated in a linked proposal do not reappear',()=>{
  const follow_up_at='2026-11-23T22:00:00Z';
  const requests=['converted','in-progress'].map(id=>({id,status:'checking',name:'Mara',vehicle:'Ferrari Roma',follow_up_at}));
  const quotes=[
    {id:'completed-proposal',status:'converted',lead_id:'converted',follow_up_at},
    {id:'scheduled-proposal',status:'sent',lead_id:'in-progress',follow_up_at,customer_first_name:'Mara',vehicle_name:'Ferrari Roma'},
  ];
  const html=renderDeskFollowups({requests,quotes,now:new Date('2026-11-22T16:00:00Z'),today:'2026-11-22'});
  const buttons=Array.from(parseHTML(html).document.querySelectorAll('.desk-followup-row'),row=>row.dataset.id);
  assert.deepEqual(buttons,['scheduled-proposal']);
});
