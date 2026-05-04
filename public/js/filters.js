// ============================================================
// filters.js — Фильтрация, поиск, аккордеоны,
//              события модальных окон и UI-панелей
// ============================================================

Object.assign(LipetskMap.prototype, {

    applyCombinedFilters() {
      const searchInput = document.getElementById("institutionSearch");
      const searchTerm = searchInput ? searchInput.value.trim() : "";
      const q = this.normalizeString(searchTerm);

      const checkedValues = (name) =>
        Array.from(document.querySelectorAll(`.filter-group-accordion input[name="${name}"]:checked`)).map(
          (cb) => cb.value
        );

      const selectedTypes = checkedValues("filter_type");
      const selectedAges = checkedValues("filter_age");
      const selectedConditions = checkedValues("filter_condition");
      const selectedAccessibilityCriteria = checkedValues("filter_accessibility");
      const aoopSelected = document.querySelector('.filter-group-accordion input[name="filter_aoop"]:checked');

      const WEIGHTS = {
        type: 0.5,
        conditions: 0.15,
        age: 0.15,
        aoop: 0.1,
        accessibility: 0.1,
      };
  
      const synonyms = {
        preschool: ['детсад', 'детскийсад', 'садик', 'дс', 'сад'],
        school: ['школа', 'шк', 'сош', 'лицей', 'гимназия'],
        school_internat: ['интернат', 'школаинтернат'],
        spo: ['спо', 'техникум', 'колледж', 'училище'],
        vo: ['во', 'вуз', 'университет', 'институт', 'академия']
      };
  
      const numberMatch = (searchTerm || '').match(/\d+/);
      const queryNumber = numberMatch ? numberMatch[0] : null;
  
      const source = Array.isArray(this.allInstitutions) ? this.allInstitutions : [];

      const matchesAgeBucket = (inst, age) => {
        if (inst.range_min == null || inst.range_max == null) return false;
        if (age.includes('-')) {
          const [minStr, maxStr] = age.split('-');
          const min = parseFloat(minStr);
          const max = parseFloat(maxStr);
          return inst.range_min <= max && inst.range_max >= min;
        }
        if (age.includes('+')) {
          const min = parseInt(age, 10);
          return inst.range_max >= min;
        }
        return false;
      };

      const ranked = source
        .filter((inst) => {
          if (!q) return true;

          const name = this.normalizeString(inst.name || '');
          const desc = this.normalizeString(inst.description || '');
          const director = this.normalizeString((inst.director && (inst.director.name || inst.director.full_name)) || '');
          const website = this.normalizeString(inst.website || '');
          const instNumber = (inst.name || '').match(/\d+/)?.[0] || null;

          if (name.includes(q) || desc.includes(q) || director.includes(q) || website.includes(q)) return true;
          if (queryNumber && instNumber && instNumber === queryNumber) return true;

          for (const [type, words] of Object.entries(synonyms)) {
            for (const w of words) {
              if (this.normalizeString(searchTerm).includes(w) && inst.type === type) {
                if (!queryNumber) return true;
                if (instNumber && queryNumber === instNumber) return true;
              }
            }
          }
          return false;
        })
        .map((inst) => {
          const instConditions = Array.isArray(inst.conditions) ? inst.conditions : [];
          const instAccessibility = Array.isArray(inst.accessibility_criteria) ? inst.accessibility_criteria : [];

          const typeScore = selectedTypes.length
            ? (selectedTypes.includes(inst.type) ? 1 : 0)
            : 1;

          const conditionsScore = selectedConditions.length
            ? selectedConditions.filter((c) => instConditions.includes(c)).length / selectedConditions.length
            : 1;

          const ageScore = selectedAges.length
            ? selectedAges.filter((age) => matchesAgeBucket(inst, age)).length / selectedAges.length
            : 1;

          const aoopScore = aoopSelected
            ? (Array.isArray(inst.aoop_programs) && inst.aoop_programs.length > 0 ? 1 : 0)
            : 1;

          const accessibilityScore = selectedAccessibilityCriteria.length
            ? selectedAccessibilityCriteria.filter((c) => instAccessibility.includes(c)).length / selectedAccessibilityCriteria.length
            : 1;

          const relevance =
            WEIGHTS.type * typeScore +
            WEIGHTS.conditions * conditionsScore +
            WEIGHTS.age * ageScore +
            WEIGHTS.aoop * aoopScore +
            WEIGHTS.accessibility * accessibilityScore;

          return { inst, relevance };
        })
        .sort((a, b) => b.relevance - a.relevance)
        .map((row) => row.inst);

      this.displayInstitutions(ranked);
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
      this.loadInstitutionsForDistrict(districtName);
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
            this.applyCombinedFilters();
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
        this.applyCombinedFilters();
      });
  
      document.getElementById("resetFilters").addEventListener("click", () => {
        document
          .querySelectorAll('.filter-group-accordion input[type="checkbox"]')
          .forEach(cb => (cb.checked = false));
  
        const searchInput = document.getElementById("institutionSearch");
        if (searchInput) searchInput.value = '';
  
        this.displayInstitutions(this.allInstitutions);
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
  
          this.applyCombinedFilters();
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