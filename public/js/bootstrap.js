// ============================================================
// bootstrap.js — Точка входа приложения.
// ============================================================

let lipetskMap;

document.addEventListener("DOMContentLoaded", () => {
  lipetskMap = new LipetskMap();
  lipetskMap.init();

  const adminManager = new AdminManager(lipetskMap);

  const authMode = new URLSearchParams(window.location.search).get("auth");
  if (authMode === "login") {
    adminManager.showLoginModal();
  } else if (authMode === "register") {
    adminManager.showRegisterModal();
  }

  if (document.body.dataset.page === "district") {
    const districtName = document.body.dataset.districtName;
    const requestedInstitution = (new URLSearchParams(window.location.search).get("q") || "").trim();
    if (districtName) {
      const applySearchFromQuery = async () => {
        if (!requestedInstitution) return;
        for (let i = 0; i < 30; i++) {
          const input = document.getElementById("institutionSearch");
          if (input) {
            input.value = requestedInstitution;
            if (typeof lipetskMap.applyCombinedFilters === "function") {
              lipetskMap.currentPage = 1;
              await lipetskMap.applyCombinedFilters(1);
            }
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      };
      const waitDistrictMap = async () => {
        for (let i = 0; i < 40; i++) {
          if (lipetskMap.districtIdMap && lipetskMap.districtIdMap[districtName]) {
            lipetskMap.showDistrictView(districtName);
            await applySearchFromQuery();
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