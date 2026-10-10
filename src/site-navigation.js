const header=document.querySelector('[data-shared-header]');
if(header) {
 const button=header.querySelector('[data-menu-toggle]'),menu=document.querySelector('#site-mobile-menu');
 const desktop=matchMedia('(min-width: 901px)');
 const setOpen=(open,restore=false)=>{
  button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Close navigation':'Open navigation');
  menu.hidden=!open;menu.classList.toggle('open',open);
  if(restore)button.focus({preventScroll:true});
 };
 button.addEventListener('click',()=>setOpen(menu.hidden));
 menu.addEventListener('click',event=>{if(event.target.closest('a'))setOpen(false);});
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!menu.hidden){event.preventDefault();setOpen(false,true);}
 });
 document.addEventListener('click',event=>{if(!menu.hidden&&!menu.contains(event.target)&&!header.contains(event.target))setOpen(false);});
 document.addEventListener('focusin',event=>{if(!menu.hidden&&!menu.contains(event.target)&&!header.contains(event.target))setOpen(false);});
 desktop.addEventListener('change',()=>{if(desktop.matches)setOpen(false);});
 const scroll=()=>header.classList.toggle('scrolled',header.dataset.home!=='true'||scrollY>24);
 addEventListener('scroll',scroll,{passive:true});scroll();
 addEventListener('pageshow',()=>setOpen(false));
}
