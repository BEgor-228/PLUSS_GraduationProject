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
      "#e57878",
      "#d88953",
      "#f7dc71",
      "#cfe672",
      "#8ee157",
      "#81ec81",
      "#60e094",
      "#84f2dc",
      "#7cc6d8",
      "#66a2fd",
      "#7171f8",
      "#b98cfb",
      "#b956d2",
      "#ea7cd4",
      "#f14d8f",
      "#FF6347",
      "#D2B48C",
      "#87CEEB",
      "#9932CC",
      "#FF69B4",
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
      this.displayInstitutions(data.institutions);
    } catch (error) {
      console.error("Error loading institutions:", error);
      document.getElementById("institutionsList").innerHTML =
        "<p>Ошибка загрузки учреждений</p>";
    }
  }

  displayInstitutions(institutions) {
    this.institutions = institutions;
    const list = document.getElementById("institutionsList");
    document.getElementById(
      "institutionCount"
    ).textContent = `(${institutions.length})`;

    if (institutions.length === 0) {
      list.innerHTML = '<p class="text-muted">Учреждения не найдены</p>';
      return;
    }

    list.innerHTML = institutions
      .map((inst) => this.createInstitutionCard(inst))
      .join("");

    if (this.isAdmin) {
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
                  `<span class="tag condition">${
                    conditionNames[condition] || condition
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
                  `<span class="tag admission">${
                    admissionNames[admission] || admission
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
        <span class="institution-type">${
          typeNames[institution.type] || institution.type
        }</span>
        
        ${
          institution.description
            ? `<p class="institution-description">${institution.description}</p>`
            : ""
        }
        
        <div class="institution-details">
          ${
            rangeInfo
              ? `<div class="detail-item"><strong>${
                  institution.type === "preschool" ? "Возраст:" : "Классы:"
                }</strong> ${rangeInfo}</div>`
              : ""
          }
          <div class="detail-item"><strong>Район:</strong> ${
            this.districts[institution.district_id] || "Неизвестный район"
          }</div>
        </div>
        
        ${conditionsSection}
        ${admissionSection}
        ${aoopSection}
        
        ${
          institution.director && institution.director.name
            ? `
          <div class="institution-contacts">
            <div class="contact-item"><strong>Руководитель:</strong> ${
              institution.director.name
            }</div>
            ${
              institution.director.phone
                ? `<div class="contact-item"><strong>Телефон:</strong> ${institution.director.phone}</div>`
                : ""
            }
            ${
              institution.director.email
                ? `<div class="contact-item"><strong>Email:</strong> ${institution.director.email}</div>`
                : ""
            }
          </div>
        `
            : ""
        }
        
        ${
          institution.website
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

    // document.getElementById("addAoOp").addEventListener("click", () => {
    //   this.addAoOpField();
    // });

    // Apply and reset filters - will be handled by admin or basic
    document.getElementById("applyFilters").addEventListener("click", () => {
      this.applyFilters();
    });

    document.getElementById("resetFilters").addEventListener("click", () => {
      this.resetFilters();
    });
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
    // Basic filter implementation - can be overridden by admin
    const districtName = document.getElementById("modalTitle").textContent;
    this.loadInstitutionsForDistrict(districtName);
  }

  resetFilters() {
    document
      .querySelectorAll('.filter-group input[type="checkbox"]')
      .forEach((cb) => {
        cb.checked = false;
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
