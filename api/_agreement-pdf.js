import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { BUSINESS } from "./_invoice-core.js";

const black = rgb(.04,.04,.04), gold = rgb(.84,.70,.38), gray = rgb(.38,.38,.38), pale = rgb(.95,.94,.91);
const dollars = (v) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(v || 0));
const date = (v) => v ? new Date(`${v}T12:00:00`).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }) : "—";

function wrap(text, font, size, width) {
  const lines=[]; let line="";
  for (const word of String(text||"").split(/\s+/)) { const next=line?`${line} ${word}`:word; if (line && font.widthOfTextAtSize(next,size)>width) { lines.push(line); line=word; } else line=next; }
  if(line) lines.push(line); return lines;
}

export async function createAgreementPdf(a) {
  const pdf=await PDFDocument.create(), regular=await pdf.embedFont(StandardFonts.Helvetica), bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  let page, y; const W=612,H=792;
  const addPage=(title="RENTAL AGREEMENT")=>{ page=pdf.addPage([W,H]); page.drawRectangle({x:0,y:H-92,width:W,height:92,color:black}); page.drawText(BUSINESS.name,{x:40,y:H-52,size:22,font:bold,color:rgb(1,1,1)}); page.drawText(title,{x:405,y:H-48,size:10,font:bold,color:gold}); page.drawText(a.agreement_number||"DRAFT",{x:405,y:H-69,size:14,font:bold,color:rgb(1,1,1)}); y=H-126; };
  const heading=(text)=>{ if(y<100)addPage("AGREEMENT CONTINUED"); page.drawText(text,{x:40,y,size:8,font:bold,color:gold}); y-=17; };
  const row=(label,value,x=40,w=250)=>{ page.drawText(label.toUpperCase(),{x,y,size:6.8,font:bold,color:gray}); page.drawText(String(value||"—"),{x,y:y-15,size:9.5,font:regular,color:black,maxWidth:w}); };
  const rule=()=>{y-=37;page.drawLine({start:{x:40,y},end:{x:572,y},thickness:.5,color:rgb(.82,.82,.82)});y-=18;};
  addPage();
  heading("CUSTOMER & DRIVER"); row("Customer",a.customer_name); row("Phone / Email",`${a.customer_phone||"—"}  ${a.customer_email||""}`,320,250); rule();
  row("Approved driver",a.driver_name||a.customer_name); row("License",`${a.license_state||""} ${a.license_number||"—"} · Exp ${date(a.license_expiration)}`,320,250); rule();
  row("Insurance",`${a.insurance_provider||"—"} · ${a.policy_number||""}`); row("Insurance expiration",date(a.insurance_expiration),320); rule();
  heading("VEHICLE & RENTAL"); page.drawRectangle({x:40,y:y-48,width:532,height:60,color:pale}); page.drawText(a.vehicle_name||"Vehicle",{x:54,y:y-18,size:16,font:bold,color:black}); page.drawText(`${a.vehicle_plate?`Plate ${a.vehicle_plate}`:""}${a.vehicle_vin?`  ·  VIN ${a.vehicle_vin}`:""}`,{x:54,y:y-38,size:8,font:regular,color:gray}); y-=80;
  row("Rental dates",`${date(a.rental_start)} – ${date(a.rental_end)} (${a.rental_days||1} days)`); row("Rate / rental total",`${dollars(a.daily_rate)} / day · ${dollars(a.rental_total)}`,320); rule();
  row("Mileage",`${a.mileage_allowance||"—"} · ${dollars(a.overage_rate)}/extra mile`); row("Refundable deposit",`${dollars(a.refundable_deposit)} · ${String(a.deposit_status||"pending").replaceAll("_"," ")}`,320); rule();
  heading("TERMS"); const terms=wrap(a.terms,regular,8,532); for(const line of terms){ if(y<76)addPage("AGREEMENT CONTINUED"); page.drawText(line,{x:40,y,size:8,font:regular,color:gray}); y-=11; }
  y-=18; if(y<180)addPage("SIGNATURE"); heading("CUSTOMER ACKNOWLEDGEMENT"); page.drawText(`Signed by ${a.signature_name||"Not yet signed"}`,{x:40,y,size:10,font:bold,color:black}); page.drawText(a.signed_at?new Date(a.signed_at).toLocaleString("en-US"):"Signature pending",{x:360,y,size:8,font:regular,color:gray}); y-=68;
  if(a.signature_data?.startsWith("data:image/png;base64,")){ try{const image=await pdf.embedPng(Buffer.from(a.signature_data.split(",")[1],"base64")); const scale=Math.min(220/image.width,70/image.height); page.drawImage(image,{x:40,y:y-10,width:image.width*scale,height:image.height*scale});}catch{} }
  addPage("VEHICLE HANDOFF"); heading("PICKUP CONDITION"); row("Mileage",a.pickup_mileage?.toLocaleString?.()||a.pickup_mileage); row("Fuel",a.pickup_fuel,320); rule();
  for(const line of wrap(a.pickup_notes||"No pickup notes recorded.",regular,8,532).slice(0,8)){page.drawText(line,{x:40,y,size:8,font:regular,color:gray});y-=11;} y-=20;
  heading("RETURN CONDITION"); row("Mileage",a.return_mileage?.toLocaleString?.()||a.return_mileage); row("Fuel",a.return_fuel,320); rule();
  for(const line of wrap(a.return_notes||"Vehicle has not been returned.",regular,8,532).slice(0,8)){page.drawText(line,{x:40,y,size:8,font:regular,color:gray});y-=11;} y-=20;
  heading("RETURN CHARGES & DEPOSIT"); const charges=[["Mileage",a.mileage_charge],["Fuel",a.fuel_charge],["Tolls",a.tolls_charge],["Damage",a.damage_charge],[a.other_charge_label||"Other",a.other_charge]]; for(const [label,val] of charges){page.drawText(label,{x:40,y,size:9,font:regular,color:black});page.drawText(dollars(val),{x:485,y,size:9,font:bold,color:black});y-=20;} y-=6;
  page.drawRectangle({x:40,y:y-48,width:532,height:60,color:pale}); page.drawText("DEPOSIT RESOLUTION",{x:54,y:y-16,size:7,font:bold,color:gold}); page.drawText(`${String(a.deposit_status||"pending").replaceAll("_"," ").toUpperCase()} · Deduction ${dollars(a.deposit_deduction)}`,{x:54,y:y-37,size:12,font:bold,color:black});
  for(const p of pdf.getPages()){p.drawText(`${BUSINESS.address}  ·  ${BUSINESS.phone}  ·  ${BUSINESS.email}`,{x:40,y:24,size:7,font:regular,color:gray});}
  return pdf.save();
}
