import {vehiclePhotoSource} from "./crm-operation-ui.js";
import {optimizedFleetImageUrl} from "./supabase-fleet.js";
import {bindRevenue, businessDay, dollars, revenuePanel} from "./crm-desk-overview-revenue.js";
import {acquisitionSource} from "./crm-desk-overview-ledger.js";
import {EMPLOYEE_ROLES} from "./crm-permissions.js";

const esc = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = (options,zone="America/Los_Angeles") => new Intl.DateTimeFormat("en-US",{timeZone:zone,...options});
const fullDay = fmt({dateStyle:"full"},"UTC"), shortDay = fmt({month:"short",day:"numeric"},"UTC");
const clock = fmt({hour:"numeric",minute:"2-digit"});
const dayLabel = value => {
  const iso = businessDay(value);
  return iso ? shortDay.format(new Date(iso+"T12:00:00Z")) : "Date not set";
};
const when = value => {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(+date)) return "";
  return dayLabel(value)+(String(value).includes("T")?" · "+clock.format(date)+" PT":"");
};
const iconPaths = {right:'m9 6 6 6-6 6',left:'m15 6-6 6 6 6',arrow:'M4 12h15m-6-6 6 6-6 6',calendar:'M4 5h16v16H4z M8 3v5m8-5v5M4 11h16',clock:'M12 6v6l4 2',close:'m6 6 12 12M18 6 6 18'};
const icon = name => `<svg class="small-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${name==="clock"?'<circle cx="12" cy="12" r="9"/>':""}<path d="${iconPaths[name]}"/></svg>`;
const button = (attrs,body,cls="")=>`<button type="button" ${attrs} class="${cls}">${body}</button>`;
const empty = copy => '<p class="clear-state">'+esc(copy)+'</p>';
const detailFields = pairs => '<dl class="detail-list">'+pairs.filter(([,v])=>v!=null && v!=="").map(([l,v])=>'<div><dt>'+esc(l)+'</dt><dd>'+esc(v)+'</dd></div>').join("")+'</dl>';
const image = (car,cls="",large=false) => {
  const cover = vehiclePhotoSource(car);
  if (!cover) return `<span class="desk-no-photo ${cls}" aria-label="Vehicle photo unavailable">PL</span>`;
  const src = optimizedFleetImageUrl(cover,{width:large?960:260,height:large?610:160,updatedAt:car.updated_at});
  return `<img src="${esc(src)}" data-original-photo="${esc(cover)}" alt="" class="${cls}" decoding="async"${large?'':' loading="lazy"'}>`;
};
const openButton = (kind,id,body,cls="desk-link") => button(`data-desk-record="${esc(kind)}" data-id="${esc(id)}" data-dashboard-open="${esc(kind)}"`,body,cls);
const state = {handoff:0,leads:"new",fleet:"all",expanded:false,period:"month"};
const statusText = {available:"Available",reserved:"Scheduled",vehicle_out:"On rent",maintenance:"Maintenance",on_hold:"On hold",partner_unavailable:"Partner unavailable",inactive:"Inactive",unknown:"Status unavailable"};
const carFor = (record,view) => view.carById.get(String(record?.vehicle_id || "")) || view.resolveVehicle(record?.vehicle_name || record?.vehicle,view.carByName);
function handoffs(view) {
  const today = businessDay(), rows = [];
  for (const item of view.model.agreements) {
    const isReturn = item.status === "vehicle_out";
    if (!isReturn && !["signed","draft"].includes(item.status)) continue;
    const at = isReturn ? item.rental_end_at || item.rental_end : item.rental_start_at || item.rental_start;
    if (!at || businessDay(at)<today) continue;
    rows.push({record:item,kind:"agreement",at,car:carFor(item,view),type:isReturn?"Return":"Pickup",name:item.vehicle_name,client:item.customer_name});
  }
  const compare = (a,b)=>businessDay(a.at).localeCompare(businessDay(b.at)) || String(a.at).localeCompare(String(b.at));
  return rows.sort(compare);
}
function fleetStatus(car,view) {
  if (car.is_active===false || car.operational_status==="inactive") return "inactive";
  if (view.failedTables.has("rental_agreements") || view.failedTables.has("vehicle_blocks")) return "unknown";
  const now = Date.now(), day = businessDay();
  const records = view.model.agreements.filter(item=>carFor(item,view)?.id===car.id);
  if (records.some(a=>a.status==="vehicle_out")) return "vehicle_out";
  if (records.some(a=>a.status==="signed" && (a.rental_start_at ? Date.parse(a.rental_start_at)<=now : a.rental_start<=day) && (a.rental_end_at ? Date.parse(a.rental_end_at)>now : a.rental_end>=day))) return "reserved";
  const block = view.model.blocks.find(b=>String(b.car_id)===String(car.id) && Date.parse(b.start_at)<=now && Date.parse(b.end_at)>now);
  if (block?.block_type==="maintenance"||car.operational_status==="maintenance") return "maintenance";
  if (block?.block_type==="partner_unavailable"||car.operational_status==="partner_unavailable") return "partner_unavailable";
  if (block) return "on_hold";
  return car.operational_status || "available";
}
function hero(view,rows,fleet) {
  const featured = rows.length ? rows : fleet.filter(c=>vehiclePhotoSource(c)).slice(0,3).map(car=>({car,name:car.name}));
  state.handoff = Math.min(state.handoff,Math.max(0,featured.length-1));
  const item = featured[state.handoff], car = item?.car;
  const heading = rows.length ? "Next handoff" : item ? "Fleet spotlight" : "Handoffs";
  const make = car?.make || "", name = item?.name || car?.name || "No upcoming handoffs";
  const model = car?.model || name;
  const details = item?.record ? openButton(item.kind,item.record.id,"View handoff "+icon("arrow"),"pl-handoff-open") : car ? openButton("vehicle",car.id,"Open vehicle "+icon("arrow"),"pl-handoff-open") : button("data-desk-schedule","View schedule "+icon("arrow"),"pl-handoff-open");
  return `<div class="pl-handoff${vehiclePhotoSource(car)?'':' has-no-image'}"><div class="pl-handoff-photo">${image(car,"pl-handoff-frame",true)}</div><div class="pl-handoff-panel">
    <div class="pl-handoff-heading"><span class="pl-handoff-label">${heading}</span>${featured.length?'<span class="pl-handoff-position">'+(state.handoff+1)+' / '+featured.length+'</span>':''}</div>
    <div class="pl-handoff-record" aria-live="polite"><h2 class="pl-handoff-name ${model.length>18?'long-name':''}">${make?esc(make)+' <em>'+esc(model)+'</em>':esc(name)}</h2>
    <p class="pl-handoff-meta">${item?.at ? icon("clock")+esc(when(item.at))+" · "+item.type : view.failedTables.has("rental_agreements")?"Handoff schedule unavailable":car?"No upcoming handoffs scheduled":""}</p>
    ${item?.client?'<p class="pl-handoff-meta">'+esc(item.client)+'</p>':''}</div>
    <div class="pl-handoff-actions">${details}${featured.length>1?`<div class="pl-handoff-nav">${[-1,1].map(dir=>button(`data-desk-handoff-step="${dir}" aria-label="${dir<0?'Previous':'Next'} ${rows.length?'handoff':'vehicle'}"`,icon(dir<0?"left":"right"),"pl-handoff-step")).join("")}</div>`:""}</div></div></div>`;
}
function issueRow(item,view) {
  const records = item.kind==="agreement"?view.model.agreements:item.kind==="invoice"?view.model.invoices:view.model.quotes;
  const record = records.find(r=>String(r.id)===String(item.id));
  const name = record?.vehicle_name || record?.vehicle || record?.customer_name || record?.name || "";
  return openButton(item.kind,item.id,image(carFor(record,view))+`<span><span class="meta">${esc(record?.customer_name||record?.name||"")}</span><span class="title">${esc(item.title)}</span><span class="sub">${esc(name)}${item.issues.length>1?" · +"+(item.issues.length-1)+" more":""}</span></span>`+icon("right"),"issue");
}
function attentionPanel(view,rows) {
  const pickups = rows.filter(row=>row.type==="Pickup" && businessDay(row.at)===businessDay());
  const issueIds = new Set(view.attention.filter(issue=>issue.kind==="agreement").map(issue=>String(issue.id)));
  const ready = pickups.filter(({record:r})=>r.signed_at && !issueIds.has(String(r.id)) && !(r.source_type==="invoice" && view.model.invoices.some(i=>String(i.id)===String(r.source_id)&&Number(i.amount_paid)<Number(i.subtotal)))).length;
  return `<section class="attention"><div class="inset-head"><h2>Needs attention</h2>${button('data-desk-issues aria-label="View all items needing attention"',String(view.attention.length),"count")}</div>
    <div id="issues">${view.attention.slice(0,2).map(item=>issueRow(item,view)).join("")||empty(view.failedTables.has("rental_agreements")?"Rental records unavailable.":"No open issues in the current records.")}</div>
    <div class="readiness"><div><span>Pickups ready today</span><strong>${ready} of ${pickups.length}</strong></div><progress max="${Math.max(1,pickups.length)}" value="${ready}" aria-label="Pickups ready today"></progress></div></section>`;
}
function paidSources(view) {
  const today = businessDay(), start=today.slice(0,7)+"-01", groups=new Map();
  for (const row of view.ledger) {
    const day=businessDay(row.date);
    if (day<start||day>today) continue;
    const label = row.source ? view.sourceLabel(row.source) : "Unattributed";
    const group=groups.get(label)||{amount:0,ids:new Set()};
    group.amount+=row.amount;group.ids.add(row.bookingKey);groups.set(label,group);
  }
  const rows = [...groups].sort((a,b)=>b[1].amount-a[1].amount);
  const incomplete = view.error || view.failedTables.has("quote_requests") || view.failedTables.has("quotes");
  return `<section id="booking-sources"><div class="section-head"><h2>Paid booking sources</h2><span class="period">${fmt({month:"long",year:"numeric"}).format(new Date())}</span></div>
    ${incomplete?empty("Booking source records could not be fully loaded."):rows.length?`<table class="source-table"><thead><tr><th>Source</th><th>Paid bookings</th><th>Collected</th></tr></thead><tbody>${rows.map(([label,r])=>'<tr><th scope="row">'+esc(label)+'</th><td>'+r.ids.size+'</td><td>'+dollars.format(r.amount)+'</td></tr>').join("")}</tbody></table>`:empty("No paid bookings recorded this month.")}</section>`;
}
function followups(view) {
  const today = businessDay();
  const proposals = view.model.proposals.filter(p=>!["converted","cancelled","declined","expired"].includes(p.status));
  const rows = [...proposals.map(p=>({kind:"proposal",id:p.id,at:p.follow_up_at,car:carFor(p,view),name:[p.customer_first_name,p.customer_last_name].filter(Boolean).join(" "),vehicle:p.vehicle_name})),
    ...view.model.quotes.filter(q=>q.status!=="booked").map(q=>({kind:"quote",id:q.id,at:q.follow_up_at,car:carFor(q,view),name:q.name,vehicle:q.vehicle}))].filter(r=>r.at && businessDay(r.at)<=today).sort((a,b)=>String(a.at).localeCompare(String(b.at)));
  return `<section id="sales"><div class="section-head"><h2>Sales follow-ups</h2><span class="period">Due by today</span></div><div>${rows.length?rows.slice(0,5).map(row=>openButton(row.kind,row.id,image(row.car)+'<span><span class="title">'+esc(row.name||"Follow up")+'</span><span class="sub">'+esc([row.vehicle,when(row.at)].filter(Boolean).join(" · "))+'</span></span>'+icon("right"),"follow")).join(""):empty(view.failedTables.has("quotes")||view.failedTables.has("quote_requests")?"Follow-ups could not be loaded.":"No follow-ups due today.")}</div>${button('data-dashboard-section="requests"',"Open quotes →","desk-link")}</section>`;
}
export function overviewMarkup(view) {
  const today = businessDay();
  return `<div class="desk-overview"><header class="page-head"><div><p class="date-line"><time datetime="${today}">${fullDay.format(new Date(today+"T12:00:00Z"))}</time></p><h1>Rental overview</h1></div>
    ${button("data-desk-schedule",icon("calendar")+" View schedule","outline")}</header>
    <div class="lead-grid"><section id="handoff-stage" aria-label="Upcoming handoffs"></section>${attentionPanel(view,handoffs(view))}</div>
    <div class="business-grid ${view.owner?"":"desk-no-finance"}"><section id="leads"><div class="section-head inquiry-head"><div class="inquiry-heading"><h2>New leads</h2><span id="inquiry-count" class="count"></span></div>
    <label class="inquiry-filter"><span class="sr">Filter leads by status</span><select data-desk-lead-filter><option value="new">New</option><option value="contacted">Contacted</option><option value="all">All leads</option></select></label></div><div id="inquiry-list"></div></section>${view.owner?revenuePanel():""}</div>
    <section id="fleet"><div class="section-head"><h2>Fleet snapshot</h2><div class="filters" role="group" aria-label="Filter fleet">${[["all","All"],["available","Available"],["vehicle_out","On rent"]].map(([id,label])=>button('data-desk-fleet-filter="'+id+'"',label)).join("")}</div></div>
    <div class="vehicles"></div><div class="fleet-end"><span role="status" data-desk-fleet-count></span><div>${button("data-desk-fleet-expand","","desk-link")}${button('data-dashboard-section="vehicles"',"Open fleet →","desk-link")}</div></div></section>
    <div class="lower-grid">${followups(view)}${view.owner?paidSources(view):""}</div>
    <dialog data-desk-dialog aria-labelledby="desk-detail-title"><div class="dialog-shell"><div class="dialog-head"><p class="date-line" data-desk-detail-type></p>${button('data-desk-dialog-close aria-label="Close details"',icon("close"),"icon-button")}</div><div data-desk-detail-body></div></div></dialog>
    <span class="sr" role="status" data-desk-announce></span></div>`;
}

export function bindOverview(root,view) {
  const desk = root.querySelector(".desk-overview"), q = selector=>desk.querySelector(selector);
  const {model} = view, rows = handoffs(view);
  const fleet = model.cars.filter(c=>c.is_active!==false && c.operational_status!=="inactive")
    .sort((a,b)=>Number(Boolean(vehiclePhotoSource(b)))-Number(Boolean(vehiclePhotoSource(a))) || Number(b.ownership_type==="prestige")-Number(a.ownership_type==="prestige") || String(a.name).localeCompare(String(b.name)));
  const leads = [...model.quotes].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  const contacted = new Set(model.quoteActivities.filter(e=>["call","email"].includes(e.activity_type)||e.metadata?.lead_contacted).map(e=>String(e.quote_request_id)));
  const progressed = new Set(model.proposals.filter(p=>p.sent_at).map(p=>String(p.lead_id)));
  const isNew = lead => (!lead.status||lead.status==="new")&&!contacted.has(String(lead.id))&&!progressed.has(String(lead.id));
  const states = new Map(fleet.map(c=>[c.id,fleetStatus(c,view)]));
  const dialog = q("[data-desk-dialog]");
  let returnFocus, leadLimit=3;
  const readOnly = !EMPLOYEE_ROLES.includes(model.profile?.role);
  const announce = value => {q("[data-desk-announce]").textContent=value;};
  const openDialog = (label,title,body) => {
    if (!dialog.open) returnFocus=document.activeElement;
    q("[data-desk-detail-type]").textContent=label;
    q("[data-desk-detail-body]").innerHTML='<h2 id="desk-detail-title">'+esc(title)+'</h2>'+body;
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop=0;q("[data-desk-dialog-close]").focus({preventScroll:true});
  };
  dialog.onclose = () => {
    if (!desk.isConnected || desk.closest("[hidden]")) return;
    (returnFocus?.isConnected ? returnFocus : q("[data-desk-lead-filter]"))?.focus({preventScroll:true});
  };
  const heroRows = rows.length || fleet.filter(c=>vehiclePhotoSource(c)).slice(0,3).length;
  const drawHero = () => {q("#handoff-stage").innerHTML=hero(view,rows,fleet);};
  const drawLeads = () => {
    const count=leads.filter(isNew).length;
    const incomplete = ["quote_requests","quote_activities","quotes"].some(table=>view.failedTables.has(table));
    q("#inquiry-count").textContent=incomplete?"—":String(count);
    q("#inquiry-count").setAttribute("aria-label",incomplete?"Lead count unavailable":count+" new leads");
    window.dispatchEvent(new CustomEvent("prestige:overview-leads",{detail:{count:incomplete?null:count}}));
    const filtered=leads.filter(l=>state.leads==="all" || (state.leads==="new")===isNew(l));
    q("[data-desk-lead-filter]").value=state.leads;
    q("#inquiry-list").innerHTML=(filtered.slice(0,leadLimit).map(lead=>{
      const source=acquisitionSource(lead);
      return button(`data-desk-inquiry="${esc(lead.id)}" aria-haspopup="dialog"`,image(carFor(lead,view),"inquiry-photo")+`<span class="inquiry-copy"><span class="inquiry-top"><strong>${esc(lead.name||"Unnamed lead")}</strong><time datetime="${esc(lead.created_at||"")}">${esc(lead.created_at?(businessDay(lead.created_at)===businessDay()?clock.format(new Date(lead.created_at)):dayLabel(lead.created_at)):"")}</time></span>
        <span class="inquiry-car">${esc(lead.vehicle||"Vehicle not selected")}</span><span class="inquiry-meta">${esc([source?view.sourceLabel(source):"",lead.city||lead.location].filter(Boolean).join(" · "))}</span></span>`,"inquiry-row");
    }).join("")||empty(incomplete?"Lead records could not be fully loaded.":state.leads==="all"?"No leads recorded.":state.leads==="new"?"No new leads.":"No contacted leads."))+
      (filtered.length>3?button('data-desk-inquiry-list aria-expanded="'+(leadLimit>3)+'"',leadLimit>3?"Show fewer leads":"View all "+filtered.length+" leads →","desk-link"):"");
  };
  const drawFleet = () => {
    const filtered=fleet.filter(c=>state.fleet==="all"||states.get(c.id)===state.fleet);
    const visible=state.expanded?filtered:filtered.slice(0,3);
    q(".vehicles").innerHTML=visible.map(car=>openButton("vehicle",car.id,`<span class="photo">${image(car,"",true)}</span><span class="caption"><span class="car-meta"><span>${esc(car.make)}</span><span class="state ${esc(states.get(car.id))}">${esc(statusText[states.get(car.id)]||"Status unavailable")}</span></span><strong class="car-title">${esc(car.model||car.name)}</strong></span>`,"vehicle")).join("")||empty(view.failedTables.has("cars")?"Fleet records could not be loaded.":"No vehicles in this view.");
    q("[data-desk-fleet-count]").textContent=visible.length+" of "+filtered.length+" vehicles";
    const toggle=q("[data-desk-fleet-expand]");
    toggle.hidden=filtered.length<=3;toggle.textContent=state.expanded?"Show fewer vehicles":"View all "+filtered.length+" vehicles →";toggle.setAttribute("aria-expanded",state.expanded);
    desk.querySelectorAll("[data-desk-fleet-filter]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.deskFleetFilter===state.fleet));
  };
  const openLead = id => {
    const l=leads.find(r=>String(r.id)===String(id));
    if (!l) return;
    const source=acquisitionSource(l), car=carFor(l,view);
    const proposals=model.proposals.filter(p=>String(p.lead_id)===String(l.id));
    const customerId=proposals.find(p=>p.customer_id)?.customer_id;
    const message=String(l.message||"").split(/(?:^|\n)(?:Acquisition source|Source|Landing page): /)[0].trim();
    openDialog("Lead details",l.name||"Unnamed lead",
      '<div class="inquiry-detail-car">'+image(car,"inquiry-photo")+'<strong>'+esc(l.vehicle||"Vehicle not selected")+'</strong></div>'+
      (message?'<p class="inquiry-request">'+esc(message)+'</p>':'')+detailFields([["Source",source&&view.sourceLabel(source)],["Requested date",l.rental_date&&dayLabel(l.rental_date)],["Received",when(l.created_at)],["Status",isNew(l)?"New":"Contacted"],["Phone",l.phone],["Email",l.email]])+
      '<div class="desk-sheet-actions">'+(isNew(l)&&!readOnly?button('data-desk-contact="'+esc(l.id)+'"',"Mark contacted","sheet-primary"):"")+
      (!readOnly?button('data-desk-create-proposal="'+esc(l.id)+'"',"Create quote →","desk-link"):"")+
      proposals.map(p=>openButton("proposal",p.id,esc(p.quote_number||"Open quote")+" →")).join("")+
      (customerId?button('data-desk-customer-link="'+esc(customerId)+'"',"Customer profile →","desk-link"):"")+
      (l.phone?'<a class="desk-link" data-desk-contact-link href="tel:'+esc(String(l.phone).replace(/[^\d+]/g,""))+'">Call</a>':"")+
      (l.email?'<a class="desk-link" data-desk-contact-link href="mailto:'+esc(encodeURIComponent(l.email))+'">Email</a>':"")+'</div><p data-desk-contact-status role="status"></p>');
  };
  const showSchedule = () => openDialog("Handoffs","Upcoming schedule",rows.length?rows.map(row=>openButton(row.kind,row.record.id,
    image(row.car,"inquiry-photo")+'<span><span class="stamp">'+esc(when(row.at))+' · '+row.type+'</span><span class="title">'+esc(row.name||"Vehicle not assigned")+'</span><span class="sub">'+esc(row.client)+'</span></span>'+icon("right"),"schedule-row")).join(""):empty(view.failedTables.has("rental_agreements")?"Schedule could not be loaded.":"No upcoming handoffs scheduled."));
  const balance = view.balance;
  bindRevenue(desk,{model:view.statementModel,ledger:view.ledger,balance,error:view.error,period:state.period,onPeriod:value=>{state.period=value;},
    onDetail:({total,owned,from,through})=>openDialog("Rental cash", "Cash breakdown",
      '<p class="dialog-sub">'+esc(dayLabel(from)+" – "+dayLabel(through))+'</p>'+detailFields([["Rental cash collected",dollars.format(total)],["Open rental balances",dollars.format(balance)],["Prestige-owned receipts",dollars.format(owned.revenue)],["Recorded owned-car costs",dollars.format(owned.costs)],["Owned-car cash retained",dollars.format(owned.cash)]])+
      '<div class="desk-sheet-actions">'+button('data-dashboard-section="invoices"',"Open invoices →","desk-link")+button('data-desk-statement',"Owned-car statement →","desk-link")+'</div>')});
  drawHero();drawFleet();drawLeads();
  desk.addEventListener("error",event=>{
    const img=event.target;
    if (!(img instanceof HTMLImageElement)) return;
    const original=img.dataset.originalPhoto;
    if (original && img.getAttribute("src")!==original) {img.src=original;return;}
    const placeholder=document.createElement("span");
    placeholder.className="desk-no-photo "+img.className;placeholder.textContent="PL";placeholder.setAttribute("aria-label","Vehicle photo unavailable");
    img.replaceWith(placeholder);
  },true);
  q("[data-desk-lead-filter]").onchange = e=>{state.leads=e.target.value;leadLimit=3;drawLeads();};
  desk.addEventListener("click",async event=>{
    const target=event.target.closest("button");
    if (!target) {
      if (event.target===dialog) {const rect=dialog.getBoundingClientRect();if (event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom) dialog.close();}
      return;
    }
    const d=target.dataset;
    if ("ownedRefresh" in d) return view.refresh();
    if ("deskDialogClose" in d) return dialog.close();
    if ("deskSchedule" in d) return showSchedule();
    if ("deskIssues" in d) return openDialog("Rental operations","Needs attention",view.attention.map(i=>issueRow(i,view)).join("")||empty("No outstanding issues."));
    if (d.deskHandoffStep) {
      state.handoff=(state.handoff+Number(d.deskHandoffStep)+heroRows)%heroRows;drawHero();
      q('[data-desk-handoff-step="'+d.deskHandoffStep+'"]')?.focus({preventScroll:true});return;
    }
    if ("deskInquiryList" in d) {
      leadLimit=leadLimit>3?3:leads.length;drawLeads();q("[data-desk-inquiry-list]")?.focus({preventScroll:true});return;
    }
    if (d.deskInquiry) return openLead(d.deskInquiry);
    if (d.deskFleetFilter) {state.fleet=d.deskFleetFilter;state.expanded=false;drawFleet();return;}
    if ("deskFleetExpand" in d) {state.expanded=!state.expanded;drawFleet();return;}
    if (d.deskContact && !readOnly) {
      target.disabled=true;
      try {
        // Repeated contact confirmations from different tabs converge on one
        // activity. The sales stage stays independent from the contact log.
        const {error} = await window.prestigeLuxorSupabase.from("quote_activities").upsert({id:d.deskContact,quote_request_id:d.deskContact,activity_type:"status",body:"Lead marked contacted",metadata:{lead_contacted:true}},{onConflict:"id",ignoreDuplicates:true});
        if (error) throw error;
        contacted.add(String(d.deskContact));model.quoteActivities.push({quote_request_id:d.deskContact,activity_type:"status",metadata:{lead_contacted:true},body:"Lead marked contacted",created_at:new Date().toISOString()});
        drawLeads();dialog.close();announce("Lead marked contacted.");
      } catch {target.disabled=false;q("[data-desk-contact-status]").textContent="Contact status could not be saved. Try again.";}
      return;
    }
    if (d.deskCreateProposal || d.deskCustomerLink || "deskStatement" in d) {
      if (dialog.open) dialog.close();
      const section=d.deskCreateProposal?"requests":d.deskCustomerLink?"customers":"vehicles";
      document.querySelector('[data-crm-section="'+section+'"]')?.click();
      window.dispatchEvent(new CustomEvent("prestige:"+(d.deskCreateProposal?"new-quote-for-lead":d.deskCustomerLink?"open-customer":"operating-statement"),{detail:{id:d.deskCreateProposal||d.deskCustomerLink}}));return;
    }
    if (d.deskRecord) {
      if (d.deskRecord==="quote") return openLead(d.id);
      if (dialog.open) dialog.close();
      return view.onOpen(d.deskRecord,d.id);
    }
    if (d.dashboardSection && dialog.open) {
      dialog.close();document.querySelector('[data-crm-section="'+d.dashboardSection+'"]')?.click();
    }
  });
  desk.addEventListener("desk:open-lead",event=>openLead(event.detail.id));
}

export function bindOperatingReports(view) {
  const details = document.querySelector(".desk-operating-reports");
  if (!details) return;
  let loaded=false;
  const slot=details.querySelector("[data-desk-operating-content]");
  const show = async () => {
    if (!details.open || loaded) return;
    loaded=true;
    const model=view.model, partners=new Map(model.partners.map(p=>[String(p.car_id),p]));
    const checks=model.quotes.filter(l=>l.status==="checking");
    const calls=checks.map(l=>{
      const car=carFor(l,view), p=partners.get(String(car?.id));
      return '<div class="desk-metric-row"><div><strong>'+esc(l.name)+'</strong><small>'+esc([l.vehicle,p?.partner_name].filter(Boolean).join(" · "))+'</small></div>'+
        (p?.partner_phone?'<a class="desk-link" data-desk-contact-link href="tel:'+esc(String(p.partner_phone).replace(/[^\d+]/g,""))+'">Call partner</a>':button('data-desk-report-lead="'+esc(l.id)+'" data-desk-inquiry="'+esc(l.id)+'"',"Review lead","desk-link"))+'</div>';
    }).join("");
    const priced=model.cars.filter(c=>c.is_active!==false && Number(c.competitor_price)>0).sort((a,b)=>String(a.competitor_checked_at||"").localeCompare(String(b.competitor_checked_at||""))).slice(0,6);
    const prices=priced.map(c=>'<div class="desk-metric-row"><div><strong>'+esc(c.name)+'</strong><small>'+esc(dollars.format(c.price)+'/day · Competitor '+dollars.format(c.competitor_price)+'/day')+'</small><small>'+esc(c.competitor_checked_at?'Checked '+dayLabel(c.competitor_checked_at):'No check date recorded')+'</small></div><div><strong>'+dollars.format(Math.max(0,c.competitor_price-50))+' target</strong> '+openButton("vehicle",c.id,"Open vehicle →")+'</div></div>').join("");
    slot.innerHTML='<section><h3>Fleet traffic &amp; clicks</h3><p>Last 30 days · latest 5,000 events</p><div data-traffic-summary role="status">Loading fleet traffic…</div></section>'+
      '<section><h3>Partner availability calls</h3>'+(calls||empty(view.failedTables.has("quote_requests")?"Lead records unavailable.":"No partner checks pending."))+'</section>'+
      '<section><h3>Competitive pricing</h3>'+(prices||empty(view.failedTables.has("cars")?"Fleet records unavailable.":"No competitor comparisons recorded."))+'</section>';
    const traffic=slot.querySelector("[data-traffic-summary]");
    try {
      const since=new Date(Date.now()-30*86400000).toISOString();
      const {data,error}=await window.prestigeLuxorSupabase.from("fleet_events").select("event_type,car_slug").gte("created_at",since).order("created_at",{ascending:false}).limit(5000);
      if(error)throw error;
      const byCar=new Map(), total=new Map();
      for(const event of data||[]) {
        total.set(event.event_type,(total.get(event.event_type)||0)+1);
        if (!event.car_slug) continue;
        const group=byCar.get(event.car_slug)||{};
        group[event.event_type]=(group[event.event_type]||0)+1;byCar.set(event.car_slug,group);
      }
      const labels=[["Vehicle impressions","card_impression"],["Detail clicks","vehicle_detail_click"],["Availability checks","availability_open"],["Requests","availability_success"]];
      const score=g=>(g.vehicle_detail_click||0)+(g.availability_open||0)+(g.availability_success||0)*2;
      const ranked=[...byCar].sort((a,b)=>score(b[1])-score(a[1])||(b[1].card_impression||0)-(a[1].card_impression||0)).slice(0,10);
      const names=new Map(model.cars.map(c=>[c.slug,c.name]));
      traffic.innerHTML='<div class="traffic-kpis">'+labels.map(([l,key])=>'<div><span>'+l+'</span><strong>'+(total.get(key)||0)+'</strong></div>').join("")+'</div><p>'+Number(total.get("fleet_page_view")||0)+' fleet page views</p>'+
        (ranked.length?'<div class="desk-source-table"><table><thead><tr><th>Vehicle</th><th>Impressions</th><th>Clicks</th><th>Checks</th><th>Requests</th><th>CTR</th></tr></thead><tbody>'+ranked.map(([slug,g])=>'<tr><th>'+esc(names.get(slug)||slug)+'</th>'+labels.map(([,key])=>'<td>'+(g[key]||0)+'</td>').join("")+'<td>'+(g.card_impression?Math.round((g.vehicle_detail_click||0)/g.card_impression*100):0)+'%</td></tr>').join("")+'</tbody></table></div>':'');
    } catch {traffic.innerHTML=empty("Fleet traffic could not be loaded. Reopen the report to retry.");loaded=false;}
  };
  details.onclick=event=>{
    const btn=event.target.closest("button");if(!btn) return;
    if(btn.dataset.deskReportLead)view.onOpen("quote",btn.dataset.deskReportLead);
    else if(btn.dataset.deskRecord)view.onOpen(btn.dataset.deskRecord,btn.dataset.id);
  };
  details.ontoggle=show;
  if(details.open) show();
  else slot.replaceChildren();
}
