# Location growth and attribution — review draft

Release scope: all 10 existing city/airport pages and all forms using quote-api, including WebMCP review.

## Acquisition measurement
- Session-scoped first acquisition remains fixed; subsequent attributed visits are retained as latest touch.
- Store source/channel, original landing path, referrer origin/path and campaign parameters; arbitrary URL queries and contact fields are not captured.
- AI referral means recognized source tag or referrer, not proof of a recommendation or an exact query. Missing attribution remains direct_or_unknown.
- Google ad click IDs and paid media tags take precedence over AI classification.
- Existing quote request message stores first source, channel, landing path, submission path, and latest touch. No database migration required.
- Calls/text clicks remain intent events, not confirmed leads. quote_submitted fires after API success.
- SessionStorage intentionally does not identify people across devices or browser sessions. Existing legacy sessions remain explicitly unclassified rather than guessed.
- Attribution fields can be supplied by visitors and should be treated as directional evidence, not independently verified claims.

## Location work
Each existing destination includes trip-specific vehicle choices, real active-fleet photos/rates, delivery planning, and links to rental requirements and a relevant guide. No invented office addresses, reviews, hotel relationships, or guaranteed airport access.

Cities: Orange County, Los Angeles, Newport Beach, Beverly Hills, Irvine, Riverside County, San Diego, Palm Springs. Airports: LAX and SNA.

## Review and measurement
Check source and landing page in CRM inquiry messages. Compare unique inquiries and actual booked outcomes weekly; do not count multiple submissions by one customer as separate acquired customers. Automated cross-inquiry deduplication and revenue attribution are not included in this release. No historical missing source can be reconstructed from this change.

Baseline query examples for manual AI visibility checks: exotic car rental Newport Beach; Lamborghini rental Orange County; convertible rental San Diego; luxury SUV rental Beverly Hills; exotic car delivery LAX; luxury car rental Irvine; convertible rental Palm Springs; exotic car rental Riverside County. Record date, assistant, exact prompt, cited URLs, mentions and inquiry outcomes separately. No ranking promise.
