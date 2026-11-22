const nav = document.querySelector('.admin-crm-nav');
const sheet = document.querySelector('#workspace-sheet');
const opener = document.querySelector('[data-workspace-menu]');
const titles = {overview:'Overview',vehicles:'Fleet',requests:'Quotes',customers:'Customers',invoices:'Invoices',agreements:'Agreements',bookings:'Bookings',settings:'Settings'};
const paths = {
  overview:'M3 3h7v7H3z M14 3h7v4h-7z M14 11h7v10h-7z M3 14h7v7H3z',
  vehicles:'M3 14l2-6h14l2 6v5h-2v-2H5v2H3z M4 13h16 M7 15h2m6 0h2',
  requests:'M8 4h12v15H8z M4 8v13h12 M11 9h6m-6 4h5', customers:'M13 9a3 3 0 1 1-6 0 3 3 0 1 1 6 0 M3 20v-2a7 7 0 0 1 14 0v2 M16 6a3 3 0 0 1 0 6m2 3q3 1 3 5',
  invoices:'M5 3l2 1 2-1 3 1 3-1 2 1 2-1v18l-3-1-4 1-4-1-3 1z M8 9h8m-8 4h6',
  agreements:'M4 19l1-5L16 3l4 4L9 18z M3 21h18', bookings:'M3 6h18v15H3z M7 3v6m10-6v6M3 11h18m-14 4h3',
  settings:'M3 7h6m4 0h8M3 17h10m4 0h4 M13 7a2 2 0 1 1-4 0 2 2 0 1 1 4 0 M17 17a2 2 0 1 1-4 0 2 2 0 1 1 4 0',
  more:'M4 7h16M4 12h16M4 17h16'
};
function addIcon(button,key) {
  button.insertAdjacentHTML('afterbegin', `<svg class="dispatch-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[key]}"/></svg>`);
}
for(const button of nav.querySelectorAll('[data-crm-section]')) {
  const key = button.dataset.crmSection;
  if(!['overview','bookings','vehicles'].includes(key)) {
    const link = document.createElement('button');
    link.type='button'; link.dataset.workspaceTab=key; link.textContent=titles[key];
    sheet.querySelector('nav').append(link);
  }
  addIcon(button,key);
}
const shortcuts = [...document.querySelectorAll('[data-workspace-tab]')];
for(const button of shortcuts) {
  addIcon(button,button.dataset.workspaceTab);
  button.addEventListener('click',()=>{
    if(sheet.open) sheet.close();
    nav.querySelector(`[data-crm-section="${button.dataset.workspaceTab}"]`).click();
    window.scrollTo(0,0);
  });
}
addIcon(opener,'more');
opener.addEventListener('click',()=>{
  sheet.showModal(); opener.setAttribute('aria-expanded','true'); document.body.classList.add('dispatch-menu-open');
});
sheet.querySelector('[data-workspace-close]').addEventListener('click',()=>sheet.close());
sheet.addEventListener('click',event=>{
  const rect=sheet.getBoundingClientRect();
  if(event.target===sheet && (event.clientY<rect.top||event.clientX<rect.left||event.clientX>rect.right)) sheet.close();
});
sheet.addEventListener('close',()=>{
  opener.setAttribute('aria-expanded','false'); document.body.classList.remove('dispatch-menu-open');
});
matchMedia('(min-width:761px)').addEventListener('change',()=>{if(sheet.open)sheet.close();});
function sync(section) {
  document.querySelector('[data-workspace-title]').textContent=titles[section]||titles.overview;
  for(const button of shortcuts) {
    if(section===button.dataset.workspaceTab)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  }
  if(!['overview','bookings','vehicles'].includes(section))opener.setAttribute('aria-current','page');else opener.removeAttribute('aria-current');
}
window.addEventListener('prestige:section-changed',e=>sync(e.detail));
sync(nav.querySelector('.active')?.dataset.crmSection||'overview');
