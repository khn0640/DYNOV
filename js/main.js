// Sticky nav shadow
const nav = document.querySelector('.nav');
const onScroll = () => {
  if (window.scrollY > 2) nav.classList.add('is-scrolled');
  else nav.classList.remove('is-scrolled');
};
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// ===== Lightbox =====
const modal = document.getElementById('imgModal');
const modalImg = document.getElementById('modalImage');
const captionEl = document.getElementById('modalCaption');

// 갤러리 이미지 수집 & 현재 인덱스
const galleryImgs = Array.from(document.querySelectorAll('#portfolioGallery img'));
let currentIndex = -1;

function openModal(imgEl){
  // ⛔ 기존 모바일 차단 제거: 모바일에서도 모달 열림
  // if (window.matchMedia('(max-width:700px)').matches) return;

  currentIndex = Math.max(0, galleryImgs.indexOf(imgEl));
  showImage(currentIndex);
  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
}

function showImage(index){
  if (!galleryImgs.length) return;

  // ✅ 무한 루프(양끝 래핑)
  if (index < 0) index = galleryImgs.length - 1;
  if (index >= galleryImgs.length) index = 0;
  currentIndex = index;

  const imgEl = galleryImgs[currentIndex];
  modalImg.src = imgEl.src;
  modalImg.alt = imgEl.alt || '';
  const caption = imgEl.closest('.tile')?.querySelector('.overlay')?.textContent || imgEl.alt || '';
  captionEl.textContent = caption;
}

function changeImage(step){
  showImage(currentIndex + step);
}

function closeModal(){
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden','true');
  modalImg.src = '';
  document.body.style.overflow='';
}

modal?.addEventListener('click', e => { if(e.target === modal) closeModal(); });
document.addEventListener('keydown', e => {
  if(!modal.classList.contains('show')) return;
  if(e.key === 'Escape') closeModal();
  if(e.key === 'ArrowLeft') changeImage(-1);
  if(e.key === 'ArrowRight') changeImage(1);
});

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

// 전역 접근 (index.html 버튼에서 사용)
window.openModal = openModal;
window.closeModal = closeModal;
window.changeImage = changeImage;

// === 모바일 포트폴리오 무한 루프 ===
(function(){
  const gallery = document.getElementById('portfolioGallery');
  if (!gallery) return;

  const mq = window.matchMedia('(max-width:700px)');
  if (!mq.matches) return; // 모바일에서만 적용

  const tiles = gallery.querySelectorAll('.tile');
  if (tiles.length === 0) return;

  // 앞뒤로 복제 아이템 추가
  const firstClone = tiles[0].cloneNode(true);
  const lastClone = tiles[tiles.length-1].cloneNode(true);
  gallery.appendChild(firstClone);
  gallery.insertBefore(lastClone, tiles[0]);

  // 초기 스크롤 위치 (실제 첫번째 아이템)
  gallery.scrollLeft = gallery.children[1].offsetLeft;

  let isScrolling;
  gallery.addEventListener('scroll', ()=>{
    clearTimeout(isScrolling);
    isScrolling = setTimeout(()=>{
      const maxScroll = gallery.scrollWidth - gallery.clientWidth;
      if (gallery.scrollLeft <= 0) {
        // 맨앞 복제 → 실제 마지막으로 점프
        gallery.scrollLeft = gallery.children[gallery.children.length-2].offsetLeft;
      } else if (gallery.scrollLeft >= maxScroll) {
        // 맨뒤 복제 → 실제 첫번째로 점프
        gallery.scrollLeft = gallery.children[1].offsetLeft;
      }
    }, 40);
  });
})();

