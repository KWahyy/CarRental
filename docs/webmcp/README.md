# Prestige Luxor WebMCP

Implemented on 2026-10-28. Production deployment follows the GitHub main branch.

## Public tools
- `search_rental_vehicles`: live active public inventory; model/category query and maximum starting daily rate. Dates/city are requested preferences, never availability filters.
- `get_rental_details`: whitelisted vehicle fields and current published rental-policy text with source URL.
- `prepare_reservation_request`: validates requested dates and vehicle, opens a customer review dialog. Does not send or reserve anything. Tool parameters contain no contact-information fields.

Customer review uses a native accessible dialog. Contact details are entered by the customer, with explicit review acknowledgement. Only a trusted submit event on the production domain can call the existing quote API. This is a UI guard, not an authentication boundary or protection against fully privileged browser automation. No booking/payment tool is registered. No cross-origin tool exposure is configured. Existing backend validation remains authoritative.

The local preview never posts production leads. Drafts are held in memory, disappear on closing/navigation, and a subsequent preparation cannot overwrite an open draft. No CRM, bookings, customer profiles, internal costs or owner details are returned.

## Compatibility
The module feature-detects `document.modelContext.registerTool` and falls back to the older `navigator.modelContext` preview interface with an MCP content envelope. Unsupported browsers retain the existing site behavior. This is client-side WebMCP, not a remote MCP server or an AI-ranking signal. Browser support remains experimental; source: https://developer.chrome.com/docs/ai/webmcp/imperative-api (reviewed October 28, 2026).

## Verification
- Node test suite: 68 passed (12 WebMCP-specific tests).
- Static build passed with 36 active vehicle pages.
- Search-readiness check: 71 pages passed.
- Native in-app browser WebMCP discovery exposed all three tools.
- Native search for Huracan under $1,300 returned EVO Coupe White ($1,045) and EVO Spyder ($1,245), both marked pending team confirmation.
- Native vehicle details returned current published policies.
- Native prepare opened review with no submission; duplicate draft preparation and impossible dates returned readable errors.
- Review checked at desktop and 390px mobile width; close control removed the draft.
- Production delivery of a real quote was deliberately not exercised. Existing quote API is reused only after customer submission.

## Files
`src/webmcp-core.js`: schemas, validation, filtering and registration.
`src/webmcp-review.js`: review UI and submission guard.
`src/webmcp.js`: browser bootstrap and public data adapters.
`src/webmcp.css`: scoped review styling.
`src/site-chrome.js`: injects module on allowed public pages.
`tests/webmcp.test.mjs`: behavior and integration tests.

## Local checks
Run `node --test tests/*.test.mjs`, `node scripts/build-static.mjs`, then `AUDIT_BASE_URL=http://127.0.0.1:8777 node scripts/check-search-readiness.mjs` while the local preview is running. Do not test by creating production leads.
