// Sticky nav shadow
const nav = document.querySelector('.nav');
const onScroll = () => {
  if (window.scrollY > 2) nav.classList.add('is-scrolled');
  else nav.classList.remove('is-scrolled');
};
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// Lightbox
const modal = document.getElementById('imgModal');
const modalImg = document.getElementById('modalImage');
function openModal(imgEl){
  if (window.matchMedia('(max-width:700px)').matches) return; // 모바일은 라이트박스 열지 않음
  modalImg.src = imgEl.src;
  modalImg.alt = imgEl.alt || '';
  const caption = imgEl.closest('.tile').querySelector('.overlay')?.textContent || imgEl.alt || '';
  document.getElementById('modalCaption').textContent = caption;
  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
}
function closeModal(){
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden','true');
  modalImg.src = '';
  document.body.style.overflow='';
}
modal?.addEventListener('click', e => { if(e.target === modal) closeModal(); });
document.addEventListener('keydown', e => { if(!modal.classList.contains('show')) return; if(e.key === 'Escape') closeModal(); });

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

// 전역 접근을 위해 함수 노출 (index.html에서 onclick 사용)
window.openModal = openModal;
window.closeModal = closeModal;
