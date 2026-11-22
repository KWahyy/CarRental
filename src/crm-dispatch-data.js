// Rental dates belong to the Southern California desk, including when staff travel.
const zone = 'America/Los_Angeles';
const isoDay = new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'});
const clock = new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit'});
export function deskDay(value=new Date()) {
  if(typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date=new Date(value);
  return Number.isFinite(date.getTime()) ? isoDay.format(date) : '';
}

export function deskMovements(model, findCar, parseFinance, readyIds, today=deskDay()) {
  const output=[];
  const byInvoice=new Map(model.invoices.map(invoice=>[String(invoice.id),invoice]));
  const byAgreement=new Map(model.agreements.map(item=>[String(item.id),item]));
  const byQuote=new Map(model.agreements.filter(item=>item.source_type==='quote'&&item.source_id).map(item=>[String(item.source_id),item]));
  const shadows=new Map();
  function add(record,kind,type,raw,fields) {
    if(!raw)return;
    const day=deskDay(raw);
    if(!day || day<today)return;
    const timed=String(raw).includes('T');
    output.push({...fields,kind,type,day,id:String(record.id),key:[kind,record.id,type].join('/'),
      order:timed ? new Date(raw).getTime() : Infinity,time:timed ? clock.format(new Date(raw)) : 'Time pending',
      client:record.customer_name||'Customer pending',car:findCar(record),vehicle:record.vehicle_name||record.vehicle||'Vehicle pending'});
  }
  for(const row of model.bookings) {
    const finance=parseFinance(row);
    const agreement=byAgreement.get(String(finance.agreement_id)) || byQuote.get(String(row.quote_request_id));
    if(agreement){shadows.set(String(agreement.id),row);continue;}
    if(finance.cancelled||row.payment_status==='refunded')continue;
    const fields={total:Number(row.total_amount||0),paid:Number(row.amount_paid||0),reference:'Manual booking'};
    add(row,'booking','Pickup',row.start_date,fields);
    add(row,'booking','Return',row.end_date,fields);
  }
  for(const item of model.agreements) {
    if(!['draft','signed','vehicle_out'].includes(item.status))continue;
    const invoice=item.source_type==='invoice'?byInvoice.get(String(item.source_id)):null;
    const shadow=shadows.get(String(item.id));
    const linkedMissing=item.source_type==='invoice'&&(!invoice||['void','refunded'].includes(invoice.status));
    const fields={reference:item.agreement_number||'Rental agreement',signed:Boolean(item.signed_at),agreementStatus:item.status,
      ready:item.status==='signed'&&Boolean(item.signed_at)&&readyIds.has(String(item.id)),readyKnown:readyIds.loaded!==false,
      total:linkedMissing?null:Number(invoice?.subtotal??(item.quote_total||item.rental_total||0)),
      paid:linkedMissing?null:Number(invoice?.amount_paid??shadow?.amount_paid??item.amount_paid??0),
      location:invoice?.delivery_location||'',license:Boolean(item.license_file_path),insurance:Boolean(item.insurance_file_path)};
    // Invoice receipts can include a refundable deposit. Display only the rental portion.
    if(invoice && fields.total!=null)fields.paid=Math.min(fields.total,Math.max(0,fields.paid));
    if(item.status!=='vehicle_out')add(item,'agreement','Pickup',item.rental_start_at||item.rental_start,fields);
    add(item,'agreement','Return',item.rental_end_at||item.rental_end,fields);
  }
  return output.sort((a,b)=>a.day.localeCompare(b.day)||a.order-b.order||a.type.localeCompare(b.type)||a.key.localeCompare(b.key));
}
