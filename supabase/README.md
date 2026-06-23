# KD's Exotics Supabase Setup

1. Open your Supabase project.
2. Go to SQL Editor and run `supabase/schema.sql`.
3. Copy your Project URL from Project Settings > API.
4. Paste it into `src/supabase-config.js` as `SUPABASE_URL`.
5. In Authentication > Users, create your owner/admin user with your private email and password.
6. Open `/admin/`, sign in, then click `Seed current fleet`.

The admin uses:
- `cars` for vehicle details.
- `car_photos` for numbered photos. Position `1` is the main image.
- `car_available_dates` for dates the car is available to book.
- Supabase Storage bucket `fleet` for uploaded photos.

The public site keeps the current local fleet as fallback. When Supabase is configured and seeded, the homepage and car pages load the Supabase fleet automatically.
