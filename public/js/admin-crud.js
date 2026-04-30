// ============================================================
// admin-crud.js — CRUD-операции над учреждениями:
//                 редактирование, удаление, сохранение
// ============================================================

Object.assign(AdminManager.prototype, {

  async editInstitution(id) {
    window.location.href = `/institution/${id}/edit/`;
  },

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
        const districtName = document.getElementById("regionName").textContent;
        await this.map.loadInstitutionsForDistrict(districtName);
      }
    } catch (error) {
      console.error('Error deleting institution:', error);
      alert('Ошибка удаления');
    }
  },

  async saveInstitution() {
    try {
      console.log("Начало сохранения учреждения...");

      const data = this.collectFormData();
      console.log("Собранные данные:", data);

      let url;
      if (this.map.editingInstitution && this.map.editingInstitution.id) {
        url = '/api/update_institution.php';
        console.log("Режим: ОБНОВЛЕНИЕ");
      } else {
        url = '/api/create_institution.php';
        console.log("Режим: СОЗДАНИЕ");
      }

      console.log("Отправка запроса на:", url);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      console.log("Статус ответа:", response.status);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      console.log("Ответ сервера:", result);

      if (result.error) throw new Error(result.error);

      document.getElementById("institutionModal").classList.add("hidden");
      if (!document.getElementById("districtModal").classList.contains("hidden")) {
        const districtName = document.getElementById("regionName").textContent;
        await this.map.loadInstitutionsForDistrict(districtName);
      }

      console.log("Сохранение завершено успешно!");

    } catch (error) {
      console.error('Error saving institution:', error);
      alert(`Ошибка: ${error.message}`);
    }
  },

  displayInstitutions(institutions) {
    this.map.displayInstitutions(institutions);

    if (this.map.isAdmin) {
      this.map.bindAdminActions();
    }
  },

  toggleFormFields(type) {
    const attestatCheckbox = document.getElementById('doc_attestat');
    const certificateCheckbox = document.getElementById('doc_certificate');
    const rangeLabel = document.getElementById('rangeLabel');
    const rangeUnit = document.getElementById('rangeUnit');

    if (!attestatCheckbox) return;

    // 1. Сброс состояний по умолчанию
    attestatCheckbox.disabled = false;
    attestatCheckbox.parentElement.style.opacity = "1";
    if (certificateCheckbox) {
      certificateCheckbox.disabled = false;
      certificateCheckbox.parentElement.style.opacity = "1";
    }

    // 2. Логика блокировки "Аттестата" для Дошкольных, Школ и Интернатов
    // (Если я правильно понял, вы хотите оставить там только Свидетельство)
    const restrictedTypes = ['preschool', 'school', 'school_internat'];

    if (restrictedTypes.includes(type)) {
      attestatCheckbox.checked = false;
      attestatCheckbox.disabled = true;
      attestatCheckbox.parentElement.style.opacity = "0.5";
    }

    // 3. Управление текстовыми подписями (Возраст vs Классы)
    if (type === 'preschool') {
      if (rangeLabel) rangeLabel.textContent = "Возраст воспитанников";
      if (rangeUnit) rangeUnit.textContent = "(лет)";
    } else if (type === 'school' || type === 'school_internat') {
      if (rangeLabel) rangeLabel.textContent = "Классы обучения";
      if (rangeUnit) rangeUnit.textContent = "(классы)";
    } else {
      // Для СПО и ВО
      if (rangeLabel) rangeLabel.textContent = "Курсы обучения / Возраст";
      if (rangeUnit) rangeUnit.textContent = "(курс/лет)";
    }
  }

});