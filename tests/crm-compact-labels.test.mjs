import assert from "node:assert/strict";
import test from "node:test";
import {compactPersonName, compactVehicleName} from "../src/crm-compact-labels.js";

test("compact customer labels use the first name and surname initial", () => {
  assert.equal(compactPersonName("Jane Smith"), "Jane S.");
  assert.equal(compactPersonName("  MATTHEW   IAN MUNOZ "), "Matthew M.");
  assert.equal(compactPersonName("Jean-Luc O’Brien Jr."), "Jean-Luc O.");
  assert.equal(compactPersonName("Ana María de León", {firstName:"Ana María", lastName:"de León"}), "Ana María D.");
  assert.equal(compactPersonName("Sofia É."), "Sofia É.");
  assert.equal(compactPersonName("Cher"), "Cher");
  assert.equal(compactPersonName("Coastal Villas LLC"), "Coastal Villas LLC");
  assert.equal(compactPersonName("Unnamed customer"), "Unnamed customer");
  assert.equal(compactPersonName("Smith", {lastName:"Smith"}), "Smith");
  assert.equal(compactPersonName(""), "");
});

test("compact vehicle labels preserve short names, models and distinguishing trims", () => {
  assert.equal(compactVehicleName("2022 Lamborghini Huracan"), "Huracan");
  assert.equal(compactVehicleName("Lamborghini Huracán EVO Spyder"), "Huracán EVO Spyder");
  assert.equal(compactVehicleName("2022 Ferrari Roma"), "Ferrari Roma");
  assert.equal(compactVehicleName("Rolls Royce Cullinan Black Badge"), "Cullinan Black Badge");
  assert.equal(compactVehicleName("Range Rover P400 SE", {make:"Land Rover"}), "Range Rover P400 SE");
  assert.equal(compactVehicleName("Mercedes-Maybach GLS 600", {make:"Mercedes-Benz"}), "Maybach GLS 600");
  assert.equal(compactVehicleName("Lamborghini Urus S (Yellow)"), "Urus S (Yellow)");
  assert.equal(compactVehicleName("Polestar Long range Dual motor", {make:"Polestar"}), "Long range Dual motor");
  assert.equal(compactVehicleName("Owner's custom roadster"), "Owner's custom roadster");
  assert.equal(compactVehicleName("Lamborghini Huracan", null), "Huracan");
  assert.equal(compactVehicleName(""), "");
});
