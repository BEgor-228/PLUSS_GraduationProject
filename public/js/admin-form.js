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
        document.getElementById('institutionAddress').value = inst.address || '';
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
  
        document.querySelectorAll('input[name="conditions"]').forEach(cb => {
          cb.checked = false;
        });
        if (inst.conditions && Array.isArray(inst.conditions)) {
          inst.conditions.forEach(code => {
            const cb = document.querySelector(`input[name="conditions"][value="${code}"]`);
            if (cb) cb.checked = true;
          });
        }
        document.querySelectorAll('input[name="accessibility_criteria"]').forEach(cb => {
          cb.checked = false;
        });
        if (inst.accessibility_criteria && Array.isArray(inst.accessibility_criteria)) {
          inst.accessibility_criteria.forEach(code => {
            const cb = document.querySelector(`input[name="accessibility_criteria"][value="${code}"]`);
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
      const rangeMin = document.getElementById("rangeMin");
      const rangeMax = document.getElementById("rangeMax");
      const attestatCheckbox = document.getElementById("doc_attestat");
      const certificateCheckbox = document.getElementById("doc_certificate");

      if (!group || !label || !unit || !rangeMin || !rangeMax) return;

      if (attestatCheckbox) {
        attestatCheckbox.disabled = false;
        attestatCheckbox.parentElement.style.opacity = "1";
        if (certificateCheckbox) {
          certificateCheckbox.disabled = false;
          certificateCheckbox.parentElement.style.opacity = "1";
        }
        const restrictedTypes = ["preschool", "school", "school_internat"];
        if (restrictedTypes.includes(type)) {
          attestatCheckbox.checked = false;
          attestatCheckbox.disabled = true;
          attestatCheckbox.parentElement.style.opacity = "0.5";
        }
      }

      group.classList.remove("hidden");

      if (type === "preschool") {
        label.textContent = "Возраст воспитанников";
        rangeMin.placeholder = "От (лет)";
        rangeMax.placeholder = "До (лет)";
        unit.textContent = "(лет)";
        rangeMin.min = "1";
        rangeMin.max = "7";
        rangeMax.min = "1";
        rangeMax.max = "7";
      } else if (type === "school" || type === "school_internat") {
        label.textContent = "Классы обучения";
        rangeMin.placeholder = "От (класс)";
        rangeMax.placeholder = "До (класс)";
        unit.textContent = "(классы)";
        rangeMin.min = "1";
        rangeMin.max = "11";
        rangeMax.min = "1";
        rangeMax.max = "11";
      } else {
        label.textContent = "Курсы обучения / Возраст";
        rangeMin.placeholder = "От";
        rangeMax.placeholder = "До";
        unit.textContent = "(курс/лет)";
        rangeMin.removeAttribute("min");
        rangeMin.removeAttribute("max");
        rangeMax.removeAttribute("min");
        rangeMax.removeAttribute("max");
      }
    },
  
    collectFormData() {
      const name = document.getElementById('institutionName').value.trim();
      const districtId = parseInt(document.getElementById('districtId').value);
      const type = document.getElementById('institutionType').value;
      const description = document.getElementById('institutionDescription').value.trim();
      const address = document.getElementById('institutionAddress').value.trim();
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
        address: address || null,
        website: website || null,
        aoop_url: aoopUrl || null,
        range: {
          min: rangeMin,
          max: rangeMax
        },
        conditions: [],
        accessibility_criteria: [],
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
  
      document.querySelectorAll('input[name="conditions"]:checked').forEach((cb) => {
        formData.conditions.push(cb.value);
      });
      document.querySelectorAll('input[name="accessibility_criteria"]:checked').forEach((cb) => {
        formData.accessibility_criteria.push(cb.value);
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