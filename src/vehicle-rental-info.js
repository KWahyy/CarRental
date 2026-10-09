const escape = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
export function vehicleRentalInfoMarkup(car) {
  const taggedRate = (low, high) => {
    const match = (car.tags || []).map(tag => String(tag).match(/^\$([\d,]+)(?:\.00)?\s+(\d+)\s*[–—-]\s*(\d+)\s*days?/i)).find(m => m && Number(m[2]) === low && Number(m[3]) === high);
    return match ? money(Number(match[1].replaceAll(',',''))) + '/day' : 'Confirm rate';
  };
  const rows = [
    ['Price per 1–2 days', Number(car.price)>0 ? money(Number(car.price))+'/day' : 'Confirm rate'],
    ['Price per 3–5 days', taggedRate(3,5)],
    ['Price per 6–7 days', taggedRate(6,7)],
    ['Price for 8+ days', 'Contact us'],
    ['Included mileage', car.mileage || 'Confirm with concierge'],
    ['Additional mileage', '$5/mile'],
    ['Security deposit', 'From $1,000'],
  ];
  const terms = [
    ['18+ years','Minimum age; vehicle approval required'],
    ['2 documents',"Valid driver’s license and full-coverage insurance"],
    ['1 year','Minimum driving experience'],
    ['From $1,000','Security deposit; exact hold and release terms confirmed before payment'],
  ];
  return `<div class="vehicle-rental-info-column"><p class="eyebrow">Plan your rental</p><h2>Rental info</h2><dl>${rows.map(([label,value])=>`<div><dt>${escape(label)}</dt><dd>${/Confirm rate|Contact us|Confirm with concierge/.test(value)?`<a href="#vehicle-request">${escape(value)} <span aria-hidden="true">↗</span></a>`:escape(value)}</dd></div>`).join('')}</dl><p class="vehicle-rental-footnote">Standard rates shown. Multi-day pricing, available offers, delivery and final terms are confirmed before your reservation is finalized.</p></div>
  <div class="vehicle-rental-terms-column"><p class="eyebrow">Before you book</p><h2>Rental terms</h2><p class="vehicle-rental-intro">Your concierge will confirm the requirements for your selected vehicle and dates.</p><div class="vehicle-rental-terms-grid">${terms.map(([title,description])=>`<div><h3>${escape(title)}</h3><p>${escape(description)}</p></div>`).join('')}</div></div>`;
}
