// Drafts exist only in this tab. Tool parameters are inserted as text, never HTML.
export function createReservationReview({document,submit,isProduction=false}){
 let active=null;
 return function prepare(draft){
  if(active?.open)return {error:'A reservation draft is already open. Ask the customer to finish or close it before preparing another.'};
  const previousFocus=document.activeElement;
  const dialog=document.createElement('dialog');dialog.className='agent-reservation';dialog.setAttribute('aria-labelledby','agent-reservation-title');
  dialog.innerHTML=`<form><header><p>Prestige Luxor <span> / Booking request</span></p><button type="button" data-close aria-label="Close reservation review">×</button><h2 id="agent-reservation-title">Your next drive.</h2><p class="agent-reservation-lead">Review the details. We’ll take care of the next step.</p></header><div class="agent-reservation-body"><section class="agent-reservation-trip" aria-label="Your selected trip"><p class="agent-section-label">01 / Your selection</p><h3 data-vehicle-name></h3><div class="agent-reservation-rate"><strong data-rate></strong><span>Starting daily rate · final total confirmed personally</span></div><dl data-summary></dl><p class="agent-reservation-notice">No payment now. Our team will contact you to confirm availability and your final total.</p></section><section class="agent-reservation-details" aria-label="Your contact details"><p class="agent-section-label">02 / Your details</p><h3>Where can we reach you?</h3><div class="agent-reservation-contact"><label>Full name<input name="name" autocomplete="name" placeholder="First and last name" maxlength="120" required></label><label>Phone number<input name="phone" type="tel" autocomplete="tel" placeholder="Your best contact number" maxlength="40" required></label><label>Email <span>(optional)</span><input name="email" type="email" autocomplete="email" placeholder="you@example.com" maxlength="254"></label></div><label class="agent-reservation-consent"><input name="reviewed" type="checkbox" required><span>I’ve reviewed my trip and would like the team to contact me.</span></label></section></div><footer><p data-status role="status" aria-live="polite"></p><div class="agent-reservation-actions"><button type="button" data-close>Cancel</button><button type="submit">Request booking <span aria-hidden="true">↗</span></button></div></footer></form>`;
  dialog.querySelector('[data-vehicle-name]').textContent=draft.vehicle.name;
  dialog.querySelector('[data-rate]').textContent=draft.vehicle.starting_daily_rate?`$${draft.vehicle.starting_daily_rate.toLocaleString('en-US')} / day`:'Rate confirmed personally';
  const dateLabel=value=>{const date=new Date(value+'T12:00:00Z');return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(date):value;};
  const summary=dialog.querySelector('[data-summary]');
  const rows=[['Pickup',dateLabel(draft.pickup_date)],['Return',dateLabel(draft.return_date)],['Delivery',draft.delivery_city],...(draft.notes?[['Your notes',draft.notes]]:[])];
  for(const [label,value] of rows){const group=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;group.append(dt,dd);summary.append(group);}
  const form=dialog.querySelector('form'),button=form.querySelector('[type="submit"]'),status=form.querySelector('[data-status]');
  if(!isProduction){button.disabled=true;status.textContent='Preview only · Sending is disabled.';}
  let sending=false,complete=false;
  const close=()=>{if(sending)return;dialog.close();};
  dialog.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',close));
  dialog.addEventListener('cancel',event=>{if(sending)event.preventDefault();});
  dialog.addEventListener('close',()=>{active=null;dialog.remove();previousFocus?.focus?.();});
  form.addEventListener('submit',async event=>{
   event.preventDefault();
   if(!event.isTrusted||!isProduction||sending||complete||!form.reportValidity())return;
   sending=true;button.disabled=true;form.setAttribute('aria-busy','true');status.textContent='Sending your request…';
   const value=name=>form.querySelector(`[name="${name}"]`).value.trim();
   try{
    await submit({source:'webmcp-reviewed-reservation',name:value('name'),phone:value('phone'),email:value('email'),vehicle:draft.vehicle.name,date:draft.pickup_date,addons:[],company:'',message:[`Return date: ${draft.return_date}`,`Delivery city or ZIP: ${draft.delivery_city}`,draft.notes].filter(Boolean).join('\n')});
    complete=true;status.textContent='Your booking request is received. Awaiting confirmation — we’ll contact you shortly to finalize your reservation.';button.textContent='Request sent';
   }catch{status.textContent='Your request could not be confirmed. Please contact the booking desk before retrying to avoid duplicate requests.';button.disabled=false;}
   finally{sending=false;form.removeAttribute('aria-busy');}
  });
  document.body.append(dialog);active=dialog;dialog.showModal();dialog.querySelector('[data-close]').focus();
  return {status:'review_required',message:'The customer review is open. Ask the customer to review the trip, enter their contact information and submit personally.',availability:'pending_team_confirmation'};
 };
}
