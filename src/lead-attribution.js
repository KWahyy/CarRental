// Session-scoped acquisition history. Never store contact fields or arbitrary URL queries.
export const ATTRIBUTION_KEY = 'prestige_luxor_attribution';
const KEYS = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','gbraid','wbraid','fbclid'];
const text = v => typeof v === 'string' ? v.slice(0,240) : '';
function sourceFor(url, referrer) {
 if (['gclid','gbraid','wbraid'].some(k=>url.searchParams.has(k))) return {source:'google',channel:'paid_search'};
 if (url.searchParams.has('fbclid')) return {source:'meta',channel:'paid_social'};
 const source=text(url.searchParams.get('utm_source'));
 const medium=text(url.searchParams.get('utm_medium'));
 const host=referrer ? new URL(referrer).hostname.replace(/^www\./,'') : '';
 const candidate=(source||host).toLowerCase();
 const ai=/^(chatgpt(?:\.com)?|chat\.openai\.com|perplexity(?:\.ai)?|claude(?:\.ai)?|gemini\.google\.com|copilot\.microsoft\.com)$/;
 return {source:source||host||'direct_or_unknown',channel:/^(cpc|ppc|paid|paid_search|paid_social)$/i.test(medium)?'paid':ai.test(candidate)?'ai_referral':source?'campaign':/^(www\.)?(google\.[a-z.]+|bing\.com|search\.yahoo\.com|duckduckgo\.com)$/.test(host)?'organic_search':host?'referral':'direct_or_unknown'};
}
function safeReferrer(value,origin) {
 try {const u=new URL(value);return /^https?:$/.test(u.protocol)&&u.origin!==origin?u.origin+u.pathname:'';} catch{return '';}
}
export function captureAttribution({href,referrer='',storage,now=new Date().toISOString()}) {
 const url=new URL(href), external=safeReferrer(referrer,url.origin);
 let saved={};try{saved=JSON.parse(storage?.getItem(ATTRIBUTION_KEY)||'{}')||{};}catch{}
 const incoming=Object.fromEntries(KEYS.map(k=>[k,text(url.searchParams.get(k))]).filter(([,v])=>v));
 const touch={...incoming,...sourceFor(url,external),landing_page:url.pathname,first_referrer:external||'direct_or_unknown',captured_at:now};
 // Keep legacy session attribution without pretending its original acquisition was known.
 const legacy=saved.landing_page&&!saved.first_touch?{...Object.fromEntries(KEYS.filter(k=>saved[k]).map(k=>[k,text(saved[k])])),source:text(saved.utm_source)||'unknown',channel:'legacy_unclassified',landing_page:String(saved.landing_page).split(/[?#]/)[0],first_referrer:safeReferrer(saved.first_referrer,url.origin)||'direct_or_unknown'}:null;
 const first=saved.first_touch||legacy||touch;
 const latest=Object.keys(incoming).length||external?touch:saved.latest_touch||first;
 const result={...first,first_touch:first,latest_touch:latest,submission_page:url.pathname};
 try{storage?.setItem(ATTRIBUTION_KEY,JSON.stringify(result));}catch{}
 return result;
}
export function currentAttribution() {
 let storage;try{storage=window.sessionStorage;}catch{}
 return captureAttribution({href:window.location.href,referrer:document.referrer,storage});
}
