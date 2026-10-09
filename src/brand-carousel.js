const rail=document.querySelector('[data-brand-grid]');
const dots=document.querySelector('[data-brand-dots]');
const prev=document.querySelector('[data-brand-prev]');
const next=document.querySelector('[data-brand-next]');
if(rail && dots && prev && next){
 let targets=[0],drag=null,suppressClick=false;
 const behavior=()=>matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
 const current=()=>targets.reduce((best,x,i)=>Math.abs(x-rail.scrollLeft)<Math.abs(targets[best]-rail.scrollLeft)?i:best,0);
 function sync(){
  const index=current();prev.disabled=rail.scrollLeft<=2;next.disabled=rail.scrollLeft>=rail.scrollWidth-rail.clientWidth-2;
  [...dots.children].forEach((dot,i)=>{dot.classList.toggle('active',i===index);dot.setAttribute('aria-current',i===index?'true':'false');});
 }
 function go(index){rail.scrollTo({left:targets[Math.max(0,Math.min(index,targets.length-1))],behavior:behavior()});}
 function rebuild(){
  const cards=[...rail.children],max=Math.max(0,rail.scrollWidth-rail.clientWidth);
  const step=cards.length>1?cards[1].offsetLeft-cards[0].offsetLeft:rail.clientWidth;
  const perPage=Math.max(1,Math.floor((rail.clientWidth+parseFloat(getComputedStyle(rail).columnGap||0))/Math.max(1,step)));
  targets=[0];for(let i=perPage;i<cards.length && targets.at(-1)<max;i+=perPage)targets.push(Math.min(max,cards[i].offsetLeft-cards[0].offsetLeft));
  dots.replaceChildren(...targets.map((_,i)=>{const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',`Show brand group ${i+1}`);button.addEventListener('click',()=>go(i));return button;}));
  sync();
 }
 prev.addEventListener('click',()=>go(current()-1));next.addEventListener('click',()=>go(current()+1));
 rail.addEventListener('scroll',sync,{passive:true});
 rail.addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();go(current()+(event.key==='ArrowRight'?1:-1));}});
 rail.addEventListener('dragstart',event=>event.preventDefault());
 rail.addEventListener('pointerdown',event=>{
  suppressClick=false;
  if(event.pointerType==='touch'||event.button!==0)return;
  drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:rail.scrollLeft,moved:false};
 });
 rail.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.id)return;
  const dx=event.clientX-drag.x;
  if(!drag.moved){if(Math.abs(dx)<8||Math.abs(dx)<Math.abs(event.clientY-drag.y))return;drag.moved=true;rail.setPointerCapture(event.pointerId);rail.classList.add('is-dragging');}
  event.preventDefault();rail.scrollLeft=drag.left-dx;suppressClick=true;
 });
 function finish(){if(!drag)return;const id=drag.id;drag=null;rail.classList.remove('is-dragging');if(rail.hasPointerCapture(id))rail.releasePointerCapture(id);sync();}
 rail.addEventListener('pointerup',finish);rail.addEventListener('pointercancel',finish);rail.addEventListener('lostpointercapture',finish);
 rail.addEventListener('click',event=>{if(suppressClick){event.preventDefault();event.stopImmediatePropagation();suppressClick=false;}},true);
 new ResizeObserver(rebuild).observe(rail);
 new MutationObserver(rebuild).observe(rail,{childList:true});
 rebuild();
}
