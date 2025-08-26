// —— 공통(main.js)으로 네비/오버레이/히어로 등 처리 ——
// 여기에는 문의 페이지 전용 로직만 포함

// HEX picker ↔ input 동기화
const hexPicker = document.getElementById('customHexPicker');
const hexInput  = document.getElementById('customHex');
const isHex = v => /^#[0-9A-Fa-f]{6}$/.test(v);

if (hexPicker && hexInput){
  hexPicker.addEventListener('input', e => {
    hexInput.value = e.target.value.toUpperCase();
    hexInput.classList.remove('hex-bad');
  });
  hexInput.addEventListener('input', e => {
    const v = e.target.value.trim();
    if (isHex(v)) { hexPicker.value = v; hexInput.classList.remove('hex-bad'); }
    else { hexInput.classList.add('hex-bad'); }
  });
}

// 톤&무드: 최대 2개, '모름' 단독
const toneWrap = document.getElementById('toneMood');
if (toneWrap){
  toneWrap.addEventListener('change', () => {
    const boxes   = [...toneWrap.querySelectorAll('input[type="checkbox"]')];
    const unsure  = boxes.find(i => i.value === 'unsure');
    const normals = boxes.filter(i => i !== unsure);

    if (unsure && unsure.checked){
      normals.forEach(i=>{ i.checked=false; i.disabled=true; });
      return;
    } else if (unsure) {
      normals.forEach(i=>{ i.disabled=false; });
    }

    const chosen = normals.filter(i=>i.checked);
    if (chosen.length > 2){
      const last = chosen.pop();
      last.checked = false;
    }
  });
}

// 컬러 팔레트 더보기/접기
const colorWrap   = document.getElementById('colorTone');
const colorToggle = document.getElementById('colorToneToggle');
if (colorWrap && colorToggle){
  colorToggle.addEventListener('click', ()=>{
    const condensed = colorWrap.classList.toggle('condense');
    colorToggle.textContent = condensed ? '더보기' : '접기';
    colorToggle.setAttribute('aria-expanded', (!condensed).toString());
  });
}

// 팔레트 선택 시 첫 블록 HEX 자동 입력
if (colorWrap && hexInput && hexPicker){
  colorWrap.addEventListener('change', ()=>{
    const picked = colorWrap.querySelector('input[type="radio"]:checked');
    if(!picked) return;
    const block = picked.closest('label').querySelector('.mc > span');
    if(!block) return;
    const bg = getComputedStyle(block).backgroundColor;
    const toHex = (rgbStr)=>{
      const m = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)\)/);
      if(!m) return null;
      const [r,g,b] = [m[1],m[2],m[3]].map(n=>Number(n));
      const h = v => ('0'+v.toString(16)).slice(-2).toUpperCase();
      return `#${h(r)}${h(g)}${h(b)}`;
    };
    const hex = bg.startsWith('#') ? bg : toHex(bg);
    if(hex){
      hexInput.value  = hex;
      hexPicker.value = hex;
      hexInput.classList.remove('hex-bad');
    }
  });
}

// 칩 툴팁(위/아래 자동 배치 + 토글)
(function(){
  const container = document.getElementById('projectType');
  if(!container) return;

  const placeTooltip = (chip) => {
    const tip = chip.querySelector('.tooltip');
    if(!tip) return;
    tip.classList.remove('top','bottom');
    tip.classList.add('top');
    const rect = tip.getBoundingClientRect();
    if(rect.top < 0){
      tip.classList.remove('top');
      tip.classList.add('bottom');
    }
  };

  container.querySelectorAll('.chip').forEach(chip=>{
    const show = ()=>{ chip.classList.add('show-tooltip'); placeTooltip(chip); };
    const hide = ()=> chip.classList.remove('show-tooltip');

    chip.addEventListener('mouseenter', show);
    chip.addEventListener('mouseleave', hide);
    chip.addEventListener('focusin', show);
    chip.addEventListener('focusout', hide);

    chip.addEventListener('click', (e)=>{
      container.querySelectorAll('.chip').forEach(c=>{ if(c!==chip) c.classList.remove('show-tooltip'); });
      chip.classList.toggle('show-tooltip');
      if(chip.classList.contains('show-tooltip')) placeTooltip(chip);
      e.stopPropagation();
    });
  });

  document.addEventListener('click', ()=> {
    container.querySelectorAll('.chip').forEach(c=> c.classList.remove('show-tooltip'));
  });
})();

// 개인정보 모달
(function(){
  const openBtn   = document.getElementById('privacyOpen');
  const modal     = document.getElementById('privacyModal');
  if(!openBtn || !modal) return;

  const closeBtn  = document.getElementById('privacyClose');
  const dismissEls= modal.querySelectorAll('[data-dismiss]');
  let lastFocus   = null;

  function openModal(){
    lastFocus = document.activeElement;
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('body--lock');
    modal.querySelector('.modal__panel').focus();
    document.addEventListener('keydown', onKeydown);
    openBtn.setAttribute('aria-expanded','true');
  }
  function closeModal(){
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('body--lock');
    document.removeEventListener('keydown', onKeydown);
    if(lastFocus) lastFocus.focus();
    openBtn.setAttribute('aria-expanded','false');
  }
  function onKeydown(e){ if(e.key === 'Escape') closeModal(); }

  openBtn.addEventListener('click', openModal);
  if(closeBtn) closeBtn.addEventListener('click', closeModal);
  dismissEls.forEach(el => el.addEventListener('click', closeModal));
  modal.addEventListener('click', (e)=>{ if(e.target.classList.contains('modal__backdrop')) closeModal(); });
})();

// ====== Google Sheets 전송 ======
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbz-Nnghn0GlTe3TOyiyFXWsIjlrlAlS8F-63Jh3iuUed5vdF-EYxb9slKrm5nuWwUYsYg/exec';

function collectPayload(){
  const pickChecked = (sel) => [...document.querySelectorAll(sel+':checked')].map(i=>i.value);
  return {
    timestamp: new Date().toISOString(),
    projectType: pickChecked('#projectType input[type="checkbox"]'),
    pages:       (document.getElementById('pages')?.value || '').trim(),
    scope:       (document.getElementById('scope')?.value || '').trim(),
    toneMood:    pickChecked('#toneMood input[type="checkbox"]'),
    colorTone:   (document.querySelector('#colorTone input[type="radio"]:checked')?.value) || '',
    customHex:   (document.getElementById('customHex')?.value || '').trim(),
    budget:      (document.getElementById('budget')?.value || ''),
    due:         (document.getElementById('due')?.value || ''),
    fast:        (document.querySelector('#fast input[type="radio"]:checked')?.value) || '',
    deliverables:pickChecked('#deliverables input[type="checkbox"]'),
    name:        (document.getElementById('name')?.value || '').trim(),
    company:     (document.getElementById('company')?.value || '').trim(),
    email:       (document.getElementById('email')?.value || '').trim(),
    phone:       (document.getElementById('phone')?.value || '').trim(),
    contactPref: (document.querySelector('#contactPref input[type="radio"]:checked')?.value) || '',
    contactTime: (document.getElementById('contactTime')?.value || '').trim(),
    link:        (document.getElementById('link')?.value || '').trim(),
    ref:         (document.getElementById('ref')?.value || ''),
    consent:      !!document.getElementById('consent')?.checked,
    userAgent:   navigator.userAgent
  };
}

async function postToSheets(payload){
  const res = await fetch(WEBAPP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Preflight 회피
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { ok:false, code:'BAD_JSON', raw:text }; }
}

(function attachSubmit(){
  const form = document.getElementById('inquiryForm');
  const success = document.getElementById('successMsg');

  function setError(id, on){
    const el = document.querySelector(`[data-for="${id}"]`);
    if(el) el.style.display = on ? 'block' : 'none';
    const field = document.getElementById(id);
    if(field) field.closest('div')?.classList.toggle('invalid', on);
  }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();

    // 유효성 체크
    let ok = true;
    ['scope','name','email','phone'].forEach(id=>{
      const v = (document.getElementById(id)?.value || '').trim();
      const bad = v.length===0; setError(id,bad); if(bad) ok=false;
    });
    const email = (document.getElementById('email')?.value || '').trim();
    if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ setError('email', true); ok=false; }
    const consent = document.getElementById('consent')?.checked;
    setError('consent', !consent); if(!consent) ok=false;
    if(hexInput && hexInput.value && !isHex(hexInput.value.trim())){ hexInput.classList.add('hex-bad'); ok=false; }
    if(!ok) return;

    // 버튼 상태
    const submitBtn = form.querySelector('button[type="submit"]');
    const old = submitBtn.textContent;
    submitBtn.disabled = true; submitBtn.textContent = '전송 중...';

    try{
      const result = await postToSheets(collectPayload());
      if(result?.ok){
        success.style.display = 'block';
        form.reset();
        success.scrollIntoView({ behavior: 'smooth', block: 'center' });        
      }else{
        alert('전송 실패: ' + (result?.code || 'UNKNOWN'));
      }
    }catch(err){
      alert('네트워크 오류로 전송하지 못했습니다. 잠시 후 다시 시도해주세요.');
      console.error(err);
    }finally{
      submitBtn.disabled = false; submitBtn.textContent = old;
    }
  });

  // reset 시 톤&무드 disabled 해제
  form.addEventListener('reset', ()=>{
    const boxes = document.querySelectorAll('#toneMood input[type="checkbox"]');
    boxes.forEach(b=> b.disabled=false);
  });
})();
