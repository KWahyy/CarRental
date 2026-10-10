# Vehicle fact verification — October 9, 2026

## Huracán EVO Spyder
- Imported supplier record: `output/partner-collection/priced-collection.json`, listing key `lamborghini-huracan-evo-spyder`.
- Supplier page: https://jungleexotic.com/luxury-and-exotic-car-rental-california/huracan-evo-spyder
- Supplier explicitly lists 2020 and a naturally aspirated 5.2L V10; used as missing-field fallbacks only.
- Black is a visual description of the actual imported gallery, labelled **Black (pictured)**, not a verified factory paint name.
- Supplier acceleration claims conflict (2.9 versus 2.5 seconds; one repeats the latter as 0–100 mph). No acceleration value is published from this evidence.
- Supplier incorrectly labels the Spyder as a coupe. Existing convertible classification retained.

## Huracán EVO Coupe (White)
- Supplier page: https://monzaexotics.com/cars/white-huracan-coupe/
- White exterior and naturally aspirated 5.2L V10 are stated explicitly. Existing CRM color is retained.
- No model year established. Omit the year rather than invent it or display a filler label.

## Rendering rules
Existing Supabase year, engine, acceleration, and listing_type fields (if present) are preserved by mapCar; known source facts only fill gaps. No pricing, rental terms, photos, or live database records were changed. The shared renderer omits unknown specification cells in both server and browser HTML. A category disclosure requires explicit `listing_type: category`; missing specs alone do not make a listing a category. Current listings reference individual supplier listings and their galleries. The pictured-vehicle disclosure states that substitutions require customer approval.
