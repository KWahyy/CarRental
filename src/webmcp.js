import {createRentalTools,isPublicRentalPath,registerRentalTools} from './webmcp-core.js';
import {loadPublicInventory} from './public-inventory.js';
import {createReservationReview} from './webmcp-review.js';
// Progressive enhancement: no globals, polyfills, CRM data or automatic submission.
const context=document.modelContext||navigator.modelContext;
if(isPublicRentalPath(location.pathname)&&typeof context?.registerTool==='function'){
 const controller=new AbortController();
 const legacy=!document.modelContext;
 const style=document.createElement('link');style.rel='stylesheet';style.href='/src/webmcp.css';document.head.append(style);
 const prepare=createReservationReview({document,isProduction:['www.prestigeluxor.com','prestigeluxor.com'].includes(location.hostname),submit:async payload=>{
  const {submitQuoteRequest}=await import('./quote-api.js?v=lead-conversion-20260906');
  return submitQuoteRequest({...payload,pageUrl:location.href});
 }});
 const tools=createRentalTools({loadInventory:()=>loadPublicInventory(),prepare,loadPolicies:async({signal})=>{
  const response=await fetch('/rental-policies',{signal});if(!response.ok)throw Error('Policy unavailable');
  const parsed=new DOMParser().parseFromString(await response.text(),'text/html');
  const main=parsed.querySelector('main');if(!main)throw Error('Policy unavailable');
  main.querySelectorAll('script,style,nav,form,.seo-delivery-nav').forEach(el=>el.remove());
  return {url:'/rental-policies',text:main.textContent.replace(/\s+/g,' ').trim().slice(0,24000)};
 }});
 // Older experimental implementations expect an MCP content envelope.
 const registeredTools=legacy?tools.map(tool=>({...tool,execute:async(...args)=>({content:[{type:'text',text:JSON.stringify(await tool.execute(...args))}]})})):tools;
 registerRentalTools(context,registeredTools,{signal:controller.signal}).catch(()=>{controller.abort();});
 // Keep bfcache restores usable; the document owns the registrations.
 window.addEventListener('pagehide',event=>{if(!event.persisted)controller.abort();});
}
