// ============================================================
// bootstrap.js — Точка входа приложения.
// ============================================================

let lipetskMap;

document.addEventListener("DOMContentLoaded", () => {
  lipetskMap = new LipetskMap();
  lipetskMap.init();

  new AdminManager(lipetskMap);

  if (document.body.dataset.page === "district") {
    const districtName = document.body.dataset.districtName;
    if (districtName) {
      const waitDistrictMap = async () => {
        for (let i = 0; i < 40; i++) {
          if (lipetskMap.districtIdMap && lipetskMap.districtIdMap[districtName]) {
            lipetskMap.showDistrictView(districtName);
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        console.error("District map is not ready for district page");
      };
      waitDistrictMap();
    }
  }
});

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
}, 10000);