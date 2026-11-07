import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const printable = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E\n]/g, ' ');
const money = value => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD'}).format(Number(value) || 0);
const date = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('en-US', {timeZone:'America/Los_Angeles',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}) : 'To be confirmed';
export const quotePdfFilename = quote => `${String(quote.quote_number || 'Prestige-Luxor-Quote').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,80)}.pdf`;

// Only explicitly selected customer-facing fields are included. Never serialize the record.
export async function createQuotePdf(q) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Prestige Luxor | ${printable(q.quote_number || 'Rental quote')}`);
  doc.setAuthor('Prestige Luxor');
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const ink = rgb(.14,.14,.13), muted = rgb(.39,.38,.35), gold = rgb(.51,.44,.31);
  let page, y;
  function newPage() {
    page = doc.addPage([612,792]); y = 642;
    page.drawRectangle({x:0,y:680,width:612,height:112,color:rgb(.96,.95,.92)});
    page.drawText('Prestige Luxor.',{x:44,y:733,size:27,font:serif,color:ink});
    page.drawText('PRIVATE RENTAL QUOTE',{x:44,y:708,size:9,font:bold,color:gold});
    page.drawText(printable(q.quote_number || 'Quote'),{x:410,y:735,size:12,font:bold,color:ink});
    page.drawText(`Revision ${Number(q.revision)||1} | ${printable(q.status || 'draft').toUpperCase()}`,{x:410,y:716,size:9,font:regular,color:muted});
  }
  function ensure(h) { if (y-h < 70) newPage(); }
  function wrap(value,width,size,font) {
    const lines=[];
    for(const paragraph of printable(value).split('\n')) {
      let line='';
      for(const word of paragraph.split(/\s+/)) {
        const candidate=line ? `${line} ${word}` : word;
        if(font.widthOfTextAtSize(candidate,size)<=width){line=candidate;continue;}
        if(line){lines.push(line);line='';}
        for(const char of word){
          if(font.widthOfTextAtSize(line+char,size)>width){lines.push(line);line='';}
          line+=char;
        }
      }
      lines.push(line);
    }
    return lines;
  }
  function text(value,{size=11,font=regular,color=ink,width=524}={}) {
    for(const line of wrap(value,width,size,font)) {ensure(size+8);page.drawText(line,{x:44,y,size,font,color});y-=size+6;}
  }
  function section(label){ensure(55);y-=14;text(label.toUpperCase(),{size:9,font:bold,color:gold});y-=7;}
  function row(label,value,emphasis=false) {
    const lines=wrap(label,370,10,regular);ensure(lines.length*15+13);
    const top=y;
    for(const line of lines){page.drawText(line,{x:44,y,size:10,font:regular,color:muted});y-=15;}
    const v=printable(value), font=emphasis?bold:regular;
    page.drawText(v,{x:568-font.widthOfTextAtSize(v,11),y:top,size:11,font,color:ink});
    y-=7;
  }
  newPage();
  text([q.customer_first_name,q.customer_last_name].filter(Boolean).join(' ') || 'Your rental quote',{size:22,font:serif});
  if(q.customer_company)text(q.customer_company,{color:muted});
  if(q.customer_email)text(q.customer_email,{size:10,color:muted});
  if(q.customer_phone)text(q.customer_phone,{size:10,color:muted});
  section('Your drive');
  text(q.vehicle_name || 'Vehicle to be confirmed',{size:15,font:bold});
  text(`Pickup: ${date(q.start_at)}`,{size:10});
  text(`Return: ${date(q.end_at)}`,{size:10});
  text('Times shown in Pacific Time.',{size:8,color:muted});
  if(q.expires_at)text(`Quote valid until: ${date(q.expires_at)}`,{size:10});
  section('Rental pricing');
  const units=Number(q.duration_value)||1;
  const base=(Number(q.rate_amount)||0)*(q.rate_type==='flat'?1:units);
  row(q.rate_type==='flat'?'Rental - flat rate':`Rental - ${units} ${q.rate_type==='hourly'?(units===1?'hour':'hours'):(units===1?'day':'days')} at ${money(q.rate_amount)}`,money(base));
  for(const item of (Array.isArray(q.line_items)?q.line_items:[])) row(item.description || 'Additional charge',money(item.amount ?? Number(item.quantity)*Number(item.rate)));
  row('Subtotal',money(q.subtotal ?? q.rental_subtotal ?? base));
  if(Number(q.discount_amount))row(q.discount_label || 'Discount',`-${money(q.discount_amount)}`);
  if(Number(q.tax_amount))row('Tax',money(q.tax_amount));
  row('Rental total',money(q.rental_total),true);
  row('Reservation payment required',money(q.amount_required));
  row('Reservation payment received',money(q.deposit_paid_amount));
  row('Remaining rental balance',money(q.remaining_balance ?? Math.max(0,Number(q.rental_total||0)-Number(q.deposit_paid_amount||0))),true);
  row('Refundable security deposit (separate from rental total)',money(q.security_deposit),true);
  if(q.customer_message){section('A note for you');text(q.customer_message,{size:10});}
  section('Next steps');
  text('Contact your Prestige Luxor representative to proceed. This quote is not a confirmed reservation. Your vehicle and final arrangements require confirmation from our team.',{size:10,color:muted});
  for(const [i,p] of doc.getPages().entries()) {
    p.drawLine({start:{x:44,y:48},end:{x:568,y:48},thickness:.5,color:rgb(.82,.80,.76)});
    p.drawText('prestigeluxor.com  |  contact@prestigeluxor.com  |  (949) 620-0024',{x:44,y:32,size:8,font:regular,color:muted});
    p.drawText(`${i+1} / ${doc.getPageCount()}`,{x:540,y:32,size:8,font:regular,color:muted});
  }
  return Buffer.from(await doc.save());
}
