# ChatGPT ads pixel

Pixel: JCcp8rMdEEvmBLpF1NDJG7
SDK: https://bzrcdn.openai.com/sdk/oaiq.min.js
Event: oaiq('measure', 'lead_created', {type:'customer_action'})

The browser integration is loaded once after explicit consent on production public rental pages. Existing Meta-only consent is not reused: the v2 choice names both Meta and OpenAI. GPC, private routes, localhost, and unsafe URL/referrer queries prevent loading. Consent revocation calls oaiq('consent',false), verified against the supplied SDK on 2026-10-28. Debug logging is off.

Successful quote-api responses with ok and an ID trigger the event. IDs deduplicate within the loaded document and are not passed to OpenAI. Partner/consignment applications are excluded. No contact fields, rental details, or amounts are attached. Browser/device and page information may still be collected by the SDK. No Conversions API or API key is configured.

Local automated tests mock network and SDK queues: no real CRM leads or ad conversions are created. After deployment, confirm the pixel in the advertising event stream using its test tools. Receipt by OpenAI has not been verified locally. Ad blockers and declined consent can prevent measurement; this is not a complete CRM count.
