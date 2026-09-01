export const AGREEMENT_TEMPLATE_KEY = "master";

export const DEFAULT_IMPORTANT_TERMS = [
  { key: "damage", title: "Damage responsibility", body: "I am responsible for physical and interior damage, theft caused by my acts or omissions, diminished value, loss of use, towing, storage, recovery, missing equipment, and related costs arising while the vehicle is in my possession, to the extent permitted by law." },
  { key: "drivers", title: "No other drivers", body: "I am the only person authorized to operate the vehicle. I may not lend, sublease, transfer possession, or allow any other person to drive. Unauthorized operation may result in retention of the entire security deposit, termination of the rental, and vehicle recovery." },
  { key: "prohibited_use", title: "No racing, drifting, burnouts, or track use", body: "The vehicle may not be raced, timed, drifted, used for burnouts, taken onto a track or off-road, used for speed testing, towing, rideshare, delivery, unlawful activity, or any unapproved commercial or unusually hazardous purpose." },
  { key: "speed", title: "Speed and reckless driving policy", body: "Each documented incident above 105 mph is a strike. Prestige Luxor may notify me by phone, text, or email. Upon the third strike, Prestige Holdings Inc. may retain the entire security deposit. Reckless or abusive driving is independently prohibited and may end the rental." },
  { key: "smoking", title: "Smoking policy", body: "Smoking, vaping, and cannabis use inside the vehicle are prohibited. A $500 cleaning and odor-remediation charge applies to a violation, plus documented damage exceeding that amount." },
  { key: "mileage", title: "Mileage and excess mileage", body: "The rental includes {{mileage_allowance}}. Additional mileage is charged at {{overage_rate}} per mile. The pickup and return odometer readings in the rental record control." },
  { key: "late_return", title: "Late return policy", body: "The vehicle must be returned by {{end_date}}. Extensions require written approval before the scheduled return. An unapproved late return is charged at $100 for each started hour until the vehicle is returned, plus other documented recovery costs if applicable." },
  { key: "fuel", title: "Fuel policy", body: "The vehicle must be returned with the same fuel level and with 91-octane premium or the manufacturer-required fuel. Missing fuel is charged at $10 per gallon. I am responsible for damage caused by incorrect fuel." },
  { key: "tickets", title: "Tickets and tolls", body: "I am responsible for the actual amount of all tolls, parking charges, traffic citations, camera violations, impound charges, and related government charges attributable to the rental period. Prestige Luxor does not add a separate toll or ticket administration fee." },
  { key: "accident", title: "Accident reporting", body: "I must contact Prestige Luxor immediately after any accident, damage, theft, vandalism, or loss; contact police when appropriate; collect photos and involved-party information; and provide the available incident information within one hour." },
  { key: "deposit", title: "Security deposit and additional charges", body: "The security deposit for this rental is {{security_deposit}}. It varies by vehicle and may be held or charged as shown in the rental record. Properly documented charges may be applied before the balance is released. The deposit does not limit my responsibility for amounts exceeding it." },
  { key: "tracking", title: "GPS, telematics, and recording disclosure", body: "The vehicle may use GPS, telematics, diagnostic systems, and interior or exterior cameras for location, speed, safety, theft recovery, mileage, condition, and agreement enforcement. I consent to this monitoring, will inform passengers, and will not disable or obstruct any system." },
];

export const DEFAULT_MASTER_AGREEMENT = `PRESTIGE LUXOR EXOTIC CAR RENTAL AGREEMENT
Terms, Conditions, and Liability Acknowledgment

COMPANY
Prestige Holdings Inc., doing business as Prestige Luxor ("Company")
212 Technology Dr Unit K, Irvine, California 92618
(949) 620-0024 | Contact@prestigeluxor.com | prestigeluxor.com

RENTAL RECORD
Agreement: {{agreement_number}}
Renter: {{customer_name}}
Vehicle: {{vehicle}}
Rental period: {{start_date}} through {{end_date}}
Rental price: {{rental_price}}
Security deposit: {{security_deposit}}
Mileage allowance: {{mileage_allowance}}
Excess mileage: {{overage_rate}} per mile

This Rental Agreement, the invoice, the vehicle condition record, and the other rental information maintained in Company's CRM are collectively the "Rental Record." The Rental Record is incorporated into this Agreement. Rental-specific information in the Rental Record controls if it conflicts with a summary shown in this document.

1. PARTIES AND RENTER REPRESENTATIONS
This Agreement is between Company and {{customer_name}} ("Renter"). Renter represents that all contact, identity, license, insurance, payment, and rental information supplied to Company is accurate and complete. Renter must keep the provided phone number and email current throughout the rental. Company may rely on that information for notices concerning the rental.

Company may use vehicles owned or supplied by third parties. No vehicle owner, supplier, broker, platform, or referring party is a party to this Agreement or authorized to modify it. Renter's contractual relationship for this rental is solely with Prestige Holdings Inc., doing business as Prestige Luxor.

2. DRIVER ELIGIBILITY AND VERIFICATION
Renter must be at least 18 years old and hold a valid, unrestricted driver's license appropriate for the vehicle. Renter must present the physical license before receiving the vehicle. An international renter must also present a valid passport and any International Driving Permit required by law.

Company may verify Renter's identity, license, insurance, and motor vehicle record. Company may deny approval to a renter with more than two moving violations or one major violation, including DUI, reckless driving, or license suspension, during the preceding three years. A renter under 25 may be subject to an increased security deposit or young-driver surcharge disclosed in the Rental Record before payment.

3. SOLE AUTHORIZED DRIVER
Renter is the only person authorized to operate the Vehicle. Additional drivers are not permitted. Renter shall not lend, sublease, transfer possession, or allow any other person to drive the Vehicle.

If an unauthorized person operates the Vehicle, Company may retain the entire security deposit as agreed liquidated damages to the extent permitted by law, terminate the rental, and recover the Vehicle at Renter's expense. Renter remains responsible for all damage, loss, claims, and costs arising from unauthorized operation, including amounts exceeding the security deposit.

4. VEHICLE CONDITION, EQUIPMENT, AND CARE
Renter accepts the Vehicle in the condition documented by Company at delivery or pickup. Renter will have an opportunity to inspect the Vehicle and report visible pre-existing damage before taking possession. Damage not shown in the pickup condition record may be presumed to have occurred during the rental, subject to applicable law and other reliable evidence.

Renter must safeguard the Vehicle, keys, fuel card or toll device, charging equipment, documents, and all accessories. Lost or damaged keys, fobs, equipment, or accessories are charged at actual replacement, programming, towing, and related cost. Renter may not authorize repairs, alterations, towing, or disposal without Company's approval except when immediately necessary to protect health or safety.

5. RENTAL PERIOD, EXTENSIONS, AND LATE RETURN
The rental begins when Renter receives possession and ends only when Company confirms return at the agreed location. The scheduled period is {{start_date}} through {{end_date}}. An extension is valid only if Company approves it in writing before the scheduled return.

An unapproved late return is charged at $100 for each started hour until the Vehicle is returned. Renter is also responsible for documented towing, recovery, storage, or other losses caused by the failure to return the Vehicle as agreed. Company may report a Vehicle not returned as agreed and exercise lawful recovery rights.

6. MILEAGE AND GEOGRAPHIC LIMITS
The rental includes {{mileage_allowance}}. Mileage exceeding the allowance is charged at {{overage_rate}} per mile. Pickup and return odometer readings recorded by Company control unless clearly erroneous.

The Vehicle must remain within California and within 200 miles of the pickup location unless Company gives prior written approval. The Vehicle may not cross an international border. An unauthorized geographic violation is a material breach; Company may terminate the rental, recover the Vehicle, and charge Renter for actual transport, recovery, mileage, and related costs.

7. APPROVED AND PROHIBITED USE
The Vehicle may be used for lawful personal use, weddings, and other purposes expressly approved in the Rental Record. Any production, promotional, commercial, event, or photography use requires Company's prior written approval.

The Vehicle may not be used for racing, drifting, burnouts, donuts, speed contests, timed events, track use, autocross, driver instruction, demonstration, off-road driving, rideshare, taxi, delivery, towing, pushing, unlawful activity, transport of contraband, or any unapproved commercial or unusually hazardous purpose. Renter may not operate while impaired by alcohol, cannabis, medication, narcotics, or any other substance. Pets require prior written approval. Renter is responsible for resulting cleaning and damage.

Company may terminate the rental and lawfully recover the Vehicle following prohibited, reckless, abusive, or unsafe use. Renter remains responsible for all resulting damage, costs, and losses.

8. SPEED AND DRIVING-CONDUCT POLICY
Each documented incident in which the Vehicle exceeds 105 miles per hour constitutes a strike. Company may notify Renter of each strike by phone, text, or email, effective when sent. Upon the third strike, Company may retain the entire security deposit as agreed liquidated damages to the extent permitted by law. Retention of the deposit does not limit Renter's responsibility for actual damage or other amounts owed.

Reckless driving, aggressive maneuvers, drifting, burnouts, repeated hard acceleration or braking, disabling safety systems, or other abusive operation is independently prohibited and may result in immediate termination and lawful recovery of the Vehicle.

9. SMOKING, CLEANING, AND FUEL
Smoking, vaping, and cannabis use inside the Vehicle are prohibited. A violation results in a $500 cleaning and odor-remediation charge, plus documented repair or replacement cost exceeding that amount.

The Vehicle must be returned with the same fuel level shown at pickup and with 91-octane premium or the manufacturer-required fuel. Missing fuel is charged at $10 per gallon. Renter is responsible for towing, decontamination, repair, and other damage caused by incorrect fuel.

10. PAYMENT, SECURITY DEPOSIT, AND NONREFUNDABLE CANCELLATION
Renter authorizes Company to collect the rental charges and all other properly documented amounts due under this Agreement using the payment method in the Rental Record. The security deposit varies by Vehicle and may be collected as an authorization hold or charge as shown in the Rental Record.

Company may apply the security deposit to damage, excess mileage, late return, missing fuel, smoking, cleaning, tolls, citations, missing equipment, recovery, prohibited use, or other amounts authorized by this Agreement. Any remaining balance will be released or refunded after return and inspection, subject to the payment provider's processing time. The security deposit does not cap Renter's liability.

Once Company confirms the reservation, all amounts paid are nonrefundable if Renter cancels, fails to appear, becomes ineligible because of inaccurate or incomplete information, or does not provide the required license, insurance, payment, or deposit. Company will refund amounts paid if Company cancels without substituting an accepted vehicle, or when a refund is required by law.

11. INSURANCE REQUIREMENT; NO DAMAGE WAIVER
Before delivery, Renter must provide a current declarations page establishing full-coverage automobile insurance, including liability, comprehensive, and collision coverage applicable to the rented Vehicle. Renter represents that the policy is active, in good standing, and sufficient for a high-value exotic or luxury rental. Company may verify coverage with the carrier and may refuse delivery if coverage cannot be confirmed.

Renter's insurance will respond to the fullest extent permitted by applicable law. Nothing in this Agreement changes any priority of coverage established by law. Any uninsured or underinsured loss remains Renter's responsibility. Renter must maintain coverage until the Vehicle is returned and all claims are resolved and must immediately report any cancellation, lapse, exclusion, or reduction.

Company does not provide a damage waiver or loss damage waiver through this Agreement. No rental payment or security deposit waives or limits Renter's responsibility for damage or loss.

12. DAMAGE, LOSS, LIABILITY, AND INDEMNITY
To the fullest extent permitted by law, Renter is responsible for physical and interior damage, theft caused by Renter's acts or omissions, vandalism, burns, stains, tears, odor remediation, diminished value, reasonable loss of use, towing, recovery, storage, impound, missing equipment, and related costs occurring from delivery until confirmed return, regardless of whether insurance ultimately responds.

Renter is responsible for injury, property damage, claims, citations, and loss arising from Renter's operation, prohibited use, impairment, unauthorized operation, breach, negligence, or unlawful conduct. Renter agrees to indemnify and hold harmless Company and its owners, officers, employees, agents, and affiliates from claims, losses, costs, and reasonable attorney fees arising from Renter's use or breach, except to the extent caused by Company's gross negligence or willful misconduct or prohibited by law.

To the fullest extent permitted by law, Company is not liable for indirect, incidental, special, consequential, or punitive damages arising from the rental.

13. ACCIDENT, THEFT, AND CLAIM PROCEDURE
After any accident, collision, damage, theft, vandalism, fire, or other loss, Renter must protect safety, contact emergency services when appropriate, and notify Prestige Luxor immediately. Police must be contacted for an injury, third-party collision, theft, or when otherwise required by law.

Within one hour, Renter must provide all reasonably available information, including scene and vehicle photographs, license plates, driver and witness contact details, insurance information, and the police report or incident number if available. Renter must promptly open an insurance claim when directed, provide the claim and adjuster information, cooperate truthfully with Company and insurers, preserve the Vehicle for inspection, and provide the police report when issued. Renter may not admit liability on Company's behalf or settle a Vehicle claim without Company's written consent.

14. TICKETS, TOLLS, AND GOVERNMENT CHARGES
Renter is responsible for the actual amount of all tolls, parking charges, traffic citations, camera-enforced violations, impound fees, and other government charges attributable to the rental period, including items received after return. Company does not add a separate toll or citation administration fee. Renter authorizes Company to charge the actual amount when documented.

15. GPS, TELEMATICS, CAMERAS, AND CONDITION RECORDS
The Vehicle may contain GPS, telematics, diagnostic, anti-theft, and interior or exterior audio or video systems that record location, speed, acceleration, braking, mileage, condition, occupancy, images, or sound. Renter expressly consents to this monitoring and recording for safety, theft recovery, mileage, geographic-limit verification, claims, condition documentation, and enforcement of this Agreement. Not every Vehicle contains every system.

Renter must inform passengers that monitoring or recording may occur. Renter shall not disable, obstruct, remove, or tamper with any system. Company may photograph or record the Vehicle at delivery and return and retain those records for operational, insurance, and legal purposes.

16. RETURN AND INSPECTION
Renter must return the Vehicle at the agreed place and time, in substantially the same condition as received, ordinary wear excepted, with personal property removed, correct fuel, and all keys and equipment. Renter must disclose new damage, warning lights, mechanical concerns, citations, toll activity, or incidents.

Company may inspect the Vehicle after return. Charges may be assessed after return when damage, tolls, citations, claims, or other amounts are discovered later. Renter may request available supporting documentation.

17. DEFAULT AND VEHICLE RECOVERY
Material breach includes an unauthorized driver, prohibited or unsafe use, geographic violation, insurance lapse, false information, nonpayment, tampering with tracking equipment, or failure to return the Vehicle. Following a material breach, Company may terminate the rental, demand immediate return, and recover the Vehicle where legally permitted. Renter is responsible for reasonable recovery, towing, storage, and transport costs caused by the breach.

18. NOTICES AND AUTHORITY
Notices to Renter may be sent to the phone number or email in the Rental Record and are effective when sent. Notices to Company must be made through the Prestige Luxor contact information above. Any authorized Prestige Luxor representative may administer and sign the Rental Record for Company, but no oral statement changes this Agreement.

19. GENERAL TERMS
California law governs this Agreement. The parties will first attempt in good faith to resolve a dispute directly and may agree to mediation. If a dispute is not resolved, it must be brought in a court of competent jurisdiction in Orange County, California. This Agreement does not require binding arbitration.

This Agreement and the Rental Record are the entire agreement. A modification must be in writing and accepted by both parties. If a provision is unenforceable, the remaining provisions remain effective. A waiver on one occasion is not a continuing waiver. Renter's payment, damage, indemnity, claims-cooperation, toll, citation, and other accrued obligations survive return of the Vehicle.

Electronic records, initials, consents, and signatures are intended to be valid and enforceable to the same extent as paper records and handwritten signatures.

20. ACKNOWLEDGMENT
By signing, Renter confirms that the rental summary is accurate; Renter has reviewed and initialed the important terms; Renter understands the insurance, damage, monitoring, driving-conduct, cancellation, deposit, and return obligations; and Renter agrees to this Agreement. Renter further acknowledges that exotic and high-performance vehicles require heightened care and represents that Renter is competent to operate the Vehicle safely.`;

export function renderAgreementText(value, agreement = {}) {
  const dateTime = (value) => value ? new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "To be confirmed";
  const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
  const replacements = {
    agreement_number: agreement.agreement_number || "Pending",
    customer_name: agreement.customer_name || "Renter",
    vehicle: agreement.vehicle_name || "Rental vehicle",
    start_date: dateTime(agreement.rental_start_at || agreement.rental_start),
    end_date: dateTime(agreement.rental_end_at || agreement.rental_end),
    rental_price: money(agreement.quote_total || agreement.rental_total),
    security_deposit: money(agreement.refundable_deposit),
    mileage_allowance: agreement.mileage_allowance || "100 miles per day",
    overage_rate: money(agreement.overage_rate || 5),
  };
  return String(value || "").replace(/\{\{([a-z_]+)\}\}/g, (match, key) => replacements[key] ?? match);
}
