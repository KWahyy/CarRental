import { decorateDateFields } from './date-fields.js';
// Public navigation has one source of truth. Private documents/admin deliberately opt out.
export const primaryNavigation = [
  ['Fleet','/fleet'],['Weddings','/wedding'],['Consignment','/partner'],
];
const footerGroups = [
 ['Explore',[...primaryNavigation,['Customer experience','/#customer-care'],['Start a reservation','/#quote']]],
 ['Destinations',[['Los Angeles','/locations/los-angeles-exotic-car-rental'],['Orange County','/locations/orange-county-exotic-car-rental'],['Palm Springs','/locations/palm-springs-exotic-car-rental'],['San Diego','/locations/san-diego-exotic-car-rental']]],
 ['Company',[['About us','/about'],['Rental policies','/rental-policies'],['FAQ','/faq'],['Privacy','/privacy'],['Terms','/terms'],['Instagram','https://www.instagram.com/prestige.luxor/'],['Admin login','/admin/']]],
];
const links = (items,path) => items.map(([label,href])=>`<a href="${href}"${path===href?' aria-current="page"':''}${href==='/admin/'?' rel="nofollow"':''}>${label}</a>`).join('');
export function applySiteChrome(document,{path='/',year=2026}={}) {
 path=path.replace(/\.html$/,'').replace(/\/index$/,'/')||'/';
 if(/^\/(admin(?:\/|$)|quote$|agreement$)/.test(path)) return;
 if(!document.querySelector('main')) return;
 decorateDateFields(document);
 const home=path==='/';
 const reserve=document.querySelector('#vehicle-request')?'#vehicle-request':document.querySelector('#location-quote')?'#location-quote':'/#quote';
 const header=`<header class="site-header shared-site-header${home?'':' scrolled'}" data-header data-shared-header data-home="${home}">
 <a class="brand" href="/" aria-label="Prestige Luxor home"><img class="brand-logo brand-logo-wide" src="/assets/prestige-luxor-logo-light.png" alt="Prestige Luxor" width="1684" height="315" /></a>
 <nav class="desktop-nav" aria-label="Primary navigation">${links(primaryNavigation,path)}</nav>
 <div class="header-actions"><a class="ghost-button" href="tel:+19496200024" aria-label="Call Prestige Luxor">Call</a><a class="primary-button compact" href="${reserve}">Reserve</a></div>
 <a class="mobile-header-call" href="tel:+19496200024" aria-label="Call Prestige Luxor">Call</a>
 <button class="menu-toggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="site-mobile-menu" data-menu-toggle><span></span><span></span></button></header>`;
 const mobile=`<nav class="mobile-menu shared-mobile-menu" id="site-mobile-menu" data-mobile-menu aria-label="Mobile navigation" hidden>${links(primaryNavigation,path)}<a href="tel:+19496200024">Call</a><a href="${reserve}">Reserve</a></nav>`;
 const footer=`<footer class="site-footer shared-site-footer"><div class="footer-main"><a class="brand footer-brand" href="/" aria-label="Prestige Luxor home"><span class="footer-logo-frame"><img class="brand-logo-wide" src="/assets/prestige-luxor-logo-light.png" alt="Prestige Luxor" width="1684" height="315" loading="lazy" /></span></a><p>A private automotive concierge for clients who expect discretion, precision, and presence.</p><div class="footer-contact"><a href="tel:+19496200024">Call (949) 620-0024</a><a href="sms:+19496200024">Text concierge</a><a href="mailto:Contact@prestigeluxor.com">Email</a></div></div><div class="footer-columns">${footerGroups.map(([label,items])=>`<nav class="footer-links" aria-label="Footer ${label.toLowerCase()}"><h3>${label}</h3>${links(items,path)}</nav>`).join('')}</div><div class="footer-bottom"><span>© ${year} Prestige Luxor. All rights reserved.</span><span>Rental approval required. Rates subject to availability.</span></div></footer>`;
 document.querySelectorAll('body > header,[data-mobile-menu],body > footer').forEach(node=>node.remove());
 document.body.insertAdjacentHTML('afterbegin',header+mobile);
 document.body.insertAdjacentHTML('beforeend',footer);
 if(!document.querySelector('[data-shared-nav-script]'))document.body.insertAdjacentHTML('beforeend','<script type="module" src="/src/site-navigation.js" data-shared-nav-script></script>');
 if(!document.querySelector('[data-public-mobile-style]'))document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="/src/public-mobile.css" data-public-mobile-style />');
 if(!document.querySelector('[data-shared-nav-style]'))document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="/src/site-navigation.css" data-shared-nav-style />');
}
