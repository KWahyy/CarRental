const sidebar = document.querySelector('#admin-sidebar');
const toggle = document.querySelector('[data-workspace-menu]');
const symbols = {overview:'◫',vehicles:'◇',requests:'↗',customers:'◎',invoices:'▤',agreements:'▧',bookings:'▦',settings:'⚙'};
document.querySelectorAll('[data-crm-section]').forEach(button => {
  // Keep decorative symbols out of accessible labels.
  const icon = document.createElement('span'); icon.textContent = symbols[button.dataset.crmSection] || '·'; icon.setAttribute('aria-hidden','true'); icon.className = 'workspace-nav-icon'; button.prepend(icon);
});
function closeMenu(restore = false) { sidebar?.removeAttribute('data-mobile-open'); toggle?.setAttribute('aria-expanded','false'); if (toggle) toggle.textContent='Menu'; if (restore) toggle?.focus(); }
toggle?.addEventListener('click', () => { const open=toggle.getAttribute('aria-expanded')!=='true'; sidebar?.toggleAttribute('data-mobile-open',open); toggle.setAttribute('aria-expanded',String(open)); toggle.textContent=open?'Close':'Menu'; });
sidebar?.addEventListener('click', event => { if(event.target.closest('[data-crm-section]')) closeMenu(toggle?.getAttribute('aria-expanded')==='true'); });
document.addEventListener('keydown',event=>{ if(event.key==='Escape'&&toggle?.getAttribute('aria-expanded')==='true')closeMenu(true); });
document.addEventListener('click',event=>{if(toggle?.getAttribute('aria-expanded')==='true'&&!sidebar.contains(event.target)&&!toggle.contains(event.target))closeMenu();});
matchMedia('(min-width:761px)').addEventListener('change',()=>closeMenu());
