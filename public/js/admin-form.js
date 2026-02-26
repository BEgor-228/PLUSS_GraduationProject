// ============================================================
// admin-form.js — Форма учреждения: открытие/заполнение,
//                 toggleFormFields, addAoOpField, collectFormData
// ============================================================

Object.assign(AdminManager.prototype, {

    addAoOpField() {
      this.aoopCounter++;
      const aoopList = document.getElementById("aoopList");
      const field = document.createElement("div");
      field.className = "aoop-field form-group";
      field.innerHTML = `
      <input type="text" class="aoop-name" placeholder="Название программы">
      <button type="button" class="remove-aoop btn btn-danger">Удалить</button>
    `;
      aoopList.appendChild(field);
      field.querySelector(".remove-aoop").addEventListener("click", () => {
        field.remove();
      });
    },
  
    openInstitutionForm(inst = null) {
      if (inst) {
        document.getElementById('institutionName').value = inst.name || '';
        document.getElementById('districtId').value = inst.district_id ? inst.district_id.toString() : '';
        document.getElementById('institutionDescription').value = inst.description || '';
        document.getElementById('institutionType').value = inst.type || '';
        document.getElementById('directorName').value = inst.director ? inst.director.name : '';
        document.getElementById('directorPhone').value = inst.director ? inst.director.phone : '';
        document.getElementById('directorEmail').value = inst.director ? inst.director.email : '';
        document.getElementById('institutionWebsite').value = inst.website || '';
        document.getElementById('rangeMin').value = inst.range_min || '';
        document.getElementById('rangeMax').value = inst.range_max || '';
  
        document.getElementById('institutionAoopUrl').value = inst.aoop_url || '';
  
        document.querySelectorAll('input[name="admission"]').forEach(cb => {
          cb.checked = false;
        });
        if (inst.conditionsAdmission && Array.isArray(inst.conditionsAdmission)) {
          inst.conditionsAdmission.forEach(code => {
            const cb = document.querySelector(`input[name="admission"][value="${code}"]`);
            if (cb) cb.checked = true;
          });
        }
  
        document.querySelectorAll('#institutionForm input[type="checkbox"]:not([name="admission"])').forEach(cb => {
          cb.checked = false;
        });
        if (inst.conditions && Array.isArray(inst.conditions)) {
          inst.conditions.forEach(code => {
            const cb = document.querySelector(`#institutionForm input[value="${code}"]`);
            if (cb) cb.checked = true;
          });
        }

        const aoopList = document.getElementById('aoopList');
        aoopList.innerHTML = '';
        this.map.aoopCounter = 0;
        if (inst.aoop_programs && Array.isArray(inst.aoop_programs)) {
          inst.aoop_programs.forEach(prog => {
            this.addAoOpField();
            const fields = aoopList.querySelectorAll('.aoop-field');
            const lastField = fields[fields.length - 1];
            lastField.querySelector('.aoop-name').value = prog.name || '';
          });
        }
  
        this.toggleFormFields(inst.type);
  
        document.getElementById('institutionModalTitle').textContent = 'Редактировать учреждение';
        this.map.editingInstitution = inst;
        document.getElementById('institutionModal').classList.remove('hidden');
      } else {
        this.map.clearInstitutionForm();
        this.toggleFormFields('school');
        document.getElementById('institutionModal').classList.remove('hidden');
      }
    },
  
    toggleFormFields(type) {
      const group = document.getElementById("rangeGroup");
      const label = document.getElementById("rangeLabel");
      const unit = document.getElementById("rangeUnit");
  
      if (!group) return;
  
      group.classList.remove("hidden");
  
      if (type === "preschool") {
        label.textContent = "Возрастной диапазон";
        document.getElementById("rangeMin").placeholder = "От (лет)";
        document.getElementById("rangeMax").placeholder = "До (лет)";
        unit.textContent = "(лет)";
        document.getElementById("rangeMin").min = "1";
        document.getElementById("rangeMin").max = "7";
        document.getElementById("rangeMax").min = "1";
        document.getElementById("rangeMax").max = "7";
      } else if (type === "school" || type === "school_internat") {
        label.textContent = "Диапазон классов";
        document.getElementById("rangeMin").placeholder = "От (класс)";
        document.getElementById("rangeMax").placeholder = "До (класс)";
        unit.textContent = "(классов)";
        document.getElementById("rangeMin").min = "1";
        document.getElementById("rangeMin").max = "11";
        document.getElementById("rangeMax").min = "1";
        document.getElementById("rangeMax").max = "11";
      } else {
        label.textContent = "Диапазон";
        document.getElementById("rangeMin").placeholder = "От";
        document.getElementById("rangeMax").placeholder = "До";
        unit.textContent = "";
        document.getElementById("rangeMin").removeAttribute("min");
        document.getElementById("rangeMin").removeAttribute("max");
        document.getElementById("rangeMax").removeAttribute("min");
        document.getElementById("rangeMax").removeAttribute("max");
      }
    },
  
    collectFormData() {
      const name = document.getElementById('institutionName').value.trim();
      const districtId = parseInt(document.getElementById('districtId').value);
      const type = document.getElementById('institutionType').value;
      const description = document.getElementById('institutionDescription').value.trim();
      const website = document.getElementById('institutionWebsite').value.trim();
      const aoopUrl = document.getElementById('institutionAoopUrl').value.trim();
      const rangeMin = document.getElementById('rangeMin').value ? parseInt(document.getElementById('rangeMin').value) : null;
      const rangeMax = document.getElementById('rangeMax').value ? parseInt(document.getElementById('rangeMax').value) : null;
      const directorName = document.getElementById('directorName').value.trim();
  
      const formData = {
        name: name,
        district_id: districtId,
        type: type,
        description: description || null,
        website: website || null,
        aoop_url: aoopUrl || null,
        range: {
          min: rangeMin,
          max: rangeMax
        },
        conditions: [],
        conditionsAdmission: [],
        aoop_programs: [],
        director: {
          name: directorName
        }
      };
  
      if (!formData.name || !formData.type || !formData.district_id) {
        throw new Error("Заполните обязательные поля: Название, Тип и Район");
      }
  
      document.querySelectorAll('input[name="admission"]:checked').forEach((cb) => {
        formData.conditionsAdmission.push(cb.value);
      });
  
      document.querySelectorAll('#institutionForm input[type="checkbox"]:not([name="admission"]):checked').forEach((cb) => {
        formData.conditions.push(cb.value);
      });
  
      document.querySelectorAll(".aoop-field").forEach((field) => {
        const name = field.querySelector(".aoop-name").value.trim();
        if (name) {
          formData.aoop_programs.push({ name });
        }
      });
  
      const directorPhone = document.getElementById('directorPhone').value.trim();
      const directorEmail = document.getElementById('directorEmail').value.trim();
  
      if (directorPhone) formData.director.phone = directorPhone;
      if (directorEmail) formData.director.email = directorEmail;
  
      if (this.map.editingInstitution && this.map.editingInstitution.director?.id) {
        formData.director.id = this.map.editingInstitution.director.id;
      }
  
      if (this.map.editingInstitution) {
        formData.id = this.map.editingInstitution.id;
      }
  
      return formData;
    },
  
  });