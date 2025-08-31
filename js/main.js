// Sticky nav shadow
const nav = document.querySelector('.nav');
const onScroll = () => {
  if (window.scrollY > 2) nav.classList.add('is-scrolled');
  else nav.classList.remove('is-scrolled');
};
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// ===== Lightbox: 무한 루프 보강 =====
const modal = document.getElementById('imgModal');
const modalImg = document.getElementById('modalImage');
const captionEl = document.getElementById('modalCaption');
const galleryImgs = Array.from(document.querySelectorAll('#portfolioGallery img'));
let currentIndex = -1;

// 안전한 모듈로 (음수 지원)
const mod = (n, m) => ((n % m) + m) % m;

function openModal(imgEl){
  const idx = galleryImgs.indexOf(imgEl);
  currentIndex = idx >= 0 ? idx : 0;
  showImage(currentIndex);
  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
}

function showImage(index){
  if (!galleryImgs.length) return;
  currentIndex = mod(index, galleryImgs.length);
  const imgEl = galleryImgs[currentIndex];
  modalImg.src = imgEl.src;
  modalImg.alt = imgEl.alt || '';
  captionEl.textContent =
    imgEl.closest('.tile')?.querySelector('.overlay')?.textContent || imgEl.alt || '';
}

function changeImage(step){
  showImage(currentIndex + step);
}

function closeModal(){
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden','true');
  modalImg.src = '';
  document.body.style.overflow = '';
}

/* ✅ 전역 노출: 이 한 번만 남기고, 아래의 중복 바인딩(두 번째 블록)은 삭제하세요. */
window.openModal = openModal;
window.closeModal = closeModal;
window.changeImage = changeImage;

// ✅ Lightbox 키보드 컨트롤 & 오버레이 닫기
(function(){
  if (!modal) return;

  // 배경(모달 컨테이너) 클릭 시, 이미지 외 영역이면 닫기
  modal.addEventListener('click', (e)=>{
    if (e.target === modal) closeModal();
  });

  // 키보드: ESC 닫기 / 좌우 이동
  function onKeydown(e){
    if (!modal.classList.contains('show')) return;
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); changeImage(-1); }
    if (e.key === 'ArrowRight'){ e.preventDefault(); changeImage(1); }
  }
  document.addEventListener('keydown', onKeydown);

  // (선택) 접근성: role/aria-modal 속성은 HTML에 한번만 세팅
  // <div id="imgModal" class="modal" role="dialog" aria-modal="true" aria-hidden="true"> ...
})();

// === 모바일 스와이프 제스처(선택) ===
let touchStartX = 0, touchStartY = 0;
const SWIPE_THRESHOLD = 40; // px
modalImg.addEventListener('touchstart', e => {
  const t = e.touches[0];
  touchStartX = t.clientX; touchStartY = t.clientY;
}, { passive:true });
modalImg.addEventListener('touchend', e => {
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD){
    changeImage(dx > 0 ? -1 : 1);
  }
}, { passive:true });

// 햄버거 메뉴 & 오버레이
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');
const navOverlay = document.querySelector('.nav-overlay');

function openMenu(){
  navLinks.classList.add('show');
  navOverlay.classList.add('show');
  navToggle.setAttribute('aria-expanded','true');
  document.body.style.overflow='hidden';
}
function closeMenu(){
  navLinks.classList.remove('show');
  navOverlay.classList.remove('show');
  navToggle.setAttribute('aria-expanded','false');
  document.body.style.overflow='';
}

navToggle?.addEventListener('click', ()=>{
  (navLinks.classList.contains('show') ? closeMenu : openMenu)();
});
navOverlay?.addEventListener('click', closeMenu);

// 모바일에서 링크 클릭하면 닫기
navLinks?.querySelectorAll('a').forEach(a=>{
  a.addEventListener('click', closeMenu);
});

// 리사이즈 시 상태 초기화(데스크탑 복귀 시 열림상태 제거)
const BREAKPOINT = 768;
window.addEventListener('resize', () => {
  if (window.innerWidth > BREAKPOINT) {
    closeMenu();
  }
});

// 포트폴리오 섹션 도달 시, 모바일에서 힌트 1회 표시
(function(){
  const mq = window.matchMedia('(max-width:700px)');
  const portfolio = document.getElementById('portfolio');
  if (!portfolio) return;
  const obs = new IntersectionObserver((entries, o)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting && mq.matches){
        portfolio.classList.add('show-arrow');
        o.unobserve(portfolio);
      }
    });
  }, { threshold: 0.4 });
  obs.observe(portfolio);
})();

// 포트폴리오: 14개 이상이면 3행 전환
(function(){
  const gallery = document.querySelector('#portfolio .gallery');
  if(!gallery) return;
  const MQ_MOBILE = '(max-width:700px)';
  const THRESHOLD = 14;
  function applyRowsByCount(){
    if(window.matchMedia(MQ_MOBILE).matches){
      gallery.classList.remove('rows-3');
      return;
    }
    const tiles = gallery.querySelectorAll('.tile').length;
    gallery.classList.toggle('rows-3', tiles >= THRESHOLD);
  }
  applyRowsByCount();
  window.addEventListener('resize', applyRowsByCount, { passive:true });
  const mo = new MutationObserver(applyRowsByCount);
  mo.observe(gallery, { childList:true });
})();

/* Guide PRO */
(function(){
  const WRAP = document.querySelector('.guide.pro');
  if(!WRAP) return;

  const BP = 700;
  const items = [...WRAP.querySelectorAll('details')];

  function isDesktop(){ return window.matchMedia(`(min-width:${BP}px)`).matches; }

  function openAllDesktop(){
    items.forEach(d=>{
      if(!d.open) d.open = true;
      const c = d.querySelector('.content');
      if(c){
        c.style.height = 'auto';
        c.style.overflow = 'visible';
      }
    });
    WRAP.dataset.mode = 'static';
  }

  function initMobile(){
    WRAP.dataset.mode = 'accordion';
    let opened = items.find(d=>d.open) || items[0];
    items.forEach(d=>{
      const c = d.querySelector('.content');
      if(d === opened){
        d.open = true;
        if(c) c.style.height = 'auto';
      }else{
        d.open = false;
        if(c) c.style.height = '0px';
      }
    });
  }

  function applyMode(){
    if(isDesktop()) openAllDesktop();
    else initMobile();
  }

  WRAP.addEventListener('toggle', (e)=>{
    const d = e.target;
    if(!(d instanceof HTMLDetailsElement)) return;
    if(!WRAP.contains(d)) return;

    if(WRAP.dataset.mode === 'static'){
      d.open = true;
      const c = d.querySelector('.content');
      if(c) c.style.height = 'auto';
      return;
    }

    if(d.open){
      items.forEach(o=>{
        if(o !== d){
          o.open = false;
          const oc = o.querySelector('.content');
          if(oc) oc.style.height = '0px';
        }
      });
    }

    const c = d.querySelector('.content');
    if(!c) return;

    if(d.open){
      c.style.height = 'auto';
      const h = c.clientHeight + 'px';
      c.style.height = '0px';
      requestAnimationFrame(()=>{ c.style.height = h; });
      setTimeout(()=>{ c.style.height = 'auto'; }, 230);
    }else{
      c.style.height = c.clientHeight + 'px';
      requestAnimationFrame(()=>{ c.style.height = '0px'; });
    }
  }, true);

  document.addEventListener('click', (e)=>{
    const sum = e.target.closest('.guide.pro summary');
    if(!sum) return;
    if(sum.closest('.guide.pro')?.dataset.mode === 'static'){
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  applyMode();
  window.addEventListener('resize', applyMode, { passive:true });
})();
/* ===== Portfolio: 모바일 무한 루프 캐러셀 (누수 방지 보강) ===== */
(function () {
  const MQ_MOBILE = window.matchMedia('(max-width:700px)');
  const gallery = document.querySelector('#portfolio .gallery');
  if (!gallery) return;

  let initialized = false;
  let items = [];
  let realCount = 0;
  let settleTimer = null;
  let onScrollRef = null; // ✅ 추가: 리스너 참조 저장

  function childX(i) {
    return items[i]?.offsetLeft || 0;
  }
  function scrollToIndex(i, behavior = 'instant') {
    gallery.scrollTo({ left: childX(i), behavior: behavior === 'smooth' ? 'smooth' : 'auto' });
  }
  function nearestIndex() {
    const x = gallery.scrollLeft;
    let bestI = 0, bestD = Infinity;
    for (let i = 0; i < items.length; i++) {
      const d = Math.abs(childX(i) - x);
      if (d < bestD) { bestD = d; bestI = i; }
    }
    return bestI;
  }

  function initLoop() {
    if (initialized || !MQ_MOBILE.matches) return;
    items = Array.from(gallery.children);
    realCount = items.length;
    if (realCount < 2) return;

    const firstClone = items[0].cloneNode(true);
    const lastClone  = items[realCount - 1].cloneNode(true);
    gallery.insertBefore(lastClone, items[0]);
    gallery.appendChild(firstClone);

    items = Array.from(gallery.children);

    requestAnimationFrame(() => {
      scrollToIndex(1, 'instant');
    });

    onScrollRef = function onScroll(){
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        const i = nearestIndex();
        if (i === 0) { scrollToIndex(realCount, 'instant'); return; }
        if (i === realCount + 1) { scrollToIndex(1, 'instant'); return; }
        // 필요 시 스냅 보정:
        // scrollToIndex(i, 'smooth');
      }, 90);
    };

    gallery.addEventListener('scroll', onScrollRef, { passive: true });
    initialized = true;
  }

  function destroyLoop() {
    if (!initialized) return;

    // ✅ 스크롤 리스너 제거
    if (onScrollRef) {
      gallery.removeEventListener('scroll', onScrollRef);
      onScrollRef = null;
    }

    items = Array.from(gallery.children);
    if (items.length >= realCount + 2) {
      gallery.removeChild(items[0]);                 // 앞 복제 제거
      gallery.removeChild(gallery.lastElementChild); // 뒤 복제 제거
    }
    gallery.scrollTo({ left: 0, behavior: 'auto' });

    initialized = false;
  }

  function apply() {
    if (MQ_MOBILE.matches) initLoop();
    else destroyLoop();
  }
  apply();
  window.addEventListener('resize', apply, { passive: true });
})();

