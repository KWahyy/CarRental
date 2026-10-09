const localDate = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const parseDate = value => new Date(`${value}T12:00:00`);
const today = () => localDate(new Date());

export function enhanceDatePicker(input) {
  const field = input.parentElement;
  const label = input.getAttribute('aria-label');
  const trigger = field.querySelector('.hero-date-trigger') || document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'hero-date-trigger';
  trigger.setAttribute('aria-haspopup','dialog');
  trigger.setAttribute('aria-expanded','false');
  const text = trigger.firstElementChild || document.createElement('span');
  const icon = trigger.querySelector('.hero-calendar-icon') || document.createElement('span');
  icon.className = 'hero-calendar-icon';
  icon.setAttribute('aria-hidden','true');
  trigger.append(text,icon);
  const popup = document.createElement('div');
  popup.id = `hero-calendar-${input.name}`;
  popup.className = 'hero-calendar';
  popup.setAttribute('role','dialog');
  popup.setAttribute('aria-label',`Choose ${label.toLowerCase()}`);
  popup.setAttribute('aria-hidden','true');
  popup.inert = true;
  trigger.setAttribute('aria-controls',popup.id);
  document.body.append(popup);
  let month, focusedDate, isOpen = false;
  const minDate = () => input.min || today();
  const sync = () => {
    text.textContent = input.value ? new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(parseDate(input.value)) : 'Select date';
    trigger.classList.toggle('has-date',Boolean(input.value));
    trigger.setAttribute('aria-label',`${label}: ${text.textContent}`);
  };
  const close = (restore = false) => {
    isOpen = false;
    popup.classList.remove('calendar-open');
    popup.setAttribute('aria-hidden','true');
    popup.inert = true;
    trigger.setAttribute('aria-expanded','false');
    if (restore) trigger.focus({preventScroll:true});
  };
  const position = () => {
    const rect = trigger.getBoundingClientRect();
    const width = popup.offsetWidth, height = popup.offsetHeight;
    const top = rect.top > height + 20 ? rect.top - height - 14 : rect.bottom + 14;
    const viewportWidth = document.documentElement.clientWidth;
    const left = viewportWidth <= 600 ? (viewportWidth-width)/2 : rect.left-12;
    popup.style.left = `${Math.max(12,Math.min(left,viewportWidth-width-12))}px`;
    popup.style.top = `${Math.max(12,Math.min(top,window.innerHeight-height-12))}px`;
  };
  const focusDay = () => popup.querySelector(`[data-date="${focusedDate}"]`)?.focus({preventScroll:true});
  const changeMonth = amount => {
    month = new Date(month.getFullYear(),month.getMonth()+amount,1,12);
    focusedDate = localDate(month) < minDate() ? minDate() : localDate(month);
    render();
    focusDay();
  };
  const render = () => {
    popup.replaceChildren();
    const header = document.createElement('div');
    header.className = 'hero-calendar-header';
    const title = document.createElement('strong');
    title.textContent = new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric'}).format(month);
    title.setAttribute('aria-live','polite');
    for (const [amount,name,symbol] of [[-1,'Previous month','‹'],[1,'Next month','›']]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = symbol;
      button.setAttribute('aria-label',name);
      button.disabled = amount < 0 && localDate(month).slice(0,7) <= minDate().slice(0,7);
      button.addEventListener('click',()=>changeMonth(amount));
      header.append(button);
      if (amount < 0) header.append(title);
    }
    const weekdays = document.createElement('div');
    weekdays.className = 'hero-calendar-weekdays';
    weekdays.setAttribute('aria-hidden','true');
    for (const day of ['Su','Mo','Tu','We','Th','Fr','Sa']) {
      const span = document.createElement('span'); span.textContent = day; weekdays.append(span);
    }
    const days = document.createElement('div');
    days.className = 'hero-calendar-days';
    days.setAttribute('role','group');
    days.setAttribute('aria-label',title.textContent);
    const first = new Date(month.getFullYear(),month.getMonth(),1,12);
    const last = new Date(month.getFullYear(),month.getMonth()+1,0,12).getDate();
    for (let cell = 0; cell < 42; cell++) {
      const day = cell - first.getDay() + 1;
      if (day < 1 || day > last) { const blank=document.createElement('span'); blank.setAttribute('aria-hidden','true'); days.append(blank); continue; }
      const date = new Date(month.getFullYear(),month.getMonth(),day,12), value = localDate(date);
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = day;
      button.dataset.date = value;
      button.disabled = value < minDate();
      button.tabIndex = value === focusedDate ? 0 : -1;
      button.setAttribute('aria-label',new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(date));
      button.setAttribute('aria-pressed',String(value === input.value));
      if (value === today()) button.setAttribute('aria-current','date');
      button.addEventListener('click',()=>{
        input.value = value;
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
        sync(); close(true);
      });
      button.addEventListener('keydown',event=>{
        const offsets = {ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-date.getDay(),End:6-date.getDay()};
        if (event.key === 'PageUp' || event.key === 'PageDown') { event.preventDefault(); if (event.key === 'PageDown' || localDate(month).slice(0,7) > minDate().slice(0,7)) changeMonth(event.key === 'PageUp' ? -1 : 1); return; }
        if (!(event.key in offsets)) return;
        event.preventDefault();
        date.setDate(date.getDate()+offsets[event.key]);
        focusedDate = localDate(date) < minDate() ? minDate() : localDate(date);
        const next = parseDate(focusedDate);
        month = new Date(next.getFullYear(),next.getMonth(),1,12);
        render(); focusDay();
      });
      days.append(button);
    }
    const hint = document.createElement('p');
    hint.className = 'hero-calendar-hint';
    hint.textContent = label === 'Return date' ? 'Return on or after your pickup date.' : 'Choose your preferred pickup date.';
    popup.append(header,weekdays,days,hint);
    position();
  };
  const open = () => {
    document.dispatchEvent(new CustomEvent('hero-picker-open',{detail:popup.id}));
    const start = input.value && input.value >= minDate() ? input.value : minDate();
    focusedDate = start;
    const date = parseDate(start);
    month = new Date(date.getFullYear(),date.getMonth(),1,12);
    isOpen = true;
    render();
    popup.inert = false;
    popup.removeAttribute('aria-hidden');
    popup.classList.add('calendar-open');
    trigger.setAttribute('aria-expanded','true');
    focusDay();
  };
  trigger.addEventListener('click',()=>isOpen ? close() : open());
  trigger.addEventListener('keydown',event=>{if (event.key === 'ArrowDown') {event.preventDefault();open();}});
  popup.addEventListener('keydown',event=>{
    if (event.key === 'Escape') {event.preventDefault();close(true);}
    if (event.key === 'Tab') {
      const controls = [...popup.querySelectorAll('button:not(:disabled)')].filter(button=>button.tabIndex >= 0);
      const index = controls.indexOf(document.activeElement);
      if ((!event.shiftKey && index === controls.length-1) || (event.shiftKey && index === 0)) {close(true);}
    }
  });
  document.addEventListener('pointerdown',event=>{if (!field.contains(event.target) && !popup.contains(event.target)) close();});
  document.addEventListener('focusin',event=>{if (isOpen && !field.contains(event.target) && !popup.contains(event.target)) close();});
  document.addEventListener('hero-picker-open',event=>{if(event.detail !== popup.id) close();});
  window.addEventListener('resize',()=>{if(isOpen) position();});
  window.addEventListener('scroll',()=>{if(isOpen) position();},{passive:true});
  input.addEventListener('change',sync);
  input.addEventListener('invalid',event=>{event.preventDefault(); if(input.form.querySelector(':invalid') === input) open();});
  field.classList.add('date-enhanced');
  input.hidden = true;
  field.append(trigger);
  sync();
}
