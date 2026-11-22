import { compactPersonName, compactVehicleName } from "./crm-compact-labels.js";
import { arrow, cash, photo, searchIcon, searchKey, stateLabel, vehiclePhotoSource, handleMissingPhotos } from "./crm-operation-ui.js";
import { canViewFinancials } from "./crm-permissions.js";
import { optimizedFleetImageUrl } from "./supabase-fleet.js?v=fleet-images-20260818";
import { linkPaidBooking } from "./request-match.js";
import { singleFlight, registerSection } from "./crm-navigation.js";
const app = document.querySelector("[data-booking-app]");
handleMissingPhotos(app);
const sectionButton = document.querySelector('[data-crm-section="bookings"]');
const newButton = document.querySelector("[data-new-booking]");
const supabase = window.prestigeLuxorSupabase;

let loaded = false;
let loading = false;
let agreements = [];
let ledgerRows = [];
let cars = [];
let profile = null;
let selectedVehicle = "";
let activeDay = pacificDay(new Date());
let sessionGeneration = 0;
let searchTerm = "";

const money = value => cash(Number(value || 0));
const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const iso = (value) => String(value || "").slice(0, 10);
const today = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};
const number = (value) => Math.max(0, Number(value || 0));
const canSeeTotals = () => canViewFinancials(profile?.role);
const readOnly = () => profile?.role === "viewer" || document.documentElement.dataset.crmRole === "viewer";

function parseFinance(notes) {
  const value = String(notes || "");
  const match = value.match(/\[PL_FINANCE\]([^\n]+)/);
  if (!match) return { notes: value };
  try { return { ...JSON.parse(match[1]), notes: value.replace(match[0], "").trim() }; }
  catch { return { notes: value }; }
}

function financeNotes(meta, notes) {
  return `[PL_FINANCE]${JSON.stringify(meta)}${String(notes || "").trim() ? `\n${String(notes).trim()}` : ""}`;
}

function costsFor(row) {
  const meta = row.finance || parseFinance(row.notes);
  return number(row.partner_cost) + number(meta.processing_fee) + number(meta.delivery_cost) + number(meta.detailing_cost) + number(meta.other_cost);
}

function agreementShadow(agreement) {
  return ledgerRows.find((row) => {
    const meta = parseFinance(row.notes);
    if (String(meta.agreement_id || "") === String(agreement.id)) return true;
    return agreement.source_type === "quote" && agreement.source_id && String(row.quote_request_id || "") === String(agreement.source_id);
  }) || null;
}

function records() {
  const agreementRecords = agreements
    .filter((item) => item.signed_at)
    .map((agreement) => {
      const shadow = agreementShadow(agreement);
      const finance = parseFinance(shadow?.notes);
      return {
        key: `agreement:${agreement.id}`,
        kind: "agreement",
        id: agreement.id,
        shadowId: shadow?.id || "",
        quote_request_id: shadow?.quote_request_id,
        agreement,
        customer_name: agreement.customer_name,
        customer_email: agreement.customer_email,
        customer_phone: agreement.customer_phone,
        vehicle: agreement.vehicle_name,
        start_date: agreement.rental_start,
        end_date: agreement.rental_end,
        booked_on: iso(agreement.signed_at),
        total_amount: number(agreement.rental_total),
        amount_paid: number(shadow?.amount_paid),
        partner_cost: number(shadow?.partner_cost),
        payment_status: shadow?.payment_status || "pending",
        notes: finance.notes || "",
        finance,
        cancelled: agreement.status==="cancelled" || Boolean(finance.cancelled),
      };
    });

  const linkedIds = new Set(agreementRecords.map((item) => item.shadowId).filter(Boolean));
  const manualRecords = ledgerRows.filter((row) => !linkedIds.has(row.id)).map((row) => {
    const finance = parseFinance(row.notes);
    return { ...row, key: `manual:${row.id}`, kind: "manual", finance, notes: finance.notes || "", cancelled: Boolean(finance.cancelled) };
  });
  return [...agreementRecords, ...manualRecords].sort((a, b) => String(b.booked_on || b.created_at).localeCompare(String(a.booked_on || a.created_at)));
}

const load = singleFlight(async function (force = false) {
  if (!app || !supabase || loading || (loaded && !force)) return;
  loading = true;
  if (!loaded) app.innerHTML = '<div class="crm-loading-state">Loading bookings…</div>';
  try {
    const generation = sessionGeneration;
    const session = (await supabase.auth.getSession()).data.session;
    const userId = session?.user?.id;
    const [agreementResult, ledgerResult, carResult, profileResult] = await Promise.all([
      supabase.from("rental_agreements").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("booking_sales").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("cars").select("id,name,image_url,price,is_active").order("name"),
      userId ? supabase.from("admin_profiles").select("display_name,role").eq("user_id", userId).limit(1) : Promise.resolve({ data: [] }),
    ]);
    if (generation !== sessionGeneration) return;
    if (agreementResult.error) throw agreementResult.error;
    if (ledgerResult.error) throw ledgerResult.error;
    agreements = agreementResult.data || [];
    ledgerRows = ledgerResult.data || [];
    cars = carResult.error ? [] : carResult.data || [];
    profile = profileResult.data?.[0] || { role: "staff" };
    loaded = true;
    render();
  } catch (error) {
    app.innerHTML = `<div class="booking-error"><strong>Bookings could not load.</strong><span>${escapeHtml(error.message || "Check the CRM database connection.")}</span><button class="secondary-button" type="button" data-retry-bookings>Try again</button></div>`;
    app.querySelector("[data-retry-bookings]")?.addEventListener("click", () => load(true));
  } finally { loading = false; }
});

function pacificDay(value) {
  return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"}).format(value);
}
function calendarDate(day, offset=0) {
  const date = new Date(day+"T12:00:00Z");
  date.setUTCDate(date.getUTCDate()+offset);
  return date;
}
function dayLabel(day,format={month:"short",day:"numeric"}) {
  return day ? calendarDate(iso(day)).toLocaleDateString("en-US",{...format,timeZone:"UTC"}) : "Date not set";
}
function carFor(item) {
  const id = item.agreement?.vehicle_id || item.vehicle_id;
  const clean = name => searchKey(name).replace(/\b(?:19|20)\d{2}\b/g,"").replace(/[^a-z0-9]/g,"");
  if(id) {
    const exact = cars.find(c=>String(c.id)===String(id));
    if(exact)return exact;
  }
  const matching=cars.filter(c=>clean(c.name)===clean(item.vehicle) && item.vehicle);
  return matching.length===1 ? matching[0] : null;
}
function vehiclePhoto(item,cls,wide=false) {
  const img = vehiclePhotoSource(carFor(item));
  return photo(img ? optimizedFleetImageUrl(img,{width:wide?900:320,height:wide?530:210,quality:78}) : "",cls,wide,img);
}
function bookingLabel(item) {
  return item.agreement?.agreement_number || ("Booking "+String(item.id).slice(0,8));
}
function rentalStatus(item) {
  if(item.cancelled)return "Cancelled";
  if(item.kind==="agreement")return ({signed:"Confirmed",vehicle_out:"On rent",returned:"Returned",completed:"Completed"})[item.agreement.status] || "Signed";
  return item.finance?.rental_status || (item.end_date && item.end_date < pacificDay(new Date()) ? "Past rental" : "Booked");
}
function bookingStatus(item) {
  const status=rentalStatus(item);
  return stateLabel(status,{"Confirmed":"reserved","Booked":"reserved","On rent":"road","Completed":"ready","Returned":"ready"}[status]);
}
function handoff(item,side) {
  const isStart=side==="start";
  const full=item.agreement?.[isStart ? "rental_start_at" : "rental_end_at"];
  const parsed = full && new Date(full);
  const tz = {timeZone:"America/Los_Angeles"};
  const recordedTime = item.finance?.[isStart ? "pickup_time" : "return_time"];
  let date=item[isStart?"start_date":"end_date"], time=recordedTime || "";
  if(parsed && Number.isFinite(parsed.getTime())){
    date=pacificDay(parsed);
    time=parsed.toLocaleTimeString("en-GB",{...tz,hour12:false,hour:"2-digit",minute:"2-digit"});
  }
  const minutes = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : "";
  const timeLabel = minutes ? new Date("2000-01-01T"+minutes+":00Z").toLocaleTimeString("en-US",{timeZone:"UTC",hour:"numeric",minute:"2-digit"}) : "Time TBD";
  return {item,date:iso(date),time:minutes,timeLabel,kind:isStart ? item.finance?.handoff || "Pickup" : "Return",location:item.finance?.location || "",stamp:full || (date ? iso(date)+(minutes?"T"+minutes:"") : "")};
}
function renderSchedule() {
  const schedule=app.querySelector("[data-handoff-schedule]");
  const all=records().filter(r=>!r.cancelled).flatMap(r=>[handoff(r,"start"),handoff(r,"end")]).filter(e=>e.date);
  const events=all.filter(e=>e.date===activeDay).sort((a,b)=>(a.time || "99").localeCompare(b.time || "99"));
  const week=calendarDate(activeDay,-calendarDate(activeDay).getUTCDay()).toISOString().slice(0,10);
  const days=Array.from({length:7},(_,i)=>calendarDate(week,i).toISOString().slice(0,10));
  const spotlight=events.find(e=>e.kind!=="Return") || events[0];
  schedule.classList.toggle("op-schedule-single",!spotlight);
  schedule.innerHTML=`<div class="op-schedule-main"><header class="op-section-head"><div><h2>Handoff schedule</h2><p>${dayLabel(week)}–${dayLabel(days[6],week.slice(0,7)===days[6].slice(0,7)?{day:"numeric"}:{month:"short",day:"numeric"})}, ${days[6].slice(0,4)} · Pacific time</p></div><div class="op-arrows">
    <button data-booking-week="-1" type="button" aria-label="Previous week">‹</button><button data-booking-week="1" type="button" aria-label="Next week">›</button></div></header>
    <div class="op-days" role="group" aria-label="Select schedule date">${days.map(day=>{
      const count=all.filter(e=>e.date===day).length;
      return `<button type="button" data-booking-day="${day}" aria-pressed="${day===activeDay}" aria-label="${dayLabel(day,{weekday:"long",month:"long",day:"numeric"})}, ${count} handoffs"><span>${dayLabel(day,{weekday:"short"})}</span><strong>${Number(day.slice(-2))}</strong><i class="${count?"op-day-mark":""}" aria-hidden="true"></i></button>`;
    }).join("")}</div>
    <div>${events.length ? events.map(e=>`<button type="button" class="op-event" data-open-booking="${escapeHtml(e.item.key)}"><time datetime="${escapeHtml(e.stamp)}">${e.timeLabel}</time><span class="op-event-body"><span class="op-event-label">${escapeHtml([e.kind,e.location].filter(Boolean).join(" · "))}</span><strong>${escapeHtml(compactVehicleName(e.item.vehicle) || "Vehicle not selected")}</strong></span>${arrow}</button>`).join("") : `<p class="op-empty">No handoffs scheduled for ${dayLabel(activeDay)}.</p>`}</div></div>
    ${spotlight ? `<aside id="op-book-feature"><div class="op-dispatch-photo">${vehiclePhoto(spotlight.item,"",true)}</div><div class="op-dispatch-copy"><p class="op-kicker">${spotlight.kind==="Return"?"Scheduled return":"Scheduled departure"}</p><h3>${escapeHtml(compactVehicleName(spotlight.item.vehicle) || "Vehicle not selected")}</h3><p class="op-dispatch-meta">${escapeHtml([spotlight.location,spotlight.timeLabel].filter(Boolean).join(" · "))}</p><button class="op-light-link" data-open-booking="${escapeHtml(spotlight.item.key)}">Booking details ${arrow}</button></div></aside>`:""}`;
}
function renderLedger(){
  const all=records();
  const term=searchKey(searchTerm);
  const filtered=all.filter(r=>(!selectedVehicle || searchKey(carFor(r)?.name || r.vehicle)===searchKey(selectedVehicle)) && searchKey([r.customer_name,r.vehicle,r.customer_email,r.customer_phone,bookingLabel(r),r.id,compactPersonName(r.customer_name)].join(" ")).includes(term));
  app.querySelector("[data-booking-count]").textContent=filtered.length+(filtered.length===1?" reservation":" reservations");
  app.querySelector("[data-booking-rows]").innerHTML=filtered.length ? `<div class="op-ledger-head" aria-hidden="true"><span>Vehicle / guest</span><span>Rental dates</span><span>Rental amount</span><span>Status</span></div>${filtered.map(r => `<button type="button" class="op-book-row" data-open-booking="${escapeHtml(r.key)}">
    <span class="op-book-name">${vehiclePhoto(r,"op-thumb")}<span><strong>${escapeHtml(compactVehicleName(r.vehicle) || "Vehicle not selected")}</strong><small>${escapeHtml(compactPersonName(r.customer_name) || "Guest")} · ${escapeHtml(bookingLabel(r))}</small></span></span>
    <span class="op-book-dates">${r.start_date ? dayLabel(r.start_date) : "Start TBD"} – ${r.end_date ? dayLabel(r.end_date) : "Return TBD"}</span><span class="op-book-amount">${cash(number(r.total_amount))}</span><span class="op-book-state">${bookingStatus(r)}${arrow}</span></button>`).join("")}` : `<p class="op-empty">${all.length?"No bookings match these filters.":"No bookings have been recorded. Signed agreements appear here automatically."}</p>`;
}
function render(){
  if(!app)return;
  const all=records();
  const stats=all.filter(r=>!r.cancelled);
  const collected=stats.reduce((sum,r)=>sum+number(r.amount_paid),0), costs=stats.reduce((sum,r)=>sum+costsFor(r),0);
  const vehicles=Array.from(new Set([selectedVehicle,...all.map(r=>carFor(r)?.name || r.vehicle),...cars.filter(c=>c.is_active).map(c=>c.name)].filter(Boolean))).sort();
  app.innerHTML=`<section class="op-schedule" data-handoff-schedule aria-label="Rental handoffs"></section>
    <section class="op-ledger" aria-label="Booking ledger"><header class="op-section-head"><div><h2>Booking ledger</h2><p data-booking-count role="status"></p></div>
    <div class="op-ledger-filter"><label class="op-search"><span class="op-screenreader">Search bookings</span>${searchIcon}<input type="search" data-booking-search placeholder="Guest or booking" value="${escapeHtml(searchTerm)}"></label>
    <label><span class="op-screenreader">Filter by vehicle</span><select data-booking-car><option value="">All vehicles</option>${vehicles.map(v=>`<option value="${escapeHtml(v)}" ${v===selectedVehicle?"selected":""}>${escapeHtml(v)}</option>`).join("")}</select></label></div></header>
    <div id="op-ledger-items" data-booking-rows></div></section>
    ${canSeeTotals()?`<details class="op-owner-summary"><summary>Booking financial summary</summary><dl class="op-facts">${[["Cash collected",collected],["Recorded costs",costs],["Cash less costs",collected-costs]].map(([k,v])=>`<div><dt>${k}</dt><dd>${cash(v)}</dd></div>`).join("")}<div><dt>Active or upcoming</dt><dd>${stats.filter(r=>!r.end_date || r.end_date>=today()).length}</dd></div></dl></details>`:""}
    <dialog class="op-sheet booking-dialog" data-booking-dialog aria-labelledby="op-booking-title"><div data-booking-editor></div></dialog>`;
  renderSchedule();renderLedger();
}
function showBooking(key){
  const item=records().find(row=>row.key===key);
  if(!item)return;
  const dialog=app.querySelector("[data-booking-dialog]");
  const car=carFor(item), pickup=handoff(item,"start"), ret=handoff(item,"end");
  const facts=[["Guest",item.customer_name],["Phone",item.customer_phone],["Email",item.customer_email||item.finance?.customer_email],[pickup.kind,pickup.date ? dayLabel(pickup.date)+" · "+pickup.timeLabel : ""],["Return",ret.date ? dayLabel(ret.date)+" · "+ret.timeLabel : ""],["Location",pickup.location],["Rental amount",cash(item.total_amount)],["Payment status",item.payment_status]];
  if(canSeeTotals())facts.push(["Collected",cash(number(item.amount_paid))],["Costs",cash(costsFor(item))],["Cash less costs",cash(number(item.amount_paid)-costsFor(item))]);
  dialog.querySelector("[data-booking-editor]").innerHTML=`<header><div><p class="eyebrow">Booking details</p><h2 id="op-booking-title">${escapeHtml(bookingLabel(item))}</h2></div><button type="button" data-close-booking aria-label="Close">×</button></header>
  <div class="op-book-summary">${vehiclePhoto(item,"op-sheet-thumb")}<div><h3>${escapeHtml(item.vehicle||"Vehicle not selected")}</h3>${bookingStatus(item)}</div></div>
  <dl class="op-facts">${facts.filter(([,v])=>v).map(([k,v])=>`<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join("")}</dl>${item.notes?`<p class="op-notes">${escapeHtml(item.notes)}</p>`:""}
  <div class="op-actions">${readOnly()?"":`<button type="button" class="primary-button" data-ledger-edit-booking="${escapeHtml(item.key)}">Edit booking</button>`}
    ${car?`<button type="button" class="secondary-button" data-booking-vehicle="${escapeHtml(car.id)}">Vehicle record ${arrow}</button>`:""}
    ${item.kind==="agreement"?`<button type="button" class="secondary-button" data-booking-agreement="${escapeHtml(item.id)}">Rental agreement ${arrow}</button>`:""}</div>`;
  if(!dialog.open)dialog.showModal();
}
app?.addEventListener("input",event=>{if(event.target.matches("[data-booking-search]")){searchTerm=event.target.value;renderLedger();}});
app?.addEventListener("change",event=>{if(event.target.matches("[data-booking-car]")){selectedVehicle=event.target.value;renderLedger();}});
app?.addEventListener("click",event=>{
  const b=event.target.closest("button");if(!b)return;
  const {bookingDay,bookingWeek,openBooking,ledgerEditBooking,bookingVehicle,bookingAgreement}=b.dataset;
  if(bookingDay || bookingWeek){activeDay=bookingDay || calendarDate(activeDay,7*Number(bookingWeek)).toISOString().slice(0,10);renderSchedule();app.querySelector(bookingDay ? `[data-booking-day="${bookingDay}"]` : `[data-booking-week="${bookingWeek}"]`)?.focus({preventScroll:true});}
  else if(openBooking)showBooking(openBooking);
  else if(ledgerEditBooking && !readOnly())openEditor(ledgerEditBooking);
  else if(b.hasAttribute("data-close-booking"))b.closest("dialog")?.close();
  else if(bookingVehicle || bookingAgreement){
    b.closest("dialog")?.close();document.querySelector(`[data-crm-section="${bookingVehicle?"vehicles":"agreements"}"]`)?.click();
    window.dispatchEvent(new CustomEvent(bookingVehicle?"prestige:open-fleet-vehicle":"prestige:open-agreement",{detail:{id:bookingVehicle||bookingAgreement}}));
  }
});
function blankRecord() {
  return { key: "new", kind: "manual", customer_name: "", customer_email: "", customer_phone: "", vehicle: "", start_date: "", end_date: "", booked_on: today(), total_amount: 0, amount_paid: 0, partner_cost: 0, payment_status: "pending", notes: "", finance: { payment_date: today(), payment_method: "stripe", cost_date: today(), processing_fee: 0, delivery_cost: 0, detailing_cost: 0, other_cost: 0 }, cancelled: false };
}

function openEditor(key = "new") {
  const item = key === "new" ? blankRecord() : records().find((row) => row.key === key);
  if (!item || !loaded) return;
  if (readOnly()) return;
  const dialog = app.querySelector("[data-booking-dialog]");
  const editor = app.querySelector("[data-booking-editor]");
  const lockedSource = item.kind === "agreement";
  const meta = item.finance || {};
  editor.innerHTML = `<header><div><p class="eyebrow">${lockedSource ? "Signed rental" : "Manual booking"}</p><h3 id="op-booking-title">${key === "new" ? "Add booking" : `Edit ${escapeHtml(item.customer_name || "booking")}`}</h3><span>${lockedSource ? "Rental details come from the signed agreement. Add payment and cost details here." : "Use this for phone bookings and historical rentals."}</span></div><button type="button" data-close-booking aria-label="Close">×</button></header>
    <form data-booking-form>
      <section><h4>Booking details</h4><div class="booking-form-grid">
        <label>Customer name<input name="customer_name" value="${escapeHtml(item.customer_name)}" required ${lockedSource ? "readonly" : ""}></label>
        <label>Phone<input name="customer_phone" value="${escapeHtml(item.customer_phone || "")}" ${lockedSource ? "readonly" : ""}></label>
        <label>Email<input name="customer_email" type="email" value="${escapeHtml(item.customer_email || meta.customer_email || "")}" ${lockedSource ? "readonly" : ""}></label>
        <label>Vehicle<input name="vehicle" list="booking-vehicles" value="${escapeHtml(item.vehicle)}" required ${lockedSource ? "readonly" : ""}><datalist id="booking-vehicles">${cars.filter(car=>car.is_active).map((car) => `<option value="${escapeHtml(car.name)}"></option>`).join("")}</datalist></label>
        <label>Rental starts<input name="start_date" type="date" value="${iso(item.start_date)}" ${lockedSource ? "readonly" : ""}></label>
        <label>Rental ends<input name="end_date" type="date" value="${iso(item.end_date)}" ${lockedSource ? "readonly" : ""}></label>
        <label>Booking date<input name="booked_on" type="date" value="${iso(item.booked_on) || today()}" required ${lockedSource ? "readonly" : ""}></label>
        ${lockedSource ? "" : `<label>Pickup time (Pacific)<input type="time" name="pickup_time" value="${escapeHtml(meta.pickup_time || "")}"></label><label>Return time (Pacific)<input type="time" name="return_time" value="${escapeHtml(meta.return_time || "")}"></label>
        <label>Handoff<select name="handoff">${["Pickup","Delivery"].map(x=>`<option ${meta.handoff===x?"selected":""}>${x}</option>`).join("")}</select></label><label>Location<input name="location" maxlength="180" value="${escapeHtml(meta.location || "")}"></label>
        <label>Rental status<select name="rental_status"><option value="">By rental dates</option>${["Confirmed","On rent","Completed"].map(x=>`<option ${meta.rental_status===x?"selected":""}>${x}</option>`).join("")}</select></label>`}
        <label class="booking-cancel"><input name="cancelled" type="checkbox" ${item.cancelled ? "checked" : ""}> Cancelled booking</label>
      </div></section>
      <section class="booking-money-section"><h4>Payment received</h4><p>Enter rental money actually collected. Do not include a refundable security deposit.</p><div class="booking-form-grid">
        <label>Rental total<input name="total_amount" type="number" min="0" step=".01" value="${number(item.total_amount)}" ${lockedSource ? "readonly" : ""}></label>
        <label>Amount collected<input name="amount_paid" type="number" min="0" step=".01" value="${number(item.amount_paid)}"></label>
        <label>Payment date<input name="payment_date" type="date" value="${iso(meta.payment_date) || (item.amount_paid ? iso(item.booked_on) : today())}"></label>
        <label>Payment method<select name="payment_method">${["stripe","cash","wire","zelle","other"].map((method) => `<option value="${method}" ${method === (meta.payment_method || "stripe") ? "selected" : ""}>${method.charAt(0).toUpperCase()+method.slice(1)}</option>`).join("")}</select></label>
      </div></section>
      <section class="booking-cost-section"><h4>Booking costs</h4><p>Enter only the real fixed cost for this rental.</p><div class="booking-form-grid booking-cost-grid">
        <label>Partner vehicle cost<input name="partner_cost" type="number" min="0" step=".01" value="${number(item.partner_cost)}"></label>
        <label>Stripe / card fee<input name="processing_fee" type="number" min="0" step=".01" value="${number(meta.processing_fee)}"></label>
        <label>Delivery cost<input name="delivery_cost" type="number" min="0" step=".01" value="${number(meta.delivery_cost)}"></label>
        <label>Detailing cost<input name="detailing_cost" type="number" min="0" step=".01" value="${number(meta.detailing_cost)}"></label>
        <label>Other cost<input name="other_cost" type="number" min="0" step=".01" value="${number(meta.other_cost)}"></label>
        <label>Cost date<input name="cost_date" type="date" value="${iso(meta.cost_date) || iso(meta.payment_date) || today()}"></label>
      </div></section>
      <label class="booking-notes">Internal notes<textarea name="notes" rows="3">${escapeHtml(item.notes || "")}</textarea></label>
      <div class="booking-editor-summary" data-booking-preview></div>
      <footer>${item.kind === "manual" && key !== "new" ? '<button class="danger-button" type="button" data-delete-booking>Delete</button>' : '<span></span>'}<div><button class="secondary-button" type="button" data-close-booking>Cancel</button><button class="primary-button" type="submit">Save booking</button></div></footer>
      <p class="admin-status" data-booking-status></p>
    </form>`;
  const form = editor.querySelector("[data-booking-form]");
  form.addEventListener("input", () => updatePreview(form));
  form.addEventListener("submit", (event) => save(event, item));
  editor.querySelectorAll("[data-close-booking]").forEach((button) => button.addEventListener("click", () => dialog.close()));
  editor.querySelector("[data-delete-booking]")?.addEventListener("click", () => remove(item));
  updatePreview(form);
  if (!dialog.open) dialog.showModal();
  else {const heading=editor.querySelector("h3");heading.tabIndex=-1;heading.focus();}
}

function updatePreview(form) {
  const data = new FormData(form);
  const collected = number(data.get("amount_paid"));
  const costs = ["partner_cost","processing_fee","delivery_cost","detailing_cost","other_cost"].reduce((sum, key) => sum + number(data.get(key)), 0);
  form.querySelector("[data-booking-preview]").innerHTML = `<span><small>Collected</small><strong>${money(collected)}</strong></span><span><small>Total costs</small><strong>${money(costs)}</strong></span><span class="${collected-costs<0?"negative":""}"><small>Profit</small><strong>${money(collected-costs)}</strong></span>`;
}

async function save(event, item) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = form.querySelector("[data-booking-status]");
  if (readOnly() || form.dataset.saving) return;
  const data = new FormData(form);
  const amountPaid = number(data.get("amount_paid"));
  const totalAmount = item.kind === "agreement" ? number(item.total_amount) : number(data.get("total_amount"));
  const startDate = String(data.get("start_date") || "");
  const endDate = String(data.get("end_date") || "");
  if (startDate && endDate && endDate < startDate) {
    status.textContent = "Rental end must be on or after the start date.";
    status.dataset.tone = "error";
    return;
  }
  if (amountPaid > totalAmount) {
    status.textContent = "Amount collected cannot exceed the rental total.";
    status.dataset.tone = "error";
    return;
  }
  const pickupTime=String(data.get("pickup_time") || ""), returnTime=String(data.get("return_time") || "");
  if(startDate && endDate===startDate && pickupTime && returnTime && returnTime<=pickupTime){
    status.textContent="Choose a return time after pickup.";status.dataset.tone="error";return;
  }
  const meta = {
    ...item.finance,
    notes: undefined,
    ...(item.kind==="manual" ? {pickup_time:pickupTime,return_time:returnTime,handoff:data.get("handoff"),location:String(data.get("location")||"").trim(),rental_status:data.get("rental_status")||""} : {}),
    agreement_id: item.kind === "agreement" ? item.id : undefined,
    customer_email: String(data.get("customer_email") || "").trim(),
    payment_date: data.get("payment_date") || null,
    payment_method: data.get("payment_method") || "other",
    cost_date: data.get("cost_date") || data.get("payment_date") || data.get("booked_on") || today(),
    processing_fee: number(data.get("processing_fee")), delivery_cost: number(data.get("delivery_cost")), detailing_cost: number(data.get("detailing_cost")), other_cost: number(data.get("other_cost")),
    cancelled: data.get("cancelled") === "on",
  };
  const agreement = item.agreement;
  const quoteId = agreement?.source_type === "quote" ? agreement.source_id : item.quote_request_id;
  const payload = {
    quote_request_id: /^[0-9a-f-]{36}$/i.test(String(quoteId || "")) ? quoteId : null,
    customer_name: String(data.get("customer_name") || "").trim(), customer_phone: String(data.get("customer_phone") || "").trim(), vehicle: String(data.get("vehicle") || "").trim(),
    booked_on: data.get("booked_on") || today(), start_date: data.get("start_date") || null, end_date: data.get("end_date") || null,
    rental_days: Math.max(1, item.agreement?.rental_days || Math.ceil((new Date(`${data.get("end_date")}T12:00:00`) - new Date(`${data.get("start_date")}T12:00:00`)) / 86400000) || 1),
    daily_rate: item.agreement?.daily_rate || 0, delivery_fee: 0, addons_total: 0, discount: 0,
    partner_cost: number(data.get("partner_cost")), total_amount: totalAmount, amount_paid: amountPaid,
    payment_status: amountPaid >= totalAmount && totalAmount > 0 ? "paid" : amountPaid > 0 ? "partial" : "pending",
    notes: financeNotes(meta, data.get("notes")), updated_at: new Date().toISOString(),
  };
  status.textContent = "Saving booking…";
  const existingId = item.shadowId || (item.kind === "manual" ? item.id : "");
  form.dataset.saving = "true";
  const submit=form.querySelector('[type="submit"]');submit.disabled=true;
  try {
    const result = existingId
      ? await supabase.from("booking_sales").update(payload).eq("id", existingId).select().single()
      : await supabase.from("booking_sales").insert(payload).select().single();
    if (result.error) throw result.error;
    if (!meta.cancelled) result.data = await linkPaidBooking(supabase, result.data, meta.customer_email);
    const index = ledgerRows.findIndex((row) => row.id === result.data.id);
    if (index >= 0) ledgerRows.splice(index, 1, result.data); else ledgerRows.unshift(result.data);
    app.querySelector("[data-booking-dialog]")?.close();
    render();
    window.dispatchEvent(new CustomEvent("prestige:finance-updated"));
  } catch (error) {
    status.textContent = error.message || "Booking could not be saved. Please try again.";
    status.dataset.tone = "error";
  } finally {delete form.dataset.saving;submit.disabled=false;}
}

async function remove(item) {
  if (readOnly() || !window.confirm("Delete this manual booking?")) return;
  const result = await supabase.from("booking_sales").delete().eq("id", item.id);
  if (result.error) return window.alert(result.error.message);
  ledgerRows = ledgerRows.filter((row) => row.id !== item.id);
  app.querySelector("[data-booking-dialog]")?.close();
  render();
  window.dispatchEvent(new CustomEvent("prestige:finance-updated"));
}

sectionButton?.addEventListener("click", () => {
  document.querySelectorAll("[data-crm-section]").forEach((button) => button.classList.toggle("active", button === sectionButton));
  document.querySelectorAll("[data-section-panel]").forEach((panel) => {
    const active = panel.dataset.sectionPanel === "bookings";
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
  try { localStorage.setItem("prestige-luxor-crm-active-section", "bookings"); } catch {}
  load();
});
newButton?.addEventListener("click", async () => { if (!loaded) await load(); openEditor("new"); });
window.addEventListener("prestige:agreement-signed", () => load(true));
supabase?.auth.onAuthStateChange((event, session) => { if (!session) { ++sessionGeneration;loaded=false;agreements=[];ledgerRows=[];cars=[];profile=null;selectedVehicle="";searchTerm="";app?.replaceChildren(); } });

registerSection("bookings", load);

window.addEventListener("prestige:vehicle-bookings",async e=>{
  await load();
  if(!loaded)return;
  selectedVehicle=cars.find(c=>String(c.id)===String(e.detail?.id))?.name || e.detail?.name || "";searchTerm="";render();
  app.querySelector(".op-ledger")?.scrollIntoView({block:"start"});
});
window.addEventListener("prestige:open-booking",async e=>{
  await load();
  if(!loaded)return;
  const item=records().find(r=>String(r.id)===String(e.detail?.id)&&(!e.detail?.kind||r.kind===e.detail.kind));
  if(item)showBooking(item.key);
});
