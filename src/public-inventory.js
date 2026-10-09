import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';
export function inventoryMonth(now = new Date()) {
 const parts = new Intl.DateTimeFormat('en-CA', {year:'numeric',month:'2-digit',timeZone:'America/Los_Angeles'}).formatToParts(now);
 return parts.find(p=>p.type==='year').value+'-'+parts.find(p=>p.type==='month').value;
}
export async function loadPublicInventory({fetcher=fetch, timeout=3000}={}) {
 const month=inventoryMonth();
 const headers={apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${SUPABASE_PUBLISHABLE_KEY}`};
 const get=async(table,params)=>{
  const url=new URL('/rest/v1/'+table,SUPABASE_URL);url.search=new URLSearchParams(params);
  const response=await fetcher(url,{headers,signal:AbortSignal.timeout(timeout)});
  if(!response.ok)throw new Error(`Public inventory unavailable (${response.status})`);
  return response.json();
 };
 const [fleet,specials]=await Promise.all([
  get('cars',{select:'slug,name,make,model,category,category_label,price,mileage,seats,color,summary,image_url,tags,details,updated_at,car_photos(position,url)',is_active:'eq.true',order:'name.asc'}),
  get('monthly_specials',{select:'month,headline,description,car_slugs',month:'eq.'+month}).catch(()=>[])
 ]);
 if(!Array.isArray(fleet))throw new Error('Invalid public inventory response');
 return {fleet:fleet.filter(car=>/^[a-z0-9][a-z0-9-]*$/.test(car.slug)),special:specials[0]||null,month};
}
