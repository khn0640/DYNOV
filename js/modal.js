/*!
 * Minimal Modal Gallery (no deps)
 * Usage:
 *   ModalGallery.init({
 *     triggerSelector: '.open-modal',   // 트리거 요소(여러 개 가능)
 *     modalId: 'imgModal'               // 모달 컨테이너 id
 *   });
 *
 * 트리거에는 data-src / data-caption 속성 사용
 */
(function (global) {
  'use strict';

  const ModalGallery = {
    _cfg: null,
    _items: [],
    _idx: -1,
    _els: {},      // refs: modal, img, cap, close, prev, next
    _lastFocused: null,

    init(cfg = {}) {
      const defaults = {
        triggerSelector: '.open-modal',
        modalId: 'imgModal'
      };
      this._cfg = Object.assign({}, defaults, cfg);

      this._cacheEls();
      this._collectItems();
      this._bind();
    },

    _cacheEls() {
      const modal = document.getElementById(this._cfg.modalId);
      if (!modal) {
        console.warn(`[ModalGallery] modal element #${this._cfg.modalId} not found.`);
        return;
      }
      this._els.modal = modal;
      this._els.img   = modal.querySelector('#modalImage');
      this._els.cap   = modal.querySelector('#modalCaption');
      this._els.close = modal.querySelector('.close');
      this._els.prev  = modal.querySelector('.prev');
      this._els.next  = modal.querySelector('.next');
    },

    _collectItems() {
      const triggers = document.querySelectorAll(this._cfg.triggerSelector);
      this._items = [...triggers].map((el, i) => {
        el.dataset.index = String(i);
        return {
          src: el.dataset.src || el.getAttribute('href') || '',
          caption: el.dataset.caption || el.getAttribute('alt') || '',
          el
        };
      });
    },

    _bind() {
      if (!this._els.modal) return;

      // 트리거 클릭
      document.addEventListener('click', (e) => {
        const t = e.target.closest(this._cfg.triggerSelector);
        if (!t) return;
        e.preventDefault();
        const i = parseInt(t.dataset.index || '0', 10);
        this.open(i);
      });

      // 닫기 버튼
      this._els.close && this._els.close.addEventListener('click', () => this.close());

      // 배경 클릭 닫기
      this._els.modal.addEventListener('click', (e) => {
        if (e.target === this._els.modal) this.close();
      });

      // 좌우 버튼
      this._els.prev && this._els.prev.addEventListener('click', () => this.go(-1));
      this._els.next && this._els.next.addEventListener('click', () => this.go(+1));

      // 키보드
      document.addEventListener('keydown', (e) => {
        if (!this.isOpen()) return;
        switch (e.key) {
          case 'Escape': e.preventDefault(); this.close(); break;
          case 'ArrowLeft': e.preventDefault(); this.go(-1); break;
          case 'ArrowRight': e.preventDefault(); this.go(+1); break;
          case 'Tab': this._trapFocus(e); break;
        }
      });

      // 동적으로 트리거가 추가되는 페이지라면, 필요 시 이 함수를 다시 호출
      // this.refresh();
    },

    refresh() {
      this._collectItems();
    },

    open(i = 0) {
      if (!this._items.length || i < 0 || i >= this._items.length) return;
      this._idx = i;

      const { src, caption } = this._items[this._idx];
      if (this._els.img) {
        this._els.img.src = src;
        this._els.img.alt = caption || '확대 이미지';
      }
      if (this._els.cap) this._els.cap.textContent = caption || '';

      this._lastFocused = document.activeElement;
      this._els.modal.classList.add('show');
      this._els.modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';

      const fcs = this._focusables();
      (fcs[0] || this._els.close || this._els.modal).focus();
    },

    close() {
      if (!this.isOpen()) return;
      this._els.modal.classList.remove('show');
      this._els.modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (this._els.img) this._els.img.src = '';
      if (this._lastFocused) this._lastFocused.focus();
    },

    go(delta = 1) {
      if (this._items.length < 2) return;
      this._idx = (this._idx + delta + this._items.length) % this._items.length;
      const { src, caption } = this._items[this._idx];
      if (this._els.img) {
        this._els.img.src = src;
        this._els.img.alt = caption || '확대 이미지';
      }
      if (this._els.cap) this._els.cap.textContent = caption || '';
    },

    isOpen() {
      return this._els.modal && this._els.modal.classList.contains('show');
    },

    _focusables() {
      return [...this._els.modal.querySelectorAll(
        'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
      )].filter(el => !el.disabled && el.offsetParent !== null);
    },

    _trapFocus(e) {
      const f = this._focusables();
      if (!f.length) return;
      const first = f[0];
      const last  = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
  };

  // UMD-ish export
  global.ModalGallery = ModalGallery;
})(window);
