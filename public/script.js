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
    this.init();
  }

  async init() {
    await this.loadMap();
    this.bindEvents();
    await this.loadDistricts();
  }

  async loadDistricts() {
    try {
      const response = await fetch('/api/get_districts.php');
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
      console.error('Error loading districts:', error);
      this.districts = {1: "Липецкий район", 2: "Елецкий район"};
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
      document.getElementById("mapWrapper").innerHTML = '<p class="text-center text-muted">Ошибка загрузки карты</p>';
    }
  }

  setupMapInteractivity() {
    const svg = document.querySelector("#mapWrapper svg");
    if (!svg) return;
  
    const groups = svg.querySelectorAll("g[id][data-region-name]");
    const originalOrder = Array.from(groups);
    const colors = [
      "#e57878","#d88953","#f7dc71",
      "#cfe672","#8ee157","#81ec81",
      "#60e094","#84f2dc","#7cc6d8",
      "#66a2fd","#7171f8","#b98cfb",
      "#b956d2","#ea7cd4","#f14d8f",
      "#FF6347","#D2B48C","#87CEEB",
      "#9932CC","#FF69B4"
    ];
  
    let hideTimeout;
    groups.forEach((group, index) => {
      const regionId = group.id;
      const regionName = group.getAttribute("data-region-name") || this.getDistrictName(regionId);
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
            originalOrder.forEach((originalGroup) => svg.appendChild(originalGroup));
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
        ${sortedDistricts.map((name) => `<option value="${name}">${name}</option>`).join("")}
      `;
  }

  getDistrictName(districtId) {
    const name = Object.values(this.districts).find(name => name.includes(districtId));
    return name || `Район ${districtId}`;
  }

  async getInstitutionCountForDistrict(districtName) {
    await this.loadInstitutionsForDistrict(districtName);
    return this.institutions.length;
  }

  showTooltip(event, districtName) {
    this.getInstitutionCountForDistrict(districtName).then(count => {
      const tooltip = document.getElementById("tooltip");
      tooltip.innerHTML = `
        <strong>${districtName}</strong><br>
        Учреждений: ${count}
      `;
      tooltip.classList.remove("hidden");
      this.updateTooltipPosition(event);
    }).catch(() => {
      this.hideTooltip();
    });
  }

  updateTooltipPosition(event) {
    const tooltip = document.getElementById("tooltip");
    const rect = document.getElementById("mapWrapper").getBoundingClientRect();
    tooltip.style.left = event.clientX - rect.left + 10 + "px";
    tooltip.style.top = event.clientY - rect.top - 10 + "px";
  }

  hideTooltip() {
    document.getElementById("tooltip").classList.add("hidden");
  }

  handleDistrictClick(event, districtName) {
    this.currentDistrictName = districtName;
    this.openDistrictModal(districtName);
  }

  async openDistrictModal(districtName) {
    document.getElementById("modalTitle").textContent = districtName;
    document.getElementById("regionName").textContent = districtName;
    document.getElementById("districtModal").classList.remove("hidden");
    await this.loadInstitutionsForDistrict(districtName); 
    const svgModal = document.querySelector('#districtModal .region-image');
    if (svgModal) {
      svgModal.innerHTML = '';
      const mainSvg = document.querySelector('#mapWrapper svg');
      if (mainSvg) {
        let regionGroup = mainSvg.querySelector(`g[data-region-name="${districtName}"]`);
        if (!regionGroup && districtName === 'Липецк (город)') {
          regionGroup = mainSvg.querySelector('#lipeck');
        }
        if (!regionGroup && districtName === 'г. Елец') {
          regionGroup = mainSvg.querySelector('#elets');
        }
        if (regionGroup) {
          const clone = regionGroup.cloneNode(true);
          const polygon = clone.querySelector('polygon');
          if (polygon) {
            const a = 1.4420655, b = 0, c = 0, d = 1.4420655, e = -45.179089, f = -121.84611;
            const pointsStr = polygon.getAttribute('points');
            const pointPairs = pointsStr.match(/[0-9.-]+,[0-9.-]+/g) || [];
            let txs = [], tys = [];
            pointPairs.forEach(pair => {
              const [xStr, yStr] = pair.split(',');
              const x = parseFloat(xStr), y = parseFloat(yStr);
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
              svgModal.setAttribute('viewBox', `0 0 ${paddedW} ${paddedH}`);
              svgModal.setAttribute('preserveAspectRatio', 'xMidYMid meet');
              const newPoints = [];
              for (let i = 0; i < pointPairs.length; i++) {
                const nx = (txs[i] - minX) + offsetX;
                const ny = (tys[i] - minY) + offsetY;
                newPoints.push(`${nx.toFixed(2)},${ny.toFixed(2)}`);
              }
              polygon.setAttribute('points', newPoints.join(' '));
              clone.removeAttribute('transform');
              polygon.style.fill = this.districtColors[districtName];
              polygon.style.stroke = 'black';
              polygon.style.strokeWidth = '2';
              polygon.classList.add('region');
  
              svgModal.appendChild(clone);
              return;
            }
          }
          svgModal.appendChild(clone);
        } else {
          svgModal.innerHTML = '<text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#27ae60" font-size="16">SVG не найден</text>';
        }
      }
    }
    this.resetFilters();
    if (window.innerWidth <= 768) {
      document.getElementById("filtersSection").classList.add("hidden");
    }
  }

  async loadInstitutionsForDistrict(districtName) {
    const districtId = this.districtIdMap[districtName];
    if (!districtId) {
      console.error('District ID not found:', districtName);
      this.displayInstitutions([]);
      return;
    }
    try {
      const params = new URLSearchParams({ district_id: districtId });
      const response = await fetch(`/api/get_institutions.php?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      this.institutions = data.institutions;
      this.displayInstitutions(this.institutions);
    } catch (error) {
      console.error('Error loading institutions:', error);
      document.getElementById("institutionsList").innerHTML = '<p class="text-danger text-center">Ошибка загрузки учреждений</p>';
    }
  }

  displayInstitutions(institutions) {
    const container = document.getElementById("institutionsList");
    const count = document.getElementById("institutionCount");
    count.textContent = `(${institutions.length})`;
    if (institutions.length === 0) {
      container.innerHTML = '<p class="text-muted text-center">Учреждения не найдены</p>';
      return;
    }
    container.innerHTML = institutions.map((inst) => this.createInstitutionCard(inst)).join("");
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
    if (institution.range) {
      if (institution.type === "preschool") {
        rangeInfo = `${institution.range.min}-${institution.range.max} лет`;
      } else if (institution.type === "school" || institution.type === "school_internat") {
        rangeInfo = `${institution.range.min}-${institution.range.max} классы`;
      }
    }
    const uniqueConditions = [...new Set(institution.conditions)];
    const tags = [];
    const uniqueAdmission = institution.conditionsAdmission ? [...new Set(institution.conditionsAdmission)] : [];
    const admissionTags = uniqueAdmission.map((condition) => `<span class="tag admission-tag">${admissionNames[condition] || condition}</span>`).join("");
    uniqueConditions.forEach((condition) => {
      tags.push(`<span class="tag">${conditionNames[condition] || condition}</span>`);
    });

    const conditionsSection = tags.length > 0 
      ? `<div class="conditions-section">
          <h5>Особые условия:</h5>
          <div class="institution-tags">${tags.join("")}</div>
        </div>`
      : "";
  
    const aoopList =
      institution.aoop_programs && institution.aoop_programs.length > 0
        ? `<div class="aoop-section">
             <h5>Реализуемые АООП:</h5>
             <ul class="aoop-list-card">
               ${institution.aoop_programs
                 .map(
                   (prog) => `
                 <li>
                   <a href="${prog.url}" target="_blank">${prog.name}</a>
                 </li>
               `,
                 )
                 .join("")}
             </ul>
           </div>`
        : "";
    
    const admissionSection = uniqueAdmission.length > 0 
      ? `<div class="admission-section">
            <h5>Условия приема:</h5>
            <div class="admission-tags institution-tags">${admissionTags}</div>
          </div>`
      : "";
  
    const adminButtons = this.isAdminMode
      ? `
              <button class="btn btn-secondary" onclick="lipetskMap.editInstitution('${institution.id}')">
                  Редактировать
              </button>
              <button class="btn btn-danger" onclick="lipetskMap.deleteInstitution('${institution.id}')">
                  Удалить
              </button>
          `
      : "";
  
      return `
        <div class="institution-card">
            <h4>${institution.name}</h4>
            <span class="institution-type">${typeNames[institution.type]}</span>
            
            ${institution.description ? `<p class="institution-description">${institution.description}</p>` : ""}
            
            <div class="institution-details">
                ${rangeInfo ? `<div class="detail-item"><strong>${institution.type === "preschool" ? "Возраст:" : "Классы:"}</strong> ${rangeInfo}</div>` : ""}
                <div class="detail-item"><strong>Район:</strong> ${lipetskMap.districts[institution.district_id] || 'Неизвестный район'}</div>
            </div>
            
            ${conditionsSection}
            
            ${aoopList}
            
            ${admissionSection}
            
            ${
              institution.director
                ? `
                  <div class="institution-contacts">
                      <div class="contact-item"><strong>Руководитель:</strong> ${institution.director.name}</div>
                      ${institution.director.phone ? `<div class="contact-item"><strong>Телефон:</strong> ${institution.director.phone}</div>` : ""}
                      ${institution.director.email ? `<div class="contact-item"><strong>Email:</strong> ${institution.director.email}</div>` : ""}
                  </div>
              `
                : ""
            }
            
            ${
              institution.website
                ? `
                  <div class="contact-item">
                      <strong>Перейти на сайт:</strong> <a href="${institution.website}" target="_blank">${institution.website}</a>
                  </div>
              `
                : ""
            }
            
            <div class="institution-actions">
                ${adminButtons}
            </div>
        </div>
      `;
  }

  bindEvents() {
    document.getElementById("adminToggle").addEventListener("click", () => {
      this.toggleAdminMode();
    });
    document.getElementById("addInstitution").addEventListener("click", () => {
      this.openInstitutionForm();
    });
    document.getElementById("closeModal").addEventListener("click", () => {
      document.getElementById("districtModal").classList.add("hidden");
    });
    document.getElementById("closeInstitutionModal").addEventListener("click", () => {
      document.getElementById("institutionModal").classList.add("hidden");
    });
    document.getElementById("cancelInstitution").addEventListener("click", () => {
      document.getElementById("institutionModal").classList.add("hidden");
    });
    document.getElementById("applyFilters").addEventListener("click", async () => {
      await this.applyFilters();
    });
    document.getElementById("resetFilters").addEventListener("click", () => {
      this.resetFilters();
    });
    document.getElementById("institutionForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      await this.saveInstitution();
    });
    document.getElementById("institutionType").addEventListener("change", (e) => {
      this.toggleFormFields(e.target.value);
    });
    document.getElementById("addAoOp").addEventListener("click", () => {
      this.addAoOpField();
    });
    document.getElementById("districtModal").addEventListener("click", (e) => {
      if (e.target.id === "districtModal") {
        document.getElementById("districtModal").classList.add("hidden");
      }
    });
    document.getElementById("institutionModal").addEventListener("click", (e) => {
      if (e.target.id === "institutionModal") {
        document.getElementById("institutionModal").classList.add("hidden");
      }
    });
    document.getElementById("toggleFilters").addEventListener("click", () => {
      const filtersSection = document.getElementById("filtersSection");
      filtersSection.classList.toggle("hidden");
    });
  }

  addAoOpField(name = "", url = "") {
    const aoopList = document.getElementById("aoopList");
    const id = this.aoopCounter++;
    const field = document.createElement("div");
    field.classList.add("aoop-field");
    field.innerHTML = `
        <input type="text" placeholder="Название программы" value="${name}" class="aoop-name">
        <input type="url" placeholder="Ссылка на программу" value="${url}" class="aoop-url">
        <button type="button" class="btn btn-danger remove-aoop">Удалить</button>
      `;

    field.querySelector(".remove-aoop").addEventListener("click", () => {
      field.remove();
    });
    aoopList.appendChild(field);
  }

  toggleAdminMode() {
    this.isAdminMode = !this.isAdminMode;
    const toggle = document.getElementById("adminToggle");
    const panel = document.getElementById("adminPanel");
    if (this.isAdminMode) {
      toggle.textContent = "Обычный режим";
      toggle.classList.remove("btn-secondary");
      toggle.classList.add("btn-primary");
      panel.classList.remove("hidden");
    } else {
      toggle.textContent = "Режим администратора";
      toggle.classList.remove("btn-primary");
      toggle.classList.add("btn-secondary");
      panel.classList.add("hidden");
    }
    if (!document.getElementById("districtModal").classList.contains("hidden")) {
      const districtName = document.getElementById("modalTitle").textContent;
      this.loadInstitutionsForDistrict(districtName);
    }
  }

  openInstitutionForm(institution = null) {
    this.editingInstitution = institution;
    this.aoopCounter = 0;
    const modal = document.getElementById("institutionModal");
    const title = document.getElementById("institutionModalTitle");
    const form = document.getElementById("institutionForm");
    const aoopList = document.getElementById("aoopList");
    aoopList.innerHTML = "";
    title.textContent = institution ? "Редактировать учреждение" : "Добавить учреждение";
    this.populateDistrictSelect();
    if (institution) {
      this.populateForm(institution);
    } else {
      form.reset();
      document.getElementById("districtId").value = this.currentDistrictName || "";
      this.toggleFormFields("");
    }
    modal.classList.remove("hidden");
  }

  populateForm(institution) {
    document.getElementById("institutionName").value = institution.name;
    document.getElementById("districtId").value = institution.district_id ? this.districts[institution.district_id] : "";
    document.getElementById("institutionDescription").value = institution.description || "";
    document.getElementById("institutionType").value = institution.type;
    if (institution.range) {
      document.getElementById("rangeMin").value = institution.range.min;
      document.getElementById("rangeMax").value = institution.range.max;
    }
    document.querySelectorAll('.form-group input[type="checkbox"][value]').forEach((cb) => {
      cb.checked = false;
    });
    institution.conditions.forEach((condition) => {
      const checkbox = document.querySelector(`.form-group input[value="${condition}"]`);
      if (checkbox) checkbox.checked = true;
    });
    document.querySelectorAll('input[name="admission"]').forEach((cb) => {
      cb.checked = false;
    });
    if (institution.conditionsAdmission) {
      institution.conditionsAdmission.forEach((condition) => {
        const checkbox = document.querySelector(`input[name="admission"][value="${condition}"]`);
        if (checkbox) checkbox.checked = true;
      });
    }
    if (institution.aoop_programs) {
      institution.aoop_programs.forEach((prog) => {
        this.addAoOpField(prog.name, prog.url);
      });
    }
    if (institution.director) {
      document.getElementById("directorName").value = institution.director.name || "";
      document.getElementById("directorPhone").value = institution.director.phone || "";
      document.getElementById("directorEmail").value = institution.director.email || "";
    }
    document.getElementById("institutionWebsite").value = institution.website || "";
    this.toggleFormFields(institution.type);
  }

  toggleFormFields(type) {
    const group = document.getElementById("rangeGroup");
    if (type === "preschool") {
      group.classList.remove("hidden");
      group.querySelector("label").textContent = "Возрастной диапазон";
      document.getElementById("rangeMin").placeholder = "От (лет)";
      document.getElementById("rangeMax").placeholder = "До (лет)";
    } else if (type === "school" || type === "school_internat") {
      group.classList.remove("hidden");
      group.querySelector("label").textContent = "Диапазон классов";
      document.getElementById("rangeMin").placeholder = "От (класс)";
      document.getElementById("rangeMax").placeholder = "До (класс)";
    } else {
      group.classList.add("hidden");
    }
  }

  collectFormData() {
    const formData = {
      id: this.editingInstitution ? this.editingInstitution.id : null,
      name: document.getElementById("institutionName").value,
      district_id: this.districtIdMap[document.getElementById("districtId").value],
      description: document.getElementById("institutionDescription").value,
      type: document.getElementById("institutionType").value,
      conditions: [],
      conditionsAdmission: [],
      aoop_programs: [],
      director: {
        name: document.getElementById("directorName").value,
        phone: document.getElementById("directorPhone").value,
        email: document.getElementById("directorEmail").value,
        id: this.editingInstitution?.director?.id || null
      },
      website: document.getElementById("institutionWebsite").value,
    };

    const rangeMin = document.getElementById("rangeMin").value;
    const rangeMax = document.getElementById("rangeMax").value;
    if (rangeMin && rangeMax) {
      formData.range = { min: parseInt(rangeMin), max: parseInt(rangeMax) };
    }

    [
      'hearing_impairment', 'vision_impairment', 'musculoskeletal_impairment',
      'speech_impairment', 'mental_retardation', 'autism', 'multiple_disorders'
    ].forEach(condition => {
      const cb = document.querySelector(`input[value="${condition}"]:checked`);
      if (cb) formData.conditions.push(condition);
    });

    document.querySelectorAll('input[name="admission"]:checked').forEach((cb) => {
      formData.conditionsAdmission.push(cb.value);
    });

    document.querySelectorAll(".aoop-field").forEach((field) => {
      const name = field.querySelector(".aoop-name").value.trim();
      const url = field.querySelector(".aoop-url").value.trim();
      if (name && url) {
        formData.aoop_programs.push({ name, url });
      }
    });

    if (!formData.name || !formData.type) {
      throw new Error("Заполните обязательные поля: Название, Тип и Район");
    }

    return formData;
  }

  async saveInstitution() {
    try {
      const data = this.collectFormData();
      const url = this.editingInstitution ? '/api/update_institution.php' : '/api/create_institution.php';
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      document.getElementById("institutionModal").classList.add("hidden");
      if (!document.getElementById("districtModal").classList.contains("hidden")) {
        const districtName = document.getElementById("modalTitle").textContent;
        await this.loadInstitutionsForDistrict(districtName);
      }
    } catch (error) {
      console.error('Error saving institution:', error);
      alert(`Ошибка: ${error.message}`);
    }
  }

  async editInstitution(id) {
    try {
      const districtId = this.institutions.find(inst => inst.id === id)?.district_id || 1;
      const params = new URLSearchParams({ district_id: districtId, id });
      const response = await fetch(`/api/get_institution.php?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      console.log(data);
      if (data.error || !data.institution || data.institution.length === 0) {
        throw new Error('Учреждение не найдено');
      }
      this.openInstitutionForm(data.institution);
    } catch (error) {
      console.error('Error loading for edit:', error);
      alert('Ошибка загрузки для редактирования: ' + error.message);
    }
  }

  async deleteInstitution(id) {
    if (!confirm("Вы уверены, что хотите удалить это учреждение?")) return;
    try {
      const response = await fetch('/api/delete_institution.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      if (!document.getElementById("districtModal").classList.contains("hidden")) {
        const districtName = document.getElementById("modalTitle").textContent;
        await this.loadInstitutionsForDistrict(districtName);
      }
    } catch (error) {
      console.error('Error deleting institution:', error);
      alert('Ошибка удаления');
    }
  }

  async applyFilters() {
    const districtName = document.getElementById("modalTitle").textContent;
    const districtId = this.districtIdMap[districtName];
    if (!districtId) return;
  
    const params = new URLSearchParams({ district_id: districtId });
  
    document.querySelectorAll('.filter-group input[type="checkbox"]:checked').forEach((cb) => {
      if (["preschool", "school", "school_internat", "spo", "vo"].includes(cb.value)) {
        params.append('type[]', cb.value);
      }
    });
  
    const ageCheckboxes = document.querySelectorAll('.filter-group input[value^="3-"], .filter-group input[value^="5-"], .filter-group input[value^="7+"]');
    ageCheckboxes.forEach((cb) => {
      if (cb.checked) {
        params.append('age[]', cb.value);
      }
    });
  
    const conditionCheckboxes = document.querySelectorAll('.filter-group input[value="hearing_impairment"], .filter-group input[value="vision_impairment"], .filter-group input[value="musculoskeletal_impairment"], .filter-group input[value="speech_impairment"], .filter-group input[value="mental_retardation"], .filter-group input[value="autism"], .filter-group input[value="multiple_disorders"]');
    conditionCheckboxes.forEach((cb) => {
      if (cb.checked) {
        params.append('condition[]', cb.value);
      }
    });
  
    if (document.querySelector('.filter-group input[value="aoop"]:checked')) {
      params.append('aoop', '1');
    }
  
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
      console.error('Error applying filters:', error);
      alert('Ошибка применения фильтров: ' + error.message);
    }
  }

  resetFilters() {
    document.querySelectorAll('.filter-group input[type="checkbox"]').forEach((cb) => {
      cb.checked = false;
    });
    document.querySelectorAll(".template-btn").forEach((btn) => {
      btn.classList.remove("active");
    });
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
