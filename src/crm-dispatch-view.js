import { deskDay } from './crm-dispatch-data.js';
import { renderDeskCalendar, bindDeskCalendar } from './crm-desk-calendar.js';
const esc = value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n=>n==null?'Unavailable':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
const date = d=>new Date(d+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
const balance = r=>r.total==null||r.paid==null?null:Math.max(0,r.total-r.paid);
const scopes = {'all':'All movements','pickup':'Pickups','return':'Returns','ready':'Ready for pickup','balance':'Balance due'};
const matches = (item,scope)=>({all:true,pickup:item.type==='Pickup',return:item.type==='Return',ready:item.type==='Pickup'&&item.ready,balance:balance(item)>0})[scope];
const state = item=>item.type==='Return' ? (item.agreementStatus==='vehicle_out'?'On rent':'Scheduled return') : item.ready ? 'Ready for pickup' : item.kind==='booking' ? 'Scheduled pickup' : item.signed ? 'Signed' : 'Signature pending';
const photo = item=>item.car?.image_url;
const image = item=>photo(item)?`<img src="${esc(photo(item))}" alt="" decoding="async">`:'';
const pageSize = 6;
const receivedFormat = new Intl.DateTimeFormat('en-US', {month:'short',day:'numeric',timeZone:'America/Los_Angeles'});
const receivedClock = new Intl.DateTimeFormat('en-US', {hour:'numeric',minute:'2-digit',timeZone:'America/Los_Angeles'});
const fullDateFormat = new Intl.DateTimeFormat('en-US', {month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short',timeZone:'America/Los_Angeles'});
const stateLabels = {new:'New',checking:'Checking availability',available:'Quote ready',alternative:'Alternative offered',approved:'Deposit pending',booked:'Booked'};
const desk = {tab:'inquiries', query:'', page:0, status:'new', scope:'all', todayOnly:false};
export function resetRentalDesk() {
  Object.assign(desk, {tab:'inquiries',query:'',page:0,status:'new',scope:'all',todayOnly:false});
}

function inquiryRow(request) {
  const name = request.name?.trim() || 'Name unavailable';
  const initials = name.split(/\s+/).slice(0,2).map(word => [...word][0]).join('').toUpperCase();
  const received = new Date(request.created_at);
  const valid = request.created_at && Number.isFinite(received.getTime());
  const receiptFormat = valid && deskDay(received) === deskDay() ? receivedClock : receivedFormat;
  let subtitle = stateLabels[request.status] || 'Inquiry';
  if (desk.status === 'new' && request.rental_date) {
    const start = deskDay(request.rental_date);
    if (start) subtitle = 'Pickup ' + receivedFormat.format(new Date(start+'T12:00:00Z'));
  }
  return `<button type="button" class="desk-inquiry" data-dashboard-open="quote" data-id="${esc(request.id)}">
    <span class="desk-person"><i aria-hidden="true">${esc(initials)}</i><span><strong>${esc(name)}</strong><small>${esc(subtitle)}</small></span></span>
    <span class="desk-requested">${esc(request.vehicle || 'Vehicle to confirm')}</span>
    <time datetime="${esc(request.created_at || '')}" title="${valid ? fullDateFormat.format(received) : ''}">${valid ? receiptFormat.format(received) : '—'}</time><span class="desk-chevron" aria-hidden="true">›</span></button>`;
}

function inboxResults(requests, failed) {
  if (failed) return '<p class="desk-no-data" role="status">Inquiries could not be loaded.</p><button class="desk-text-action" type="button" data-dispatch-refresh>Retry</button>';
  const query = desk.query.trim().toLowerCase();
  const matches = requests.filter(row => (desk.status === 'all' || row.status === 'new') &&
    (!query || [row.name,row.vehicle,row.email,row.phone].some(value => String(value || '').toLowerCase().includes(query))));
  desk.page = Math.max(0,Math.min(desk.page, Math.ceil(matches.length/pageSize)-1));
  if (!matches.length) return `<div class="desk-quiet" role="status"><h4>${query ? 'No matching inquiries' : desk.status === 'new' ? 'No new inquiries' : 'No inquiries yet'}</h4><p>${query ? 'Try another name or vehicle.' : desk.status === 'new' ? 'Requests awaiting a first response appear here.' : 'Submitted reservation requests will appear here.'}</p></div>`;
  const first = desk.page*pageSize;
  const shown = matches.slice(first, first+pageSize);
  return `<div class="desk-columns" aria-hidden="true"><span>Customer</span><span>Requested vehicle</span><span>Received</span></div>
    <div class="desk-inquiries">${shown.map(inquiryRow).join('')}</div><footer class="desk-pagination">
    <small role="status">${matches.length>pageSize ? `${first+1}–${first+shown.length} of ` : ''}${matches.length} ${matches.length === 1 ? 'inquiry' : 'inquiries'}</small>
    ${matches.length>pageSize ? `<span><button type="button" data-desk-page="prev" aria-label="Previous inquiries" ${first===0?'disabled':''}>‹</button><button type="button" data-desk-page="next" aria-label="Next inquiries" ${first+shown.length>=matches.length?'disabled':''}>›</button></span>` : ''}</footer>`;
}
function movements(rows) {
  let last='';
  return rows.filter(item => (!desk.todayOnly || item.day === deskDay()) && matches(item,desk.scope)).map(item => {
    const heading=item.day===last?'':`<h4>${esc(date(item.day))}</h4>`;last=item.day;
    return heading+`<button class="dispatch-row" type="button" data-dispatch-handoff="${esc(item.key)}"><span class="dispatch-time"><b>${esc(item.time)}</b><small>${esc(item.type)}</small></span>${image(item)}<span class="dispatch-who"><b>${esc(item.vehicle)}</b><small>${esc(item.client)}</small></span><span class="dispatch-pill">${esc(state(item))}</span><span aria-hidden="true">↗</span></button>`;
  }).join('') || `<div class="desk-quiet"><h4>${desk.scope!=='all' ? 'No matching handoffs' : desk.todayOnly ? 'No handoffs today' : 'No upcoming handoffs'}</h4><p>Scheduled pickups and returns appear here.</p></div>`;
}

function schedulePanel(rows, unavailable) {
  if (unavailable) return '<div role="status"><p class="desk-no-data">The schedule could not be loaded.</p><button type="button" data-dispatch-refresh>Retry</button></div>';
  const today=rows.filter(row=>row.day===deskDay());
  const balances=[...new Map(today.map(row => [row.kind+'/'+row.id,balance(row)])).values()];
  const counts = [
    ['pickup','Pickups',today.filter(row=>row.type==='Pickup').length],['return','Returns',today.filter(row=>row.type==='Return').length],
    ['ready','Ready',today.some(row=>row.kind==='agreement' && row.type==='Pickup' && !row.readyKnown)?'—':today.filter(row=>row.type==='Pickup' && row.ready).length],
    ['balance','To collect',balances.includes(null)?'—':money(balances.reduce((sum,n)=>sum+n,0))]
  ];
  return `<div class="desk-work-tools"><span data-schedule-label>${desk.todayOnly ? 'Today' : 'Upcoming'} · Pacific time</span><select data-dispatch-scope aria-label="Filter movements">${Object.entries(scopes).map(([key,label])=>`<option value="${key}" ${desk.scope===key?'selected':''}>${label}</option>`).join('')}</select></div>
    <div class="desk-today" aria-label="Today's handoffs"><span>Today</span>${counts.map(([key,label,value])=>`<button type="button" data-dispatch-scope="${key}" aria-pressed="${desk.todayOnly&&desk.scope===key}">${label} <b>${esc(value)}</b></button>`).join('')}</div>
    <div class="dispatch-rows" aria-live="polite">${movements(rows)}</div><footer><button class="desk-text-action" type="button" data-dashboard-section="bookings">View bookings <span aria-hidden="true">→</span></button></footer>`;
}

function tab(key,label,value) {
  return `<button type="button" id="desk-tab-${key}" data-desk-tab="${key}" aria-controls="desk-panel-${key}" aria-pressed="${desk.tab===key}">${label} <span>${esc(value)}</span></button>`;
}
function panel(key, body) {
  return `<section id="desk-panel-${key}" data-desk-panel="${key}" aria-labelledby="desk-tab-${key}" ${desk.tab===key?'':'hidden'}>${body}</section>`;
}

export function dispatchOverview({rows, requests, attentionHtml, attentionCount, partial, inquiryFailed, scheduleFailed, fleetHtml, followupsHtml, demandHtml}) {
  const newCount = inquiryFailed ? '—' : requests.filter(r=>r.status==='new').length;
  const inbox = `<div class="desk-work-tools"><label class="desk-search"><span aria-hidden="true"></span><input type="search" aria-label="Search inquiries" data-desk-search placeholder="Search inquiries" value="${esc(desk.query)}"></label>
    <select data-desk-status aria-label="Inquiry status"><option value="new">New inquiries</option><option value="all" ${desk.status==='all'?'selected':''}>All inquiries</option></select></div><div data-desk-results>${inboxResults(requests,inquiryFailed)}</div>`;
  const attention = `<div class="desk-work-tools"><span>Items to review</span><span class="attention-count">${partial?'Partial':esc(attentionCount)}</span></div><div class="attention-list">${attentionHtml}</div>`;
  return `<div class="rental-desk-grid"><div class="desk-primary-column"><section class="rental-worklist" aria-label="Rental worklist">
    <nav class="desk-work-tabs" aria-label="Work queues">${tab('inquiries','Inquiries',newCount)}${tab('handoffs','Handoffs',scheduleFailed?'—':rows.length)}${tab('attention','Attention',partial?'—':attentionCount)}</nav>
    ${panel('inquiries',inbox)}${panel('handoffs',schedulePanel(rows,scheduleFailed))}${panel('attention',attention)}</section>
    ${followupsHtml}</div><div class="desk-side-column"><aside class="desk-calendar-slot">${renderDeskCalendar(rows,{unavailable:scheduleFailed})}</aside>
    ${fleetHtml}${demandHtml}</div></div>`;
}

export function bindDispatch(root,rows,{requests,inquiryFailed,openRecord,markReady,canWrite,refresh}) {
  const host = root.querySelector('.rental-worklist');
  if (!host) return;
  function updateResults(focusPager) {
    host.querySelector('[data-desk-results]').innerHTML = inboxResults(requests,inquiryFailed);
    if (focusPager) {
      const focused = host.querySelector(`[data-desk-page="${focusPager}"]:not(:disabled)`) || host.querySelector('[data-desk-page]:not(:disabled)');
      focused?.focus({preventScroll:true});
    }
  }
  host.querySelector('[data-desk-search]').addEventListener('input',e => {desk.query=e.target.value;desk.page=0;updateResults();});
  host.querySelector('[data-desk-status]').addEventListener('change',e => {desk.status=e.target.value;desk.page=0;updateResults();});
  host.addEventListener('click',e=>{
    const tabButton=e.target.closest('[data-desk-tab]');
    if (tabButton) {
      desk.tab=tabButton.dataset.deskTab;
      for(const item of host.querySelectorAll('[data-desk-tab]')) item.setAttribute('aria-pressed',String(item===tabButton));
      for(const item of host.querySelectorAll('[data-desk-panel]')) item.hidden=item.dataset.deskPanel!==desk.tab;
    }
    const pager=e.target.closest('[data-desk-page]');
    if(pager){desk.page+=pager.dataset.deskPage==='next'?1:-1;updateResults(pager.dataset.deskPage);}
    if(e.target.closest('[data-dispatch-refresh]')) refresh();
  });
  const select=host.querySelector('select[data-dispatch-scope]');
  function filter(next,todayOnly){
    desk.scope=next;desk.todayOnly=todayOnly;select.value=next;
    host.querySelector('.dispatch-rows').innerHTML=movements(rows);
    host.querySelectorAll('button[data-dispatch-scope]').forEach(button=>button.setAttribute('aria-pressed',String(todayOnly&&button.dataset.dispatchScope===next)));
    host.querySelector('[data-schedule-label]').textContent=todayOnly?'Today · Pacific time':'Upcoming · Pacific time';
  }
  select?.addEventListener('change',()=>filter(select.value,false));
  host.querySelectorAll('button[data-dispatch-scope]').forEach(button=>button.addEventListener('click',()=>filter(button.dataset.dispatchScope,true)));
  host.querySelector('.dispatch-rows')?.addEventListener('click',event=>{
    const button=event.target.closest('[data-dispatch-handoff]');
    if(button) openHandoff(button.dataset.dispatchHandoff,button);
  });
  bindDeskCalendar(root,rows,{openHandoff});
  function openHandoff(key,trigger) {
    const item=rows.find(r=>r.key===key);
    if(!item)return;
    const dialog=document.createElement('dialog');
    dialog.className='dispatch-handoff';dialog.setAttribute('aria-labelledby','dispatch-handoff-title');
    const fields=[['Rental total',money(item.total)],['Collected',money(item.paid)],['Rental balance',money(balance(item))],['Handoff',state(item)]];
    if(item.kind==='agreement')fields.push(['Driver’s license',item.license?'On file':'Missing'],['Insurance',item.insurance?'On file':'Missing']);
    const readyAction=canWrite&&item.readyKnown&&item.kind==='agreement'&&item.type==='Pickup'&&item.signed&&item.agreementStatus==='signed'&&!item.ready;
    dialog.innerHTML=`<header><small>${esc(item.reference)}</small><button type="button" data-dispatch-close aria-label="Close handoff">×</button></header><h2 id="dispatch-handoff-title">${esc(item.vehicle)}</h2>${image(item)}<p>${esc(item.client)}<br>${esc([date(item.day),item.time,item.type,item.location].filter(Boolean).join(' · '))}</p><h3>Handoff checklist</h3><dl>${fields.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl><button type="button" data-dispatch-agreement>Open ${item.kind==='agreement'?'agreement':'booking'}</button>${readyAction?'<button type="button" data-dispatch-mark>Mark ready for pickup</button>':''}<p role="status"></p>`;
    document.body.append(dialog); dialog.showModal();
    dialog.querySelector('[data-dispatch-close]').addEventListener('click',()=>dialog.close());
    const origin = trigger.hasAttribute('data-desk-calendar-handoff') ? 'data-desk-calendar-handoff' : 'data-dispatch-handoff';
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (dialog.returnValue === 'record') return;
      const replacement = root.querySelector(`[${origin}="${CSS.escape(key)}"]`);
      const focus = [trigger, replacement, root.querySelector('[data-desk-tab][aria-pressed="true"]')]
        .find(button => button?.isConnected && button.getClientRects().length);
      focus?.focus({preventScroll:true});
    }, {once:true});
    dialog.querySelector('[data-dispatch-agreement]').addEventListener('click',()=>{dialog.close('record');openRecord(item.kind,item.id);});
    dialog.querySelector('[data-dispatch-mark]')?.addEventListener('click',async event=>{
      const button=event.currentTarget;button.disabled=true;
      try { await markReady(item.id);button.textContent='Ready for pickup';dialog.querySelector('[role=status]').textContent='Pickup preparation recorded.'; dialog.querySelector('[data-dispatch-close]').focus(); }
      catch(error){button.disabled=false;dialog.querySelector('[role=status]').textContent=error.message;}
    });
  }
}
