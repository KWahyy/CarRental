const video=document.querySelector('[data-customer-review]');
const play=document.querySelector('[data-review-play]');
if(video && play){
 play.hidden=false;
 play.addEventListener('click',async()=>{
  try{video.muted=false;await video.play();play.hidden=true;}
  catch{play.hidden=true;video.controls=true;video.focus();}
 });
 video.addEventListener('play',()=>{play.hidden=true;});
 video.addEventListener('ended',()=>{play.hidden=false;});
}
