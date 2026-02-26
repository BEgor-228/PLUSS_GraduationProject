// ============================================================
// utils.js — Вспомогательные методы LipetskMap
// ============================================================

/**
 * Методы, добавляемые в прототип LipetskMap:
 *   - showPageLoader / hidePageLoader
 *   - showModalLoader / hideModalLoader
 *   - normalizeString
 *   - debounce
 */

Object.assign(LipetskMap.prototype, {

    // Методы для загрузчика страницы
    showPageLoader() {
      const pageLoader = document.getElementById("pageLoader");
      if (pageLoader) {
        pageLoader.style.display = 'flex';
      }
    },
  
    hidePageLoader() {
      const pageLoader = document.getElementById("pageLoader");
      if (pageLoader) {
        // Плавное исчезновение
        pageLoader.style.opacity = '0';
        setTimeout(() => {
          pageLoader.style.display = 'none';
        }, 300);
      }
    },
  
    // Методы для загрузчика модального окна
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
  
    // Нормализация строки для сравнения
    normalizeString(str) {
      if (!str) return '';
      return String(str)
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/№/g, '')
        .replace(/[^a-zа-я0-9]/gi, '');
    },
  
    // Дебаунс (чтобы не дергать фильтр на каждую букву моментально)
    debounce(fn, delay = 250) {
      let timer;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
      };
    },
  
  });