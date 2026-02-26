// ============================================================
// bootstrap.js — Точка входа приложения.
// ============================================================

let lipetskMap;

document.addEventListener("DOMContentLoaded", () => {
  // Инициализируем карту
  lipetskMap = new LipetskMap();
  lipetskMap.init();

  // Инициализируем админ-панель
  new AdminManager(lipetskMap);
});

// Глобальная обработка ошибок загрузки страницы
window.addEventListener('error', () => {
  const pageLoader = document.getElementById("pageLoader");
  if (pageLoader) {
    pageLoader.innerHTML = `
      <div style="text-align: center; color: #e74c3c;">
        <div style="font-size: 48px; margin-bottom: 10px;">⚠️</div>
        <p>Ошибка загрузки страницы</p>
        <button onclick="location.reload()" class="btn btn-primary" style="margin-top: 10px;">
          Обновить страницу
        </button>
      </div>
    `;
  }
});

setTimeout(() => {
  const pageLoader = document.getElementById("pageLoader");
  if (pageLoader && pageLoader.style.display !== 'none') {
    pageLoader.innerHTML = `
      <div style="text-align: center; color: #e74c3c;">
        <p>Загрузка занимает больше времени чем ожидалось</p>
        <button onclick="location.reload()" class="btn btn-primary" style="margin-top: 10px;">
          Обновить страницу
        </button>
      </div>
    `;
  }
}, 10000); // 10 секунд