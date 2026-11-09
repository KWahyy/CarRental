// Cash-based vehicle performance. Refundable deposits and unpaid rental totals
// are not revenue. Financing principal is cash outflow, not accounting expense.
const num = v => Math.max(0, Number(v) || 0);
const day = v => v instanceof Date ? [v.getFullYear(),String(v.getMonth()+1).padStart(2,'0'),String(v.getDate()).padStart(2,'0')].join('-') : String(v||'').slice(0,10);
const stamp = v => /^\d{4}-\d{2}-\d{2}$/.test(day(v)) ? Date.parse(day(v)+'T12:00:00Z') : NaN;
const key = v => String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(?:19|20)\d{2}\b/g,'').replace(/[^a-z0-9]/g,'');
const finance = r => {try{return JSON.parse(String(r.notes||'').match(/\[PL_FINANCE\]([^\n]+)/)?.[1]||'{}');}catch{return {};}};
export const expenseLabels = {insurance:'Insurance',car_payment:'Car payments',maintenance:'Maintenance',repair:'Repairs',tires:'Tires',detail:'Detailing',fuel:'Fuel',registration:'Registration',transportation:'Delivery',parking:'Parking',tolls:'Tolls',processing:'Payment fees',other:'Other',partner:'Partner payouts'};
export function ownedFleet(model, range, now = new Date()) {
 const {cars=[],partners=[],invoices=[],invoicePayments=[],agreements=[],bookings=[],expenses=[]}=model;
 const partnerIds=new Set(partners.map(p=>String(p.car_id)));
 const owned=cars.filter(c=>c.ownership_type==='prestige'&&!partnerIds.has(String(c.id)));
 const rows=owned.map(c=>({...c,revenue:0,costs:0,cash:0,outstanding:0,bookings:0,rentedDays:0,utilization:0,breakdown:{},transactions:[],missing:[],days:new Set(),rentalIds:new Set(),costOverlap:false}));
 const byId=new Map(rows.map(r=>[String(r.id),r]));
 const start=day(range.start),end=day(range.end),elapsedEnd=day(now)<end?day(now):end;
 const inPeriod=v=>day(v)&&day(v)>=start&&day(v)<=end;
 const invoiceById=new Map(invoices.map(i=>[String(i.id),i]));
 const agreementById=new Map(agreements.map(a=>[String(a.id),a]));
 const unmatched=new Set();
 function match(id,name,ref){
  if(id) {const car=cars.find(c=>String(c.id)===String(id));if(car)return byId.get(String(car.id));}
  const found=cars.filter(c=>key(c.name)===key(name)&&key(name));
  if(found.length===1)return byId.get(String(found[0].id));
  if(ref)unmatched.add(ref);
 }
 function receipt(row,amount,date,ref) {if(row&&inPeriod(date)&&amount>0){row.revenue+=amount;row.transactions.push({kind:'income',label:'Rental payment',amount,date:day(date),ref});}}
 function cost(row,amount,category,date,ref) {if(row&&inPeriod(date)){row.costs+=amount;row.breakdown[category]=(row.breakdown[category]||0)+amount;row.transactions.push({kind:'expense',label:expenseLabels[category]||category,amount,date:day(date),ref});}}
 const paymentsByInvoice=new Map();
 for(const payment of invoicePayments){const id=String(payment.invoice_id);if(!paymentsByInvoice.has(id))paymentsByInvoice.set(id,[]);paymentsByInvoice.get(id).push(payment);}
 const paidInvoices=new Set(paymentsByInvoice.keys());
 const ledgerCategories=new Set(expenses.filter(e=>e.agreement_id).map(e=>String(e.agreement_id)+":"+e.category));
 // Chronological allocation caps rental receipts at the invoice subtotal over
 // its entire history, even when the dashboard shows only a later period.
 for(const invoice of invoices) {
  if(['void','refunded','draft'].includes(invoice.status))continue;
  const payments=(paymentsByInvoice.get(String(invoice.id))||[]).sort((a,b)=>String(a.paid_at).localeCompare(String(b.paid_at)));
  const relevant=payments.some(p=>inPeriod(p.paid_at)) || inPeriod(invoice.paid_at||invoice.updated_at) || inPeriod(invoice.rental_start||invoice.issue_date);
  const row=match(invoice.vehicle_id,invoice.vehicle_name,relevant?'invoice:'+invoice.id:null);
  let remaining=num(invoice.subtotal);
  for(const p of payments){const amount=Math.min(num(p.amount),remaining);remaining-=amount;receipt(row,amount,p.paid_at,invoice.invoice_number||invoice.id);}
  if(!paidInvoices.has(String(invoice.id)))receipt(row,Math.min(num(invoice.amount_paid),num(invoice.subtotal)),invoice.paid_at||invoice.updated_at,invoice.invoice_number||invoice.id);
  if(row&&inPeriod(invoice.rental_start||invoice.issue_date))row.outstanding+=Math.max(num(invoice.subtotal)-Math.min(num(invoice.amount_paid),num(invoice.subtotal)),0);
 }
 for(const expense of expenses) {
  if(!inPeriod(expense.expense_date))continue;
  cost(match(expense.car_id,'','expense:'+expense.id),num(expense.amount),expense.category,expense.expense_date,expense.vendor||expense.id);
 }
 function rental(row,record,id) {
  if(!row)return;
  const from=stamp(record.rental_start||record.start_date);
  let to=stamp(record.rental_end||record.end_date);
  if(to===from)to+=86400000;
  if(!Number.isFinite(from)||!Number.isFinite(to)||to<=from)return;
  if(from<=stamp(end)&&to>stamp(start))row.rentalIds.add(id);
  // Return day is excluded; same-day rentals occupy one day. Never count future days.
  for(let t=Math.max(from,stamp(start));t<to&&t<=stamp(elapsedEnd);t+=86400000)row.days.add(t);
 }
 for(const a of agreements){
  if(!['signed','vehicle_out','returned','completed'].includes(a.status))continue;
  rental(match(a.vehicle_id,a.vehicle_name),a,'agreement:'+a.id);
 }
 for(const b of bookings){
  const f=finance(b);
  if(f.cancelled||b.payment_status==='refunded')continue;
  const a=agreementById.get(String(f.agreement_id));
  const linkedInvoice=a?.source_type==='invoice'?invoiceById.get(String(a.source_id)):null;
  const date=f.payment_date||b.booked_on;
  const row=match(b.vehicle_id||a?.vehicle_id,b.vehicle||a?.vehicle_name,inPeriod(date)?'booking:'+b.id:null);
  // Linked invoice is authoritative, including legacy invoice amount_paid.
  if(!linkedInvoice)receipt(row,num(b.amount_paid),date,'Booking '+b.id);
  if(!a)rental(row,b,'booking:'+b.id);
  const costDate=f.cost_date||f.payment_date||b.booked_on;
  const categories={processing:num(f.processing_fee),transportation:num(f.delivery_cost),detail:num(f.detailing_cost),other:num(f.other_cost),partner:num(b.partner_cost)};
  for(const [category,amount] of Object.entries(categories)){
   if(!amount||!inPeriod(costDate))continue;
   // A reservation-linked ledger entry supersedes the legacy booking category.
   const explicit=a&&ledgerCategories.has(String(a.id)+":"+category);
   if(explicit){if(row)row.costOverlap=true;continue;}
   cost(row,amount,category,costDate,'Booking '+b.id);
  }
 }
 const elapsedDays=Math.max(0,Math.round((stamp(elapsedEnd)-stamp(start))/86400000)+1);
 for(const row of rows){
  row.cash=row.revenue-row.costs;row.bookings=row.rentalIds.size;row.rentedDays=row.days.size;
  row.utilization=elapsedDays?row.rentedDays/elapsedDays*100:0;
  row.missing=['insurance','car_payment'].filter(category=>!row.transactions.some(t=>t.kind==='expense'&&t.label===expenseLabels[category]));
  row.transactions.sort((a,b)=>b.date.localeCompare(a.date));delete row.days;delete row.rentalIds;
 }
 rows.sort((a,b)=>b.revenue-a.revenue||a.name.localeCompare(b.name));
 return {rows,unassigned:unmatched.size,unknownOwnership:cars.filter(c=>!c.ownership_type&&!partnerIds.has(String(c.id))).length,elapsedDays,totals:rows.reduce((t,r)=>({revenue:t.revenue+r.revenue,costs:t.costs+r.costs,cash:t.cash+r.cash,bookings:t.bookings+r.bookings}),{revenue:0,costs:0,cash:0,bookings:0})};
}
