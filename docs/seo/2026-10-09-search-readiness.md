# Prestige Luxor — SEO and AI-search implementation report

Date: October 9, 2026. Status: implemented and tested in the local production build; **not deployed or pushed by this task**.

## Scope and architecture

Audited the public HTML sources, generated locations/company/guides/brand pages, inventory mapping, server response handler, build pipeline, private-route exclusions, Vercel routing, structured data, styles/fonts/media loading, and existing automated checks. This project uses generated HTML and vanilla JavaScript with a Vercel response handler, not React/Next.js. React hydration is therefore not the cause of the public page behavior. The existing server response/state mechanism and critical CSS inlining were preserved.

Inventory source: the active public Supabase inventory in KD’s Exotics. There are 30 active listings at verification time. Active means listed for inquiry; availability for particular dates still requires confirmation. No vehicles, prices, addresses, ratings, or endorsements were invented. No dependencies were added. Booking logic and the established visual design were preserved, apart from the explicitly authorized removal of unverified press logos.

## Verified findings and fixes

| Finding before this task | Implementation | Responsible files |
|---|---|---|
| Vehicle JSON-LD updated only price/name/one image at request time. Model details and FAQ answers could retain build-time facts after CRM edits. Social titles/descriptions/images were also build snapshots. | Generate the complete Vehicle/Offer/FAQ graph and social metadata from the same current inventory used for visible HTML. Absolute gallery URLs and canonical vehicle URLs are maintained. | `src/search-metadata.js`, `src/public-render.js`, `scripts/build-static.mjs` |
| Active vehicles were marked `InStock`, despite date-specific confirmation being required. Invalid future rates could be coerced into zero-priced structured offers. | Remove the unsupported availability assertion; describe the rate as a starting daily rental quote. Emit offers only for finite positive prices. Preserve the rental business function and per-day unit. | `src/search-metadata.js`, `scripts/build-static.mjs` |
| A vehicle added after deployment had no compiled response template and could return 404 until the next build. | Use a compiled shared vehicle template only after the requested slug is confirmed active in Supabase; replace the old template’s slug, content, canonical and metadata. Unknown/archived cars return 404/noindex. An unknown new car during an inventory outage returns 503 rather than inventing a listing. | `api/public-page.js`, `scripts/build-static.mjs` |
| Sitemap inventory was a build-time snapshot, so additions and removals were not reflected until deployment. | Serve `/sitemap.xml` from active inventory, with a five-minute CDN cache and a complete build snapshot fallback. Validate last-modified dates; do not create dates for static pages. Keep private and duplicate routes excluded. Move the static file out of Vercel’s public output so it cannot shadow the dynamic rewrite. | `api/sitemap.js`, `src/search-metadata.js`, `vercel.json`, `scripts/build-static.mjs` |
| Business information was defined primarily on the homepage, with partial/unresolved references elsewhere; breadcrumbs were inconsistent. | Add one consistent AutoRental/Organization entity per indexable page and BreadcrumbList on interior pages. AutoRental is a LocalBusiness subtype. Use the existing phone, email and Instagram identity; no fabricated street address or rating. | `src/search-metadata.js`, `scripts/build-static.mjs`, `wedding.html` |
| Static FAQ schema could drift from visible answers. | Read non-vehicle FAQs directly from rendered details/answers; vehicle FAQs share the same content generator as the page. | `src/search-metadata.js` |
| Porsche and Rolls-Royce pages included the delivery navigation twice because its renamed aria-label defeated the build’s duplicate check. | Check the stable component class before insertion. | `scripts/build-static.mjs` |
| No dedicated Irvine or Riverside County planning pages existed. | Add two distinct useful pages using the existing location template. Irvine covers business/hotel stays, SNA coordination, luggage, coastal trips and returns. Riverside County covers exact-address coverage checks, desert communities, event logistics and longer routes. Both clearly require confirmation and imply no storefront or hotel partnership. Link them from public exploration navigation and vehicle delivery resources. Prioritize OC, LA, Newport Beach and Beverly Hills first. | `scripts/build-static.mjs`, `src/vehicle-content.js` |
| General rental policies had not caught up with the user-approved mileage overage and deposit/experience requirements. | Align policy copy with $5/additional mile, deposits from $1,000, one year of driving experience, license/full-coverage insurance, and vehicle-specific approval. Preserve final-quote/agreement qualification. Improve About contact links and link the genuine customer experience. | `scripts/build-static.mjs` |
| The homepage claimed publication features without supporting article links. | Removed the “Featured In” logo section after explicit user authorization. Retained the supplied customer review. | `index.html` |
| The wedding page emitted an unsupported `as="video"` preload warning. | Remove that ineffective hint; preserve the video’s existing loading and playback behavior. | `wedding.html` |
| The build copied the Supabase project directory into public output unnecessarily. | Stop shipping database setup/migration implementation files in the static public directory. No database or authentication protections were changed. | `scripts/build-static.mjs` |
| Private quote/agreement pages depended on their existing meta noindex controls. | Preserve those controls and additionally send `X-Robots-Tag: noindex, nofollow` from the response handler. | `api/public-page.js` |

## Crawler access and production observations

The prior robots wildcard already allowed public search crawling. The generated file retains this behavior and documents that Googlebot, Bingbot, OAI-SearchBot and PerplexityBot can crawl public pages. Only `/api/` endpoints are disallowed. Public JavaScript, CSS and images stay accessible. Private pages remain crawlable enough for engines to observe their noindex directives; robots.txt is not treated as access control. Existing training-crawler policy was not expanded.

Twenty read-only production probes tested the homepage, Ferrari F8 page, robots and sitemap with five user-agent headers (normal browser, Googlebot, Bingbot, OAI-SearchBot and PerplexityBot). All returned 200. HTTP and the non-www hostname resolved to the www HTTPS canonical host. A deliberately nonexistent public URL returned 404. The live homepage, fleet and Ferrari page contain inventory text/links in raw HTML. One production probe used the existing `build-fallback` inventory response, so transient Supabase latency/outages merit monitoring.

These user-agent probes originate from this machine, **not the crawlers’ verified IP ranges**. They cannot certify CDN/firewall rules or actual indexing. No firewall or security rule was relaxed.

## Verification results

| Check | Before / baseline | After |
|---|---|---|
| Indexable build pages | 55, including 30 vehicles | 57, including the same 30 vehicles and two location pages |
| Basic canonical/heading/link/JSON parsing audit | Passed, but did not catch stale entity facts or duplicate navigation | Passed; stronger raw-response checks also pass |
| Duplicate delivery sections on brand pages | 2 affected pages | 0 |
| Unit tests | 37 existing tests | 42 passing, including five new metadata/inventory lifecycle tests |
| Full production-build refresh audit | No new pre-change performance baseline was captured in this task | 60 routes × 3 viewport sizes × 3 loads = 540 runs; 0 exceptions, 0 overflow failures, 0 broken images, max observed CLS 0 |
| Final targeted refresh checks after logo removal/navigation ordering | — | 4 routes × 3 sizes × 3 loads = 36 runs; all passed, max CLS 0 |
| Wedding after preload correction | Unsupported preload warning observed | 9 refresh runs passed; unsupported preload warning removed |
| Booking interactions | Existing framework | Passed at 1440, 768 and 390 pixels after changes |
| JavaScript syntax | Plain JavaScript repository | 10 affected modules parsed successfully; no TypeScript project/typecheck script exists |

The full audit captures first-frame and settled screenshots, disables browser cache, delays application JavaScript for the initial comparison, checks layout geometry, and repeats refreshes. It covers all 57 sitemap URLs plus quote, agreement and the legacy exotic-car-rental route.

Raw HTTP checks fetch all 57 pages without executing JavaScript and verify unique titles/descriptions, one canonical and H1, visible FAQ/schema agreement, current vehicle metadata, business identity, breadcrumbs, alt attributes, navigation duplication and private exclusions. All pass.

Local lab timing across the full run: median FCP 156 ms, p75 FCP 216 ms; median LCP 176 ms, p75 LCP 244 ms. These are unthrottled localhost figures with controlled script loading, **not production Core Web Vitals, mobile-network measurements, or a demonstrated speed improvement**. Production field p75 LCP/INP/CLS still needs Search Console/CrUX or real-user telemetry.

Six additional location-inquiry scenarios passed: Irvine and Riverside County at desktop, tablet and mobile sizes, verifying successful confirmation and the correct service-area payload.

Booking tests mock POST requests, quote acceptance and signing. They verify UI behavior and payload flow without creating real leads, sending messages, charging cards, or signing a real agreement. Live delivery to CRM/email and real payment processing were not exercised.

Local preview warnings are separated in `network-summary.json`: Vercel’s deployment-only analytics endpoints return 404 locally, and third-party advertising requests may abort on navigation. The browser also emitted an environment-level text-session warning. No first-party content/image failures or JavaScript exceptions were observed. Google’s Rich Results Test and Schema.org’s hosted validator were not run against an unpublished deployment; local validation checks JSON syntax, entity properties and visible-content consistency, not rich-result eligibility.

## Files changed for this task

Created:
- `src/search-metadata.js`
- `api/sitemap.js`
- `scripts/check-search-readiness.mjs`
- `tests/search-metadata.test.mjs`
- `scripts/test-location-inquiries.mjs`
- `docs/seo/2026-10-09-search-readiness.md`

Updated:
- `scripts/build-static.mjs`
- `src/public-render.js`
- `src/vehicle-content.js`
- `api/public-page.js`
- `vercel.json`
- `index.html`
- `wedding.html`
- `scripts/preview-production.mjs`
- `scripts/test-render-stability.mjs`
- `package.json` (`test:search` command)

The location pages, canonical metadata, robots, response templates, fallback sitemap and sitemap route manifest are generated build artifacts. Earlier unrelated local changes remain in the workspace and were not discarded or committed.

Evidence is in `output/seo/2026-10-09/`: build/unit/syntax/SEO logs, baseline page inventory, crawler probes, live page checks, raw-response checks, inventory gaps, booking log, and three browser screenshot/result directories (`render`, `final-render`, `wedding-render`).

## Remaining work / external verification

1. Deploy the reviewed changes and verify Vercel bundles both the generic vehicle template and sitemap manifest; recheck canonical routes and dynamic sitemap on the deployment. Nothing was published by this task.
2. Inspect actual WAF/CDN bot logs and current official crawler IP ranges. A spoofable user-agent header alone is insufficient evidence for allowlisting.
3. Use Google Search Console and Bing Webmaster Tools to submit the canonical sitemap and inspect indexing, exclusions, manual actions, and selected URL live tests. Account data was not accessed in this task.
4. Confirm Google Business Profile and Bing Places as service-area businesses with consistent name/phone/URL; do not publish an invented storefront address.
5. Supply verified model years for 18 listings. The public inventory also provides no engine or acceleration specification; the pages retain confirmation wording. Do not infer exact trim specifications from generic model information.
6. Static editorial price-comparison guides and generated location/brand collection snapshots still update on build. Rebuild when those examples change; their linked individual vehicle pages and the main fleet use current response inventory. A CRM deployment webhook or a later broader server-rendering migration can automate editorial snapshots without client-side replacement.
7. Retain customer video/photography publication permissions and verify any additional social/citation profiles before adding them. No aggregate ratings or unverified press claims were added.
8. Observe the inventory fallback rate and real production CWV; the single observed fallback is not enough evidence to change database timeouts or weaken reliability behavior.

## Prioritized 30-day action plan

| Window | Priority | Action | Evidence of completion |
|---|---|---|---|
| Days 1–3 | P0 | Deploy; verify dynamic sitemap and new-car pages on Vercel; run Google/Bing live URL inspections for home, fleet, Huracán EVO Spyder, OC and the new location pages. Inspect bot access with IP-verified logs. | Canonical URLs fetched successfully; sitemap accepted; no blocking rules or accidental noindex |
| Days 4–7 | P1 | Verify service-area business listings and contact consistency; fill missing model years/specifications from actual vehicle records; verify photo and testimonial permissions. | Consistent business details; documented vehicle facts; approved media records |
| Days 8–14 | P1 | Publish one useful first-hand rental story using a consented real booking: exact car, general service area, delivery process and practical lessons, without disclosing customer private details. Add genuine walkaround videos and descriptive captions to priority cars. | Original customer-useful content linked from relevant vehicle/location pages |
| Days 15–21 | P1 | Request honest feedback from completed rentals without incentives for positive ratings. Seek relevant referral/citation links from real wedding planners, photographers, hotels or event collaborators only where a genuine relationship exists. | Verifiable reviews and relevant editorial/referral links; no purchased endorsements or fabricated partnerships |
| Days 22–30 | P2 | Compare search impressions, indexed pages, inquiry conversions and field performance. Manually sample the user’s six target questions across AI search products, recording date, locale, citations and variability. Refine pages based on missing factual answers rather than keyword density. | Baseline/30-day dashboard, query/citation log, prioritized next fixes |

Do not use AI answer appearances as a guaranteed or stable ranking metric. Track qualified inquiries alongside visibility.

## Current official guidance used

- [Google: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features): core SEO, accessible text, internal links, page experience and accurate structured data remain relevant; no special AI file or schema is required.
- [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots): OAI-SearchBot controls search discoverability separately from GPTBot’s training purpose; published IP ranges matter for access checks.
- [Perplexity crawler documentation](https://docs.perplexity.ai/docs/resources/perplexity-crawlers): PerplexityBot serves search discovery; verify IP ranges as well as user agents for WAF rules.
- [Schema.org AutoRental](https://schema.org/AutoRental), [Vehicle](https://schema.org/Vehicle), [UnitPriceSpecification](https://schema.org/UnitPriceSpecification): semantics used for the business and daily rental rates.
- [Google Search documentation updates](https://developers.google.com/search/updates): the FAQ rich-result feature was removed in 2026. FAQPage is retained as accurate semantic description of visible questions, not a promise of Google FAQ rich results.

No ranking or AI recommendation is guaranteed. The work makes the site easier to crawl and interpret and removes verified sources of inconsistency.
