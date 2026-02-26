// ============================================================
// filters.js — Фильтрация, поиск, аккордеоны,
//              события модальных окон и UI-панелей
// ============================================================

Object.assign(LipetskMap.prototype, {

    applyCombinedFilters() {
      const searchInput = document.getElementById("institutionSearch");
      const searchTerm = searchInput ? searchInput.value.trim() : "";
      const q = this.normalizeString(searchTerm);
  
      const selectedTypes = Array.from(
        document.querySelectorAll('.filter-group-accordion input[value^="preschool"], .filter-group-accordion input[value^="school"], .filter-group-accordion input[value^="spo"], .filter-group-accordion input[value^="vo"]')
      )
        .filter(cb => cb.checked)
        .map(cb => cb.value);
  
      const selectedAges = Array.from(
        document.querySelectorAll('.filter-group-accordion input[value^="1.5-"], .filter-group-accordion input[value^="3-"], .filter-group-accordion input[value^="5-"], .filter-group-accordion input[value^="7+"]')
      )
        .filter(cb => cb.checked)
        .map(cb => cb.value);
  
      const selectedConditions = Array.from(
        document.querySelectorAll('.filter-group-accordion input[value="hearing_impairment"], .filter-group-accordion input[value="vision_impairment"], .filter-group-accordion input[value="musculoskeletal_impairment"], .filter-group-accordion input[value="speech_impairment"], .filter-group-accordion input[value="mental_retardation"], .filter-group-accordion input[value="autism"], .filter-group-accordion input[value="multiple_disorders"]')
      )
        .filter(cb => cb.checked)
        .map(cb => cb.value);
  
      const aoopSelected = document.querySelector('.filter-group-accordion input[value="aoop"]:checked');
  
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
  
      const filtered = source.filter(inst => {
        if (selectedTypes.length && !selectedTypes.includes(inst.type)) return false;
  
        if (selectedAges.length && inst.range_min && inst.range_max) {
          const matchAge = selectedAges.some(age => {
            if (age.includes('-')) {
              const [minStr, maxStr] = age.split('-');
              const min = parseFloat(minStr);
              const max = parseFloat(maxStr);
  
              if (age === "1.5-3") {
                return inst.range_min <= max && inst.range_max >= min;
              } else {
                return inst.range_min <= max && inst.range_max >= min;
              }
            } else if (age.includes('+')) {
              const min = parseInt(age);
              return inst.range_max >= min;
            }
            return false;
          });
          if (!matchAge) return false;
        }
  
        if (selectedConditions.length) {
          const hasCond = inst.conditions?.some(c => selectedConditions.includes(c));
          if (!hasCond) return false;
        }
  
        if (aoopSelected && (!inst.aoop_programs || inst.aoop_programs.length === 0)) return false;
  
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
      });
  
      this.displayInstitutions(filtered);
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
      document.getElementById("institutionSearch").addEventListener("input", (e) => {
        const searchInput = document.getElementById("institutionSearch");
        if (searchInput) {
          searchInput.addEventListener("input", this.debounce((e) => {
            this.applyCombinedFilters();
          }, 250));
        }
      });
  
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