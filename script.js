class LipetskMap {
  constructor() {
    this.isAdminMode = false
    this.currentDistrictName = null
    this.editingInstitution = null
    this.institutions = this.loadInstitutions()
    this.districts = {}
    this.districtColors = {}
    this.aoopCounter = 0

    this.init()
  }

  init() {
    this.loadMap()
    this.bindEvents()
    this.generateSampleData()
  }

  async loadMap() {
    try {
      const response = await fetch("map.svg")
      const svgText = await response.text()
      const mapWrapper = document.getElementById("mapWrapper")
      mapWrapper.innerHTML = svgText
      this.setupMapInteractivity()
      this.populateLegend()
    } catch (error) {
      console.error("Error loading map:", error)
      document.getElementById("mapWrapper").innerHTML = '<p class="text-center text-muted">Ошибка загрузки карты</p>'
    }
  }

  setupMapInteractivity() {
    const svg = document.querySelector("#mapWrapper svg")
    if (!svg) return

    const groups = svg.querySelectorAll("g[id][data-region-name]")
    const originalOrder = Array.from(groups)

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
      "#FF69B4"
    ]

    groups.forEach((group, index) => {
      const regionId = group.id
      const regionName = group.getAttribute("data-region-name") || this.getDistrictName(regionId)
      const color = colors[index % colors.length]
      this.districtColors[regionName] = color
      const polygons = group.querySelectorAll("polygon, path, circle, rect")
      polygons.forEach((polygon) => {
        if (!polygon.id) {
          polygon.id = `${regionId}-shape-${index}`
        }
        polygon.classList.add("district")
        polygon.style.fill = color
        polygon.setAttribute("tabindex", "0")
        polygon.setAttribute("role", "button")
        this.districts[polygon.id] = {
          name: regionName,
          element: polygon,
          group: group,
        }
        polygon.addEventListener("click", (e) => {
          e.stopPropagation()
          this.handleDistrictClick(e, polygon.id)
        })
        polygon.addEventListener("mouseenter", (e) => {
          e.stopPropagation()
          this.showTooltip(e, regionName)
          svg.appendChild(group)
          if (group.id === "region_eletskiy") {
            const eletsGroup = svg.querySelector("#elets")
            if (eletsGroup) {
              svg.appendChild(eletsGroup)
            }
          }
        })
        polygon.addEventListener("mouseleave", () => {
          this.hideTooltip()
          originalOrder.forEach((originalGroup) => svg.appendChild(originalGroup))
        })
        polygon.addEventListener("mousemove", (e) => {
          this.updateTooltipPosition(e)
        })
        polygon.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            e.stopPropagation()
            this.handleDistrictClick(e, polygon.id)
          }
        })
      })
    })
    const eletsGroup = svg.querySelector("#elets")
    if (eletsGroup) {
      svg.appendChild(eletsGroup)
    }
  }

  populateLegend() {
    const legendList = document.getElementById("legendList")
    if (!legendList) return

    const sortedDistricts = Object.keys(this.districtColors).sort()
    legendList.innerHTML = sortedDistricts
      .map((name) => {
        const color = this.districtColors[name]
        return `
          <li class="legend-item" data-district-name="${name}">
            <div class="color-swatch" style="background-color: ${color};"></div>
            <span>${name}</span>
          </li>
        `
      })
      .join("")
    document.querySelectorAll(".legend-item").forEach((item) => {
      item.addEventListener("click", () => {
        const name = item.dataset.districtName
        this.currentDistrictName = name
        this.openDistrictModal(name)
      })
    })
  }

  getDistrictName(districtId) {
    const districtNames = {
      "district-0": "Липецкий район",
      "district-1": "Елецкий район",
      "district-2": "Грязинский район",
      "district-3": "Усманский район",
      "district-4": "Чаплыгинский район",
      "district-5": "Лебедянский район",
      "district-6": "Данковский район",
      "district-7": "Добровский район",
      "district-8": "Долгоруковский район",
      "district-9": "Задонский район",
      "district-10": "Измалковский район",
      "district-11": "Краснинский район",
      "district-12": "Лев-Толстовский район",
      "district-13": "Становлянский район",
      "district-14": "Тербунский район",
      "district-15": "Хлевенский район",
      "district-16": "Воловский район",
      "district-17": "Липецк (город)",
    }
    return districtNames[districtId] || `Район ${districtId}`
  }

  showTooltip(event, districtName) {
    const tooltip = document.getElementById("tooltip")
    const institutionCount = this.getInstitutionCountForDistrict(districtName)
    tooltip.innerHTML = `
              <strong>${districtName}</strong><br>
              Учреждений: ${institutionCount}
          `
    tooltip.classList.remove("hidden")
    this.updateTooltipPosition(event)
  }

  updateTooltipPosition(event) {
    const tooltip = document.getElementById("tooltip")
    const rect = document.getElementById("mapWrapper").getBoundingClientRect()
    tooltip.style.left = event.clientX - rect.left + 10 + "px"
    tooltip.style.top = event.clientY - rect.top - 10 + "px"
  }

  hideTooltip() {
    document.getElementById("tooltip").classList.add("hidden")
  }

  handleDistrictClick(event, districtId) {
    const districtName = this.districts[districtId].name
    this.currentDistrictName = districtName
    this.openDistrictModal(districtName)
  }

  openDistrictModal(districtName) {
    document.getElementById("modalTitle").textContent = districtName
    document.getElementById("regionName").textContent = districtName
    document.getElementById("districtModal").classList.remove("hidden")
    this.loadInstitutionsForDistrict(districtName)
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
    this.resetFilters()
    if (window.innerWidth <= 768) {
      document.getElementById("filtersSection").classList.add("hidden");
    }
  }

  loadInstitutionsForDistrict(districtName) {
    const districtInstitutions = this.institutions.filter((inst) => inst.district_id === districtName)
    this.displayInstitutions(districtInstitutions)
  }

  displayInstitutions(institutions) {
    const container = document.getElementById("institutionsList")
    const count = document.getElementById("institutionCount")
    count.textContent = `(${institutions.length})`
    if (institutions.length === 0) {
      container.innerHTML = '<p class="text-muted text-center">Учреждения не найдены</p>'
      return
    }
    container.innerHTML = institutions.map((inst) => this.createInstitutionCard(inst)).join("")
  }

  createInstitutionCard(institution) {
    const typeNames = {
      preschool: "Дошкольное",
      school: "Школа",
      school_internat: "Школа-интернат",
      spo: "СПО",
      vo: "ВО",
    }
    const conditionNames = {
      hearing_impairment: "Нарушения слуха",
      vision_impairment: "Нарушения зрения",
      musculoskeletal_impairment: "Нарушения опорно-двигательного аппарата",
      speech_impairment: "Нарушения речи",
      mental_retardation: "Задержка психического развития",
      autism: "Расстройство аутистического спектра",
      multiple_disorders: "Множественные нарушения развития",
    }
    const admissionNames = {
      certificate: "Свидетельство",
      attestat: "Аттестат",
    }
    let rangeInfo = ""
    if (institution.range) {
      if (institution.type === "preschool") {
        rangeInfo = `${institution.range.min}-${institution.range.max} лет`
      } else if (institution.type === "school" || institution.type === "school_internat") {
        rangeInfo = `${institution.range.min}-${institution.range.max} классы`
      }
    }
    const uniqueConditions = [...new Set(institution.conditions)]
    const tags = []
    const uniqueAdmission = institution.conditionsAdmission ? [...new Set(institution.conditionsAdmission)] : []
    const admissionTags = uniqueAdmission.map((condition) => `<span class="tag admission-tag">${admissionNames[condition] || condition}</span>`).join("")
    uniqueConditions.forEach((condition) => {
      tags.push(`<span class="tag">${conditionNames[condition] || condition}</span>`)
    })

    const conditionsSection = tags.length > 0 
      ? `<div class="conditions-section">
          <h5>Особые условия:</h5>
          <div class="institution-tags">${tags.join("")}</div>
        </div>`
      : ""
  
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
        : ""
    
    const admissionSection = uniqueAdmission.length > 0 
      ? `<div class="admission-section">
            <h5>Условия приема:</h5>
            <div class="admission-tags institution-tags">${admissionTags}</div>
          </div>`
      : ""
  
    const adminButtons = this.isAdminMode
      ? `
              <button class="btn btn-secondary" onclick="lipetskMap.editInstitution('${institution.id}')">
                  Редактировать
              </button>
              <button class="btn btn-danger" onclick="lipetskMap.deleteInstitution('${institution.id}')">
                  Удалить
              </button>
          `
      : ""
  
      return `
        <div class="institution-card">
            <h4>${institution.name}</h4>
            <span class="institution-type">${typeNames[institution.type]}</span>
            
            ${institution.description ? `<p class="institution-description">${institution.description}</p>` : ""}
            
            <div class="institution-details">
                ${rangeInfo ? `<div class="detail-item"><strong>${institution.type === "preschool" ? "Возраст:" : "Классы:"}</strong> ${rangeInfo}</div>` : ""}
                <div class="detail-item"><strong>Район:</strong> ${institution.district_id}</div>
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
      `
  }

  bindEvents() {
    document.getElementById("adminToggle").addEventListener("click", () => {
      this.toggleAdminMode()
    })
    document.getElementById("addInstitution").addEventListener("click", () => {
      this.openInstitutionForm()
    })
    document.getElementById("closeModal").addEventListener("click", () => {
      document.getElementById("districtModal").classList.add("hidden")
    })
    document.getElementById("closeInstitutionModal").addEventListener("click", () => {
      document.getElementById("institutionModal").classList.add("hidden")
    })
    document.getElementById("cancelInstitution").addEventListener("click", () => {
      document.getElementById("institutionModal").classList.add("hidden")
    })
    document.getElementById("applyFilters").addEventListener("click", () => {
      this.applyFilters()
    })

    document.getElementById("resetFilters").addEventListener("click", () => {
      this.resetFilters()
    })
    document.getElementById("institutionForm").addEventListener("submit", (e) => {
      e.preventDefault()
      this.saveInstitution()
    })
    document.getElementById("institutionType").addEventListener("change", (e) => {
      this.toggleFormFields(e.target.value)
    })
    document.getElementById("addAoOp").addEventListener("click", () => {
      this.addAoOpField()
    })
    document.getElementById("districtModal").addEventListener("click", (e) => {
      if (e.target.id === "districtModal") {
        document.getElementById("districtModal").classList.add("hidden")
      }
    })
    document.getElementById("institutionModal").addEventListener("click", (e) => {
      if (e.target.id === "institutionModal") {
        document.getElementById("institutionModal").classList.add("hidden")
      }
    })
    document.getElementById("toggleFilters").addEventListener("click", () => {
      const filtersSection = document.getElementById("filtersSection");
      filtersSection.classList.toggle("hidden");
    });
  }

  addAoOpField(name = "", url = "") {
    const aoopList = document.getElementById("aoopList")
    const id = this.aoopCounter++
    const field = document.createElement("div")
    field.classList.add("aoop-field")
    field.innerHTML = `
        <input type="text" placeholder="Название программы" value="${name}" class="aoop-name">
        <input type="url" placeholder="Ссылка на программу" value="${url}" class="aoop-url">
        <button type="button" class="btn btn-danger remove-aoop">Удалить</button>
      `

    field.querySelector(".remove-aoop").addEventListener("click", () => {
      field.remove()
    })
    aoopList.appendChild(field)
  }

  populateDistrictSelect() {
    const districtSelect = document.getElementById("districtId")
    const sortedDistricts = Object.keys(this.districtColors).sort()
    districtSelect.innerHTML = `
        <option value="">Выберите район</option>
        ${sortedDistricts.map((name) => `<option value="${name}">${name}</option>`).join("")}
      `
  }

  toggleAdminMode() {
    this.isAdminMode = !this.isAdminMode
    const toggle = document.getElementById("adminToggle")
    const panel = document.getElementById("adminPanel")
    if (this.isAdminMode) {
      toggle.textContent = "Обычный режим"
      toggle.classList.remove("btn-secondary")
      toggle.classList.add("btn-primary")
      panel.classList.remove("hidden")
    } else {
      toggle.textContent = "Режим администратора"
      toggle.classList.remove("btn-primary")
      toggle.classList.add("btn-secondary")
      panel.classList.add("hidden")
    }
    if (!document.getElementById("districtModal").classList.contains("hidden")) {
      const districtName = document.getElementById("modalTitle").textContent
      this.loadInstitutionsForDistrict(districtName)
    }
  }

  openInstitutionForm(institution = null) {
    this.editingInstitution = institution
    this.aoopCounter = 0
    const modal = document.getElementById("institutionModal")
    const title = document.getElementById("institutionModalTitle")
    const form = document.getElementById("institutionForm")
    const aoopList = document.getElementById("aoopList")
    aoopList.innerHTML = ""
    title.textContent = institution ? "Редактировать учреждение" : "Добавить учреждение"
    this.populateDistrictSelect()
    if (institution) {
      this.populateForm(institution)
    } else {
      form.reset()
      document.getElementById("districtId").value = this.currentDistrictName || ""
      this.toggleFormFields("")
    }
    modal.classList.remove("hidden")
  }

  populateForm(institution) {
    document.getElementById("institutionName").value = institution.name
    document.getElementById("districtId").value = institution.district_id
    document.getElementById("institutionDescription").value = institution.description || ""
    document.getElementById("institutionType").value = institution.type
    if (institution.range) {
      document.getElementById("rangeMin").value = institution.range.min
      document.getElementById("rangeMax").value = institution.range.max
    }
    document.querySelectorAll('.form-group input[type="checkbox"][value]').forEach((cb) => {
      cb.checked = false
    })
    institution.conditions.forEach((condition) => {
      const checkbox = document.querySelector(`.form-group input[value="${condition}"]`)
      if (checkbox) checkbox.checked = true
    })
    document.querySelectorAll('input[name="admission"]').forEach((cb) => {
      cb.checked = false
    })
    if (institution.conditionsAdmission) {
      institution.conditionsAdmission.forEach((condition) => {
        const checkbox = document.querySelector(`input[name="admission"][value="${condition}"]`)
        if (checkbox) checkbox.checked = true
      })
    }
    if (institution.aoop_programs) {
      institution.aoop_programs.forEach((prog) => {
        this.addAoOpField(prog.name, prog.url)
      })
    }
    if (institution.director) {
      document.getElementById("directorName").value = institution.director.name || ""
      document.getElementById("directorPhone").value = institution.director.phone || ""
      document.getElementById("directorEmail").value = institution.director.email || ""
    }
    document.getElementById("institutionWebsite").value = institution.website || ""
    this.toggleFormFields(institution.type)
  }

  toggleFormFields(type) {
    const group = document.getElementById("rangeGroup")
    if (type === "preschool") {
      group.classList.remove("hidden")
      group.querySelector("label").textContent = "Возрастной диапазон"
      document.getElementById("rangeMin").placeholder = "От (лет)"
      document.getElementById("rangeMax").placeholder = "До (лет)"
    } else if (type === "school" || type === "school_internat") {
      group.classList.remove("hidden")
      group.querySelector("label").textContent = "Диапазон классов"
      document.getElementById("rangeMin").placeholder = "От (класс)"
      document.getElementById("rangeMax").placeholder = "До (класс)"
    } else {
      group.classList.add("hidden")
    }
  }

  saveInstitution() {
    const form = document.getElementById("institutionForm")
    const institution = {
      id: this.editingInstitution ? this.editingInstitution.id : this.generateId(),
      name: document.getElementById("institutionName").value,
      district_id: document.getElementById("districtId").value,
      description: document.getElementById("institutionDescription").value,
      type: document.getElementById("institutionType").value,
      conditions: [],
      aoop_programs: [],
      director: {
        name: document.getElementById("directorName").value,
        phone: document.getElementById("directorPhone").value,
        email: document.getElementById("directorEmail").value,
      },
      website: document.getElementById("institutionWebsite").value,
    }
    const rangeMin = document.getElementById("rangeMin").value
    const rangeMax = document.getElementById("rangeMax").value
    if (rangeMin && rangeMax) {
      institution.range = { 
        min: Number.parseInt(rangeMin), 
        max: Number.parseInt(rangeMax) 
      }
    }
    const conditions = new Set()
    document
      .querySelectorAll(
        'input[value="hearing_impairment"]:checked, ' +
          'input[value="vision_impairment"]:checked, ' +
          'input[value="musculoskeletal_impairment"]:checked, ' +
          'input[value="speech_impairment"]:checked, ' +
          'input[value="mental_retardation"]:checked, ' +
          'input[value="autism"]:checked, ' +
          'input[value="multiple_disorders"]:checked' ,
      )
      .forEach((cb) => {
        conditions.add(cb.value)
      })
    institution.conditions = [...conditions]
    const admissionConditions = new Set()
    document.querySelectorAll('input[name="admission"]:checked').forEach((cb) => {
      admissionConditions.add(cb.value)
    })
    institution.conditionsAdmission = [...admissionConditions]
    document.querySelectorAll(".aoop-field").forEach((field) => {
      const name = field.querySelector(".aoop-name").value.trim()
      const url = field.querySelector(".aoop-url").value.trim()
      if (name && url) {
        institution.aoop_programs.push({ name, url })
      }
    })
    if (!institution.name || !institution.type || !institution.district_id) {
      alert("Пожалуйста, заполните обязательные поля: Название, Тип учреждения и Район")
      return
    }
    if (this.editingInstitution) {
      const index = this.institutions.findIndex((inst) => inst.id === this.editingInstitution.id)
      this.institutions[index] = institution
    } else {
      this.institutions.push(institution)
    }
    this.saveInstitutions()
    document.getElementById("institutionModal").classList.add("hidden")
    if (!document.getElementById("districtModal").classList.contains("hidden")) {
      const districtName = document.getElementById("modalTitle").textContent
      this.loadInstitutionsForDistrict(districtName)
    }
  }

  editInstitution(id) {
    const institution = this.institutions.find((inst) => inst.id === id)
    if (institution) {
      this.openInstitutionForm(institution)
    }
  }

  deleteInstitution(id) {
    if (confirm("Вы уверены, что хотите удалить это учреждение?")) {
      this.institutions = this.institutions.filter((inst) => inst.id !== id)
      this.saveInstitutions()
      if (!document.getElementById("districtModal").classList.contains("hidden")) {
        const districtName = document.getElementById("modalTitle").textContent
        this.loadInstitutionsForDistrict(districtName)
      }
    }
  }

  applyFilters() {
    const districtName = document.getElementById("modalTitle").textContent
    let institutions = this.institutions.filter((inst) => inst.district_id === districtName)
    const typeFilters = []

    document.querySelectorAll('.filter-group input[type="checkbox"]:checked').forEach((cb) => {
      if (["preschool", "school", "school_internat", "spo", "vo"].includes(cb.value)) {
        typeFilters.push(cb.value)
      }
    })
    if (typeFilters.length > 0) {
      institutions = institutions.filter((inst) => typeFilters.includes(inst.type))
    }

    const ageFilters = []
    document
      .querySelectorAll(
        '.filter-group input[value^="3-"], .filter-group input[value^="5-"], .filter-group input[value^="7+"]:checked',
      )
      .forEach((cb) => {
        ageFilters.push(cb.value)
      })

    const conditionFilters = []
    document
      .querySelectorAll(
        '.filter-group input[value="hearing_impairment"]:checked, ' +
          '.filter-group input[value="vision_impairment"]:checked, ' +
          '.filter-group input[value="musculoskeletal_impairment"]:checked, ' +
          '.filter-group input[value="speech_impairment"]:checked, ' +
          '.filter-group input[value="mental_retardation"]:checked, ' +
          '.filter-group input[value="autism"]:checked, ' +
          '.filter-group input[value="multiple_disorders"]:checked'
      )
      .forEach((cb) => {
        conditionFilters.push(cb.value)
      })

    if (conditionFilters.length > 0) {
      institutions = institutions.filter((inst) => {
        return conditionFilters.some((filter) => {
          return inst.conditions.includes(filter)
        })
      })
    }
    const aoopFilter = document.querySelector('.filter-group input[value="aoop"]:checked')
    if (aoopFilter) {
      institutions = institutions.filter((inst) => inst.aoop_programs && inst.aoop_programs.length > 0)
    }
    this.displayInstitutions(institutions)
    if (window.innerWidth <= 768) {
      document.getElementById("filtersSection").classList.add("hidden");
    }
  }

  resetFilters() {
    document.querySelectorAll('.filter-group input[type="checkbox"]').forEach((cb) => {
      cb.checked = false
    })
    document.querySelectorAll(".template-btn").forEach((btn) => {
      btn.classList.remove("active")
    })
    const districtName = document.getElementById("modalTitle").textContent
    this.loadInstitutionsForDistrict(districtName)
    if (window.innerWidth <= 768) {
      document.getElementById("filtersSection").classList.add("hidden");
    }
  }


  getInstitutionCountForDistrict(districtName) {
    return this.institutions.filter((inst) => inst.district_id === districtName).length
  }

  generateId() {
    return "inst_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
  }

  loadInstitutions() {
    const stored = localStorage.getItem("lipetsk_institutions")
    const parsed = stored ? JSON.parse(stored) : []
    return parsed
  }

  saveInstitutions() {
    localStorage.setItem("lipetsk_institutions", JSON.stringify(this.institutions))
  }

  generateSampleData() {
    if (this.institutions.length === 0) {
      const sampleInstitutions = [
        {
          id: "sample_1",
          name: 'МБДОУ детский сад №1 "Солнышко"',
          description: "Детский сад общеразвивающего вида с приоритетным осуществлением деятельности по познавательно-речевому развитию детей",
          type: "preschool",
          district_id: "Липецкий район",
          range: { min: 3, max: 6 },
          conditions: ["hearing_impairment"],
          aoop_programs: [
            { name: "АООП для детей с нарушениями слуха", url: "https://example.com/aoop1" },
            { name: "АООП для дошкольников с ЗПР", url: "https://example.com/aoop2" },
          ],
          conditionsAdmission: ["certificate"],
          director: {
            name: "Иванова Мария Петровна",
            phone: "+7 (4742) 12-34-56",
            email: "solnyshko@lipetsk.ru",
          },
          website: "https://solnyshko-lipetsk.ru",
        },
        {
          id: "sample_2",
          name: "МБОУ СОШ №5",
          description: "Средняя общеобразовательная школа с углубленным изучением математики и информатики",
          type: "school",
          district_id: "Липецкий район",
          range: { min: 1, max: 11 },
          conditions: ["vision_impairment"],
          aoop_programs: [
            { name: "АООП для школьников с нарушениями зрения", url: "https://example.com/aoop3" },
          ],
          conditionsAdmission: ["attestat"],
          director: {
            name: "Петров Алексей Иванович",
            phone: "+7 (4742) 23-45-67",
            email: "school5@lipetsk.edu.ru",
          },
          website: "https://school5-lipetsk.ru",
        },
        {
          id: "sample_3",
          name: "Елецкий государственный колледж",
          description: "Среднее профессиональное образование по направлениям: экономика, информатика, строительство",
          type: "spo",
          district_id: "Елецкий район",
          conditions: [],
          aoop_programs: [],
          conditionsAdmission: [],
          director: {
            name: "Сидорова Елена Владимировна",
            phone: "+7 (47467) 34-56-78",
            email: "college@elets.ru",
          },
          website: "https://elets-college.ru",
        },
      ]
  
      this.institutions = sampleInstitutions
      this.saveInstitutions()
    }
  }
}

let lipetskMap
document.addEventListener("DOMContentLoaded", () => {
  lipetskMap = new LipetskMap()
})
