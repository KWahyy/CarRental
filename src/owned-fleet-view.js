import {ownedFleet,expenseLabels} from './owned-fleet.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:2}).format(v);
export function renderOwnedFleet(model,range,{error='',now=new Date(),readOnly=false,data=null}={}) {
 if(error)return `<section class="owned-fleet"><h3>Our fleet performance</h3><p role="status">Financial records could not be fully loaded. Totals are hidden until the connection is restored.</p><button type="button" data-owned-refresh>Retry financial records</button></section>`;
 data ??= ownedFleet(model,range,now);
 const {rows,totals}=data;
 const pending=rows.filter(r=>r.missing.length).length;
 const months=Array.from({length:6},(_,i)=>{const end=new Date(Math.min(range.end,now));const start=new Date(end.getFullYear(),end.getMonth()-5+i,1);const finish=new Date(start.getFullYear(),start.getMonth()+1,0,23,59,59);return {label:start.toLocaleDateString('en-US',{month:'short'}),data:ownedFleet(model,{start,end:finish},now)};});
 return `<section class="owned-fleet" aria-labelledby="owned-fleet-title">
  <header class="owned-heading"><div><span class="owned-eyebrow">PRESTIGE OWNED · ${readOnly?"READ-ONLY":"OWNER VIEW"}</span><h3 id="owned-fleet-title">Prestige-owned cars</h3><p>What your cars bring in. What goes out. What you keep.</p></div><button type="button" data-owned-refresh>Refresh figures ↻</button></header>
  <div class="owned-totals">${[['Rental income',totals.revenue,'Rental payments received'],['Car payments',totals.carPayments,'Loan or lease payments recorded'],['Running costs',totals.runningCosts,'Insurance, service and other expenses'],['What you keep',totals.cash,'After recorded payments and expenses']].map(([label,value,note],i)=>`<div class="${i===3?'owned-keep-total':''}"><span>${label}</span><strong class="${value<0?'is-negative':''}">${money(value)}</strong><small>${note}</small></div>`).join('')}</div>
  ${pending||data.unknownOwnership||data.unassigned?`<p class="owned-notice">${pending?`${pending} car${pending===1?' has':'s have'} no insurance or car-payment entry in this period. `:''}${data.unknownOwnership?`${data.unknownOwnership} vehicle(s) need ownership confirmed. `:''}${data.unassigned?`${data.unassigned} financial record(s) could not be matched uniquely and are excluded. `:''}Review entries before relying on the totals.</p>`:''}
  <div class="owned-cars">${rows.map((r,index)=>{
   const trend=months.map(m=>({label:m.label,value:m.data.rows.find(x=>x.id===r.id)?.revenue||0}));
   const max=Math.max(...trend.map(t=>t.value),1);
   const monthly=months.map(m=>({label:m.label,row:m.data.rows.find(x=>x.id===r.id)})).filter(m=>m.row);
   return `<article class="owned-car">
    <div class="owned-car-heading">${r.image_url?`<img src="${esc(r.image_url)}" alt="${esc(r.name)}" loading="lazy">`:'<span class="owned-no-photo">PL</span>'}<div><span class="owned-eyebrow">${r.revenue>0&&index===0?'TOP RENTAL INCOME':'PRESTIGE OWNED'}${r.is_active===false?' · INACTIVE':''}</span><h4>${esc(r.name)}</h4><p>${r.bookings} rental${r.bookings===1?'':'s'} · ${r.rentedDays} rented days</p></div></div>
    <div class="owned-car-numbers"><div><span>Rental income</span><strong>${money(r.revenue)}</strong></div><div><span>What you keep</span><strong class="${r.cash<0?'is-negative':''}">${money(r.cash)}</strong><small>After recorded costs</small></div></div>
    <div class="owned-utilization"><span>Utilization <b>${r.utilization.toFixed(0)}%</b></span><meter min="0" max="100" value="${r.utilization}" aria-label="Utilization"></meter><small>${r.rentedDays} of ${data.elapsedDays} elapsed calendar days · return day excluded</small></div>

    ${r.missing.length?`<p class="owned-missing">Not recorded: ${r.missing.map(k=>expenseLabels[k].toLowerCase()).join(' · ')}</p>`:'<p class="owned-recorded">Insurance and payment entries recorded</p>'}
    <footer>${readOnly?'':`<button type="button" data-owned-expense="${esc(r.id)}">Record expense <span aria-hidden="true">＋</span></button><button type="button" data-owned-expense="${esc(r.id)}" data-owned-category="car_payment">Add car payment</button><button type="button" data-owned-expense="${esc(r.id)}" data-owned-category="insurance">Add insurance</button>`}<button type="button" data-owned-vehicle="${esc(r.id)}">Open vehicle ↗</button></footer>
    <section class="owned-cashflow" aria-label="${esc(r.name)} cash breakdown">
     <div class="owned-deductions"><div><span>Rental payments received</span><strong>${money(r.revenue)}</strong></div><div><span>Less car payments</span><strong>−${money(r.carPayments)}</strong></div><div><span>Less insurance</span><strong>−${money(r.insurance)}</strong></div><div><span>Less other running costs</span><strong>−${money(r.runningCosts-r.insurance)}</strong></div></div>
     <div class="owned-takehome"><span>What you keep</span><strong class="${r.cash<0?'is-negative':''}">${money(r.cash)}</strong><p>${r.cash<0?'Recorded costs exceed rental income for this period.':'Rental cash left after the costs you have recorded.'} ${r.missing.length?'Some ownership costs have not been recorded.':''}</p></div>
    </section>
    <details class="owned-breakdown"><summary>View financial breakdown <span aria-hidden="true">＋</span></summary>
      <dl><div><dt>Rental payments received</dt><dd>${money(r.revenue)}</dd></div>${Object.entries(r.breakdown).map(([k,v])=>`<div><dt>${esc(expenseLabels[k]||k)}</dt><dd>${money(v)}</dd></div>`).join('')}<div class="owned-total-line"><dt>What you keep</dt><dd>${money(r.cash)}</dd></div><div><dt>Uncollected rental balance*</dt><dd>${money(r.outstanding)}</dd></div></dl>
      <p>*Invoices starting in this period. Not included in received income. “What you keep” subtracts the full recorded loan or lease payment. It is cash remaining, not accounting net profit. Depreciation and taxes are not included.</p>
      ${r.costOverlap?'<p>For overlapping cost categories, reservation-linked vehicle expenses replace legacy booking costs. Check that the ledger includes all costs.</p>':''}
      <div class="owned-chart-block"><h5>Monthly rental income</h5><p>Payments collected over the last six months</p><div class="owned-trend" aria-label="Monthly collected rental income">${trend.map(t=>`<div title="${t.label}: ${money(t.value)}"><span style="--bar:${Math.max(t.value/max*48,2)}px"></span><small>${t.label}</small><b>${money(t.value)}</b></div>`).join('')}</div></div>
      <section class="owned-months" aria-label="Monthly income and cash remaining"><h5>Month by month</h5><p>Last six months through ${months.at(-1).label}. Each month uses its own recorded payments and costs.</p>${monthly.map(({label,row})=>`<div class="owned-month"><strong>${label}</strong><dl>${[['Income received',row.revenue],['Car payments',row.carPayments],['Running costs',row.runningCosts],['What you keep',row.cash]].map(([name,value])=>`<div><dt>${name}</dt><dd class="${value<0?'is-negative':''}">${money(value)}</dd></div>`).join('')}</dl>${row.missing.length?'<small class="owned-month-incomplete">Ownership costs incomplete</small>':''}</div>`).join('')}</section>
      <div class="owned-transactions">${r.transactions.length?r.transactions.map(t=>`<div><span>${esc(t.label)}<small>${esc(t.date)} · ${esc(t.ref)}</small></span><strong>${t.kind==='expense'?'−':'+'}${money(t.amount)}</strong></div>`).join(''):'<p>No transactions recorded in this period.</p>'}</div>
    </details>

   </article>`;
  }).join('')}</div>
  ${!rows.length?'<p class="owned-notice">No vehicles are explicitly marked Prestige Owned. Set ownership in Fleet to begin tracking your cars here.</p>':''}
  <p class="owned-method">Actual entries only. Record insurance and car payments by date; enter $0 with a note when none is due. Maintenance is counted from the expense ledger once. Utilization uses elapsed calendar days, without adjusting for maintenance or acquisition dates. Monthly bars show collected income, including partial current months.</p>
 </section>`;
}
