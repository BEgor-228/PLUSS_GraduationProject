// ============================================================
// utils.js — Вспомогательные методы LipetskMap
// ============================================================

Object.assign(LipetskMap.prototype, {
    showPageLoader() {
      const pageLoader = document.getElementById("pageLoader");
      if (pageLoader) {
        pageLoader.classList.remove("is-hidden");
        pageLoader.style.display = 'flex';
      }
    },
  
    hidePageLoader() {
      const pageLoader = document.getElementById("pageLoader");
      if (pageLoader) {
        pageLoader.classList.add("is-hidden");
        setTimeout(() => {
          pageLoader.style.display = 'none';
        }, 300);
      }
    },
  
    showModalLoader() {
      const modalLoader = document.getElementById("modalLoader");
      if (modalLoader) {
        modalLoader.classList.remove("hidden");
      }
    },
  
    hideModalLoader() {
      const modalLoader = document.getElementById("modalLoader");
      if (modalLoader) {
        modalLoader.classList.add("hidden");
      }
    },
  
    normalizeString(str) {
      if (!str) return '';
      return String(str)
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/№/g, '')
        .replace(/[^a-zа-я0-9]/gi, '');
    },
  
    debounce(fn, delay = 250) {
      let timer;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
      };
    },
  
  });