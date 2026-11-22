import { compactPersonName, compactVehicleName } from "./crm-compact-labels.js";
import { rentalRange } from "./crm-billing-display.js";
import { singleFlight, registerSection } from "./crm-navigation.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js?v=fleet-sync-20260714";
import { clearDraft, draftData, restoreForm, scheduleDraft, serializeForm, writeDraft } from "./form-drafts.js";

const supabase=window.prestigeLuxorSupabase||createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=(selector)=>document.querySelector(selector);
const form=$("[data-agreement-form]"),list=$("[data-agreement-list]"),statusEl=$("[data-agreement-status]"),search=$("[data-agreement-search]"),kpis=$("[data-agreement-kpis]");
const sourceType=$("[data-agreement-source-type]"),sourceSelect=$("[data-agreement-source]"),title=$("[data-agreement-title]"),subtitle=$("[data-agreement-subtitle]"),badge=$("[data-agreement-badge]");
const linkCard=$("[data-agreement-link-card]"),linkStatus=$("[data-agreement-link-status]"),audit=$("[data-agreement-audit]"),auditList=$("[data-agreement-audit-list]");
const saveButton=$("[data-save-agreement]"),sendButton=$("[data-resend-agreement]"),downloadButton=$("[data-download-agreement]"),deleteButton=$("[data-delete-agreement]");
const licenseCard=$("[data-license-photo-card]"),licenseInput=$("[data-license-photo-input]"),licensePreview=$("[data-license-photo-preview]"),licenseImage=$("[data-license-photo-image]"),licenseName=$("[data-license-photo-name]"),licenseButton=$("[data-license-photo-button]");
const vehiclePicker=$("[data-agreement-vehicle-picker]"),vehiclePickerButton=$("[data-open-agreement-vehicle-picker]"),vehicleDialog=$("[data-agreement-vehicle-dialog]"),vehicleGrid=$("[data-agreement-vehicle-grid]"),vehicleSearch=$("[data-agreement-vehicle-search]"),manualVehicle=$("[data-agreement-manual-vehicle]"),selectedVehicleImage=$("[data-agreement-vehicle-selected-image]"),selectedVehiclePlaceholder=$("[data-agreement-vehicle-placeholder]"),selectedVehicleName=$("[data-agreement-vehicle-selected-name]"),selectedVehicleMeta=$("[data-agreement-vehicle-selected-meta]");
const templateForm=$("[data-agreement-template-form]"),templateTerms=$("[data-agreement-template-terms]"),templateStatus=$("[data-agreement-template-status]");
const editor = $("[data-agreement-editor]");
const editorStatus = $("[data-agreement-editor-status]");
const scopes = {all:"All agreements", prep:"In preparation", waiting:"Awaiting signature", signed:"Signed"};
let agreementScope = "all";
const DRAFT_KEY="prestige-luxor:draft:new-agreement:v2";
const AGREEMENT_DOCUMENTS_BUCKET="rental-documents";
let agreements=[],invoices=[],quotes=[],inventory=[],current=null,events=[],publicUrl="",role="staff",template=null,loaded=false,loading=false,settingsLoaded=false,pendingLicenseFile=null,licenseObjectUrl="",licensePreviewVersion=0;

let sessionGeneration = 0;
let recordVersion = 0;
let fieldsEdited = false;
let inventoryReady = false;
const readySources = new Set();

const escapeHtml=(value)=>String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const money=(value)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(Number(value||0));
const dateTime=(value)=>value?new Date(value).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}):"To be confirmed";
const localInput=(value)=>{if(!value)return"";if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value+"T00:00";const date=new Date(value);if(Number.isNaN(date.getTime()))return String(value).length===10?`${value}T10:00`:"";date.setMinutes(date.getMinutes()-date.getTimezoneOffset());return date.toISOString().slice(0,16);};
const setStatus=(message="",tone="")=>{const target=editor.open?editorStatus:statusEl;const other=editor.open?statusEl:editorStatus;target.textContent=message;target.dataset.tone=tone;other.textContent="";};

async function token(){const{data}=await supabase.auth.getSession();if(!data.session?.access_token)throw new Error("Sign in again to use agreements.");return data.session.access_token;}
async function api(path="agreements",options={}){const response=await fetch(`/api/${path}`,{...options,headers:{Authorization:`Bearer ${await token()}`,...(options.body?{"Content-Type":"application/json"}:{}),...(options.headers||{})}});if(path.startsWith("agreement-pdf")&&response.ok)return response;const data=await response.json().catch(()=>({}));if(!response.ok){if([404,405,501].includes(response.status)&&["localhost","127.0.0.1","0.0.0.0"].includes(location.hostname))throw new Error("Agreement saving needs the full application server. Restart the preview with Vercel Dev, then try again.");const message=data.error||"Agreement request failed.";if(/agreement_templates|important_terms|access_token|signed_pdf/i.test(message)&&/schema|column|table|cache|not found/i.test(message))throw new Error("The new agreement database update is not installed yet. Run supabase/rental-agreements.sql in the Supabase SQL Editor, then refresh.");throw new Error(message);}
  if (options.method && options.method !== "GET" && path.split("?")[0] === "agreements") window.dispatchEvent(new Event("prestige:overview-changed"));
  return data;
}

function sourceRows(){if(sourceType.value==="invoice")return invoices.map(item=>({id:item.id,label:`${item.invoice_number} · ${item.customer_name} · ${item.vehicle_name}`,item}));if(sourceType.value==="quote")return quotes.map(item=>({id:item.id,label:`${item.quote_number||"Quote"} · ${[item.customer_first_name,item.customer_last_name].filter(Boolean).join(" ")} · ${item.vehicle_name}`,item}));return[];}
function populateSources(selected=""){const rows=sourceRows();if(selected&&!rows.some(row=>String(row.id)===String(selected)))rows.push({id:selected,label:"Linked rental record"});sourceSelect.disabled=sourceType.value==="manual" || sourceType.disabled;sourceSelect.innerHTML=`<option value="">${rows.length?"Select a rental record":"No records available"}</option>${rows.map(row=>`<option value="${escapeHtml(row.id)}" ${String(row.id)===String(selected)?"selected":""}>${escapeHtml(row.label)}</option>`).join("")}`;}
function latestDriver(customer={}){const email=String(customer.customer_email||customer.email||"").toLowerCase(),phone=String(customer.customer_phone||customer.phone||"").replace(/\D/g,"");return agreements.find(item=>item.license_file_path&&((email&&String(item.customer_email||"").toLowerCase()===email)||(phone&&String(item.customer_phone||"").replace(/\D/g,"")===phone)));}
function sourceValues(type,item){if(type==="invoice"){const prior=latestDriver(item)||{};return{source_type:"invoice",source_id:item.id,customer_name:item.customer_name||"",customer_phone:item.customer_phone||"",customer_email:item.customer_email||"",driver_name:item.customer_name||"",license_file_path:prior.license_file_path||"",vehicle_id:item.vehicle_id||null,vehicle_name:item.vehicle_name||"",rental_start:item.rental_start||"",rental_end:item.rental_end||"",rental_start_at:localInput(item.rental_start),rental_end_at:localInput(item.rental_end),rental_days:item.rental_days||1,daily_rate:item.daily_rate||0,quote_total:item.subtotal||Math.max(Number(item.total||0)-(item.deposit_method==="charge"?Number(item.refundable_deposit||0):0),0),refundable_deposit:item.refundable_deposit||0,mileage_allowance:item.mileage_allowance||"100 miles/day",overage_rate:Number(String(item.overage_rate||"").replace(/[^0-9.]/g,""))||0,payment_status:item.status==="paid"?"paid":item.status==="partially_paid"?"partial":"unpaid",amount_paid:item.amount_paid||0,payment_method:item.payment_method||"stripe",payment_reference:item.payment_reference||"",deposit_status:item.deposit_method==="authorization_hold"?"held":Number(item.refundable_deposit)?"charged":"not_required"};}const prior=latestDriver({email:item.customer_email,phone:item.customer_phone})||{};return{source_type:"quote",source_id:item.id,quote_id:item.id,vehicle_id:item.vehicle_id||null,customer_name:[item.customer_first_name,item.customer_last_name].filter(Boolean).join(" "),customer_phone:item.customer_phone||"",customer_email:item.customer_email||"",driver_name:[item.customer_first_name,item.customer_last_name].filter(Boolean).join(" "),license_file_path:prior.license_file_path||"",vehicle_name:item.vehicle_name||"",rental_start_at:localInput(item.start_at),rental_end_at:localInput(item.end_at),rental_start:String(item.start_at||"").slice(0,10),rental_end:String(item.end_at||"").slice(0,10),rental_days:item.duration_type==="days"?item.duration_value:1,daily_rate:item.rate_amount||0,quote_total:item.rental_total||0,refundable_deposit:item.security_deposit||0,mileage_allowance:"100 miles/day",payment_status:Number(item.deposit_paid_amount)>=Number(item.rental_total)?"paid":Number(item.deposit_paid_amount)>0?"partial":"unpaid",amount_paid:item.deposit_paid_amount||0,deposit_status:Number(item.security_deposit)?"pending":"not_required"};}
function applyValues(values){Object.entries(values||{}).forEach(([name,value])=>{if(!form.elements[name])return;form.elements[name].value=["rental_start_at","rental_end_at"].includes(name)&&value?localInput(value):value??"";});renderSummary();renderVehicleChoice();}
function applySource(){const row=sourceRows().find(item=>String(item.id)===sourceSelect.value);if(row){const values=sourceValues(sourceType.value,row.item);pendingLicenseFile=null;licenseInput.value="";applyValues(values);renderLicensePhoto(values.license_file_path||"");}}

async function payload() {
  const origin = current;
  const data = Object.fromEntries(new FormData(form));
  const start = data.rental_start_at ? new Date(data.rental_start_at) : null;
  const end = data.rental_end_at ? new Date(data.rental_end_at) : null;
  const days = start && end && end > start ? Math.max(Math.ceil((end-start)/86400000),1) : 1;
  // The visible summary contains only editable fields. Preserve financial details
  // supplied by the linked rental when a new agreement is created from it.
  const changedSource = !origin || origin.source_type !== data.source_type || String(origin.source_id || "") !== (data.source_id || "");
  let source = sourceRows().find(row => String(row.id) === data.source_id)?.item;
  if (changedSource && !source && data.source_id && ["invoice","quote"].includes(data.source_type)) {
    const table = data.source_type === "invoice" ? "invoices" : "quotes";
    const result = await supabase.from(table).select("*").eq("id",data.source_id).single();
    if (result.error || !result.data) throw new Error("The linked rental record could not be loaded. Re-select it before saving.");
    source = result.data;
  }
  const sourceData = source && changedSource ? sourceValues(data.source_type,source) : {};
  return {...sourceData,...data,id:origin?.id || undefined,rental_start_at:start?.toISOString() || null,rental_end_at:end?.toISOString() || null,
    rental_start:data.rental_start_at?.slice(0,10) || null,rental_end:data.rental_end_at?.slice(0,10) || null,
    rental_days:days,daily_rate:Number(data.quote_total || 0)/days,quote_total:Number(data.quote_total || 0),
    refundable_deposit:Number(data.refundable_deposit || 0),overage_rate:Number(data.overage_rate || 0),driver_name:data.customer_name,
    terms:origin?.terms,important_terms:origin?.important_terms,template_version:origin?.template_version};
}
async function renderLicensePhoto(path="",file=null){const version=++licensePreviewVersion;if(licenseObjectUrl){URL.revokeObjectURL(licenseObjectUrl);licenseObjectUrl="";}licensePreview.hidden=true;licenseImage.removeAttribute("src");licenseName.textContent="";licenseCard.classList.toggle("has-photo",Boolean(path||file));licenseButton.textContent=path||file?"Replace license photo":"Take license photo";if(file){licenseObjectUrl=URL.createObjectURL(file);licenseImage.src=licenseObjectUrl;licenseName.textContent=file.name||"New license photo";licensePreview.hidden=false;return;}if(!path)return;licenseName.textContent="Saved securely";const{data,error}=await supabase.storage.from(AGREEMENT_DOCUMENTS_BUCKET).createSignedUrl(path,600);if(version!==licensePreviewVersion)return;if(error){licenseName.textContent="Saved securely · preview unavailable";licensePreview.hidden=false;return;}licenseImage.src=data.signedUrl;licensePreview.hidden=false;}
async function uploadLicensePhoto(file,agreementId){if(!file)return null;if(!String(file.type||"").startsWith("image/"))throw new Error("Choose a photo of the driver's license.");if(file.size>15*1024*1024)throw new Error("The license photo must be smaller than 15 MB.");const extension=(String(file.name||"").split(".").pop()||"jpg").replace(/[^a-z0-9]/gi,"").slice(0,8)||"jpg";const path=`driver-licenses/${agreementId}/${Date.now()}-license.${extension.toLowerCase()}`;const{error}=await supabase.storage.from(AGREEMENT_DOCUMENTS_BUCKET).upload(path,file,{cacheControl:"3600",contentType:file.type||"image/jpeg",upsert:false});if(error)throw new Error(`License photo could not be saved: ${error.message}`);return path;}
function inventoryPhoto(car){const photos=[...(car?.car_photos||[])].sort((a,b)=>Number(a.position)-Number(b.position));return photos[0]?.url||car?.image_url||"";}
function inventoryPhotoUrl(car){const source=inventoryPhoto(car);if(!source?.includes("/storage/v1/object/public/"))return source;try{const url=new URL(source,location.origin);url.pathname=url.pathname.replace("/storage/v1/object/public/","/storage/v1/render/image/public/");url.searchParams.set("width","420");url.searchParams.set("height","260");url.searchParams.set("resize","cover");url.searchParams.set("quality","78");if(car.updated_at)url.searchParams.set("v",String(Date.parse(car.updated_at)||car.updated_at));return url.href;}catch{return source;}}
function selectedInventoryVehicle(){const id=String(form.elements.vehicle_id?.value||"");const name=String(form.elements.vehicle_name?.value||"").toLowerCase();return inventory.find(car=>(id&&String(car.id)===id)||(!id&&name&&String(car.name||"").toLowerCase()===name));}
function renderVehicleChoice(){if(!form?.elements.vehicle_name)return;const name=String(form.elements.vehicle_name.value||"").trim(),car=selectedInventoryVehicle(),photo=car?inventoryPhotoUrl(car):"";selectedVehicleName.textContent=name||"Choose a vehicle";selectedVehicleMeta.textContent=car?`${car.make||"Inventory"}${car.price?` · ${money(car.price)}/day`:""}`:name?"Manual or partner vehicle":"Browse your active inventory with photos";selectedVehicleImage.hidden=!photo;selectedVehiclePlaceholder.hidden=Boolean(photo);if(photo){selectedVehicleImage.src=photo;selectedVehicleImage.alt=`${car.name||name} inventory photo`;}else{selectedVehicleImage.removeAttribute("src");selectedVehicleImage.alt="";}vehiclePicker.classList.toggle("has-selection",Boolean(name));}
function renderVehicleGrid(){const query=String(vehicleSearch.value||"").trim().toLowerCase();const rows=inventory.filter(car=>[car.name,car.make,car.model,car.color].some(value=>String(value||"").toLowerCase().includes(query)));const selectedId=String(form.elements.vehicle_id?.value||"");vehicleGrid.innerHTML=rows.length?rows.map(car=>{const photo=inventoryPhotoUrl(car),active=selectedId&&String(car.id)===selectedId;return`<button class="agreement-inventory-card ${active?"selected":""}" type="button" data-agreement-vehicle-id="${escapeHtml(car.id)}" aria-pressed="${active}">${photo?`<img src="${escapeHtml(photo)}" alt="${escapeHtml(car.name)}" width="420" height="260" loading="lazy" decoding="async" />`:`<span class="agreement-inventory-no-photo">No photo</span>`}<span><small>${escapeHtml([car.make,car.color].filter(Boolean).join(" · ")||"Inventory vehicle")}</small><strong>${escapeHtml(car.name)}</strong><b>${money(car.price)}<em>/day</em></b></span></button>`;}).join(""):`<div class="agreement-vehicle-empty"><strong>No vehicles found</strong><span>Try another search or enter a partner vehicle below.</span></div>`;}
function selectAgreementVehicle(car=null,manualName=""){const name=car?.name||String(manualName||"").trim();if(!name){manualVehicle.focus();return;}fieldsEdited=true;form.elements.vehicle_id.value=car?.id||"";form.elements.vehicle_name.value=name;if(car?.mileage&&!form.elements.mileage_allowance.value)form.elements.mileage_allowance.value=car.mileage;if(car?.extra_mileage_rate&&!Number(form.elements.overage_rate.value))form.elements.overage_rate.value=car.extra_mileage_rate;renderVehicleChoice();renderSummary();if(!current)scheduleDraft(DRAFT_KEY,()=>({fields:serializeForm(form)}));vehicleDialog.close();}
const ensureInventory = singleFlight(async () => {
  if (inventoryReady) return;
  const generation = sessionGeneration;
  const result = await supabase.from("cars").select("*").eq("is_active", true).order("name");
  if (generation !== sessionGeneration) return;
  if (result.error) throw result.error;
  const rows = result.data || [];
  const byCar = new Map();
  if (rows.length) {
    const photos = await supabase.from("car_photos").select("car_id,position,url")
      .in("car_id", rows.map(car => car.id)).order("position");
    if (generation !== sessionGeneration) return;
    for (const photo of photos.data || []) {
      if (!byCar.has(photo.car_id)) byCar.set(photo.car_id, photo);
    }
    if (photos.error) setStatus("Some gallery photos are temporarily unavailable.");
  }
  inventory = rows.map(car => ({...car, car_photos: byCar.has(car.id) ? [byCar.get(car.id)] : []}));
  inventoryReady = true;
  renderVehicleChoice();
});

async function openVehiclePicker() {
  if (vehiclePickerButton.disabled) return;
  vehicleSearch.value = ""; manualVehicle.value = "";
  if (inventoryReady) renderVehicleGrid();
  else vehicleGrid.textContent = "Loading vehicles…";
  if (!vehicleDialog.open) vehicleDialog.showModal();
  requestAnimationFrame(() => vehicleSearch.focus());
  try {
    await ensureInventory();
    if (vehicleDialog.open) renderVehicleGrid();
  } catch {
    if (vehicleDialog.open) vehicleGrid.textContent = "Inventory could not load. Reopen the picker to retry, or enter a partner vehicle below.";
  }
}

async function loadSources(type) {
  if (readySources.has(type)) return;
  const generation = sessionGeneration;
  const query = type === "invoice"
    ? supabase.from("invoices").select("*").neq("status","void")
    : supabase.from("quotes").select("*");
  const {data, error} = await query.order("created_at", {ascending:false}).limit(500);
  if (generation !== sessionGeneration) return;
  if (error) throw error;
  if (type === "invoice") invoices = data || [];
  else quotes = data || [];
  readySources.add(type);
}
const sourceLoaders = {
  invoice: singleFlight(() => loadSources("invoice")),
  quote: singleFlight(() => loadSources("quote")),
};
async function prepareSources(type = sourceType.value) {
  if (sourceType.disabled || !sourceLoaders[type]) return;
  try {
    await sourceLoaders[type]();
    if (editor.open && !sourceType.disabled && sourceType.value === type) populateSources(sourceSelect.value);
  } catch {
    if (editor.open && sourceType.value === type) setStatus("Rental records could not load. Select the source again to retry.", "error");
  }
}
function renderSummary(){if(!form||form.hidden)return;const p=current&&current.status!=="draft"?current:Object.fromEntries([...form.elements].filter(el=>el.name).map(el=>[el.name,el.value]));$("[data-agreement-summary]").innerHTML=`<article><span>Renter</span><strong>${escapeHtml(p.customer_name||"Not selected")}</strong></article><article><span>Vehicle</span><strong>${escapeHtml(p.vehicle_name||"Not selected")}</strong></article><article><span>Rental dates</span><strong>${escapeHtml(dateTime(p.rental_start_at))}<small>to ${escapeHtml(dateTime(p.rental_end_at))}</small></strong></article><article><span>Rental amount</span><strong>${money(p.quote_total)}</strong></article><article><span>Security deposit</span><strong>${money(p.refundable_deposit)}</strong></article>`;}
function signingScope(item) {
  if (item.status === "cancelled") return "closed";
  if (item.signed_at || ["signed","vehicle_out","returned","completed"].includes(item.status)) return "signed";
  if (item.access_token || item.opened_at || item.sent_at) return "waiting";
  return "prep";
}
function stageLabel(item) {
  const labels = { vehicle_out:"Vehicle out", returned:"Returned", completed:"Completed", cancelled:"Cancelled", signed:"Signed" };
  return labels[item.status] || (signingScope(item) === "waiting" ? "Awaiting signature" : "Draft");
}
function renderList() {
  const query = search.value.trim().toLowerCase();
  const rows = agreements.filter(item => (agreementScope === "all" || signingScope(item) === agreementScope) &&
    [item.agreement_number,item.customer_name,compactPersonName(item.customer_name),item.vehicle_name].some(value => String(value || "").toLowerCase().includes(query)));
  list.innerHTML = rows.map(item => {
    const car = inventory.find(car => (item.vehicle_id && car.id === item.vehicle_id) || car.name?.trim().toLowerCase() === item.vehicle_name?.trim().toLowerCase());
    const photo = item.vehicle_image_url || inventoryPhotoUrl(car);
    return `<button type="button" class="ag-row" data-select-agreement="${escapeHtml(item.id)}" aria-haspopup="dialog">
      <span class="ag-car">${photo ? `<img class="ag-thumb" alt="" src="${escapeHtml(photo)}" loading="lazy">` : '<span class="ag-thumb ag-missing" aria-hidden="true">PL</span>'}
      <span><small>${escapeHtml(item.agreement_number)}</small><strong title="${escapeHtml(item.vehicle_name)}">${escapeHtml(compactVehicleName(item.vehicle_name, car) || "Vehicle pending")}</strong></span></span>
      <span class="ag-guest" title="${escapeHtml(item.customer_name)}">${escapeHtml(compactPersonName(item.customer_name))}</span><span class="ag-dates">${rentalRange(item.rental_start_at || item.rental_start,item.rental_end_at || item.rental_end)}</span>
      <span class="ag-state" data-stage="${signingScope(item)}">${stageLabel(item)}</span><span class="ag-chevron" aria-hidden="true">›</span></button>`;
  }).join("") || `<p class="bl-empty">${agreements.length ? "No agreements match this view." : "No agreements yet."}</p>`;
  kpis.innerHTML = Object.entries(scopes).map(([key,label]) => `<button type="button" data-agreement-scope="${key}" aria-pressed="${agreementScope === key}"><span>${label}</span><strong>${agreements.filter(item => key === "all" || signingScope(item) === key).length}</strong></button>`).join("");
}

function updateDocument() {
  const terms = $("[data-agreement-terms]");
  const state = current && signingScope(current);
  const step = state === "signed" ? 3 : state === "waiting" ? 2 : current ? 1 : 0;
  $("[data-agreement-progress]").innerHTML = ["Draft","Prepared","Awaiting signature","Signed"].map((text,index) =>
    `<span class="${index <= step ? "active" : ""}" ${index === step ? 'aria-current="step"' : ""}>${text}</span>`).join("");
  const body = current?.terms || "";
  const items = current?.important_terms || [];
  terms.hidden = !current || (!body && !items.length);
  if (terms.hidden) return;
  const fields = {agreement_number:current.agreement_number, customer_name:current.customer_name, vehicle:current.vehicle_name,
    start_date:dateTime(current.rental_start_at || current.rental_start), end_date:dateTime(current.rental_end_at || current.rental_end),
    rental_price:money(current.quote_total),security_deposit:money(current.refundable_deposit),mileage_allowance:current.mileage_allowance,overage_rate:money(current.overage_rate)};
  const personalize = text => escapeHtml(String(text || "").replace(/\{\{([a-z_]+)\}\}/g,(token,key)=>fields[key] ?? token));
  $("[data-agreement-terms-body]").innerHTML = `<p>${personalize(body)}</p>${items.length ? '<h4>Renter acknowledgments</h4>' : ""}${items.map(item=>`<p><b>${escapeHtml(item.title)}</b><br>${personalize(item.body)}</p>`).join("")}`;
}
function renderAudit(){audit.hidden=!current;const rows=[...events];if(current?.created_at&&!rows.some(event=>event.event_type==="created"))rows.push({event_type:"created",detail:"Agreement created.",created_at:current.created_at});auditList.innerHTML=rows.length?rows.map(event=>`<article><i></i><div><strong>${escapeHtml(event.event_type.replaceAll("_"," "))}</strong><span>${escapeHtml(event.detail||"")}</span><time>${escapeHtml(dateTime(event.created_at))}</time></div></article>`).join(""):`<p>No audit events yet.</p>`;}
function setLocked(locked){updateDocument();form.querySelectorAll("[data-agreement-editable] input,[data-agreement-editable] select").forEach(field=>field.disabled=locked);licenseCard.classList.toggle("is-locked",locked);licenseButton.setAttribute("aria-disabled",String(locked));vehiclePickerButton.disabled=locked;vehiclePicker.classList.toggle("is-locked",locked);if(locked&&vehicleDialog.open)vehicleDialog.close();saveButton.hidden=locked;deleteButton.hidden=!current||role!=="owner";deleteButton.textContent=current?.status==="draft"?"Delete draft":"Delete agreement";sendButton.hidden=!current;downloadButton.hidden=!current;downloadButton.textContent=current?.signed_pdf_path?"Download signed PDF":"Download PDF";linkCard.hidden=!current;subtitle.textContent=locked?"Signed agreements are locked. The saved PDF is the record copy.":"Review the rental summary before sending it to the renter.";}
async function openAgreement(item = null, options = {}) {
  role = document.documentElement.dataset.crmRole || role;
  if (!item && role === "viewer") return;
  const version = ++recordVersion;
  current = item; events = []; publicUrl = ""; fieldsEdited = false;
  pendingLicenseFile = null; licenseInput.value = "";
  if (!editor.open) editor.showModal();
  editorStatus.textContent = ""; editor.scrollTop = 0;
  form.hidden = false; form.reset();
  const defaults = item || options.defaults || {source_type:"invoice", mileage_allowance:"100 miles/day", quote_total:0, refundable_deposit:0};
  applyValues(defaults);
  sourceType.value = defaults.source_type || "invoice";
  populateSources(defaults.source_id || "");
  if (!item && !options.defaults) {
    const saved = draftData(DRAFT_KEY)?.fields;
    restoreForm(form, saved);
    sourceType.value = form.elements.source_type.value || "invoice";
    populateSources(saved?.find(field => field.name === "source_id")?.value || "");
    if (saved) setStatus("Your unsaved agreement draft was restored.", "success");
  }
  renderLicensePhoto(form.elements.license_file_path.value || "").catch(() => {});
  title.textContent = item?.agreement_number || "New agreement";
  badge.textContent = item ? stageLabel(item) : "Draft";
  badge.className = `invoice-status-badge ${item?.status || "draft"}`;
  const locked = role === "viewer" || Boolean(item && item.status !== "draft");
  setLocked(locked);
  sourceSelect.disabled = sourceType.value === "manual" || locked;
  form.querySelector(".agreement-missing-details").open = !item;
  renderSummary(); renderVehicleChoice(); renderList(); renderAudit();
  if (!item) prepareSources();
  if (options.detail) applyDetail(options.detail);
  else if (item) await loadDetail(item.id, version);
}

function applyDetail(data) {
  const previous = current;
  current = data.agreement;
  role = data.role || role;
  events = data.events || []; publicUrl = data.public_url || "";
  const index = agreements.findIndex(item => item.id === current.id);
  if (index < 0) agreements.unshift(current);
  else agreements[index] = current;
  // A fresh signature takes precedence. A background read of a draft must
  // leave any fields the agent has started editing intact.
  const locked = role === "viewer" || current.status !== "draft";
  if (!fieldsEdited || locked) {
    applyValues(current);
    populateSources(current.source_id || "");
    if (current.license_file_path !== previous?.license_file_path) renderLicensePhoto(current.license_file_path || "").catch(() => {});
  }
  title.textContent = current.agreement_number;
  badge.textContent = stageLabel(current);
  badge.className = `invoice-status-badge ${current.status}`;
  linkStatus.textContent = current.status === "signed" ? (current.signed_pdf_path ? "Signed PDF saved" : "Agreement signed") : current.opened_at ? "Opened by renter" : "Ready to send";
  linkCard.dataset.state = current.status;
  $("[data-agreement-link-description]").textContent = signingScope(current) === "signed"
    ? "View the completed agreement or download the record copy below." : "Share the private link so your renter can review and sign.";
  setLocked(locked);
  sourceSelect.disabled = locked || sourceType.value === "manual";
  renderAudit(); renderList();
}

async function loadDetail(id, version = recordVersion) {
  try {
    const data = await api(`agreements?id=${encodeURIComponent(id)}`);
    if (version !== recordVersion || current?.id !== id || !editor.open) return;
    if (data.agreement?.id !== id) throw new Error("Agreement not found.");
    applyDetail(data);
  } catch (error) {
    if (version === recordVersion && editor.open) setStatus(error.message, "error");
  }
}

const load = singleFlight(async function (force = false) {
  if (loaded && !force) return;
  const generation = sessionGeneration;
  loading = true;
  if (!loaded && !editor.open) setStatus("Loading agreements…");
  try {
    const data = await api();
    if (generation !== sessionGeneration) return;
    agreements = data.agreements || [];
    role = data.role || document.documentElement.dataset.crmRole || "viewer";
    loaded = true;
    if (!editor.open) setStatus("");
    renderList();
    if (!inventory.length && agreements.some(item => !item.vehicle_image_url)) {
      const covers = await supabase.from("cars").select("id,name,image_url").order("name").limit(1000);
      if (generation !== sessionGeneration) return;
      if (!inventoryReady && covers.data) { inventory = covers.data; renderList(); renderVehicleChoice(); }
    }
    if (!agreementPanel.hidden && !editor.open && role !== "viewer" && !force && draftData(DRAFT_KEY)) await openAgreement();
  } catch (error) {
    if (generation !== sessionGeneration) return;
    if (!editor.open) setStatus(error.message, "error");
  } finally { if (generation === sessionGeneration) loading = false; }
});

function beginAgreementLookup() {
  const version = ++recordVersion;
  current = null; form.hidden = true; pendingLicenseFile = null;
  if (!editor.open) editor.showModal();
  title.textContent = "Rental agreement"; badge.textContent = ""; subtitle.textContent = "";
  setStatus("Loading agreement…");
  return version;
}

async function openLinkedAgreement({id, record}) {
  if (!id) return;
  const cached = agreements.find(item => item.id === id) || (record?.id === id && record);
  if (cached) return openAgreement(cached);
  const version = beginAgreementLookup();
  try {
    const data = await api(`agreements?id=${encodeURIComponent(id)}`);
    if (version !== recordVersion || !editor.open) return;
    if (data.agreement?.id !== id) throw new Error("Agreement not found.");
    await openAgreement(data.agreement, {detail:data});
  } catch (error) {
    if (version === recordVersion && editor.open) setStatus(error.message, "error");
  }
}
async function save(event){event?.preventDefault();if(!form.reportValidity())return;if(!String(form.elements.vehicle_name.value||"").trim()){setStatus("Choose a vehicle from inventory or enter a partner vehicle.","error");openVehiclePicker();return;}const hasNewLicensePhoto=Boolean(pendingLicenseFile);try{saveButton.disabled=true;setStatus("Saving agreement and creating the private signing link…");const version=recordVersion;const body=await payload();if(recordVersion!==version||!editor.open)return;let data=await api("agreements",{method:body.id?"PATCH":"POST",body:JSON.stringify(body)});current=data.agreement;if(pendingLicenseFile){setStatus("Agreement saved. Securing the driver's license photo…");const licenseFilePath=await uploadLicensePhoto(pendingLicenseFile,current.id);data=await api("agreements",{method:"PATCH",body:JSON.stringify({id:current.id,license_file_path:licenseFilePath})});current=data.agreement;pendingLicenseFile=null;}clearDraft(DRAFT_KEY);const index=agreements.findIndex(item=>item.id===current.id);if(index===-1)agreements.unshift(current);else agreements[index]=current;await openAgreement(current);publicUrl=data.public_url||publicUrl;setStatus(hasNewLicensePhoto?"Agreement and license photo saved. The private signing link is ready.":"Agreement saved. The private signing link is ready.","success");}catch(error){setStatus(error.message,"error");}finally{saveButton.disabled=false;}}
async function send(){if(!current)return;try{sendButton.disabled=true;setStatus("Sending the agreement…");const data=await api("agreements",{method:"POST",body:JSON.stringify({action:"send",id:current.id})});publicUrl=data.public_url||publicUrl;await loadDetail(current.id);setStatus(data.delivery?.delivered?`Agreement emailed to ${current.customer_email}.`:data.delivery?.reason||"Signing link ready to copy.",data.delivery?.delivered?"success":"");}catch(error){setStatus(error.message,"error");}finally{sendButton.disabled=false;}}
async function remove(){if(!current)return;const locked=current.status!=="draft";const warning=locked?`Delete ${current.agreement_number}? This permanently removes the signed PDF and audit trail. This cannot be undone.`:`Delete draft ${current.agreement_number}? This cannot be undone.`;if(!confirm(warning))return;let confirmation="";if(locked){confirmation=prompt("Type DELETE to permanently remove this agreement:")||"";if(confirmation!=="DELETE"){setStatus("Agreement deletion cancelled.");return;}}try{deleteButton.disabled=true;await api(`agreements?id=${encodeURIComponent(current.id)}${locked?"&confirm=DELETE":""}`,{method:"DELETE"});const label=current.agreement_number;current=null;form.hidden=true;editor.close();await load(true);setStatus(`${label} deleted.`,"success");}catch(error){setStatus(error.message,"error");}finally{deleteButton.disabled=false;}}
async function download(){if(!current)return;try{const response=await api(`agreement-pdf?id=${encodeURIComponent(current.id)}`),blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=`${current.agreement_number}.pdf`;link.click();URL.revokeObjectURL(url);}catch(error){setStatus(error.message,"error");}}

function renderTemplateTerms(){templateTerms.innerHTML=(template?.important_terms||[]).map((term,index)=>`<article data-template-term data-key="${escapeHtml(term.key)}"><span>${String(index+1).padStart(2,"0")}</span><label>Term title<input name="term_title" value="${escapeHtml(term.title)}" required /></label><label>Short acknowledgment<textarea name="term_body" rows="3" required>${escapeHtml(term.body)}</textarea></label></article>`).join("");}
async function loadSettings(){if(settingsLoaded)return;try{templateStatus.textContent="Loading agreement template…";const data=await api("agreement-settings");template=data.template;templateForm.elements.title.value=template.title||"";templateForm.elements.body.value=template.body||"";renderTemplateTerms();settingsLoaded=true;templateStatus.textContent=`Template version ${template.version||1}`;}catch(error){templateStatus.textContent=error.message;templateStatus.dataset.tone="error";}}
async function saveSettings(event){event.preventDefault();if(!templateForm.reportValidity())return;const terms=[...templateTerms.querySelectorAll("[data-template-term]")].map(row=>({key:row.dataset.key,title:row.querySelector('[name="term_title"]').value,body:row.querySelector('[name="term_body"]').value}));try{const button=templateForm.querySelector('button[type="submit"]');button.disabled=true;templateStatus.textContent="Saving a new template version…";const data=await api("agreement-settings",{method:"PUT",body:JSON.stringify({title:templateForm.elements.title.value,body:templateForm.elements.body.value,important_terms:terms})});template=data.template;templateStatus.textContent=`Template version ${template.version} saved. Existing agreements were not changed.`;templateStatus.dataset.tone="success";button.disabled=false;}catch(error){templateStatus.textContent=error.message;templateStatus.dataset.tone="error";templateForm.querySelector('button[type="submit"]').disabled=false;}}

kpis.addEventListener("click",event => {
  const button = event.target.closest("[data-agreement-scope]");
  if (!button) return;
  agreementScope = button.dataset.agreementScope;
  renderList();
  kpis.querySelector('[aria-pressed="true"]').focus({preventScroll:true});
});
$("[data-close-agreement-editor]").addEventListener("click",()=>editor.close());
editor.addEventListener("close",()=>{
  recordVersion++;
  if(!current && !form.hidden) writeDraft(DRAFT_KEY,{fields:serializeForm(form)});
  current=null; publicUrl=""; form.hidden=true; pendingLicenseFile=null;
  renderLicensePhoto();
});
form.addEventListener("submit",save);form.addEventListener("input",()=>{fieldsEdited=true;renderSummary();if(!current)scheduleDraft(DRAFT_KEY,()=>({fields:serializeForm(form)}));});form.addEventListener("change",()=>{fieldsEdited=true;renderSummary();if(!current)scheduleDraft(DRAFT_KEY,()=>({fields:serializeForm(form)}));});
licenseInput.addEventListener("change",()=>{const file=licenseInput.files?.[0]||null;if(!file)return;if(!String(file.type||"").startsWith("image/")){licenseInput.value="";setStatus("Choose an image from the camera or photo library.","error");return;}if(file.size>15*1024*1024){licenseInput.value="";setStatus("The license photo must be smaller than 15 MB.","error");return;}fieldsEdited=true;pendingLicenseFile=file;renderLicensePhoto(form.elements.license_file_path.value||"",file);setStatus("License photo ready. Save the agreement to upload it privately.","success");});
vehiclePickerButton.addEventListener("click",openVehiclePicker);
vehicleSearch.addEventListener("input",renderVehicleGrid);
vehicleGrid.addEventListener("click",event=>{const button=event.target.closest("[data-agreement-vehicle-id]");if(button)selectAgreementVehicle(inventory.find(car=>String(car.id)===button.dataset.agreementVehicleId));});
$('[data-close-agreement-vehicle-picker]').addEventListener("click",()=>vehicleDialog.close());
$('[data-use-manual-agreement-vehicle]').addEventListener("click",()=>selectAgreementVehicle(null,manualVehicle.value));
manualVehicle.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();selectAgreementVehicle(null,manualVehicle.value);}});
vehicleDialog.addEventListener("click",event=>{if(event.target===vehicleDialog)vehicleDialog.close();});
sourceType.addEventListener("change",()=>{populateSources();prepareSources();});
sourceSelect.addEventListener("focus",()=>prepareSources());sourceSelect.addEventListener("change",applySource);search.addEventListener("input",renderList);
list.addEventListener("click",event=>{const button=event.target.closest("[data-select-agreement]");if(button)openAgreement(agreements.find(item=>item.id===button.dataset.selectAgreement));});
$("[data-new-agreement]").addEventListener("click",()=>openAgreement());$("[data-crm-section=agreements]").addEventListener("click",()=>load());$("[data-crm-section=settings]").addEventListener("click",loadSettings);
sendButton.addEventListener("click",send);downloadButton.addEventListener("click",download);deleteButton.addEventListener("click",remove);
$("[data-copy-agreement-link]").addEventListener("click",async()=>{if(!publicUrl)await loadDetail(current.id);await navigator.clipboard.writeText(publicUrl);setStatus("Private signing link copied.","success");});
$("[data-open-agreement-link]").addEventListener("click",async()=>{if(!publicUrl)await loadDetail(current.id);window.open(publicUrl,"_blank","noopener");});
templateForm.addEventListener("submit",saveSettings);
window.addEventListener("prestige:start-agreement", async ({detail}) => {
  const invoice = detail?.invoice;
  if (!invoice?.id) { setStatus("Save the invoice before continuing.", "error"); return; }
  const cached = agreements.find(item => item.source_type === "invoice" && item.source_id === invoice.id);
  if (cached) return openAgreement(cached);
  const version = beginAgreementLookup();
  try {
    // Check this source even when it falls outside the current register page.
    const {data,error} = await supabase.from("rental_agreements").select("*")
      .eq("source_type","invoice").eq("source_id",invoice.id).order("created_at",{ascending:false}).limit(1);
    if (version !== recordVersion || !editor.open) return;
    if (error) throw error;
    if (data?.length) return openAgreement(data[0]);
    clearDraft(DRAFT_KEY);
    invoices = [invoice, ...invoices.filter(row => row.id !== invoice.id)];
    await openAgreement(null, {defaults:sourceValues("invoice",invoice)});
    setStatus(`Invoice ${invoice.invoice_number} carried forward. Review the summary, then create the signing link.`, "success");
  } catch (error) {
    if (version === recordVersion && editor.open) setStatus(error.message, "error");
  }
});
window.addEventListener("prestige:open-agreement", event => openLinkedAgreement(event.detail || {}));
window.addEventListener("pagehide",()=>{if(!current&&!form.hidden)writeDraft(DRAFT_KEY,{fields:serializeForm(form)});});
supabase.auth.onAuthStateChange((event,session)=>{if(!session){sessionGeneration++;recordVersion++;loaded=false;loading=false;agreements=[];invoices=[];quotes=[];inventory=[];readySources.clear();inventoryReady=false;settingsLoaded=false;template=null;form.hidden=true;current=null;if(editor.open)editor.close();}else if($("[data-section-panel=agreements]")?.classList.contains("active"))load();});
const agreementPanel=$("[data-section-panel=agreements]");
// Remote signatures update the shared agreement, even when this tab stayed open.
let refreshingSignatures=false;
async function refreshRemoteSignatures(){
  if(refreshingSignatures||loading||document.hidden||agreementPanel?.hidden||!loaded||saveButton.disabled)return;
  refreshingSignatures=true;
  try{
    const data=await api();
    agreements=data.agreements||[];
    const updated=current&&agreements.find(item=>item.id===current.id);
    if(updated&&current.status==="draft"&&updated.status!=="draft"){
      await loadDetail(updated.id);
      badge.textContent=stageLabel(current);
      badge.className=`invoice-status-badge ${current.status}`;
      setStatus(current.signed_pdf_path?"Renter signed remotely. The signed PDF is saved in this CRM agreement.":"Agreement status updated.","success");
    }
    renderList();
  }catch{/* Keep the current form intact during temporary connection failures. */}
  finally{refreshingSignatures=false;}
}
window.addEventListener("focus",refreshRemoteSignatures);
document.addEventListener("visibilitychange",refreshRemoteSignatures);
window.setInterval(refreshRemoteSignatures,30000);
if(!agreementPanel?.hidden)load();
if(agreementPanel)new MutationObserver(()=>{if(!agreementPanel.hidden&&agreementPanel.classList.contains("active"))load();}).observe(agreementPanel,{attributes:true,attributeFilter:["hidden","class"]});

registerSection("agreements", load);
