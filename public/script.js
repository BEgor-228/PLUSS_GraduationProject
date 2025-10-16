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

    // Пагинация
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.totalPages = 0;
    this.allInstitutions = [];
    this.displayedInstitutions = [];

    this.init();
  }

  async init() {
    await this.loadMap();
    this.bindEvents();
    await this.loadDistricts();
  }

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
  }

  async loadMap() {
    try {
      const response = await fetch("map.svg");
      const svgText = await response.text();
      const mapWrapper = document.getElementById("mapWrapper");
      mapWrapper.innerHTML = svgText;
      this.setupMapInteractivity();
    } catch (error) {
      console.error("Error loading map:", error);
      document.getElementById("mapWrapper").innerHTML =
        '<p class="text-center text-muted">Ошибка загрузки карты</p>';
    }
  }

  setupMapInteractivity() {
    const svg = document.querySelector("#mapWrapper svg");
    if (!svg) return;

    const groups = svg.querySelectorAll("g[id][data-region-name]");
    const originalOrder = Array.from(groups);
    const colors = [
      "#e57878", "#d88953", "#f7dc71", "#cfe672",
      "#8ee157", "#81ec81", "#60e094", "#84f2dc",
      "#7cc6d8", "#66a2fd", "#7171f8", "#b98cfb",
      "#b956d2", "#ea7cd4", "#f14d8f", "#FF6347",
      "#D2B48C", "#87CEEB", "#9932CC", "#FF69B4",
    ];

    let hideTimeout;
    groups.forEach((group, index) => {
      const regionId = group.id;
      const regionName =
        group.getAttribute("data-region-name") ||
        this.getDistrictName(regionId);
      const color = colors[index % colors.length];
      this.districtColors[regionName] = color;
      const polygons = group.querySelectorAll("polygon, path, circle, rect");
      polygons.forEach((polygon) => {
        if (!polygon.id) {
          polygon.id = `${regionId}-shape-${index}`;
        }
        polygon.classList.add("district");
        polygon.style.fill = color;
        polygon.setAttribute("tabindex", "0");
        polygon.setAttribute("role", "button");
        this.districts[polygon.id] = {
          name: regionName,
          element: polygon,
          group: group,
        };
        polygon.addEventListener("click", (e) => {
          e.stopPropagation();
          this.handleDistrictClick(e, regionName);
        });
        polygon.addEventListener("mouseenter", (e) => {
          e.stopPropagation();
          if (hideTimeout) clearTimeout(hideTimeout);
          this.showTooltip(e, regionName);
          svg.appendChild(group);
          if (group.id === "region_eletskiy") {
            const eletsGroup = svg.querySelector("#elets");
            if (eletsGroup) {
              svg.appendChild(eletsGroup);
            }
          }
        });
        polygon.addEventListener("mouseout", (e) => {
          e.stopPropagation();
          hideTimeout = setTimeout(() => {
            this.hideTooltip();
            originalOrder.forEach((originalGroup) =>
              svg.appendChild(originalGroup)
            );
          }, 100);
        });
        polygon.addEventListener("mousemove", (e) => {
          e.stopPropagation();
          this.updateTooltipPosition(e);
        });
        polygon.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            this.handleDistrictClick(e, regionName);
          }
        });
      });
    });
    const eletsGroup = svg.querySelector("#elets");
    if (eletsGroup) {
      svg.appendChild(eletsGroup);
    }
  }

  populateLegend() {
    const legendList = document.getElementById("legendList");
    if (!legendList) return;

    const sortedDistricts = Object.values(this.districts).sort();
    legendList.innerHTML = sortedDistricts
      .map((name) => {
        const color = this.districtColors[name];
        return `
          <li class="legend-item" data-district-name="${name}">
            <div class="color-swatch" style="background-color: ${color};"></div>
            <span>${name}</span>
          </li>
        `;
      })
      .join("");
    document.querySelectorAll(".legend-item").forEach((item) => {
      item.addEventListener("click", () => {
        const name = item.dataset.districtName;
        this.currentDistrictName = name;
        this.openDistrictModal(name);
      });
    });
  }

  populateDistrictSelect() {
    const districtSelect = document.getElementById("districtId");
    const sortedDistricts = Object.values(this.districts).sort();
    districtSelect.innerHTML = `
        <option value="">Выберите район</option>
        ${sortedDistricts
        .map(
          (name) =>
            `<option value="${this.districtIdMap[name]}">${name}</option>`
        )
        .join("")}
      `;
  }

  getDistrictName(districtId) {
    const name = Object.values(this.districts).find((name) =>
      name.includes(districtId)
    );
    return name || `Район ${districtId}`;
  }

  async loadInstitutionsForDistrict(districtName) {
    const districtId = this.districtIdMap[districtName];
    if (!districtId) return;

    try {
      const params = new URLSearchParams({ district_id: districtId });
      const response = await fetch(`/api/get_institutions.php?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      console.log("Loaded institutions from API:", data.institutions.length);
      this.displayInstitutions(data.institutions);
    } catch (error) {
      console.error("Error loading institutions:", error);
      document.getElementById("institutionsList").innerHTML =
        "<p>Ошибка загрузки учреждений</p>";
    }
  }

  displayInstitutions(institutions) {
    this.allInstitutions = institutions;
    this.totalPages = Math.ceil(institutions.length / this.itemsPerPage);
    this.currentPage = 1;

    document.getElementById(
      "institutionCount"
    ).textContent = `(${institutions.length})`;

    if (institutions.length === 0) {
      document.getElementById("institutionsList").innerHTML =
        '<p class="text-muted">Учреждения не найдены</p>';
      document.getElementById("pagination").classList.add("hidden");
      return;
    }

    this.showCurrentPage();
    this.updatePagination(); // Сначала показываем учреждения, потом обновляем пагинацию
  }

  showCurrentPage() {
    console.log(
      "Showing page:",
      this.currentPage,
      "Total institutions:",
      this.allInstitutions.length
    );

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.displayedInstitutions = this.allInstitutions.slice(
      startIndex,
      endIndex
    );

    console.log(
      "Displaying institutions:",
      this.displayedInstitutions.length,
      "from",
      startIndex,
      "to",
      endIndex
    );

    const list = document.getElementById("institutionsList");
    if (this.displayedInstitutions.length === 0) {
      list.innerHTML = '<p class="text-muted">Учреждения не найдены</p>';
    } else {
      list.innerHTML = this.displayedInstitutions
        .map((inst) => this.createInstitutionCard(inst))
        .join("");
    }
    const debugInfo = document.getElementById("debugInfo");
    if (debugInfo) {
      const start = (this.currentPage - 1) * this.itemsPerPage + 1;
      const end = Math.min(
        this.currentPage * this.itemsPerPage,
        this.allInstitutions.length
      );
      debugInfo.innerHTML = `Показано ${start}-${end} из ${this.allInstitutions.length} учреждений (Страница ${this.currentPage} из ${this.totalPages})`;
    }
    // Обновляем кнопки действий для админа
    if (this.isAdmin) {
      this.bindAdminActions();
    }
  }

  updatePagination() {
    const pagination = document.getElementById("pagination");
    const numbersContainer = document.getElementById("paginationNumbers");

    console.log(
      "Updating pagination. Total pages:",
      this.totalPages,
      "Current page:",
      this.currentPage
    );

    if (!pagination || !numbersContainer) {
      console.error("Pagination elements not found!");
      return;
    }

    if (this.totalPages <= 1) {
      pagination.classList.add("hidden");
      console.log("Hiding pagination - only 1 page");
      return;
    }

    pagination.classList.remove("hidden");
    console.log("Showing pagination with", this.totalPages, "pages");

    // Обновляем состояние кнопок вперед/назад
    const prevBtn = document.getElementById("prevPage");
    const nextBtn = document.getElementById("nextPage");

    if (prevBtn) prevBtn.disabled = this.currentPage === 1;
    if (nextBtn) nextBtn.disabled = this.currentPage === this.totalPages;

    // Генерируем номера страниц
    numbersContainer.innerHTML = this.generatePaginationNumbers();
    console.log("Generated pagination numbers");
  }

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
  }

  createPageButton(page, isActive = false) {
    return `<button class="pagination-number ${isActive ? "active" : ""
      }" data-page="${page}">${page}</button>`;
  }

  bindPaginationEvents() {
    // Кнопки вперед/назад
    document.getElementById("prevPage").addEventListener("click", () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.showCurrentPage();
        this.updatePagination();
      }
    });

    document.getElementById("nextPage").addEventListener("click", () => {
      if (this.currentPage < this.totalPages) {
        this.currentPage++;
        this.showCurrentPage();
        this.updatePagination();
      }
    });

    // Номера страниц
    document.querySelectorAll(".pagination-number").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const page = parseInt(e.target.dataset.page);
        if (page !== this.currentPage) {
          this.currentPage = page;
          this.showCurrentPage();
          this.updatePagination();
        }
      });
    });
  }

  bindAdminActions() {
    // Привязываем события для кнопок редактирования/удаления
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
  }

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
    if (institution.range_min && institution.range_max) {
      if (institution.type === "preschool") {
        rangeInfo = `${institution.range_min}-${institution.range_max} лет`;
      } else if (
        institution.type === "school" ||
        institution.type === "school_internat"
      ) {
        rangeInfo = `${institution.range_min}-${institution.range_max} классы`;
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
            (prog) =>
              `<li><a href="${prog.url}" target="_blank">${prog.name}</a></li>`
          )
          .join("")}
          </ul>
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
        ? `<div class="detail-item"><strong>${institution.type === "preschool" ? "Возраст:" : "Классы:"
        }</strong> ${rangeInfo}</div>`
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
  }

  bindEvents() {
    document.getElementById("closeModal").addEventListener("click", () => {
      document.getElementById("districtModal").classList.add("hidden");
    });

    document.getElementById("toggleFilters").addEventListener("click", () => {
      const filtersSection = document.getElementById("filtersSection");
      filtersSection.classList.toggle("hidden");
    });

    // Institution form events (basic, admin will handle submit)
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

    // Apply and reset filters - will be handled by admin or basic
    document.getElementById("applyFilters").addEventListener("click", () => {
      this.applyFilters();
    });

    document.getElementById("resetFilters").addEventListener("click", () => {
      this.resetFilters();
    });

    // Обработчики для кнопок "вперед/назад" - привязываем один раз при инициализации
    document.getElementById("prevPage")?.addEventListener("click", () => {
      this.handlePrevPage();
    });

    document.getElementById("nextPage")?.addEventListener("click", () => {
      this.handleNextPage();
    });

    // Обработчик для клика по номерам страниц (делегирование событий)
    document.getElementById("pagination")?.addEventListener("click", (e) => {
      if (e.target.classList.contains("pagination-number")) {
        const page = parseInt(e.target.dataset.page);
        this.handlePageClick(page);
      }
    });
  }

  handlePrevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.showCurrentPage();
      this.updatePagination();
      this.scrollToInstitutions();
    }
  }

  handleNextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.showCurrentPage();
      this.updatePagination();
      this.scrollToInstitutions();
    }
  }

  handlePageClick(page) {
    if (page !== this.currentPage) {
      this.currentPage = page;
      this.showCurrentPage();
      this.updatePagination();
      this.scrollToInstitutions();
    }
  }

  // Метод для плавной прокрутки к началу списка учреждений
  scrollToInstitutions() {
    const institutionsSection = document.querySelector(".institutions-section");
    if (institutionsSection) {
      institutionsSection.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  handleDistrictClick(e, districtName) {
    this.currentDistrictName = districtName;
    this.openDistrictModal(districtName);
  }

  openDistrictModal(districtName) {
    document.getElementById("districtModal").classList.remove("hidden");
    document.getElementById("modalTitle").textContent = districtName;
    document.getElementById("regionName").textContent = districtName;
    this.loadInstitutionsForDistrict(districtName);
    this.loadDistrictSVG(districtName);
  }

  async loadDistrictSVG(districtName) {
    const svgModal = document.querySelector("#districtModal .region-image");
    if (!svgModal) return;

    try {
      const mainSvg = document.querySelector("#mapWrapper svg");
      if (!mainSvg) return;

      let regionGroup = mainSvg.querySelector(
        `g[data-region-name="${districtName}"]`
      );
      if (!regionGroup && districtName === "Липецк (город)") {
        regionGroup = mainSvg.querySelector("#lipeck");
      }
      if (!regionGroup && districtName === "г. Елец") {
        regionGroup = mainSvg.querySelector("#elets");
      }

      if (regionGroup) {
        const clone = regionGroup.cloneNode(true);
        const polygon = clone.querySelector("polygon");

        if (polygon) {
          const a = 1.4420655,
            b = 0,
            c = 0,
            d = 1.4420655,
            e = -45.179089,
            f = -121.84611;
          const pointsStr = polygon.getAttribute("points");
          const pointPairs = pointsStr.match(/[0-9.-]+,[0-9.-]+/g) || [];

          let txs = [],
            tys = [];
          pointPairs.forEach((pair) => {
            const [xStr, yStr] = pair.split(",");
            const x = parseFloat(xStr),
              y = parseFloat(yStr);
            const tx = a * x + c * y + e;
            const ty = b * x + d * y + f;
            txs.push(tx);
            tys.push(ty);
          });

          if (txs.length > 0) {
            const minX = Math.min(...txs);
            const maxX = Math.max(...txs);
            const minY = Math.min(...tys);
            const maxY = Math.max(...tys);
            const w = maxX - minX;
            const h = maxY - minY;
            const padding = 0.05;
            const offsetX = padding * w;
            const offsetY = padding * h;
            const paddedW = w + 2 * offsetX;
            const paddedH = h + 2 * offsetY;

            svgModal.setAttribute("viewBox", `0 0 ${paddedW} ${paddedH}`);
            svgModal.setAttribute("preserveAspectRatio", "xMidYMid meet");

            const newPoints = [];
            for (let i = 0; i < pointPairs.length; i++) {
              const nx = txs[i] - minX + offsetX;
              const ny = tys[i] - minY + offsetY;
              newPoints.push(`${nx.toFixed(2)},${ny.toFixed(2)}`);
            }

            polygon.setAttribute("points", newPoints.join(" "));
            clone.removeAttribute("transform");
            polygon.style.fill = this.districtColors[districtName];
            polygon.style.stroke = "black";
            polygon.style.strokeWidth = "2";
            polygon.classList.add("region");

            svgModal.innerHTML = "";
            svgModal.appendChild(clone);
            return;
          }
        }

        svgModal.innerHTML = "";
        svgModal.appendChild(clone);
      } else {
        svgModal.innerHTML =
          '<text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#27ae60" font-size="16">SVG не найден</text>';
      }
    } catch (error) {
      console.error("Error loading district SVG:", error);
      svgModal.innerHTML =
        '<text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#e74c3c" font-size="16">Ошибка загрузки</text>';
    }
  }

  showTooltip(e, districtName) {
    const tooltip = document.getElementById("tooltip");
    tooltip.textContent = districtName;
    tooltip.classList.remove("hidden");
  }

  hideTooltip() {
    document.getElementById("tooltip").classList.add("hidden");
  }

  updateTooltipPosition(e) {
    const tooltip = document.getElementById("tooltip");
    tooltip.style.left = e.pageX - 65 + "px";
    tooltip.style.top = e.pageY - 165 + "px";
  }

  clearInstitutionForm() {
    document.getElementById("institutionForm").reset();
    document.getElementById("aoopList").innerHTML = "";
    this.aoopCounter = 0;
    document.getElementById("institutionModalTitle").textContent =
      "Добавить учреждение";
    this.editingInstitution = null;
  }

  addAoOpField() {
    this.aoopCounter++;
    const aoopList = document.getElementById("aoopList");
    const field = document.createElement("div");
    field.className = "aoop-field form-group";
    field.innerHTML = `
      <input type="text" class="aoop-name" placeholder="Название программы" required>
      <input type="url" class="aoop-url" placeholder="URL программы">
      <button type="button" class="remove-aoop btn btn-danger">Удалить</button>
    `;
    aoopList.appendChild(field);
    field.querySelector(".remove-aoop").addEventListener("click", () => {
      field.remove();
    });
  }

  applyFilters() {
    const districtName = document.getElementById("modalTitle").textContent;
    const districtId = this.districtIdMap[districtName];
    if (!districtId) return;

    const params = new URLSearchParams({ district_id: districtId });

    // Фильтрация по типу учреждения
    document
      .querySelectorAll('.filter-group input[type="checkbox"]:checked')
      .forEach((cb) => {
        if (
          ["preschool", "school", "school_internat", "spo", "vo"].includes(
            cb.value
          )
        ) {
          params.append("type[]", cb.value);
        }
      });

    // Фильтрация по возрастным группам
    const ageCheckboxes = document.querySelectorAll(
      '.filter-group input[value^="3-"], .filter-group input[value^="5-"], .filter-group input[value^="7+"]'
    );
    ageCheckboxes.forEach((cb) => {
      if (cb.checked) {
        params.append("age[]", cb.value);
      }
    });

    // Фильтрация по особым условиям
    const conditionCheckboxes = document.querySelectorAll(
      '.filter-group input[value="hearing_impairment"], .filter-group input[value="vision_impairment"], .filter-group input[value="musculoskeletal_impairment"], .filter-group input[value="speech_impairment"], .filter-group input[value="mental_retardation"], .filter-group input[value="autism"], .filter-group input[value="multiple_disorders"]'
    );
    conditionCheckboxes.forEach((cb) => {
      if (cb.checked) {
        params.append("condition[]", cb.value);
      }
    });

    // Фильтрация по АООП
    if (document.querySelector('.filter-group input[value="aoop"]:checked')) {
      params.append("aoop", "1");
    }
    this.currentPage = 1;
    // Загрузка отфильтрованных данных
    this.loadFilteredInstitutions(params);
  }

  async loadFilteredInstitutions(params) {
    try {
      const response = await fetch(`/api/get_institutions.php?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      this.displayInstitutions(data.institutions);
      if (window.innerWidth <= 768) {
        document.getElementById("filtersSection").classList.add("hidden");
      }
    } catch (error) {
      console.error("Error applying filters:", error);
      // Для обычных пользователей не показываем alert, просто логируем ошибку
    }
  }

  resetFilters() {
    document
      .querySelectorAll('.filter-group input[type="checkbox"]')
      .forEach((cb) => {
        cb.checked = false;
      });
    this.currentPage = 1;
    const districtName = document.getElementById("modalTitle").textContent;
    this.loadInstitutionsForDistrict(districtName);

    if (window.innerWidth <= 768) {
      document.getElementById("filtersSection").classList.add("hidden");
    }
  }
}

let lipetskMap;
document.addEventListener("DOMContentLoaded", () => {
  lipetskMap = new LipetskMap();
});
