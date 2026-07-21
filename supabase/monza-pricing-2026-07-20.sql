-- Match KD's Exotics rates to Monza's advertised rates for defensible model matches.
with pricing(slug, price, competitor_model) as (
  values
    ('2021-bmw-m3-comp', 495, 'BMW M3 G80'),
    ('bmw-m3-gloss-grey', 495, 'BMW M3 G80'),
    ('bmw-m3-frozen-white', 495, 'BMW M3 G80'),
    ('bmw-m3-isle-man-green', 495, 'BMW M3 G80'),
    ('2022-porsche-911-carrera', 595, 'Porsche 911 Carrera 4S'),
    ('porsche-911-carrera-gts', 595, 'Porsche 911 Carrera 4S'),
    ('porsche-911-carrera-red', 595, 'Porsche 911 Carrera 4S'),
    ('2022-lamborghini-huracan', 1295, 'Lamborghini Huracan Evo Spyder'),
    ('lamborghini-huracan-evo', 995, 'Lamborghini Huracan EVO'),
    ('lamborghini-huracan-spyder-white', 1295, 'Lamborghini Huracan Evo Spyder'),
    ('lamborghini-huracan-spyder', 1295, 'Lamborghini Huracan Evo Spyder'),
    ('2019-mercedes-g63-amg', 695, 'Mercedes G63 AMG'),
    ('mercedes-brabus-g-wagon', 895, 'Mercedes Brabus G800'),
    ('mercedes-g-wagon-black', 695, 'Mercedes G63 AMG'),
    ('mercedes-g-wagon-blue', 695, 'Mercedes G63 AMG'),
    ('mercedes-g-wagon-silver', 695, 'Mercedes G63 AMG'),
    ('2022-cadillac-escalade', 595, 'Cadillac Escalade'),
    ('cadillac-escalade-white', 595, 'Cadillac Escalade'),
    ('cadillac-escalade-esv', 595, 'Cadillac Escalade ESV Platinum'),
    ('2020-lamborghini-urus', 995, 'Lamborghini Urus'),
    ('lamborghini-urus-white', 995, 'Lamborghini Urus'),
    ('lamborghini-urus-black', 995, 'Lamborghini Urus'),
    ('lamborghini-urus-grey', 995, 'Lamborghini Urus'),
    ('lamborghini-urus-blue', 995, 'Lamborghini Urus'),
    ('lamborghini-urus-s-black', 1095, 'Lamborghini Urus S'),
    ('lamborghini-urus-performante-white', 1295, 'Lamborghini Urus Performante'),
    ('lamborghini-widebody-urus-black', 1195, 'Lamborghini Urus Widebody'),
    ('lamborghini-mansory-urus', 1195, 'Lamborghini Urus Widebody'),
    ('land-rover-range-rover', 595, 'Range Rover P400 SE'),
    ('land-rover-sport-white', 395, 'Range Rover Sport'),
    ('mercedes-maybach-gls-600-black', 795, 'Mercedes Maybach GLS 600'),
    ('mercedes-maybach-gls-600-white-and-black', 795, 'Mercedes Maybach GLS 600'),
    ('mercedes-maybach-gls-600-white', 795, 'Mercedes Maybach GLS 600'),
    ('mercedes-maybach-grey', 795, 'Mercedes Maybach S580'),
    ('ferrari-f8', 1595, 'Ferrari F8 Tributo'),
    ('corvette-c8-z06-grey', 595, 'Chevrolet Corvette Z06'),
    ('corvette-c8-z06-black', 595, 'Chevrolet Corvette Z06'),
    ('corvette-c8-z06-navy-blue', 595, 'Chevrolet Corvette Z06'),
    ('rolls-royce-cullinan-white', 1495, 'Rolls-Royce Cullinan'),
    ('rolls-royce-dawn-convertible-white', 1095, 'Rolls-Royce Dawn')
)
update public.cars as car
set
  price = pricing.price,
  competitor_price = pricing.price,
  competitor_name = 'Monza Exotics · ' || pricing.competitor_model,
  competitor_url = 'https://monzaexotics.com/catalog/',
  competitor_checked_at = date '2026-07-20'
from pricing
where car.slug = pricing.slug;
