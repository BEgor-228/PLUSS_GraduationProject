// ============================================================
// main.js — Класс LipetskMap: только конструктор и init().
// ============================================================

class LipetskMap {
    constructor() {
      this.isAdminMode = false;
      this.currentDistrictName = null;
      this.editingInstitution = null;
      this.institutions = [];
      this.districts = {};
      this.districtIdMap = {};
      this.districtColors = {};
      this.aoopCounter = 0;
      this.isAdmin = false;
      this.animationPlayed = false;
      // Пагинация
      this.currentPage = 1;
      this.itemsPerPage = 10;
      this.totalPages = 0;
      this.allInstitutions = [];
      this.displayedInstitutions = [];
  
      this.loaderTimeout = null;
      this.pageLoaderTimeout = null;
  
      this.activeDistrict = null; // Текущий активный район
      this.hoverTimeout = null;
    }
  
    async init() {
      // Показываем загрузчик страницы
      this.showPageLoader();
  
      try {
        await this.loadMap();
        this.bindEvents();
        await this.loadDistricts();
      } catch (error) {
        console.error('Error during initialization:', error);
      } finally {
        // Скрываем загрузчик страницы
        this.hidePageLoader();
      }
    }
  }