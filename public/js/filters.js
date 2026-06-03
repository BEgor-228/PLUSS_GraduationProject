// ============================================================
// filters.js — Фильтрация, поиск, аккордеоны,
//              события модальных окон и UI-панелей
// ============================================================

Object.assign(LipetskMap.prototype, {

    async applyCombinedFilters(page = 1) {
      const searchInput = document.getElementById("institutionSearch");
      const searchTerm = searchInput ? searchInput.value.trim() : "";
      const districtName = document.getElementById("regionName")?.textContent || "";
      const districtId = this.districtIdMap ? this.districtIdMap[districtName] : null;
      if (!districtId) {
        this.displayInstitutions(Array.isArray(this.allInstitutions) ? this.allInstitutions : []);
        return;
      }

      const checkedValues = (name) =>
        Array.from(document.querySelectorAll(`.filter-group-accordion input[name="${name}"]:checked`)).map(
          (cb) => cb.value
        );

      const params = new URLSearchParams();
      params.set("district_id", districtId);
      params.set("page", String(page));
      params.set("page_size", String(this.itemsPerPage || 10));
      if (searchTerm) params.set("q", searchTerm);
      checkedValues("filter_type").forEach((v) => params.append("type", v));
      checkedValues("filter_age").forEach((v) => params.append("age", v));
      checkedValues("filter_condition").forEach((v) => params.append("condition", v));
      checkedValues("filter_accessibility").forEach((v) => params.append("accessibility", v));
      checkedValues("filter_admission").forEach((v) => params.append("admission", v));
      if (document.querySelector('.filter-group-accordion input[name="filter_aoop"]:checked')) {
        params.set("aoop", "1");
      }

      try {
        const response = await fetch(`/api/search_institutions?${params.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        this.lastListMode = "search";
        this.displayInstitutions(Array.isArray(data.institutions) ? data.institutions : [], data.pagination || null);
      } catch (error) {
        console.error("Error searching institutions:", error);
      }
    },
  
    closeAllAccordions() {
      const accordionToggles = document.querySelectorAll(".accordion-toggle");
      const accordionContents = document.querySelectorAll(".accordion-content");
  
      accordionToggles.forEach(toggle => {
        toggle.classList.remove("active");
      });
  
      accordionContents.forEach(content => {
        content.classList.remove("open");
      });
    },
  
    resetFiltersUI() {
      document.querySelectorAll('.filter-group-accordion input[type="checkbox"]').forEach((cb) => {
        cb.checked = false;
      });
      this.closeAllAccordions();
    },
  
    resetFilters() {
      document.querySelectorAll('.filter-group-accordion input[type="checkbox"]').forEach((cb) => {
        cb.checked = false;
      });
      this.currentPage = 1;
      const districtName = document.getElementById("regionName").textContent;
      this.lastListMode = "district";
      this.loadInstitutionsForDistrict(districtName, 1);
      if (window.innerWidth <= 768) {
        document.getElementById("filtersSection").classList.add("hidden");
      }
    },
  
    bindEvents() {
      document.getElementById("closeModal").addEventListener("click", () => {
        if (document.body.dataset.page === "district") {
          window.location.href = "/";
          return;
        }
        document.getElementById("districtModal").classList.add("hidden");
        this.closeAllAccordions();
        const searchInput = document.getElementById("institutionSearch");
        if (searchInput) {
          searchInput.value = '';
        }
        this.resetFiltersUI();
      });
      document.getElementById("districtModal").addEventListener("click", (e) => {
        if (e.target.id === "districtModal") {
          this.resetFiltersUI();
        }
      });
      const institutionSearch = document.getElementById("institutionSearch");
      if (institutionSearch) {
        institutionSearch.addEventListener(
          "input",
          this.debounce(() => {
            this.applyCombinedFilters(1);
          }, 250)
        );
      }
  
      document
        .getElementById("closeInstitutionModal")
        .addEventListener("click", () => {
          document.getElementById("institutionModal").classList.add("hidden");
          this.clearInstitutionForm();
        });
  
      document
        .getElementById("cancelInstitution")
        .addEventListener("click", () => {
          document.getElementById("institutionModal").classList.add("hidden");
          this.clearInstitutionForm();
        });
  
      document.getElementById("applyFilters").addEventListener("click", () => {
        this.applyCombinedFilters(1);
      });
  
      document.getElementById("resetFilters").addEventListener("click", () => {
        document
          .querySelectorAll('.filter-group-accordion input[type="checkbox"]')
          .forEach(cb => (cb.checked = false));
  
        const searchInput = document.getElementById("institutionSearch");
        if (searchInput) searchInput.value = '';
  
        const districtName = document.getElementById("regionName")?.textContent || "";
        this.lastListMode = "district";
        if (districtName) {
          this.loadInstitutionsForDistrict(districtName, 1);
        }
      });
  
      // Обработчики для верхней пагинации
      document.getElementById("prevPageTop")?.addEventListener("click", () => {
        this.handlePrevPage();
      });
      document.getElementById("nextPageTop")?.addEventListener("click", () => {
        this.handleNextPage();
      });
  
      // Обработчики для нижней пагинации
      document.getElementById("prevPageBottom")?.addEventListener("click", () => {
        this.handlePrevPage();
      });
      document.getElementById("nextPageBottom")?.addEventListener("click", () => {
        this.handleNextPage();
      });
  
      document.querySelectorAll('.pagination').forEach(pagination => {
        pagination.addEventListener("click", (e) => {
          if (e.target.classList.contains('pagination-number')) {
            const page = parseInt(e.target.dataset.page);
            this.handlePageClick(page);
          }
        });
      });
      document.querySelectorAll(".accordion-toggle").forEach(btn => {
        btn.addEventListener("click", () => {
          btn.classList.toggle("active");
          const content = btn.nextElementSibling;
          content.classList.toggle("open");
        });
      });
  
      document.querySelectorAll('.type-filter-btn').forEach(button => {
        button.addEventListener('click', (e) => {
          const btn = e.target;
          const type = btn.dataset.type;
          const allButtonType = 'all';
  
          if (type === allButtonType) {
            const isActive = btn.classList.contains('active');
            if (isActive) {
              btn.classList.remove('active');
              document.querySelectorAll('.type-filter-btn').forEach(b => b.classList.remove('active'));
              document.querySelectorAll('.filter-group-accordion input[type="checkbox"]').forEach(cb => cb.checked = false);
            } else {
              document.querySelectorAll('.type-filter-btn').forEach(b => b.classList.remove('active'));
              btn.classList.add('active');
              document.querySelectorAll('.filter-group-accordion input[type="checkbox"]').forEach(cb => cb.checked = false);
            }
          } else {
            const allButton = document.querySelector(`.type-filter-btn[data-type="${allButtonType}"]`);
            allButton.classList.remove('active');
  
            btn.classList.toggle('active');
  
            const checkbox = document.querySelector(`.filter-group-accordion input[type="checkbox"][value="${type}"]`);
            if (checkbox) {
              checkbox.checked = btn.classList.contains('active');
            }
  
  
            const activeButtons = Array.from(document.querySelectorAll('.type-filter-btn'))
              .filter(b => b.dataset.type !== allButtonType && b.classList.contains('active'));
            if (activeButtons.length === 0) {
              allButton.classList.add('active');
            }
          }
  
          this.applyCombinedFilters(1);
        });
      });
  
      const toggleFiltersBtn = document.getElementById("toggleFilters");
      const filtersPanel = document.getElementById("filtersSection");
      const filtersOverlay = document.getElementById("filtersOverlay");
      const applyFiltersBtn = document.getElementById("applyFilters");
      const resetFiltersBtn = document.getElementById("resetFilters");
  
      if (toggleFiltersBtn && filtersPanel && filtersOverlay) {
        toggleFiltersBtn.addEventListener("click", () => {
          filtersPanel.classList.add("active");
          filtersOverlay.classList.add("active");
          document.body.style.overflow = "hidden";
        });
  
        filtersOverlay.addEventListener("click", () => {
          filtersPanel.classList.remove("active");
          filtersOverlay.classList.remove("active");
          document.body.style.overflow = "";
        });
      }
      if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener("click", () => {
          filtersPanel.classList.remove("active");
          filtersOverlay.classList.remove("active");
          document.body.style.overflow = "";
        });
      }
  
      if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener("click", () => {
          filtersPanel.classList.remove("active");
          filtersOverlay.classList.remove("active");
          document.body.style.overflow = "";
        });
      }
    },
  
  });