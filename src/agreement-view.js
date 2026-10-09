const money=(value)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(Number(value||0));
const dateTime=(value)=>value?new Date(value).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}):"To be confirmed";
const escapeHtml=(value)=>String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");

export function renderAgreementContent(document, agreement, initials={}) {
 const $=selector=>document.querySelector(selector);
function renderSummary(){const start=agreement.rental_start_at||agreement.rental_start,end=agreement.rental_end_at||agreement.rental_end;$("[data-sign-summary]").innerHTML=`<article><span>Renter</span><strong>${escapeHtml(agreement.customer_name)}</strong></article><article><span>Vehicle</span><strong>${escapeHtml(agreement.vehicle_name)}</strong></article><article><span>Rental dates</span><strong>${escapeHtml(dateTime(start))}<small>to ${escapeHtml(dateTime(end))}</small></strong></article><article><span>Rental amount</span><strong>${money(agreement.rental_total)}</strong></article><article><span>Security deposit</span><strong>${money(agreement.refundable_deposit)}</strong></article>`;}
function renderTerms(){const paragraphs=String(agreement.terms||"").split(/\n+/).filter(Boolean);$("[data-sign-terms]").innerHTML=paragraphs.map((paragraph,index)=>index===0?`<h3>${escapeHtml(paragraph)}</h3>`:/^\d+\./.test(paragraph)?`<h4>${escapeHtml(paragraph)}</h4>`:`<p>${escapeHtml(paragraph)}</p>`).join("");}
function renderInitials(){$("[data-initial-list]").innerHTML=(agreement.important_terms||[]).map((term,index)=>`<article><div><span>${String(index+1).padStart(2,"0")}</span><h3>${escapeHtml(term.title)}</h3><p>${escapeHtml(term.body)}</p></div><label>Renter initials<input type="text" inputmode="text" autocomplete="off" autocapitalize="characters" maxlength="4" value="${escapeHtml(initials[term.key]||"")}" data-initial-key="${escapeHtml(term.key)}" aria-label="Initial ${escapeHtml(term.title)}" /></label></article>`).join("");}

renderSummary();renderTerms();renderInitials();
}
