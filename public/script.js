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

    this.init();
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

  // Методы для загрузчика страницы
  showPageLoader() {
    const pageLoader = document.getElementById("pageLoader");
    if (pageLoader) {
      pageLoader.style.display = 'flex';
    }
  }

  hidePageLoader() {
    const pageLoader = document.getElementById("pageLoader");
    if (pageLoader) {
      // Плавное исчезновение
      pageLoader.style.opacity = '0';
      setTimeout(() => {
        pageLoader.style.display = 'none';
      }, 300);
    }
  }

  // Методы для загрузчика модального окна
  showModalLoader() {
    const modalLoader = document.getElementById("modalLoader");
    if (modalLoader) {
      modalLoader.classList.remove("hidden");
    }
  }

  hideModalLoader() {
    const modalLoader = document.getElementById("modalLoader");
    if (modalLoader) {
      modalLoader.classList.add("hidden");
    }
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

  searchInstitutions(searchTerm) {
    const q = this.normalizeString(searchTerm || '');
    if (!q.length) {
      // Отображаем полный текущий набор (мастер-список)
      this.displayInstitutions(this.allInstitutions || []);
      return;
    }

    const numberMatch = (searchTerm || '').match(/\d+/);
    const queryNumber = numberMatch ? numberMatch[0] : null;

    const synonyms = {
      preschool: ['детсад', 'детскийсад', 'садик', 'дс', 'сад', "дет сад", "дет.сад", "дет. сад", "дет садик", "дет.садик", "дет. садик"],
      school: ['школа', 'шк', 'сош'],
      school_internat: ['интернат', 'школаинтернат'],
      spo: ['спо', 'техникум', 'колледж', 'училище'],
      vo: ['во', 'вуз', 'университет', 'институт', 'академия']
    };

    const source = Array.isArray(this.allInstitutions) ? this.allInstitutions : [];
    const results = source.filter(inst => {
      const name = this.normalizeString(inst.name || '');
      const desc = this.normalizeString(inst.description || '');
      const director = this.normalizeString(
        (inst.director && (inst.director.name || inst.director.full_name)) || ''
      );
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

    // Отрисовываем результаты поиска (не меняем this.allInstitutions)
    this.displayInstitutions(results);
  }

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
      document.querySelectorAll('.filter-group-accordion input[value^="3-"], .filter-group-accordion input[value^="5-"], .filter-group-accordion input[value^="7+"]')
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
      // --- фильтрация по типу учреждения ---
      if (selectedTypes.length && !selectedTypes.includes(inst.type)) return false;

      // --- фильтрация по возрасту / диапазону ---
      if (selectedAges.length && inst.range_min && inst.range_max) {
        const matchAge = selectedAges.some(age => {
          if (age.includes('-')) {
            const [min, max] = age.split('-').map(Number);
            return inst.range_min <= max && inst.range_max >= min;
          } else if (age.includes('+')) {
            const min = parseInt(age);
            return inst.range_max >= min;
          }
          return false;
        });
        if (!matchAge) return false;
      }

      // --- фильтрация по условиям (ОВЗ) ---
      if (selectedConditions.length) {
        const hasCond = inst.conditions?.some(c => selectedConditions.includes(c));
        if (!hasCond) return false;
      }

      // --- фильтрация по АООП ---
      if (aoopSelected && (!inst.aoop_programs || inst.aoop_programs.length === 0)) return false;

      // --- теперь поиск ---
      if (!q) return true; // если строка пустая — только фильтры

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
  }

  // Нормализация строки для сравнения
  normalizeString(str) {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/№/g, '')
      .replace(/[^a-zа-я0-9]/gi, '');
  }

  // Дебаунс (чтобы не дергать фильтр на каждую букву моментально)
  debounce(fn, delay = 250) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
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
      document.getElementById("mapWrapper").innerHTML = '<p class="text-center text-muted">Ошибка загрузки карты</p>';
    }
  }

  // В методе setupMapInteractivity() замените код:
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

        // Добавляем начальные стили для анимации
        if (!this.animationPlayed) {
          polygon.style.transform = "scale(0)";
          polygon.style.opacity = "0";
          polygon.style.transition = "transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease-out";
        }

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

    // Запускаем анимацию после небольшой задержки
    if (!this.animationPlayed) {
      setTimeout(() => {
        this.animateDistrictsAppearance();
        this.animationPlayed = true;
      }, 300);
    }
  }

  // Добавьте новый метод для анимации:
  animateDistrictsAppearance() {
    const svg = document.querySelector("#mapWrapper svg");
    if (!svg) return;

    const districts = svg.querySelectorAll(".district");
    const centerX = svg.viewBox.baseVal.width / 2;
    const centerY = svg.viewBox.baseVal.height / 2;

    districts.forEach((district, index) => {
      // Получаем центр района для расчета направления анимации
      const bbox = district.getBBox();
      const districtCenterX = bbox.x + bbox.width / 2;
      const districtCenterY = bbox.y + bbox.height / 2;

      // Рассчитываем направление от центра карты к центру района
      const deltaX = districtCenterX - centerX;
      const deltaY = districtCenterY - centerY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const directionX = deltaX / distance;
      const directionY = deltaY / distance;

      // Начальное смещение (чем дальше район, тем больше смещение)
      const startOffset = Math.min(distance * 0.1, 50);

      // Устанавливаем начальную позицию с отдельным transition для анимации появления
      district.style.transition = 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.6s ease-out';
      district.style.transform = `translate(${directionX * startOffset}px, ${directionY * startOffset}px) scale(0.8)`;
      district.style.opacity = "0";

      // Запускаем анимацию с задержкой для создания волнового эффекта
      setTimeout(() => {
        district.style.transform = "translate(0, 0) scale(1)";
        district.style.opacity = "1";

        // После завершения анимации появления возвращаем стандартные transition для hover
        setTimeout(() => {
          district.style.transition = 'transform 0.3s ease-out, filter 0.3s ease-out, stroke-width 0.3s ease-out';
        }, 800);
      }, 100 + index * 40);
    });
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
      // Показываем загрузчик модального окна с задержкой
      this.loaderTimeout = setTimeout(() => {
        this.showModalLoader();
      }, 200);

      const params = new URLSearchParams({ district_id: districtId });
      const response = await fetch(`/api/get_institutions.php?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      // Сохраняем "мастер"-список учреждений для данного района
      this.allInstitutions = Array.isArray(data.institutions) ? data.institutions : [];

      // Отображаем (displayInstitutions больше this.allInstitutions не перезаписывает)
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
  }


  displayInstitutions(institutions) {
    // НЕ перезаписываем this.allInstitutions здесь!
    // this.allInstitutions должен быть установлен только при загрузке с сервера / при применении серверных фильтров.

    // institutions — массив, который хотим сейчас отрисовать (может быть filtered от поиска)
    this.totalPages = Math.ceil(institutions.length / this.itemsPerPage);
    this.currentPage = 1;

    const debugInfo = document.getElementById("debugInfo");
    const institutionCount = document.getElementById("institutionCount");

    if (institutionCount) {
      institutionCount.textContent = `(${institutions.length})`;
    }

    if (institutions.length === 0) {
      document.getElementById("institutionsList").innerHTML = '<p class="text-muted">Учреждения не найдены</p>';

      // Скрываем пагинацию и debugInfo
      const paginationTop = document.getElementById("paginationTop");
      const paginationBottom = document.getElementById("paginationBottom");
      if (paginationTop) paginationTop.classList.add("hidden");
      if (paginationBottom) paginationBottom.classList.add("hidden");
      if (debugInfo) debugInfo.style.display = 'none';
      return;
    }

    // Показываем debugInfo когда есть учреждения
    if (debugInfo) {
      debugInfo.style.display = 'block';
    }

    // Сохраним текущий набор, который отображается (не путать с this.allInstitutions)
    this.displayedInstitutionsFull = institutions.slice(); // полный набор для пагинации
    this.totalPages = Math.ceil(this.displayedInstitutionsFull.length / this.itemsPerPage);
    this.currentPage = 1;

    this.showCurrentPage();
    this.updatePagination();
  }


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

      // Обновляем информацию о пагинации
      if (debugInfo) {
        const start = startIndex + 1;
        const end = Math.min(endIndex, source.length);
        debugInfo.textContent = `Показано ${start}-${end} из ${source.length} учреждений (Страница ${this.currentPage} из ${this.totalPages})`;
      }
    }

    // Обновляем кнопки действий для админа
    if (this.isAdmin) {
      this.bindAdminActions();
    }
  }


  updatePagination() {
    const paginationTop = document.getElementById("paginationTop");
    const paginationBottom = document.getElementById("paginationBottom");
    const numbersTop = document.getElementById("paginationNumbersTop");
    const numbersBottom = document.getElementById("paginationNumbersBottom");

    // Проверяем существование элементов перед работой с ними
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
  }

  updatePaginationButtons() {
    const prevButtons = document.querySelectorAll('.pagination-prev');
    const nextButtons = document.querySelectorAll('.pagination-next');

    prevButtons.forEach(btn => {
      if (btn) btn.disabled = this.currentPage === 1;
    });

    nextButtons.forEach(btn => {
      if (btn) btn.disabled = this.currentPage === this.totalPages;
    });
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
      this.closeAllAccordions(); // Закрыть все аккордеоны
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
          this.applyCombinedFilters(); // теперь поиск всегда связан с фильтрами
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

    // Apply and reset filters - will be handled by admin or basic
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

    document.querySelectorAll('.type-filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.target.dataset.type;
        this.handleTypeFilter(type);

        // Обновляем активные кнопки
        document.querySelectorAll('.type-filter-btn').forEach(b => {
          b.classList.remove('active');
        });
        e.target.classList.add('active');
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
  }

  closeAllAccordions() {
    const accordionToggles = document.querySelectorAll(".accordion-toggle");
    const accordionContents = document.querySelectorAll(".accordion-content");

    accordionToggles.forEach(toggle => {
      toggle.classList.remove("active");
    });

    accordionContents.forEach(content => {
      content.classList.remove("open");
    });
  }

  resetFiltersUI() {
    // Сбрасываем все чекбоксы в фильтрах
    document.querySelectorAll('.filter-group-accordion input[type="checkbox"]').forEach((cb) => {
      cb.checked = false;
    });
    // Закрываем аккордеоны
    this.closeAllAccordions();
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
    document.getElementById("regionName").textContent = districtName;

    // Сбрасываем фильтр типов
    document.querySelectorAll('.type-filter-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector('.type-filter-btn[data-type="all"]').classList.add('active');

    this.loadInstitutionsForDistrict(districtName);
    const searchInput = document.getElementById("institutionSearch");
    this.resetFiltersUI();
    if (searchInput) searchInput.value = '';
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
    if (!tooltip) return;

    tooltip.style.left = (e.pageX + 20) + "px";
    tooltip.style.top = (e.pageY - 20) + "px";
  }

  clearInstitutionForm() {
    document.getElementById('institutionForm').reset();
    document.getElementById('aoopList').innerHTML = '';
    this.aoopCounter = 0;

    this.editingInstitution = null;
    document.getElementById('institutionModalTitle').textContent = 'Добавить учреждение';
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
    const districtName = document.getElementById("regionName").textContent;
    const districtId = this.districtIdMap[districtName];
    if (!districtId) return;
    try {
      this.showModalLoader();
      const params = new URLSearchParams({ district_id: districtId });

      // Фильтрация по типу учреждения
      document
        .querySelectorAll('.filter-group-accordion input[type="checkbox"]:checked')
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
        '.filter-group-accordion input[value^="3-"], .filter-group-accordion input[value^="5-"], .filter-group-accordion input[value^="7+"]'
      );
      ageCheckboxes.forEach((cb) => {
        if (cb.checked) {
          params.append("age[]", cb.value);
        }
      });

      // Фильтрация по особым условиям
      const conditionCheckboxes = document.querySelectorAll(
        '.filter-group-accordion input[value="hearing_impairment"], .filter-group-accordion input[value="vision_impairment"], .filter-group-accordion input[value="musculoskeletal_impairment"], .filter-group-accordion input[value="speech_impairment"], .filter-group-accordion input[value="mental_retardation"], .filter-group-accordion input[value="autism"], .filter-group-accordion input[value="multiple_disorders"]'
      );
      conditionCheckboxes.forEach((cb) => {
        if (cb.checked) {
          params.append("condition[]", cb.value);
        }
      });

      // Фильтрация по АООП
      if (document.querySelector('.filter-group-accordion input[value="aoop"]:checked')) {
        params.append("aoop", "1");
      }
      this.currentPage = 1;
      // Загрузка отфильтрованных данных
      this.loadFilteredInstitutions(params);
    } finally {
      this.hideModalLoader();
    }
  }

  async loadFilteredInstitutions(params) {
    try {
      const response = await fetch(`/api/get_institutions.php?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      // Обновляем "мастер"-список — фильтры с сервера изменяют набор
      this.allInstitutions = Array.isArray(data.institutions) ? data.institutions : [];

      // И отрисовываем этот набор
      this.displayInstitutions(this.allInstitutions);

      if (window.innerWidth <= 768) {
        document.getElementById("filtersSection").classList.add("hidden");
      }
    } catch (error) {
      console.error("Error applying filters:", error);
    }
  }

  // Добавить в класс LipetskMap
  handleTypeFilter(type) {
    if (type === 'all') {
      // Показываем все учреждения
      this.displayInstitutions(this.allInstitutions);
    } else {
      // Фильтруем по типу
      const filtered = this.allInstitutions.filter(inst => inst.type === type);
      this.displayInstitutions(filtered);
    }

    // Прокручиваем к началу списка
    this.scrollToInstitutions();
  }


  resetFilters() {
    document.querySelectorAll('.filter-group-accordion input[type="checkbox"]').forEach((cb) => {
      cb.checked = false;
    });
    // Сбрасываем фильтр типов
    document.querySelectorAll('.type-filter-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector('.type-filter-btn[data-type="all"]').classList.add('active');
    this.currentPage = 1;
    const districtName = document.getElementById("regionName").textContent;
    this.loadInstitutionsForDistrict(districtName);
    if (window.innerWidth <= 768) {
      document.getElementById("filtersSection").classList.add("hidden");
    }
  }

  showLoader() {
    const loader = document.getElementById("modalLoader");
    const institutionsSection = document.querySelector('.institutions-section');
    if (loader) {
      loader.classList.remove("hidden");
    }
    if (institutionsSection) {
      institutionsSection.style.opacity = "0.5";
    }
  }

  hideLoader() {
    const loader = document.getElementById("modalLoader");
    const institutionsSection = document.querySelector('.institutions-section');
    if (loader) {
      loader.classList.add("hidden");
    }
    if (institutionsSection) {
      institutionsSection.style.opacity = "1";
    }
  }


}

let lipetskMap;
document.addEventListener("DOMContentLoaded", () => {
  lipetskMap = new LipetskMap();
});

// В конец script.js
document.addEventListener('DOMContentLoaded', () => {
  // Обработчик ошибок загрузки страницы
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

  // Скрываем загрузчик страницы если что-то пошло не так
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
});
