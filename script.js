class LipetskMap {
    constructor() {
      this.isAdminMode = false
      this.currentDistrict = null
      this.editingInstitution = null
      this.institutions = this.loadInstitutions()
      this.districts = {}
  
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
      } catch (error) {
        console.error("Error loading map:", error)
        document.getElementById("mapWrapper").innerHTML = '<p class="text-center text-muted">Ошибка загрузки карты</p>'
      }
    }
  
    setupMapInteractivity() {
      const svg = document.querySelector("#mapWrapper svg");
      if (!svg) return;
    
      const groups = svg.querySelectorAll("g[id][data-region-name]");
      const originalOrder = Array.from(groups); // Сохраняем исходный порядок групп
    
      const colors = [
        "#a3c9e2", // Голубой
        "#d1a3e2", // Фиолетовый
        "#a3e2a3", // Зелёный
        "#e2c9a3", // Персиковый
        "#e2a3a3", // Розовый
        "#a3e2c9", // Мятный
        "#c9a3e2", // Лавандовый
        "#a3a3e2", // Синий
        "#e2e2a3", // Жёлтый
        "#c9e2a3", // Лаймовый
        "#e2a3c9", // Сиреневый
        "#a3c9e2", // Бирюзовый
        "#e2a3a3", // Коралловый
        "#a3e2b5", // Салатовый
        "#c9e2b5", // Оливковый 
      ];
    
      groups.forEach((group, index) => {
        const regionId = group.id;
        const regionName = group.getAttribute("data-region-name") || this.getDistrictName(regionId);
    
        const polygons = group.querySelectorAll("polygon, path, circle, rect");
        polygons.forEach((polygon) => {
          if (!polygon.id) {
            polygon.id = `${regionId}-shape-${index}`;
          }
    
          polygon.classList.add("district");
          polygon.style.fill = colors[index % colors.length];
          polygon.setAttribute("tabindex", "0");
          polygon.setAttribute("role", "button");
    
          this.districts[polygon.id] = {
            name: regionName,
            element: polygon,
            group: group,
          };
    
          polygon.addEventListener("click", (e) => {
            e.stopPropagation();
            this.handleDistrictClick(e, polygon.id);
          });
          polygon.addEventListener("mouseenter", (e) => {
            e.stopPropagation();
            this.showTooltip(e, regionName);
            svg.appendChild(group);
            if (group.id === "region_eletskiy") {
              const eletsGroup = svg.querySelector("#elets");
              if (eletsGroup) {
                svg.appendChild(eletsGroup);
              }
            }
          });
          polygon.addEventListener("mouseleave", () => {
            this.hideTooltip();
            originalOrder.forEach((originalGroup) => svg.appendChild(originalGroup));
          });
          polygon.addEventListener("mousemove", (e) => {
            this.updateTooltipPosition(e);
          });
          polygon.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              this.handleDistrictClick(e, polygon.id);
            }
          });
        });
      });
    
      // Дополнительно поднимаем город поверх всех при инициализации
      const eletsGroup = svg.querySelector("#elets");
      if (eletsGroup) {
        svg.appendChild(eletsGroup);
      }
    }
  
    getDistrictName(districtId) {
      // Map district IDs to names (you can expand this based on actual SVG IDs)
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
      this.currentDistrict = districtId
      this.openDistrictModal(districtName)
    }
  
    openDistrictModal(districtName) {
      document.getElementById("modalTitle").textContent = districtName
      document.getElementById("districtModal").classList.remove("hidden")
      this.loadInstitutionsForDistrict(districtName)
  
      // Reset filters
      this.resetFilters()
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
        spo: "СПО",
        vo: "ВО",
      }
  
      const conditionNames = {
        hearing_impairment: "Нарушения слуха",
        vision_impairment: "Нарушения зрения",
        intellectual_disability: "Интеллектуальные нарушения",
      }
  
      const ageInfo = institution.ageRange
        ? `${institution.ageRange.min}-${institution.ageRange.max} лет`
        : institution.classes
          ? `${institution.classes.join(", ")} классы`
          : ""
  
      const tags = []
      if (institution.implements_AOOP) tags.push('<span class="tag aoop">АООП</span>')
      institution.conditions.forEach((condition) => {
        tags.push(`<span class="tag">${conditionNames[condition] || condition}</span>`)
      })
  
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
                      ${ageInfo ? `<div class="detail-item"><strong>Возраст/Классы:</strong> ${ageInfo}</div>` : ""}
                  </div>
                  
                  ${tags.length > 0 ? `<div class="institution-tags">${tags.join("")}</div>` : ""}
                  
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
                          <strong>Сайт:</strong> <a href="${institution.website}" target="_blank">${institution.website}</a>
                      </div>
                  `
                      : ""
                  }
                  
                  <div class="institution-actions">
                      <button class="btn btn-primary">Подробнее</button>
                      ${adminButtons}
                  </div>
              </div>
          `
    }
  
    bindEvents() {
      // Admin toggle
      document.getElementById("adminToggle").addEventListener("click", () => {
        this.toggleAdminMode()
      })
  
      // Add institution
      document.getElementById("addInstitution").addEventListener("click", () => {
        this.openInstitutionForm()
      })
  
      // Modal close buttons
      document.getElementById("closeModal").addEventListener("click", () => {
        document.getElementById("districtModal").classList.add("hidden")
      })
  
      document.getElementById("closeInstitutionModal").addEventListener("click", () => {
        document.getElementById("institutionModal").classList.add("hidden")
      })
  
      document.getElementById("cancelInstitution").addEventListener("click", () => {
        document.getElementById("institutionModal").classList.add("hidden")
      })
  
      // Filter controls
      document.getElementById("applyFilters").addEventListener("click", () => {
        this.applyFilters()
      })
  
      document.getElementById("resetFilters").addEventListener("click", () => {
        this.resetFilters()
      })
  
      // Template buttons
      document.querySelectorAll(".template-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          this.applyTemplate(e.target.dataset.template)
        })
      })
  
      // Institution form
      document.getElementById("institutionForm").addEventListener("submit", (e) => {
        e.preventDefault()
        this.saveInstitution()
      })
  
      // Institution type change
      document.getElementById("institutionType").addEventListener("change", (e) => {
        this.toggleFormFields(e.target.value)
      })
  
      // Close modals on backdrop click
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
  
      // Refresh current view if modal is open
      if (!document.getElementById("districtModal").classList.contains("hidden")) {
        const districtName = document.getElementById("modalTitle").textContent
        this.loadInstitutionsForDistrict(districtName)
      }
    }
  
    openInstitutionForm(institution = null) {
      this.editingInstitution = institution
      const modal = document.getElementById("institutionModal")
      const title = document.getElementById("institutionModalTitle")
      const form = document.getElementById("institutionForm")
  
      title.textContent = institution ? "Редактировать учреждение" : "Добавить учреждение"
  
      if (institution) {
        this.populateForm(institution)
      } else {
        form.reset()
        this.toggleFormFields("")
      }
  
      modal.classList.remove("hidden")
    }
  
    populateForm(institution) {
      document.getElementById("institutionName").value = institution.name
      document.getElementById("institutionDescription").value = institution.description || ""
      document.getElementById("institutionType").value = institution.type
  
      if (institution.ageRange) {
        document.getElementById("ageMin").value = institution.ageRange.min
        document.getElementById("ageMax").value = institution.ageRange.max
      }
  
      if (institution.classes) {
        institution.classes.forEach((cls) => {
          const checkbox = document.querySelector(`#classesGroup input[value="${cls}"]`)
          if (checkbox) checkbox.checked = true
        })
      }
  
      document.getElementById("implementsAOOP").checked = institution.implements_AOOP
  
      institution.conditions.forEach((condition) => {
        const checkbox = document.querySelector(`input[value="${condition}"]`)
        if (checkbox) checkbox.checked = true
      })
  
      if (institution.director) {
        document.getElementById("directorName").value = institution.director.name || ""
        document.getElementById("directorPhone").value = institution.director.phone || ""
        document.getElementById("directorEmail").value = institution.director.email || ""
      }
  
      document.getElementById("institutionWebsite").value = institution.website || ""
  
      this.toggleFormFields(institution.type)
    }
  
    toggleFormFields(type) {
      const ageGroup = document.getElementById("ageRangeGroup")
      const classesGroup = document.getElementById("classesGroup")
  
      if (type === "preschool") {
        ageGroup.classList.remove("hidden")
        classesGroup.classList.add("hidden")
      } else if (type === "school") {
        ageGroup.classList.add("hidden")
        classesGroup.classList.remove("hidden")
      } else {
        ageGroup.classList.add("hidden")
        classesGroup.classList.add("hidden")
      }
    }
  
    saveInstitution() {
      const form = document.getElementById("institutionForm")
      const formData = new FormData(form)
  
      const institution = {
        id: this.editingInstitution ? this.editingInstitution.id : this.generateId(),
        name: document.getElementById("institutionName").value,
        description: document.getElementById("institutionDescription").value,
        type: document.getElementById("institutionType").value,
        implements_AOOP: document.getElementById("implementsAOOP").checked,
        district_id: this.currentDistrict ? this.districts[this.currentDistrict].name : "Липецкий район",
        conditions: [],
        director: {
          name: document.getElementById("directorName").value,
          phone: document.getElementById("directorPhone").value,
          email: document.getElementById("directorEmail").value,
        },
        website: document.getElementById("institutionWebsite").value,
      }
  
      // Handle age range or classes
      if (institution.type === "preschool") {
        const ageMin = document.getElementById("ageMin").value
        const ageMax = document.getElementById("ageMax").value
        if (ageMin && ageMax) {
          institution.ageRange = { min: Number.parseInt(ageMin), max: Number.parseInt(ageMax) }
        }
      } else if (institution.type === "school") {
        const classes = []
        document.querySelectorAll("#classesGroup input:checked").forEach((cb) => {
          classes.push(cb.value)
        })
        institution.classes = classes
      }
  
      // Handle conditions
      document
        .querySelectorAll(
          'input[value="hearing_impairment"]:checked, input[value="vision_impairment"]:checked, input[value="intellectual_disability"]:checked',
        )
        .forEach((cb) => {
          institution.conditions.push(cb.value)
        })
  
      // Validate required fields
      if (!institution.name || !institution.type) {
        alert("Пожалуйста, заполните обязательные поля")
        return
      }
  
      // Save institution
      if (this.editingInstitution) {
        const index = this.institutions.findIndex((inst) => inst.id === this.editingInstitution.id)
        this.institutions[index] = institution
      } else {
        this.institutions.push(institution)
      }
  
      this.saveInstitutions()
      document.getElementById("institutionModal").classList.add("hidden")
  
      // Refresh current view
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
  
        // Refresh current view
        if (!document.getElementById("districtModal").classList.contains("hidden")) {
          const districtName = document.getElementById("modalTitle").textContent
          this.loadInstitutionsForDistrict(districtName)
        }
      }
    }
  
    applyFilters() {
      const districtName = document.getElementById("modalTitle").textContent
      let institutions = this.institutions.filter((inst) => inst.district_id === districtName)
  
      // Type filters
      const typeFilters = []
      document.querySelectorAll('.filter-group input[type="checkbox"]:checked').forEach((cb) => {
        if (["preschool", "school", "spo", "vo"].includes(cb.value)) {
          typeFilters.push(cb.value)
        }
      })
  
      if (typeFilters.length > 0) {
        institutions = institutions.filter((inst) => typeFilters.includes(inst.type))
      }
  
      // Age filters
      const ageFilters = []
      document
        .querySelectorAll(
          '.filter-group input[value^="3-"], .filter-group input[value^="5-"], .filter-group input[value^="7+"]:checked',
        )
        .forEach((cb) => {
          ageFilters.push(cb.value)
        })
  
      // Condition filters
      const conditionFilters = []
      document
        .querySelectorAll(
          '.filter-group input[value="hearing_impairment"]:checked, .filter-group input[value="vision_impairment"]:checked, .filter-group input[value="intellectual_disability"]:checked, .filter-group input[value="aoop"]:checked',
        )
        .forEach((cb) => {
          conditionFilters.push(cb.value)
        })
  
      if (conditionFilters.length > 0) {
        institutions = institutions.filter((inst) => {
          return conditionFilters.some((filter) => {
            if (filter === "aoop") return inst.implements_AOOP
            return inst.conditions.includes(filter)
          })
        })
      }
  
      this.displayInstitutions(institutions)
    }
  
    resetFilters() {
      document.querySelectorAll('.filter-group input[type="checkbox"]').forEach((cb) => {
        cb.checked = ["preschool", "school", "spo", "vo", "3-4", "5-6", "7+"].includes(cb.value)
      })
  
      document.querySelectorAll(".template-btn").forEach((btn) => {
        btn.classList.remove("active")
      })
  
      const districtName = document.getElementById("modalTitle").textContent
      this.loadInstitutionsForDistrict(districtName)
    }
  
    applyTemplate(template) {
      // Reset all filters first
      document.querySelectorAll('.filter-group input[type="checkbox"]').forEach((cb) => {
        cb.checked = false
      })
  
      // Remove active class from all template buttons
      document.querySelectorAll(".template-btn").forEach((btn) => {
        btn.classList.remove("active")
      })
  
      // Add active class to clicked button
      document.querySelector(`[data-template="${template}"]`).classList.add("active")
  
      // Apply specific template filters
      switch (template) {
        case "certificate":
          // This would need specific logic based on your data structure
          document
            .querySelectorAll('.filter-group input[value="preschool"], .filter-group input[value="school"]')
            .forEach((cb) => (cb.checked = true))
          break
        case "hearing":
          document.querySelector('.filter-group input[value="hearing_impairment"]').checked = true
          break
        case "vision":
          document.querySelector('.filter-group input[value="vision_impairment"]').checked = true
          break
        case "aoop":
          document.querySelector('.filter-group input[value="aoop"]').checked = true
          break
      }
  
      this.applyFilters()
    }
  
    getInstitutionCountForDistrict(districtName) {
      return this.institutions.filter((inst) => inst.district_id === districtName).length
    }
  
    generateId() {
      return "inst_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
    }
  
    loadInstitutions() {
      const stored = localStorage.getItem("lipetsk_institutions")
      return stored ? JSON.parse(stored) : []
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
            description:
              "Детский сад общеразвивающего вида с приоритетным осуществлением деятельности по познавательно-речевому развитию детей",
            type: "preschool",
            ageRange: { min: 3, max: 6 },
            conditions: ["hearing_impairment"],
            implements_AOOP: true,
            director: {
              name: "Иванова Мария Петровна",
              phone: "+7 (4742) 12-34-56",
              email: "solnyshko@lipetsk.ru",
            },
            website: "https://solnyshko-lipetsk.ru",
            district_id: "Липецкий район",
          },
          {
            id: "sample_2",
            name: "МБОУ СОШ №5",
            description: "Средняя общеобразовательная школа с углубленным изучением математики и информатики",
            type: "school",
            classes: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"],
            conditions: ["vision_impairment", "intellectual_disability"],
            implements_AOOP: true,
            director: {
              name: "Петров Алексей Иванович",
              phone: "+7 (4742) 23-45-67",
              email: "school5@lipetsk.edu.ru",
            },
            website: "https://school5-lipetsk.ru",
            district_id: "Липецкий район",
          },
          {
            id: "sample_3",
            name: "Елецкий государственный колледж",
            description: "Среднее профессиональное образование по направлениям: экономика, информатика, строительство",
            type: "spo",
            conditions: [],
            implements_AOOP: false,
            director: {
              name: "Сидорова Елена Владимировна",
              phone: "+7 (47467) 34-56-78",
              email: "college@elets.ru",
            },
            website: "https://elets-college.ru",
            district_id: "Елецкий район",
          },
        ]
  
        this.institutions = sampleInstitutions
        this.saveInstitutions()
      }
    }
  }
  
  // Initialize the application
  let lipetskMap
  document.addEventListener("DOMContentLoaded", () => {
    lipetskMap = new LipetskMap()
  })
  