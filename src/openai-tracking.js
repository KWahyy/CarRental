import { safeMeasurementSearch, safeMeasurementReferrer } from './ad-measurement-url.js';
// Browser-only ChatGPT ads measurement. No contact fields or reservation values are sent.
export const OPENAI_PIXEL_ID = 'JCcp8rMdEEvmBLpF1NDJG7';
export function createOpenAITracking(env) {
 let consent=false, initialized=false;
 const sent=new Set();
 function permitted(){
  const {location,document,navigator}=env;
  if(!['prestigeluxor.com','www.prestigeluxor.com'].includes(location.hostname)||navigator.globalPrivacyControl)return false;
  if(!/^\/(?:$|fleet\/?$|wedding\/?$|(?:lamborghini|ferrari|porsche|rolls-royce)\/?$|(?:cars|locations|guides)\/[a-z0-9-]+\/?$)/.test(location.pathname))return false;
  if (!safeMeasurementSearch(location.search) || !safeMeasurementReferrer(document.referrer)) return false;
  return true;
 }
 function setConsent(allowed){
  consent=allowed===true;
  if(!consent){if(initialized)env.oaiq('consent',false);return;}
  if(!permitted())return;
  if(initialized){env.oaiq('consent',true);return;}
  if(env.oaiq)return; // Never take over an unknown integration.
  const q=function(){q.q.push(arguments);};q.q=[];env.oaiq=q;
  q('consent',true);
  q('init',{pixelId:OPENAI_PIXEL_ID,debug:false});
  const script=env.document.createElement('script');script.async=true;
  script.src='https://bzrcdn.openai.com/sdk/oaiq.min.js';
  env.document.head.append(script);initialized=true;
 }
 function lead(result,payload={}){
  if(!consent||!initialized||!permitted()||!result?.ok||!result.id)return;
  if(payload.requestType==='partner'||/partner|consignment/i.test(payload.source||''))return;
  const id=String(result.id);if(sent.has(id))return;
  env.oaiq('measure','lead_created',{type:'customer_action'});sent.add(id);
 }
 return {setConsent,lead};
}
let tracker;
function instance(){return tracker??=createOpenAITracking(window);}
export const setOpenAIConsent=allowed=>instance().setConsent(allowed);
export const trackOpenAILead=(result,payload)=>instance().lead(result,payload);
