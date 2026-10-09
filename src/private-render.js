import {parseHTML} from 'linkedom';
import {quoteMarkup} from './quote-view.js';
import {renderAgreementContent} from './agreement-view.js';
const escape=value=>String(value||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function renderPrivateDocument(html,page,data={}) {
 const {document:d}=parseHTML(html),$=selector=>d.querySelector(selector);
 if(page==='quote')$('[data-public-quote]').innerHTML=data.quote?quoteMarkup(data.quote):`<section class="public-quote-error"><p class="eyebrow">Prestige Luxor</p><h1>Quote unavailable</h1><p>${escape(data.error||'The secure quote token is missing.')}</p><a href="tel:+19496200024">Call concierge · (949) 620-0024</a></section>`;
 else {
  $('[data-sign-loading]').hidden=true;
  $('[data-sign-app]').hidden=!data.agreement;
  $('[data-sign-error]').hidden=Boolean(data.agreement);
  if(data.agreement){
   const a=data.agreement,step=a.status==='signed'?4:0;
   renderAgreementContent(d,a,a.initials||{});
   $('[data-sign-number]').textContent=a.agreement_number;
   $('[data-printed-name]').setAttribute('value',a.customer_name||'');
   $('[data-sign-date]').textContent='Date: '+new Date().toLocaleDateString('en-US',{timeZone:'America/Los_Angeles'});
   d.querySelectorAll('[data-sign-step]').forEach(n=>n.hidden=Number(n.dataset.signStep)!==step);
   d.querySelectorAll('[data-sign-progress] li').forEach((n,i)=>{n.classList.toggle('active',i===step);n.classList.toggle('done',i<step);});
   $('[data-sign-back]').hidden=true;$('[data-sign-next]').hidden=step===4;$('[data-sign-submit]').hidden=true;$('[data-sign-actions]').hidden=step===4;
  }else $('[data-sign-error-message]').textContent=data.error||'The secure agreement token is missing.';
 }
 let state=$('#private-page-state');if(!state){state=d.createElement('script');state.id='private-page-state';state.type='application/json';d.head.append(state);}
 state.textContent=JSON.stringify(data).replaceAll('<','\\u003c');
 return '<!doctype html>\n'+d.documentElement.outerHTML;
}
