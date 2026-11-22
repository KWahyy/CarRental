// Use the pickup day and vehicle as well as contact details. A repeat renter
// can have several open inquiries, including for different Huracán variants.
const clean = value => String(value || "").trim().toLowerCase();
function vehicleKey(value) {
  const name = clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
  return name === "2022 lamborghini huracan evo spyder" ? "2022 lamborghini huracan" : name;
}
function phoneKey(value) {
  const digits = clean(value).replace(/[^\d]/g, "");
  if (digits.length < 10 || digits.length > 15) return "";
  return /^1\d{10}$/.test(digits) ? digits.slice(1) : digits;
}
export const matchColumns = "id,email,phone,vehicle,rental_date";
export async function originalRequest({date, vehicle, email, phone}, readDay) {
  const address = clean(email);
  const number = phoneKey(phone);
  if (!/^\d{4}-\d\d-\d\d$/.test(date) || !vehicleKey(vehicle) || !(address || number)) return null;
  const candidates = await readDay(date);
  if (!Array.isArray(candidates) || candidates.length >= 101) return null;
  const matches = candidates.filter(row => {
    if (row.rental_date !== date || vehicleKey(row.vehicle) !== vehicleKey(vehicle)) return false;
    const otherEmail = clean(row.email);
    const otherPhone = phoneKey(row.phone);
    if (address && otherEmail && address !== otherEmail) return false;
    if (number && otherPhone && number !== otherPhone) return false;
    return Boolean((address && address === otherEmail) || (number && number === otherPhone));
  });
  return matches.length === 1 ? matches[0].id : null;
}

export async function linkPaidBooking(db, booking, email) {
  if (booking.quote_request_id || !(booking.amount_paid > 0) || booking.payment_status === "refunded") return booking;
  try {
    const id = await originalRequest({date:booking.start_date, vehicle:booking.vehicle, phone:booking.customer_phone, email}, async date => {
      const result = await db.from("quote_requests").select(matchColumns).eq("rental_date",date).limit(101);
      if (result.error) throw result.error;
      return result.data;
    });
    if (id) {
      const result = await db.from("booking_sales").update({quote_request_id:id}).eq("id",booking.id)
        .is("quote_request_id",null).select().maybeSingle();
      if (result.error) throw result.error;
      if (result.data) return result.data;
    }
  } catch { console.warn("Automatic request link unavailable for saved booking."); }
  return booking;
}
