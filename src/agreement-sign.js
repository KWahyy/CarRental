import { renderAgreementContent } from './agreement-view.js';
const params=new URLSearchParams(location.search),token=params.get("token")||"";
const $=(selector)=>document.querySelector(selector);
const loading=$("[data-sign-loading]"),app=$("[data-sign-app]"),errorView=$("[data-sign-error]"),status=$("[data-sign-status]");
const canvas=$("[data-public-signature]"),ctx=canvas.getContext("2d");
let agreement=null,step=0,drawing=false,hasInk=false,initials={},consents={};
const money=(value)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(Number(value||0));
const dateTime=(value)=>value?new Date(value).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}):"To be confirmed";
const escapeHtml=(value)=>String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
// The private agreement token authorizes the renter; no staff login is needed.
async function authHeaders(extra={}){return extra;}

function setStatus(message="",tone=""){status.textContent=message;status.dataset.tone=tone;}
function clearSignature(){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle="#090909";ctx.lineWidth=5;ctx.lineCap="round";ctx.lineJoin="round";hasInk=false;}
function pointerPosition(event){const rect=canvas.getBoundingClientRect();return{x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height};}

function showStep(next){step=Math.max(0,Math.min(next,4));document.querySelectorAll("[data-sign-step]").forEach(node=>node.hidden=Number(node.dataset.signStep)!==step);document.querySelectorAll("[data-sign-progress] li").forEach((node,index)=>{node.classList.toggle("active",index===step);node.classList.toggle("done",index<step);});$("[data-sign-back]").hidden=step===0||step===4;$("[data-sign-next]").hidden=step>=3;$("[data-sign-submit]").hidden=step!==3;$("[data-sign-actions]").hidden=step===4;setStatus("");window.scrollTo({top:0,behavior:"smooth"});}
function validateStep(){if(step===1){const missing=(agreement.important_terms||[]).filter(term=>!String(initials[term.key]||"").trim());if(missing.length){setStatus(`Initial all ${agreement.important_terms.length} important terms to continue.`,"error");document.querySelector(`[data-initial-key="${CSS.escape(missing[0].key)}"]`)?.focus();return false;}}if(step===2&&(!consents.reviewed||!consents.electronic||!consents.intent)){setStatus("Check all three consent statements to continue.","error");return false;}return true;}

async function load(){if(!token){showError("The secure agreement token is missing.");return;}try{const response=await fetch(`/api/agreements-public?token=${encodeURIComponent(token)}`,{headers:await authHeaders()}),data=await response.json();if(!response.ok)throw new Error(data.error||"Agreement unavailable.");agreement=data.agreement;loading.hidden=true;app.hidden=false;$("[data-sign-number]").textContent=agreement.agreement_number;initials={...(agreement.initials||{})};renderAgreementContent(document,agreement,initials);$("[data-printed-name]").value=agreement.customer_name||"";$("[data-sign-date]").textContent=`Date: ${new Date().toLocaleDateString("en-US")}`;$("[data-public-download]").href=`/api/agreements-public?token=${encodeURIComponent(token)}&document=1`;clearSignature();if(agreement.status==="signed")showStep(4);else showStep(0);}catch(error){showError(error.message);}}
function showError(message){loading.hidden=true;app.hidden=true;errorView.hidden=false;$("[data-sign-error-message]").textContent=message;}

$("[data-initial-list]").addEventListener("input",event=>{if(!event.target.matches("[data-initial-key]"))return;event.target.value=event.target.value.toUpperCase().replace(/[^A-Z]/g,"");initials[event.target.dataset.initialKey]=event.target.value;});
document.querySelectorAll("[data-consent]").forEach(input=>input.addEventListener("change",()=>{consents[input.dataset.consent]=input.checked;}));
$("[data-sign-next]").addEventListener("click",()=>{if(validateStep())showStep(step+1);});
$("[data-sign-back]").addEventListener("click",()=>showStep(step-1));
$("[data-clear-public-signature]").addEventListener("click",clearSignature);
$("[data-public-download]").addEventListener("click",async event=>{event.preventDefault();try{const response=await fetch(`/api/agreements-public?token=${encodeURIComponent(token)}&document=1`,{headers:await authHeaders()});if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||"The signed agreement PDF is unavailable.");}const url=URL.createObjectURL(await response.blob()),link=document.createElement("a");link.href=url;link.download=`${agreement?.agreement_number||"rental-agreement"}.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){setStatus(error.message,"error");}});
canvas.addEventListener("pointerdown",event=>{drawing=true;hasInk=true;canvas.setPointerCapture(event.pointerId);const point=pointerPosition(event);ctx.beginPath();ctx.moveTo(point.x,point.y);});
canvas.addEventListener("pointermove",event=>{if(!drawing)return;const point=pointerPosition(event);ctx.lineTo(point.x,point.y);ctx.stroke();});
canvas.addEventListener("pointerup",()=>drawing=false);canvas.addEventListener("pointercancel",()=>drawing=false);
$("[data-sign-submit]").addEventListener("click",async()=>{const printed=$("[data-printed-name]").value.trim();if(!printed){setStatus("Enter the renter’s printed name.","error");$("[data-printed-name]").focus();return;}if(!hasInk){setStatus("Draw the renter’s signature before signing.","error");return;}const button=$("[data-sign-submit]");try{button.disabled=true;button.textContent="Saving signed agreement…";setStatus("Creating and securely saving the signed PDF…");const response=await fetch("/api/agreements-public",{method:"POST",headers:await authHeaders({"Content-Type":"application/json"}),body:JSON.stringify({token,printed_name:printed,signature_data:canvas.toDataURL("image/png"),initials,consents})}),data=await response.json();if(!response.ok)throw new Error(data.error||"The agreement could not be signed.");agreement=data.agreement;showStep(4);}catch(error){setStatus(error.message,"error");}finally{button.disabled=false;button.textContent="Sign agreement";}});
const serverState=JSON.parse(document.getElementById('private-page-state')?.textContent || 'null');
if(serverState?.agreement){agreement=serverState.agreement;initials={...(agreement.initials||{})};step=agreement.status==='signed'?4:0;clearSignature();}
else if(!serverState)load();
