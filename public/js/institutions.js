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
        this.districts = { 1: "Липецкий округ", 2: "Елецкий округ" };
        this.populateLegend();
      }
    },
  
    async loadInstitutionsForDistrict(districtName, page = 1) {
      const districtId = this.districtIdMap[districtName];
      if (!districtId) return;
  
      try {
        this.loaderTimeout = setTimeout(() => {
          this.showModalLoader();
        }, 200);
  
        const params = new URLSearchParams({
          district_id: districtId,
          page: String(page),
          page_size: String(this.itemsPerPage || 10),
        });
        const response = await fetch(`/api/get_institutions.php?${params}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);
  
        this.lastListMode = "district";
        this.allInstitutions = Array.isArray(data.institutions) ? data.institutions : [];
        this.displayInstitutions(this.allInstitutions, data.pagination || null);
  
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
  
    displayInstitutions(institutions, pagination = null) {
      this.totalPages = Number(pagination?.total_pages || 1);
      this.currentPage = Number(pagination?.page || 1);
      const totalItems = Number(pagination?.total_items || institutions.length);
  
      const debugInfo = document.getElementById("debugInfo");
      const institutionCount = document.getElementById("institutionCount");
  
      if (institutionCount) {
        institutionCount.textContent = `(${totalItems})`;
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
  
      this.displayedInstitutions = institutions.slice();
  
      this.showCurrentPage();
      this.updatePagination();
    },
  
    showCurrentPage() {
      const source = Array.isArray(this.displayedInstitutions) ? this.displayedInstitutions : [];
  
      const list = document.getElementById("institutionsList");
      const debugInfo = document.getElementById("debugInfo");
  
      if (source.length === 0) {
        list.innerHTML = '<p class="text-muted">Учреждения не найдены</p>';
        if (debugInfo) debugInfo.style.display = 'none';
      } else {
        list.innerHTML = source.map((inst) => this.createInstitutionCard(inst)).join('');
        if (debugInfo) debugInfo.style.display = 'block';
  
        if (debugInfo) {
          debugInfo.textContent = `Страница ${this.currentPage} из ${this.totalPages}`;
        }
      }
  
      if (this.isAdmin) {
        this.bindAdminActions();
      } else if (this.isPortalUser) {
        this.bindFavoriteActions();
        this.bindReviewActions();
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

    bindFavoriteActions() {
      document.querySelectorAll(".favorite-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const target = e.currentTarget;
          const id = parseInt(target.dataset.id, 10);
          const isFavorite = target.dataset.favorite === "true";
          await this.toggleFavorite(id, isFavorite, target);
        });
      });
    },

    async toggleFavorite(institutionId, isFavorite, buttonEl) {
      const endpoint = isFavorite ? "/api/remove_favorite.php" : "/api/add_favorite.php";
      buttonEl.disabled = true;
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ institution_id: institutionId }),
        });
        const data = await response.json();
        if (!response.ok || data.error) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }
        this.syncFavoriteState(institutionId, Boolean(data.is_favorite));
        this.showCurrentPage();
      } catch (error) {
        console.error("Favorite toggle error:", error);
        alert(`Ошибка обновления избранного: ${error.message}`);
      } finally {
        buttonEl.disabled = false;
      }
    },

    syncFavoriteState(institutionId, isFavorite) {
      const applyState = (items) => {
        if (!Array.isArray(items)) return;
        items.forEach((inst) => {
          if (inst && inst.id === institutionId) {
            inst.is_favorite = isFavorite;
          }
        });
      };
      applyState(this.allInstitutions);
      applyState(this.displayedInstitutions);
    },

    bindReviewActions() {
      this.initReviewModalEvents();
      document.querySelectorAll(".review-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const id = parseInt(e.currentTarget.dataset.id, 10);
          this.openReviewModal(id);
        });
      });
    },

    initReviewModalEvents() {
      if (this.reviewModalBound) return;
      const modal = document.getElementById("reviewModal");
      const closeBtn = document.getElementById("closeReviewModal");
      const cancelBtn = document.getElementById("cancelReview");
      const form = document.getElementById("reviewForm");
      if (!modal || !closeBtn || !cancelBtn || !form) return;

      const closeModal = () => {
        modal.classList.add("hidden");
        form.reset();
        const errorNode = document.getElementById("reviewErrorMessage");
        if (errorNode) {
          errorNode.textContent = "";
          errorNode.classList.add("hidden");
        }
      };

      closeBtn.addEventListener("click", closeModal);
      cancelBtn.addEventListener("click", closeModal);
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
      });
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.submitReview();
      });
      this.reviewModalBound = true;
    },

    openReviewModal(institutionId) {
      if (!this.isPortalUser || this.isAdmin) {
        alert("Только зарегистрированный пользователь может оставить отзыв.");
        return;
      }
      const source = Array.isArray(this.displayedInstitutions) ? this.displayedInstitutions : [];
      const institution = source.find((inst) => inst.id === institutionId);
      if (!institution) return;

      const accessibilityNames = {
        ramps_lifts: "Нормативные пандусы и подъемники",
        entrance_groups_doorways: "Входные группы и дверные проемы",
        tactile_pedestrian_indicators: "Тактильно-пешеходные указатели",
        braille_signage: "Информационные таблички со шрифтом Брайля",
        accessible_sanitary_facilities: "Оборудованные санитарно-гигиенические помещения",
        assistant_call_system: "Система вызова помощника",
        contrast_marking: "Контрастная маркировка",
        safety_zones_evacuation_routes: "Зоны безопасности и пути эвакуации",
        acoustic_systems_induction_loops: "Акустические системы и индукционные петли",
      };
      const criteriaCodes = Array.isArray(institution.accessibility_criteria)
        ? [...new Set(institution.accessibility_criteria)].filter((code) => accessibilityNames[code])
        : [];

      const modal = document.getElementById("reviewModal");
      const institutionIdInput = document.getElementById("reviewInstitutionId");
      const institutionNameInput = document.getElementById("reviewInstitutionName");
      const criteriaList = document.getElementById("reviewCriteriaList");
      if (!modal || !institutionIdInput || !institutionNameInput || !criteriaList) return;

      criteriaList.innerHTML = criteriaCodes.map((code) => `
        <div class="review-criterion-row">
          <span class="review-criterion-name">${accessibilityNames[code]}</span>
          <select class="review-criterion-select" data-code="${code}" required>
            <option value="">Оценка</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </div>
      `).join("");
      institutionIdInput.value = String(institution.id);
      institutionNameInput.value = institution.name || "";
      document.getElementById("reviewComment").value = "";
      document.getElementById("reviewInstitutionRating").value = "";
      const submitBtn = document.getElementById("submitReviewBtn");
      const errorNode = document.getElementById("reviewErrorMessage");
      if (submitBtn) submitBtn.disabled = false;
      if (errorNode) {
        errorNode.textContent = "";
        errorNode.classList.add("hidden");
      }
      modal.classList.remove("hidden");
    },

    async submitReview() {
      const institutionId = parseInt(document.getElementById("reviewInstitutionId")?.value || "", 10);
      const comment = (document.getElementById("reviewComment")?.value || "").trim();
      const institutionRating = parseInt(document.getElementById("reviewInstitutionRating")?.value || "", 10);
      const errorNode = document.getElementById("reviewErrorMessage");
      const submitBtn = document.getElementById("submitReviewBtn");
      if (!institutionId) return;
      if (!Number.isInteger(institutionRating) || institutionRating < 1 || institutionRating > 5) {
        if (errorNode) {
          errorNode.textContent = "Укажите оценку учреждения от 1 до 5.";
          errorNode.classList.remove("hidden");
        }
        return;
      }

      const criteriaRatings = {};
      let missing = false;
      const criteriaNodes = document.querySelectorAll(".review-criterion-select");
      document.querySelectorAll(".review-criterion-select").forEach((node) => {
        const code = node.dataset.code;
        const value = parseInt(node.value, 10);
        if (!Number.isInteger(value)) {
          missing = true;
          return;
        }
        criteriaRatings[code] = value;
      });

      if (criteriaNodes.length > 0 && missing) {
        if (errorNode) {
          errorNode.textContent = "Поставьте оценку каждому критерию доступности.";
          errorNode.classList.remove("hidden");
        }
        return;
      }

      if (submitBtn) submitBtn.disabled = true;
      if (errorNode) {
        errorNode.textContent = "";
        errorNode.classList.add("hidden");
      }
      try {
        const response = await fetch("/api/create_review.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            institution_id: institutionId,
            comment,
            institution_rating: institutionRating,
            criteria_ratings: criteriaRatings,
          }),
        });
        const data = await response.json();
        if (!response.ok || data.error) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }
        alert("Отзыв отправлен на модерацию.");
        document.getElementById("reviewModal")?.classList.add("hidden");
      } catch (error) {
        if (errorNode) {
          errorNode.textContent = `Ошибка отправки: ${error.message}`;
          errorNode.classList.remove("hidden");
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
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
      const accessibilityNames = {
        ramps_lifts: "Нормативные пандусы и подъемники",
        entrance_groups_doorways: "Входные группы и дверные проемы",
        tactile_pedestrian_indicators: "Тактильно-пешеходные указатели",
        braille_signage: "Информационные таблички со шрифтом Брайля",
        accessible_sanitary_facilities: "Оборудованные санитарно-гигиенические помещения",
        assistant_call_system: "Система вызова помощника",
        contrast_marking: "Контрастная маркировка",
        safety_zones_evacuation_routes: "Зоны безопасности и пути эвакуации",
        acoustic_systems_induction_loops: "Акустические системы и индукционные петли",
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
      const uniqueAccessibilityCriteria = institution.accessibility_criteria
        ? [...new Set(institution.accessibility_criteria)]
        : [];
      const avgAccessibility = institution.avg_accessibility_criteria || {};
  
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
      const accessibilitySection =
        uniqueAccessibilityCriteria.length > 0
          ? `<div class="admission-section">
            <h5>Критерии физической доступности:</h5>
            <div class="accessibility-rating-list">
              ${uniqueAccessibilityCriteria
            .map(
              (criterion) => {
                const avg = avgAccessibility[criterion];
                const avgBadge =
                  typeof avg === "number"
                    ? `<span class="tag-avg-circle" title="Средняя оценка критерия">${avg.toFixed(2)}</span>`
                    : "";
                const label = accessibilityNames[criterion] || criterion;
                return `<div class="accessibility-rating-row"><span class="accessibility-rating-label">${label}</span>${avgBadge}</div>`;
              }
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
      const approvedReviews = Array.isArray(institution.approved_reviews) ? institution.approved_reviews : [];
      const approvedReviewsCount = Number(institution.approved_reviews_count || approvedReviews.length || 0);
      const approvedReviewsSection = approvedReviewsCount > 0
        ? `<div class="institution-reviews-section">
            <h5>Отзывы пользователей (${approvedReviewsCount})</h5>
            <div class="institution-reviews-list">
              ${approvedReviews
                .map((review) => {
                  const rating = Number.parseFloat(String(review.rating ?? "0").replace(",", "."));
                  const safeRating = Number.isFinite(rating) ? Math.max(0, Math.min(5, rating)) : 0;
                  const stars = "★".repeat(Math.round(safeRating)) + "☆".repeat(5 - Math.round(safeRating));
                  return `<article class="institution-review-item">
                    <div class="institution-review-head">
                      <span class="institution-review-author">${review.author || "Пользователь"}</span>
                      <span class="institution-review-date">${review.created_at || ""}</span>
                    </div>
                    <div class="institution-review-rating" title="Оценка отзыва">${stars} ${safeRating.toFixed(2)}</div>
                    <p class="institution-review-comment">${review.comment || "Комментарий не указан."}</p>
                  </article>`;
                })
                .join("")}
            </div>
          </div>`
        : `<div class="institution-reviews-section">
            <h5>Отзывы пользователей</h5>
            <p class="institution-review-empty">Пока нет одобренных отзывов.</p>
          </div>`;
  
      const adminButtons = this.isAdmin
        ? `<div class="institution-actions">
            <button class="btn btn-primary edit-btn" data-id="${institution.id}">Редактировать</button>
            <button class="btn btn-danger delete-btn" data-id="${institution.id}">Удалить</button>
          </div>`
        : "";
      const favoriteButtons = this.isPortalUser && !this.isAdmin
        ? `<div class="institution-actions">
            <button class="btn ${institution.is_favorite ? "btn-danger" : "btn-primary"} favorite-btn" data-id="${institution.id}" data-favorite="${institution.is_favorite ? "true" : "false"}">
              ${institution.is_favorite ? "Удалить из избранного" : "Добавить в избранное"}
            </button>
            <button class="btn btn-secondary review-btn" data-id="${institution.id}">Оставить отзыв</button>
          </div>`
        : "";
      const relevanceBadge =
        typeof institution.relevance === "number"
          ? `<div class="institution-relevance-badge" title="Коэффициент релевантности">R: ${institution.relevance.toFixed(2)}</div>`
          : "";
  
      return `
      <div class="institution-card">
        ${relevanceBadge}
        <div class="institution-title-row">
          <h4>${institution.name}</h4>
          ${typeof institution.avg_institution_rating === "number" ? `<span class="institution-rating-circle" title="Средняя оценка учреждения">${institution.avg_institution_rating.toFixed(2)}</span>` : ""}
        </div>
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
          <div class="detail-item"><strong>Округа:</strong> ${this.districts[institution.district_id] || "Неизвестный район"
        }</div>
        </div>
        
        ${conditionsSection}
        ${admissionSection}
        ${accessibilitySection}
        ${institution.address 
            ? `<div class="detail-item"><strong>Адрес:</strong>&nbsp;${institution.address}</div>` 
            : ""
        }
        ${aoopSection}
        ${approvedReviewsSection}
        
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
        ${favoriteButtons}
      </div>
    `;
    },
  
    clearInstitutionForm() {
      document.getElementById('institutionForm').reset();
      document.getElementById('aoopList').innerHTML = '';
      this.aoopCounter = 0;
      document.getElementById('institutionAddress').value = '';
      document.getElementById('rangeMin').value = '';
      document.getElementById('rangeMax').value = '';
      document.getElementById('rangeMin').removeAttribute('min');
      document.getElementById('rangeMin').removeAttribute('max');
      document.getElementById('rangeMax').removeAttribute('min');
      document.getElementById('rangeMax').removeAttribute('max');
  
      this.editingInstitution = null;
      document.getElementById('institutionModalTitle').textContent = 'Добавить учреждение';
    },
  
    async handlePrevPage() {
      if (this.currentPage > 1) {
        await this.requestListPage(this.currentPage - 1);
        this.scrollToInstitutions();
      }
    },
  
    async handleNextPage() {
      if (this.currentPage < this.totalPages) {
        await this.requestListPage(this.currentPage + 1);
        this.scrollToInstitutions();
      }
    },
  
    async handlePageClick(page) {
      if (page !== this.currentPage) {
        await this.requestListPage(page);
        this.scrollToInstitutions();
      }
    },

    async requestListPage(page) {
      const districtName = document.getElementById("regionName")?.textContent || this.currentDistrictName;
      if (this.lastListMode === "search") {
        await this.applyCombinedFilters(page);
        return;
      }
      if (districtName) {
        await this.loadInstitutionsForDistrict(districtName, page);
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
