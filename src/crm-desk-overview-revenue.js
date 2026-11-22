import {ownedFleet} from "./owned-fleet.js";

const dayMillis = 86400000;
const calendar = new Intl.DateTimeFormat("en-CA", {timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"});
export function businessDay(value = new Date()) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return value && Number.isFinite(date.valueOf()) ? calendar.format(date) : "";
}
const shortDate = new Intl.DateTimeFormat("en-US",{timeZone:"UTC",month:"short",day:"numeric"});
const dayIndex = iso => Date.parse(iso+"T00:00:00Z") / dayMillis;
const dayString = n => new Date(n * dayMillis).toISOString().slice(0,10);
export const dollars = new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:0,maximumFractionDigits:2});
const money = value => dollars.format(value);
const compact = new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",notation:"compact",maximumFractionDigits:1});

export function bindRevenue(root, {model,ledger,balance,error,period,onPeriod,onDetail}) {
  const select = root.querySelector("[data-desk-cash-period]");
  if (!select) return;
  let points, start, end, selected;
  const el = selector => root.querySelector(selector);
  select.value = period;
  const render = () => {
    onPeriod(select.value);
    const today = businessDay();
    end = dayIndex(today);
    start = select.value === "week" ? end - 6 : dayIndex(today.slice(0,7)+"-01");
    const range = {start:dayString(start),end:today};
    const daily = new Map();
    for (const row of ledger) {
      const day = businessDay(row.date);
      if (day >= range.start && day <= today) daily.set(day, (daily.get(day)||0) + row.amount);
    }
    let total = 0;
    points = [...daily.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([date,amount]) => ({date,day:dayIndex(date),amount,total:total+=amount}));
    el("#rv-total").textContent = error ? "—" : money(total);
    el(".rv-reading").hidden = error || !points.length;
    const owned = error ? null : ownedFleet(model,range).totals;
    const details = el(".rv-details");
    details.hidden = Boolean(error);
    details.querySelector("[data-open-balances]").textContent = money(balance);
    details.querySelector("[data-owned-retained]").textContent = owned ? money(owned.cash) : "—";
    details.querySelector("[data-desk-cash-detail]").onclick = () => onDetail({total,balance,owned,from:range.start,through:today});
    const chart = el("#rv-chart");
    if (error || !points.length) {
      chart.innerHTML = error ? '<p class="rv-empty">Financial records could not be loaded. <button type="button" class="desk-link" data-owned-refresh>Retry</button></p>' : '<p class="rv-empty">No rental payments recorded in this period.</p>';
      return;
    }
    const magnitude = 10 ** Math.floor(Math.log10(total / 2));
    const half = [1,2,2.5,4,5,8,10].find(n=>n*magnitude >= total/2) * magnitude;
    const ceiling = 2*half, span = Math.max(1,end-start);
    const x = day => (day-start)/span*100;
    const y = amount => 100-100*amount/ceiling;
    const line = "M0 100 "+points.map(p=>'H'+x(p.day)+' V'+y(p.total)).join(' ')+' H100';
    const dates = [...new Set([0,1,2,3].map(n=>Math.round(start+(end-start)*n/3)))];
    chart.innerHTML = `<div class="rv-graph"><div class="rv-axis" aria-hidden="true"><span>${compact.format(ceiling)}</span><span>${compact.format(half)}</span><span>$0</span></div>
      <div class="rv-plot" role="slider" tabindex="0" aria-label="Cumulative rental cash by payment date" aria-valuemin="1" aria-valuemax="${points.length}" aria-describedby="rv-instructions"><div class="rv-ink" aria-hidden="true"><div class="rv-gridlines"></div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="desk-cash-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#b38c52" stop-opacity=".29"/><stop offset="1" stop-color="#b38c52" stop-opacity=".035"/></linearGradient></defs>
      <path d="${line} V100 Z" fill="url(#desk-cash-fill)"/><path d="${line}" fill="none" stroke="var(--rv-bronze)" vector-effect="non-scaling-stroke" stroke-width="2"/></svg>
      ${points.map((p,i)=>`<i class="rv-point" data-rv-point="${i}" style="left:${x(p.day)}%;top:${y(p.total)}%"></i>`).join("")}
      </div></div><div class="rv-dates" aria-hidden="true">${dates.map(d=>`<span style="left:${x(d)}%">${shortDate.format(d*dayMillis)}</span>`).join("")}</div></div>
      <p class="sr" id="rv-instructions">Use the arrow keys to inspect payment dates.</p>`;
    inspect(points.length-1);
  };
  const inspect = index => {
    selected = index;
    const p = points[index], label = shortDate.format(p.day*dayMillis);
    el("#rv-date").textContent = label+" · "+money(p.amount)+" received";
    el("#rv-cumulative").textContent = money(p.total)+" to date";
    const plot = el(".rv-plot");
    plot.setAttribute("aria-valuenow", index+1);
    plot.setAttribute("aria-valuetext", label+", "+money(p.amount)+" received, "+money(p.total)+" to date");
    plot.querySelector("[aria-current]")?.removeAttribute("aria-current");
    plot.querySelector('[data-rv-point="'+index+'"]').setAttribute("aria-current","true");
  };
  const pointAtPointer = event => {
    const plot = event.target.closest(".rv-plot");
    if (!plot) return;
    const box = plot.getBoundingClientRect();
    const day = start+(end-start)*(event.clientX-box.left)/box.width;
    inspect(points.reduce((best,p,i)=>Math.abs(day-p.day)<Math.abs(day-points[best].day)?i:best,0));
  };
  const chart = el("#rv-chart");
  chart.onpointerdown = event => {
    if (!event.target.closest(".rv-plot")) return;
    if (event.pointerType !== "mouse") event.target.closest(".rv-plot").setPointerCapture(event.pointerId);
    pointAtPointer(event);
  };
  chart.onpointermove = event => { if (event.pointerType==="mouse" || event.buttons) pointAtPointer(event); };
  chart.onkeydown = event => {
    if (!event.target.matches(".rv-plot")) return;
    const next = {Home:0,End:points.length-1,ArrowLeft:selected-1,ArrowDown:selected-1,ArrowRight:selected+1,ArrowUp:selected+1}[event.key];
    if (next === undefined) return;
    event.preventDefault();
    inspect(Math.max(0,Math.min(points.length-1,next)));
  };
  select.onchange = render;
  render();
}

export function revenuePanel() {
  return `<section id="revenue" aria-labelledby="desk-revenue-heading"><div class="rv-header"><h2 id="desk-revenue-heading">Revenue</h2>
    <label class="rv-picker"><span class="sr">Revenue period</span><select data-desk-cash-period><option value="month">This month</option><option value="week">Last 7 days</option></select></label></div>
    <div class="rv-summary"><div><span class="rv-label">Cash collected</span><strong id="rv-total"></strong></div>
    <div class="rv-reading" aria-hidden="true"><span id="rv-date"></span><strong id="rv-cumulative"></strong></div></div>
    <div id="rv-chart"></div><div class="rv-details"><dl><div class="rv-metric"><dt>Open rental balances</dt><dd data-open-balances></dd></div><div class="rv-metric"><dt>Owned-car cash retained</dt><dd data-owned-retained></dd></div></dl>
    <button type="button" class="rv-breakdown" data-desk-cash-detail>Cash breakdown <span aria-hidden="true">→</span></button></div></section>`;
}
