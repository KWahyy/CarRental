import assert from "node:assert/strict";
import test from "node:test";
import { newportCounts } from "../src/newport-funnel.js";

test("attributes paid EVO requests once across CRM paths and ignores other vehicles and unpaid requests", () => {
  const slug = "2022-lamborghini-huracan";
  const car = {id:"blue", name:"2022 Lamborghini Huracan", slug};
  const request = (id, vehicle=slug, click="c") => ({id,page_url:`https://www.prestigeluxor.com/booking?vehicle=${vehicle}&newport_evo_click=${click}`});
  const funnel = {
    clicks:["c","d"].map(id => ({id,session_id:"one",created_at:"2026-11-22T12:00:00Z"})),
    requests:[request("manual"),request("converted"),request("invoice"),request("open"),request("refunded"),request("changed"),request("other","another-car"),request("unknown",slug,"absent")],
    quotes:[{id:"q",lead_id:"converted",vehicle_id:"blue"}]
  };
  const invoice = (source_id,extra={}) => ({source_type:"quote",source_id,vehicle_name:car.name,amount_paid:500,status:"partially_paid",...extra});
  const model = {cars:[car],bookings:[{id:"b",quote_request_id:"manual",vehicle:car.name,amount_paid:300}],
    invoices:[invoice("manual"),invoice("q",{quote_id:"q"}),invoice("invoice"),invoice("open",{amount_paid:0}),invoice("refunded",{status:"refunded"}),invoice("changed",{vehicle_name:"2020 Lamborghini Huracan"}),invoice("unknown")]};
  assert.deepEqual(newportCounts(funnel,model,{start:new Date("2026-11-01"),end:new Date("2026-12-01")}),[2,1,6,3]);
});
