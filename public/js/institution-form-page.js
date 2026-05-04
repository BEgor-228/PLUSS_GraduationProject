(() => {
  const initialNode = document.getElementById("institutionInitialData");
  const initialData = initialNode ? JSON.parse(initialNode.textContent || "{}") : {};

  const form = document.getElementById("institutionForm");
  if (!form) return;

  const districtSelect = document.getElementById("districtId");
  const cancelTop = document.getElementById("cancelInstitutionFormTop");
  const cancelBottom = document.getElementById("cancelInstitutionFormBottom");
  const addAoopBtn = document.getElementById("addAoOp");

  let editingInstitution = initialData && initialData.id ? initialData : null;
  let aoopCounter = 0;

  function addAoOpField(name = "") {
    aoopCounter += 1;
    const aoopList = document.getElementById("aoopList");
    const field = document.createElement("div");
    field.className = "aoop-field form-group";
    field.innerHTML = `
      <input type="text" class="aoop-name" placeholder="Название программы" value="${name.replace(/"/g, "&quot;")}">
      <button type="button" class="remove-aoop btn btn-danger">Удалить</button>
    `;
    aoopList.appendChild(field);
    field.querySelector(".remove-aoop").addEventListener("click", () => field.remove());
  }

  function toggleFormFields(type) {
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
  }

  function fillForm(inst) {
    if (!inst) return;
    document.getElementById("institutionName").value = inst.name || "";
    districtSelect.value = inst.district_id ? String(inst.district_id) : "";
    document.getElementById("institutionDescription").value = inst.description || "";
    document.getElementById("institutionType").value = inst.type || "";
    document.getElementById("institutionAddress").value = inst.address || "";
    document.getElementById("directorName").value = inst.director ? inst.director.name : "";
    document.getElementById("directorPhone").value = inst.director ? inst.director.phone : "";
    document.getElementById("directorEmail").value = inst.director ? inst.director.email : "";
    document.getElementById("institutionWebsite").value = inst.website || "";
    document.getElementById("rangeMin").value = inst.range_min ?? "";
    document.getElementById("rangeMax").value = inst.range_max ?? "";
    document.getElementById("institutionAoopUrl").value = inst.aoop_url || "";

    document.querySelectorAll('input[name="admission"]').forEach((cb) => (cb.checked = false));
    (inst.conditionsAdmission || []).forEach((code) => {
      const cb = document.querySelector(`input[name="admission"][value="${code}"]`);
      if (cb) cb.checked = true;
    });

    document.querySelectorAll('input[name="conditions"]').forEach((cb) => (cb.checked = false));
    (inst.conditions || []).forEach((code) => {
      const cb = document.querySelector(`input[name="conditions"][value="${code}"]`);
      if (cb) cb.checked = true;
    });
    document
      .querySelectorAll('input[name="accessibility_criteria"]')
      .forEach((cb) => (cb.checked = false));
    (inst.accessibility_criteria || []).forEach((code) => {
      const cb = document.querySelector(`input[name="accessibility_criteria"][value="${code}"]`);
      if (cb) cb.checked = true;
    });

    const aoopList = document.getElementById("aoopList");
    aoopList.innerHTML = "";
    aoopCounter = 0;
    (inst.aoop_programs || []).forEach((prog) => addAoOpField(prog.name || ""));

    toggleFormFields(inst.type);
  }

  function collectFormData() {
    const name = document.getElementById("institutionName").value.trim();
    const districtId = parseInt(districtSelect.value, 10);
    const type = document.getElementById("institutionType").value;
    const description = document.getElementById("institutionDescription").value.trim();
    const address = document.getElementById("institutionAddress").value.trim();
    const website = document.getElementById("institutionWebsite").value.trim();
    const aoopUrl = document.getElementById("institutionAoopUrl").value.trim();
    const rangeMin = document.getElementById("rangeMin").value
      ? parseInt(document.getElementById("rangeMin").value, 10)
      : null;
    const rangeMax = document.getElementById("rangeMax").value
      ? parseInt(document.getElementById("rangeMax").value, 10)
      : null;
    const directorName = document.getElementById("directorName").value.trim();

    const formData = {
      name: name,
      district_id: districtId,
      type: type,
      description: description || null,
      address: address || null,
      website: website || null,
      aoop_url: aoopUrl || null,
      range: { min: rangeMin, max: rangeMax },
      conditions: [],
      accessibility_criteria: [],
      conditionsAdmission: [],
      aoop_programs: [],
      director: { name: directorName },
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
      const aoopName = field.querySelector(".aoop-name").value.trim();
      if (aoopName) formData.aoop_programs.push({ name: aoopName });
    });

    const directorPhone = document.getElementById("directorPhone").value.trim();
    const directorEmail = document.getElementById("directorEmail").value.trim();
    if (directorPhone) formData.director.phone = directorPhone;
    if (directorEmail) formData.director.email = directorEmail;

    if (editingInstitution && editingInstitution.director && editingInstitution.director.id) {
      formData.director.id = editingInstitution.director.id;
    }
    if (editingInstitution && editingInstitution.id) {
      formData.id = editingInstitution.id;
    }
    return formData;
  }

  function updateCancelLinks(districtId) {
    if (!districtId) return;
    const href = `/district/${districtId}/`;
    cancelTop.href = href;
    cancelBottom.href = href;
  }

  addAoopBtn.addEventListener("click", () => addAoOpField(""));
  document.getElementById("institutionType").addEventListener("change", (e) => {
    toggleFormFields(e.target.value);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const data = collectFormData();
      const url = data.id ? "/api/update_institution.php" : "/api/create_institution.php";
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      window.location.href = `/district/${data.district_id}/`;
    } catch (error) {
      alert(`Ошибка: ${error.message}`);
    }
  });

  if (editingInstitution) {
    fillForm(editingInstitution);
    updateCancelLinks(editingInstitution.district_id);
  } else {
    if (initialData && initialData.district_id) {
      districtSelect.value = String(initialData.district_id);
      updateCancelLinks(initialData.district_id);
    }
    toggleFormFields(document.getElementById("institutionType").value || "school");
  }
})();
