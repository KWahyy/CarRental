const availability='pending_team_confirmation';
export function isPublicRentalPath(path){
 const p=path.replace(/\.html$/,'').replace(/\/$/,'')||'/';
 return /^\/(cars|locations|guides)\/[a-z0-9-]+$/.test(p)||['/','/fleet','/lamborghini','/ferrari','/porsche','/rolls-royce','/exotic-car-rental','/wedding','/partner','/about','/faq','/rental-policies','/guides'].includes(p);
}
export function rentalToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
const str=(description,maxLength=120)=>({type:'string',description,maxLength});
const trip={pickup_date:{...str('Requested pickup date in YYYY-MM-DD format.',10),format:'date'},return_date:{...str('Requested return date in YYYY-MM-DD format.',10),format:'date'},delivery_city:str('Requested Southern California delivery city or ZIP. Delivery requires team confirmation.')};
function validate(input,properties,required,today){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Provide an object containing the tool parameters.');
 for(const key of required)if(input[key]===undefined||input[key]==='')throw Error(`Provide ${key}.`);
 for(const [key,value] of Object.entries(input)){
  const rule=properties[key];if(!rule)throw Error(`Unsupported parameter: ${key}.`);
  if(typeof value!==rule.type)throw Error(`${key} must be a ${rule.type}.`);
  if(rule.type==='string'&&(value.length>rule.maxLength||!value.trim()))throw Error(`${key} must contain 1–${rule.maxLength} characters.`);
  if(rule.type==='number'&&(!Number.isFinite(value)||value<0))throw Error(`${key} must be a finite nonnegative number.`);
 }
 for(const key of ['pickup_date','return_date'])if(input[key]){
  const s=input[key],date=new Date(s+'T12:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==s)throw Error(`${key} must be a valid calendar date (YYYY-MM-DD).`);
  if(s<today())throw Error(`${key} cannot be in the past.`);
 }
 if(input.return_date&&!input.pickup_date)throw Error('Provide pickup_date with return_date.');
 if(input.return_date<input.pickup_date)throw Error('return_date must be on or after pickup_date.');
}
function vehicleView(car){
 return {slug:car.slug,name:String(car.name||''),make:String(car.make||''),model:String(car.model||''),category:String(car.category_label||car.category||''),starting_daily_rate:Number(car.price)>0?Number(car.price):null,currency:'USD',daily_rate_type:'starting_price',seats:car.seats||null,color:car.color||null,mileage:car.mileage||'Confirm the allowance with the team.',url:'/cars/'+car.slug,availability};
}
export function createRentalTools({loadInventory,loadPolicies,prepare,today=rentalToday}){
 const define=(name,description,properties,required,readOnly,execute)=>({name,description,inputSchema:{type:'object',properties,required,additionalProperties:false},annotations:{readOnlyHint:readOnly,untrustedContentHint:true},execute:async(input={},options={})=>{
  try{validate(input,properties,required,today);if(options.signal?.aborted)return {error:'Request cancelled.'};return await execute(input,options);}catch(error){return {error:error.validationMessage||error.message||'Unable to process this request.'};}
 }});
 const inventory=async(signal)=>{let result;try{result=await loadInventory({signal});}catch{throw Error('The public fleet is temporarily unavailable. Try again or contact the booking desk.');}if(signal?.aborted)throw Error('Request cancelled.');if(!Array.isArray(result?.fleet))throw Error('The public fleet is temporarily unavailable.');return result.fleet.filter(car=>car.is_active!==false&&/^[a-z0-9][a-z0-9-]*$/.test(car.slug));};
 const getVehicle=async(slug,signal)=>{const car=(await inventory(signal)).find(c=>c.slug===slug);if(!car)throw Error('Vehicle not found in the current public fleet. Search the fleet for a current vehicle_slug.');return vehicleView(car);};
 return [
 define('search_rental_vehicles','Search Prestige Luxor’s public fleet by vehicle, category and starting daily rate. Requested dates and delivery are preferences, not a live availability check.',{query:str('Make, model or body style to match.'),max_daily_rate:{type:'number',minimum:0,description:'Maximum starting daily rate in USD, excluding delivery and other charges.'},...trip},[],true,async(input,{signal})=>{
 const terms=(input.query||'').toLowerCase().split(/\s+/).filter(Boolean);
 const vehicles=(await inventory(signal)).map(vehicleView).filter(v=>terms.every(t=>`${v.name} ${v.make} ${v.model} ${v.category}`.toLowerCase().includes(t))&&(input.max_daily_rate===undefined||(v.starting_daily_rate!==null&&v.starting_daily_rate<=input.max_daily_rate)));
 return {vehicles,requested_trip:{pickup_date:input.pickup_date||null,return_date:input.return_date||null,delivery_city:input.delivery_city||null},availability,notice:'Published starting rates only. Vehicle availability, delivery eligibility and the final total require personal confirmation.'};
 }),
 define('get_rental_details','Read a vehicle’s published rental details and the current rental-policy page. Use the exact slug returned by fleet search.',{vehicle_slug:str('Exact public vehicle slug.')},['vehicle_slug'],true,async({vehicle_slug},{signal})=>{
 const vehicle=await getVehicle(vehicle_slug,signal);let policies;try{policies=await loadPolicies({signal});}catch{policies={url:'/rental-policies',notice:'Policy text could not be loaded. Review the linked policy page with the customer.'};}if(signal?.aborted)return {error:'Request cancelled.'};return {vehicle,policies,availability};
 }),
 define('prepare_reservation_request','Prepare a visible reservation review for the customer. The customer enters contact details and personally submits the request. Preparing does not send a lead or reserve a vehicle.',{vehicle_slug:str('Exact public vehicle slug.'),...trip,notes:str('Optional timing, passenger or occasion preferences. Do not include payment or identity documents.',1000)},['vehicle_slug','pickup_date','return_date','delivery_city'],false,async(input,{signal})=>{
 const vehicle=await getVehicle(input.vehicle_slug,signal);if(signal?.aborted)return {error:'Request cancelled.'};return prepare({vehicle,pickup_date:input.pickup_date,return_date:input.return_date,delivery_city:input.delivery_city.trim(),notes:input.notes||''});
 })];
}
export async function registerRentalTools(context,tools,{signal}={}){
 if(typeof context?.registerTool!=='function')return false;
 for(const tool of tools)await context.registerTool(tool,{signal});
 return true;
}
