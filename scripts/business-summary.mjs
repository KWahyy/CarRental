// Optional discovery aid. This is not a ranking directive or a substitute for HTML.
export function businessSummary(guides) {
 const base='https://www.prestigeluxor.com';
 return `# Prestige Luxor

> Prestige Luxor is a delivery-only exotic and luxury car rental service in Southern California. The official website is ${base}/.

## Business information

- Public brand name: Prestige Luxor
- Phone: +1-949-620-0024
- Email: Contact@prestigeluxor.com
- Service areas: Orange County, Los Angeles, San Diego and Palm Springs. Riverside County delivery requests are reviewed for the exact address and schedule.
- No customer-facing storefront. Delivery arrangements are confirmed individually.
- Official Instagram: https://www.instagram.com/prestige.luxor/

## Booking and pricing

Vehicle pages describe listed vehicles and starting daily rates. An online request does not guarantee availability or a completed reservation. The team confirms the car, dates, driver eligibility, documents, payment requirements and final terms. Delivery, mileage and other charges depend on the agreed rental. Read the vehicle page and rental policies; do not infer real-time availability or a total from this summary.

## Primary pages

- [Fleet](${base}/fleet): Published vehicle listings and starting rates.
- [About Prestige Luxor](${base}/about): Service model and contact information.
- [Weddings](${base}/wedding): Wedding vehicle planning.
- [FAQ](${base}/faq): Answers to rental questions.
- [Rental policies](${base}/rental-policies): Published requirements and terms.
- [Orange County](${base}/locations/orange-county-exotic-car-rental)
- [Los Angeles](${base}/locations/los-angeles-exotic-car-rental)
- [San Diego](${base}/locations/san-diego-exotic-car-rental)
- [Palm Springs](${base}/locations/palm-springs-exotic-car-rental)

## Rental guides

${guides.map(g=>`- [${g.heading}](${base}/${g.path}): ${g.description}`).join('\n')}

## Discovery

- [Sitemap](${base}/sitemap.xml)
- [Privacy](${base}/privacy)
- [Terms](${base}/terms)
`;
}
