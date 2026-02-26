// ============================================================
// institutions.js — Загрузка, отображение учреждений,
//                   карточки, пагинация
// ============================================================

Object.assign(LipetskMap.prototype, {

    async loadDistricts() {
      try {
        const response = await fetch("/api/get_districts.php");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        this.districts = data.districts;
        this.districtIdMap = {};
        Object.entries(this.districts).forEach(([id, name]) => {
          this.districtIdMap[name] = parseInt(id);
        });
        this.populateLegend();
        this.populateDistrictSelect();
      } catch (error) {
        console.error("Error loading districts:", error);
        this.districts = { 1: "Липецкий район", 2: "Елецкий район" };
        this.populateLegend();
      }
    },
  
    async loadInstitutionsForDistrict(districtName) {
      const districtId = this.districtIdMap[districtName];
      if (!districtId) return;
  
      try {
        this.loaderTimeout = setTimeout(() => {
          this.showModalLoader();
        }, 200);
  
        const params = new URLSearchParams({ district_id: districtId });
        const response = await fetch(`/api/get_institutions.php?${params}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);
  
        this.allInstitutions = Array.isArray(data.institutions) ? data.institutions : [];
  
        this.displayInstitutions(this.allInstitutions);
  
      } catch (error) {
        console.error('Error loading institutions:', error);
        document.getElementById("institutionsList").innerHTML = '<p>Ошибка загрузки учреждений</p>';
      } finally {
        if (this.loaderTimeout) {
          clearTimeout(this.loaderTimeout);
        }
        this.hideModalLoader();
      }
    },
  
    async loadRegionLinks(districtId) {
      const linksDiv = document.getElementById('regionLinks');
      if (!linksDiv) return;
      linksDiv.innerHTML = '';
  
      try {
        const response = await fetch(`/api/get_links.php?district_id=${districtId}`);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();
        if (data.links && data.links.length > 0) {
          linksDiv.innerHTML = data.links.map(link =>
            `<a href="${link.linktoinstitution}" target="_blank" class="region-link">${link.linksto}</a>`
          ).join('<br>');
        }
      } catch (e) {
        linksDiv.innerHTML = '<span class="text-muted">Нет ссылок для региона</span>';
      }
    },
  
    displayInstitutions(institutions) {
      this.totalPages = Math.ceil(institutions.length / this.itemsPerPage);
      this.currentPage = 1;
  
      const debugInfo = document.getElementById("debugInfo");
      const institutionCount = document.getElementById("institutionCount");
  
      if (institutionCount) {
        institutionCount.textContent = `(${institutions.length})`;
      }
  
      if (institutions.length === 0) {
        document.getElementById("institutionsList").innerHTML = '<p class="text-muted">Учреждения не найдены</p>';
  
        const paginationTop = document.getElementById("paginationTop");
        const paginationBottom = document.getElementById("paginationBottom");
        if (paginationTop) paginationTop.classList.add("hidden");
        if (paginationBottom) paginationBottom.classList.add("hidden");
        if (debugInfo) debugInfo.style.display = 'none';
        return;
      }
  
      if (debugInfo) {
        debugInfo.style.display = 'block';
      }
  
      this.displayedInstitutionsFull = institutions.slice();
      this.totalPages = Math.ceil(this.displayedInstitutionsFull.length / this.itemsPerPage);
      this.currentPage = 1;
  
      this.showCurrentPage();
      this.updatePagination();
    },
  
    showCurrentPage() {
      const source = Array.isArray(this.displayedInstitutionsFull) ? this.displayedInstitutionsFull : [];
      const startIndex = (this.currentPage - 1) * this.itemsPerPage;
      const endIndex = startIndex + this.itemsPerPage;
      this.displayedInstitutions = source.slice(startIndex, endIndex);
  
      const list = document.getElementById("institutionsList");
      const debugInfo = document.getElementById("debugInfo");
  
      if (this.displayedInstitutions.length === 0) {
        list.innerHTML = '<p class="text-muted">Учреждения не найдены</p>';
        if (debugInfo) debugInfo.style.display = 'none';
      } else {
        list.innerHTML = this.displayedInstitutions.map((inst) => this.createInstitutionCard(inst)).join('');
        if (debugInfo) debugInfo.style.display = 'block';
  
        if (debugInfo) {
          const start = startIndex + 1;
          const end = Math.min(endIndex, source.length);
          debugInfo.textContent = `Показано ${start}-${end} из ${source.length} учреждений (Страница ${this.currentPage} из ${this.totalPages})`;
        }
      }
  
      if (this.isAdmin) {
        this.bindAdminActions();
      }
    },
  
    updatePagination() {
      const paginationTop = document.getElementById("paginationTop");
      const paginationBottom = document.getElementById("paginationBottom");
      const numbersTop = document.getElementById("paginationNumbersTop");
      const numbersBottom = document.getElementById("paginationNumbersBottom");
  
      if (!paginationTop || !paginationBottom || !numbersTop || !numbersBottom) {
        console.error('Pagination elements not found');
        return;
      }
  
      if (this.totalPages <= 1) {
        paginationTop.classList.add("hidden");
        paginationBottom.classList.add("hidden");
        return;
      }
  
      paginationTop.classList.remove("hidden");
      paginationBottom.classList.remove("hidden");
  
      numbersTop.innerHTML = this.generatePaginationNumbers();
      numbersBottom.innerHTML = this.generatePaginationNumbers();
  
      this.updatePaginationButtons();
    },
  
    updatePaginationButtons() {
      const prevButtons = document.querySelectorAll('.pagination-prev');
      const nextButtons = document.querySelectorAll('.pagination-next');
  
      prevButtons.forEach(btn => {
        if (btn) btn.disabled = this.currentPage === 1;
      });
  
      nextButtons.forEach(btn => {
        if (btn) btn.disabled = this.currentPage === this.totalPages;
      });
    },
  
    generatePaginationNumbers() {
      const current = this.currentPage;
      const total = this.totalPages;
  
      if (total <= 5) {
        return Array.from({ length: total }, (_, i) => i + 1)
          .map((page) => this.createPageButton(page, page === current))
          .join("");
      }
  
      let pages = [];
      pages.push(1);
  
      let start = Math.max(2, current - 1);
      let end = Math.min(total - 1, current + 1);
  
      if (current <= 3) {
        end = Math.min(4, total - 1);
      } else if (current >= total - 2) {
        start = Math.max(total - 3, 2);
      }
  
      if (start > 2) pages.push("...");
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < total - 1) pages.push("...");
      if (total > 1) pages.push(total);
  
      return pages
        .map((page) => {
          if (page === "...")
            return `<span class="pagination-ellipsis">...</span>`;
          return this.createPageButton(page, page === current);
        })
        .join("");
    },
  
    createPageButton(page, isActive = false) {
      return `<button class="pagination-number ${isActive ? "active" : ""
        }" data-page="${page}">${page}</button>`;
    },
  
    bindAdminActions() {
      document.querySelectorAll(".edit-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const id = parseInt(e.target.dataset.id);
          this.editInstitution(id);
        });
      });
  
      document.querySelectorAll(".delete-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const id = parseInt(e.target.dataset.id);
          this.deleteInstitution(id);
        });
      });
    },
  
    createInstitutionCard(institution) {
      const typeNames = {
        preschool: "Дошкольное",
        school: "Школа",
        school_internat: "Школа-интернат",
        spo: "СПО",
        vo: "ВО",
      };
      const conditionNames = {
        hearing_impairment: "Нарушения слуха",
        vision_impairment: "Нарушения зрения",
        musculoskeletal_impairment: "Нарушения опорно-двигательного аппарата",
        speech_impairment: "Нарушения речи",
        mental_retardation: "Задержка психического развития",
        autism: "Расстройство аутистического спектра",
        multiple_disorders: "Множественные нарушения развития",
      };
      const admissionNames = {
        certificate: "Свидетельство",
        attestat: "Аттестат",
      };
  
      let rangeInfo = "";
      if (institution.range_min !== null && institution.range_max !== null) {
        if (institution.type === "preschool") {
          rangeInfo = `${institution.range_min}-${institution.range_max} лет`;
        } else if (
          institution.type === "school" ||
          institution.type === "school_internat"
        ) {
          rangeInfo = `${institution.range_min}-${institution.range_max} классы`;
        } else {
          rangeInfo = `${institution.range_min}-${institution.range_max}`;
        }
      } else if (institution.range_min !== null) {
        if (institution.type === "preschool") {
          rangeInfo = `от ${institution.range_min} лет`;
        } else if (institution.type === "school" || institution.type === "school_internat") {
          rangeInfo = `от ${institution.range_min} класса`;
        } else {
          rangeInfo = `от ${institution.range_min}`;
        }
      } else if (institution.range_max !== null) {
        if (institution.type === "preschool") {
          rangeInfo = `до ${institution.range_max} лет`;
        } else if (institution.type === "school" || institution.type === "school_internat") {
          rangeInfo = `до ${institution.range_max} класса`;
        } else {
          rangeInfo = `до ${institution.range_max}`;
        }
      }
  
      const uniqueConditions = institution.conditions
        ? [...new Set(institution.conditions)]
        : [];
      const uniqueAdmission = institution.conditionsAdmission
        ? [...new Set(institution.conditionsAdmission)]
        : [];
  
      const conditionsSection =
        uniqueConditions.length > 0
          ? `<div class="conditions-section">
            <h5>Особые условия:</h5>
            <div class="institution-tags">
              ${uniqueConditions
            .map(
              (condition) =>
                `<span class="tag condition">${conditionNames[condition] || condition
                }</span>`
            )
            .join("")}
            </div>
          </div>`
          : "";
  
      const admissionSection =
        uniqueAdmission.length > 0
          ? `<div class="admission-section">
            <h5>Условия приема:</h5>
            <div class="institution-tags">
              ${uniqueAdmission
            .map(
              (admission) =>
                `<span class="tag admission">${admissionNames[admission] || admission
                }</span>`
            )
            .join("")}
            </div>
          </div>`
          : "";
  
      const aoopSection =
        institution.aoop_programs && institution.aoop_programs.length > 0
          ? `<div class="aoop-section">
            <h5>Реализуемые АООП:</h5>
            <ul class="aoop-list-card">
              ${institution.aoop_programs
            .map(
              (prog) => {
                if (institution.aoop_url) {
                  return `<li><a href="${institution.aoop_url}" target="_blank">${prog.name}</a></li>`;
                } else {
                  return `<li>${prog.name}</li>`;
                }
              }
            )
            .join("")}
            </ul>
            ${institution.aoop_url
            ? `<div class="aoop-global-link"><strong>Общая ссылка на АООП:</strong> <a href="${institution.aoop_url}" target="_blank">${institution.aoop_url}</a></div>`
            : ''}
          </div>`
          : "";
  
      const adminButtons = this.isAdmin
        ? `<div class="institution-actions">
            <button class="btn btn-primary edit-btn" data-id="${institution.id}">Редактировать</button>
            <button class="btn btn-danger delete-btn" data-id="${institution.id}">Удалить</button>
          </div>`
        : "";
  
      return `
      <div class="institution-card">
        <h4>${institution.name}</h4>
        <span class="institution-type">${typeNames[institution.type] || institution.type
        }</span>
        
        ${institution.description
          ? `<p class="institution-description">${institution.description}</p>`
          : ""
        }
        
        <div class="institution-details">
          ${rangeInfo
          ? `<div class="detail-item"><strong>${institution.type === "preschool" ? "Возраст:" : institution.type === "school" || institution.type === "school_internat" ? "Классы:" : "Диапазон:"}</strong> ${rangeInfo}</div>`
          : ""
        }
          <div class="detail-item"><strong>Район:</strong> ${this.districts[institution.district_id] || "Неизвестный район"
        }</div>
        </div>
        
        ${conditionsSection}
        ${admissionSection}
        ${aoopSection}
        
        ${institution.director && institution.director.name
          ? `
          <div class="institution-contacts">
            <div class="contact-item"><strong>Руководитель:</strong> ${institution.director.name
          }</div>
            ${institution.director.phone
            ? `<div class="contact-item"><strong>Телефон:</strong> ${institution.director.phone}</div>`
            : ""
          }
            ${institution.director.email
            ? `<div class="contact-item"><strong>Email:</strong> ${institution.director.email}</div>`
            : ""
          }
          </div>
        `
          : ""
        }
        
        ${institution.website
          ? `
          <div class="contact-item">
            <strong>Сайт:</strong> <a href="${institution.website}" target="_blank">${institution.website}</a>
          </div>
        `
          : ""
        }
        
        ${adminButtons}
      </div>
    `;
    },
  
    clearInstitutionForm() {
      document.getElementById('institutionForm').reset();
      document.getElementById('aoopList').innerHTML = '';
      this.aoopCounter = 0;
  
      document.getElementById('rangeMin').value = '';
      document.getElementById('rangeMax').value = '';
      document.getElementById('rangeMin').removeAttribute('min');
      document.getElementById('rangeMin').removeAttribute('max');
      document.getElementById('rangeMax').removeAttribute('min');
      document.getElementById('rangeMax').removeAttribute('max');
  
      this.editingInstitution = null;
      document.getElementById('institutionModalTitle').textContent = 'Добавить учреждение';
    },
  
    handlePrevPage() {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.showCurrentPage();
        this.updatePagination();
        this.scrollToInstitutions();
      }
    },
  
    handleNextPage() {
      if (this.currentPage < this.totalPages) {
        this.currentPage++;
        this.showCurrentPage();
        this.updatePagination();
        this.scrollToInstitutions();
      }
    },
  
    handlePageClick(page) {
      if (page !== this.currentPage) {
        this.currentPage = page;
        this.showCurrentPage();
        this.updatePagination();
        this.scrollToInstitutions();
      }
    },
  
    scrollToInstitutions() {
      const institutionsSection = document.querySelector(".institutions-section");
      if (institutionsSection) {
        institutionsSection.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    },
  
  });