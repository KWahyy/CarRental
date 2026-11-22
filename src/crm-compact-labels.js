// Compact labels are for display. Searches, forms and documents use the original values.
const clean = value => String(value ?? "").trim().replace(/\s+/gu, " ").normalize("NFC");

function givenNameLabel(name) {
  if (name !== name.toLocaleUpperCase("en-US")) return name;
  return name.toLocaleLowerCase("en-US").replace(/(?:^|[\s’'-])\p{L}/gu, part => part.toLocaleUpperCase("en-US"));
}

export function compactPersonName(name, person) {
  let first = clean(person?.firstName);
  let last = clean(person?.lastName);
  const full = clean(name);
  if (!first || !last) {
    if (!first && !last && (/@|\d{3}|\b(?:LLC|Inc\.?|Ltd\.?|Corporation)$/iu.test(full) ||
        /^(?:unknown|unnamed|walk-in) (?:customer|guest|lead)$/iu.test(full))) return full;
    const parts = full.split(" ").filter(Boolean);
    if (parts.length > 2 && /^(?:Jr\.?|Sr\.?|II|III|IV|V)$/iu.test(parts.at(-1))) parts.pop();
    if (!first && full !== last) first = parts[0] || "";
    if (!last && parts.length > 1 && first !== full) last = parts.at(-1);
  }
  if (!first) return last;
  if (!last) return givenNameLabel(first);
  const initial = last.match(/\p{L}/u)?.[0];
  return [givenNameLabel(first), initial && initial.toLocaleUpperCase("en-US") + "."].filter(Boolean).join(" ");
}

// Historical bookings can contain only free text. Use whole make prefixes so an
// unfamiliar vehicle or a model such as Range Rover retains its identifying text.
const legacyMakePrefix = /^(?:Mercedes(?:[-\s]+Benz)?|Rolls[-\s]+Royce|Aston\s+Martin|Alfa\s+Romeo|Land\s+Rover|Lamborghini|Bentley|Ferrari|Porsche|McLaren|Maserati|Cadillac|Chevrolet|Audi|BMW|Ford|Tesla|Jaguar|Lexus|Lucid|GMC|Dodge|Jeep)[\s-]+/iu;
const maxFullLabelLength = 16;

export function compactVehicleName(name, vehicle) {
  const marque = clean(vehicle?.make);
  const full = clean(name) || clean(vehicle?.model) || marque;
  const label = full.replace(/^(?:19|20)\d{2}\s+(?=\S)/u, "");
  if (label.length <= maxFullLabelLength) return label;
  if (marque && label.toLowerCase().startsWith(marque.toLowerCase() + " ")) {
    return label.slice(marque.length).trimStart();
  }
  return label.replace(legacyMakePrefix, "") || label;
}
