class AdminManager {
  constructor(map) {
    this.map = map;
    this.init();
  }

  init() {
    // Проверяем URL на наличие /admin
    if (!window.location.pathname.includes('admin')) {
      return;
    }
    document.getElementById('adminLogin').classList.remove('hidden');
    this.bindEvents();
    this.checkSession();
  }

  async checkSession() {
    try {
      const response = await fetch('/api/check_session.php');
      const data = await response.json();
      if (data.loggedIn) {
        this.map.isAdmin = true;
        this.showAdminPanel();
        // Перезагружаем текущий район, если открыт
        if (!document.getElementById("districtModal").classList.contains("hidden")) {
          const districtName = document.getElementById("modalTitle").textContent;
          await this.map.loadInstitutionsForDistrict(districtName);
        }
      }
    } catch (error) {
      console.error('Error checking session:', error);
    }
  }

  bindEvents() {
    document.getElementById('adminLogin').addEventListener('click', () => this.showLoginModal());
    document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
    document.getElementById('cancelLogin').addEventListener('click', () => this.hideLoginModal());
    document.getElementById('closeLoginModal').addEventListener('click', () => this.hideLoginModal());
    document.getElementById('logout').addEventListener('click', () => this.handleLogout());

    document.getElementById('selectExistingDirector').addEventListener('click', () => {
      // Если поля заблокированы (директор уже выбран), сбрасываем выбор
      if (document.getElementById('directorName').readOnly) {
        this.resetDirectorSelection();
      } else {
        this.showDirectorSelection();
      }
    });
    document.getElementById('saveDirectorSelection').addEventListener('click', () => this.saveDirectorSelection());
    document.getElementById('cancelDirectorSelection').addEventListener('click', () => this.cancelDirectorSelection());
    document.getElementById('directorSearch').addEventListener('input', (e) => this.searchDirectors(e.target.value));

    // Переопределяем методы карты для админа
    this.map.openInstitutionForm = (inst = null) => this.openInstitutionForm(inst);
    this.map.editInstitution = (id) => this.editInstitution(id);
    this.map.deleteInstitution = (id) => this.deleteInstitution(id);
    this.map.applyFilters = () => this.applyFilters();
    this.map.resetFilters = () => this.resetFilters();

    // Привязываем submit формы учреждения
    document.getElementById('institutionForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveInstitution();
    });
    document.getElementById('addAoOp').addEventListener('click', () => {
      this.map.addAoOpField();
    });
    document.getElementById('institutionType').addEventListener('change', (e) => {
      this.toggleFormFields(e.target.value);
    });

  }
  resetDirectorSelection() {
    // Сбрасываем временные данные
    this.tempDirectorId = null;
    if (this.map.editingInstitution && this.map.editingInstitution.director) {
      delete this.map.editingInstitution.director.id;
    }

    // Очищаем поля
    document.getElementById('directorName').value = '';
    document.getElementById('directorPhone').value = '';
    document.getElementById('directorEmail').value = '';

    // Разблокируем поля
    this.lockDirectorFields(false);

    // Показываем панель выбора
    this.showDirectorSelection();
  }

  showDirectorSelection() {
    // Если поля уже заблокированы (директор выбран), спрашиваем о сбросе
    if (document.getElementById('directorName').readOnly) {
      if (confirm('Вы хотите изменить выбранного директора? Текущие данные будут сброшены.')) {
        this.resetDirectorSelection();
      }
      return;
    }

    // Показываем панель выбора директора
    document.getElementById('directorSelection').classList.remove('hidden');

    // Загружаем список директоров
    this.loadDirectors();
  }

  cancelDirectorSelection() {
    // Скрываем панель выбора директора
    document.getElementById('directorSelection').classList.add('hidden');

    // Очищаем поиск и список
    document.getElementById('directorSearch').value = '';
    document.getElementById('directorsList').innerHTML = '';
    this.selectedDirectorId = null;

    // НЕ разблокируем поля здесь, только если пользователь явно не отменил выбор
    // Поля остаются заблокированными, если директор уже был выбран ранее
  }

  async loadDirectors(searchTerm = '') {
    try {
      const params = new URLSearchParams();
      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await fetch(`/api/get_directors.php?${params}`);
      const data = await response.json();

      if (data.error) throw new Error(data.error);

      this.displayDirectors(data.directors);
    } catch (error) {
      console.error('Error loading directors:', error);
      alert('Ошибка загрузки списка директоров');
    }
  }

  displayDirectors(directors) {
    const directorsList = document.getElementById('directorsList');
    directorsList.innerHTML = '';

    if (directors.length === 0) {
      directorsList.innerHTML = '<p class="no-results">Директоры не найдены</p>';
      return;
    }

    directors.forEach(director => {
      const directorItem = document.createElement('div');
      directorItem.className = 'director-item';
      directorItem.innerHTML = `
              <div class="director-info">
                  <strong>${director.full_name || 'Не указано'}</strong>
                  <div class="director-details">
                      ${director.phone ? `Тел: ${director.phone}` : ''}
                      ${director.email ? `Email: ${director.email}` : ''}
                  </div>
              </div>
              <button type="button" class="btn btn-primary select-director-btn" data-id="${director.id}">
                  Выбрать
              </button>
          `;
      directorsList.appendChild(directorItem);
    });

    // Добавляем обработчики для кнопок выбора
    directorsList.querySelectorAll('.select-director-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const directorId = e.target.getAttribute('data-id');
        this.selectDirector(directorId);
      });
    });
  }

  searchDirectors(searchTerm) {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.loadDirectors(searchTerm);
    }, 300);
  }

  selectDirector(directorId) {
    this.selectedDirectorId = directorId;

    // Подсвечиваем выбранный элемент
    document.querySelectorAll('.director-item').forEach(item => {
      item.classList.remove('selected');
    });
    event.target.closest('.director-item').classList.add('selected');
  }

  saveDirectorSelection() {
    if (!this.selectedDirectorId) {
      alert('Пожалуйста, выберите директора из списка');
      return;
    }

    // Сначала скрываем панель выбора
    document.getElementById('directorSelection').classList.add('hidden');

    // Очищаем поиск и список
    document.getElementById('directorSearch').value = '';
    document.getElementById('directorsList').innerHTML = '';

    // Блокируем поля ДО загрузки данных
    this.lockDirectorFields(true);

    // Загружаем данные выбранного директора
    this.loadDirectorData(this.selectedDirectorId);

    // Сбрасываем выбранный ID
    this.selectedDirectorId = null;
  }

  async loadDirectorData(directorId) {
    try {
      const response = await fetch(`/api/get_director.php?id=${directorId}`);
      const data = await response.json();

      if (data.error) throw new Error(data.error);

      // Заполняем поля формы данными директора
      document.getElementById('directorName').value = data.director.full_name || '';
      document.getElementById('directorPhone').value = data.director.phone || '';
      document.getElementById('directorEmail').value = data.director.email || '';

      // Сохраняем ID директора для отправки на сервер
      if (this.map.editingInstitution) {
        this.map.editingInstitution.director = this.map.editingInstitution.director || {};
        this.map.editingInstitution.director.id = directorId;
      } else {
        // Для нового учреждения создаем временный объект
        this.tempDirectorId = directorId;
      }

    } catch (error) {
      console.error('Error loading director data:', error);
      alert('Ошибка загрузки данных директора');
      // В случае ошибки разблокируем поля
      this.lockDirectorFields(false);
    }
  }

  lockDirectorFields(locked) {
    const fields = [
      'directorName',
      'directorPhone',
      'directorEmail'
    ];

    fields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.readOnly = locked;
        field.style.backgroundColor = locked ? '#f5f5f5' : '';
        field.style.cursor = locked ? 'not-allowed' : '';
        field.style.borderColor = locked ? '#ddd' : '';
      }
    });

    // Обновляем кнопку выбора директора
    const selectButton = document.getElementById('selectExistingDirector');
    if (selectButton) {
      if (locked) {
        selectButton.textContent = 'Изменить выбранного директора';
        selectButton.classList.remove('btn-secondary');
        selectButton.classList.add('btn-primary');
      } else {
        selectButton.textContent = 'Выбрать существующего директора';
        selectButton.classList.remove('btn-primary');
        selectButton.classList.add('btn-secondary');
      }
      // Всегда показываем кнопку
      selectButton.classList.remove('hidden');
    }
  }

  showLoginModal() {
    document.getElementById('loginModal').classList.remove('hidden');
  }

  hideLoginModal() {
    document.getElementById('loginModal').classList.add('hidden');
    document.getElementById('loginForm').reset();
  }

  async handleLogin(e) {
    e.preventDefault();
    const login = document.getElementById('adminLoginInput').value;
    const password = document.getElementById('adminPassword').value;

    try {
      const response = await fetch('/api/login.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password })
      });
      const data = await response.json();
      if (data.success) {
        this.map.isAdmin = true;
        this.showAdminPanel();
        this.hideLoginModal();
      } else {
        alert('Ошибка входа: ' + (data.error || 'Неизвестная ошибка'));
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Ошибка входа');
    }
  }

  async handleLogout() {
    try {
      await fetch('/api/logout.php', { method: 'POST' });
      this.map.isAdmin = false;
      document.getElementById('adminPanel').classList.add('hidden');
      document.getElementById('adminLogin').classList.remove('hidden');
      // Reload current district if open
      if (!document.getElementById("districtModal").classList.contains("hidden")) {
        const districtName = document.getElementById("modalTitle").textContent;
        await this.map.loadInstitutionsForDistrict(districtName);
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  showAdminPanel() {
    document.getElementById('adminLogin').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    document.getElementById('addInstitution').addEventListener('click', () => {
      this.map.editingInstitution = null;
      document.getElementById('institutionModalTitle').textContent = 'Добавить учреждение';
      document.getElementById('institutionModal').classList.remove('hidden');
      this.map.clearInstitutionForm();
    });
  }

  openInstitutionForm(inst = null) {
    this.lockDirectorFields(false);

    if (inst) {
      // Set form fields
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

      // Conditions Admission
      document.querySelectorAll('input[name="admission"]').forEach(cb => {
        cb.checked = false;
      });
      if (inst.conditionsAdmission && Array.isArray(inst.conditionsAdmission)) {
        inst.conditionsAdmission.forEach(code => {
          const cb = document.querySelector(`input[name="admission"][value="${code}"]`);
          if (cb) cb.checked = true;
        });
      }

      // Special conditions
      document.querySelectorAll('#institutionForm input[type="checkbox"]:not([name="admission"])').forEach(cb => {
        cb.checked = false;
      });
      if (inst.conditions && Array.isArray(inst.conditions)) {
        inst.conditions.forEach(code => {
          const cb = document.querySelector(`#institutionForm input[value="${code}"]`);
          if (cb) cb.checked = true;
        });
      }

      // AOOP
      const aoopList = document.getElementById('aoopList');
      aoopList.innerHTML = '';
      this.map.aoopCounter = 0;
      if (inst.aoop_programs && Array.isArray(inst.aoop_programs)) {
        inst.aoop_programs.forEach(prog => {
          this.map.addAoOpField();
          const fields = aoopList.querySelectorAll('.aoop-field');
          const lastField = fields[fields.length - 1];
          lastField.querySelector('.aoop-name').value = prog.name || '';
          lastField.querySelector('.aoop-url').value = prog.url || '';
        });
      }
      if (inst.director && inst.director.id) {
        // Блокируем поля, так как директор уже выбран
        this.lockDirectorFields(true);
      }
      // ВАЖНО: Добавляем вызов toggleFormFields
      this.toggleFormFields(inst.type);

      document.getElementById('institutionModalTitle').textContent = 'Редактировать учреждение';
      this.map.editingInstitution = inst;
      document.getElementById('institutionModal').classList.remove('hidden');
    } else {
      this.map.clearInstitutionForm();
      document.getElementById('institutionModal').classList.remove('hidden');
    }
  }

  // Добавляем метод toggleFormFields в AdminManager
  toggleFormFields(type) {
    const group = document.getElementById("rangeGroup");
    if (!group) return;

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

  async editInstitution(id) {
    try {
      const districtId = this.map.institutions.find(inst => inst.id === id)?.district_id || 1;
      const params = new URLSearchParams({ district_id: districtId, id });
      const response = await fetch(`/api/get_institution.php?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
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
        await this.map.loadInstitutionsForDistrict(districtName);
      }
    } catch (error) {
      console.error('Error deleting institution:', error);
      alert('Ошибка удаления');
    }
  }

  async saveInstitution() {
    try {
      const data = this.collectFormData();

      // ВРЕМЕННО: принудительно используем update для отладки
      let url;
      if (this.map.editingInstitution && this.map.editingInstitution.id) {
        url = '/api/update_institution.php';
      } else {
        url = '/api/create_institution.php';
      }

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
        await this.map.loadInstitutionsForDistrict(districtName);
      }
    } catch (error) {
      console.error('Error saving institution:', error);
      alert(`Ошибка: ${error.message}`);
    }
  }

  collectFormData() {
    const formData = {
      name: document.getElementById('institutionName').value.trim(),
      district_id: parseInt(document.getElementById('districtId').value),
      type: document.getElementById('institutionType').value,
      description: document.getElementById('institutionDescription').value.trim(),
      website: document.getElementById('institutionWebsite').value.trim(),
      range: {
        min: parseInt(document.getElementById('rangeMin').value) || null,
        max: parseInt(document.getElementById('rangeMax').value) || null
      },
      conditions: [],
      conditionsAdmission: [],
      aoop_programs: [],
      director: {
        name: document.getElementById('directorName').value.trim()
      }
    };

    if (document.getElementById('directorPhone').value.trim()) {
      formData.director.phone = document.getElementById('directorPhone').value.trim();
    }
    if (document.getElementById('directorEmail').value.trim()) {
      formData.director.email = document.getElementById('directorEmail').value.trim();
    }
    if (this.map.editingInstitution && this.map.editingInstitution.director.id) {
      formData.director.id = this.map.editingInstitution.director.id;
    }

    if (!formData.name || !formData.type || !formData.district_id) {
      throw new Error("Заполните обязательные поля: Название, Тип и Район");
    }
    if (this.map.editingInstitution && this.map.editingInstitution.director && this.map.editingInstitution.director.id) {
      formData.director.id = this.map.editingInstitution.director.id;
    } else if (this.tempDirectorId) {
      formData.director.id = this.tempDirectorId;
    }
    document.querySelectorAll('input[name="admission"]:checked').forEach((cb) => {
      formData.conditionsAdmission.push(cb.value);
    });

    document.querySelectorAll('#institutionForm input[type="checkbox"]:not([name="admission"]):checked').forEach((cb) => {
      formData.conditions.push(cb.value);
    });

    document.querySelectorAll(".aoop-field").forEach((field) => {
      const name = field.querySelector(".aoop-name").value.trim();
      const url = field.querySelector(".aoop-url").value.trim();
      if (name) {
        formData.aoop_programs.push({ name, url: url || null });
      }
    });

    if (this.map.editingInstitution) {
      formData.id = this.map.editingInstitution.id;
    }

    return formData;
  }

  async applyFilters() {
    const districtName = document.getElementById("modalTitle").textContent;
    const districtId = this.map.districtIdMap[districtName];
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
      this.map.displayInstitutions(data.institutions);
      if (window.innerWidth <= 768) {
        document.getElementById("filtersSection").classList.add("hidden");
      }
    } catch (error) {
      console.error('Error applying filters:', error);
      alert('Ошибка применения фильтров: ' + error.message);
    }
  }

  displayInstitutions(institutions) {
    // Вызываем родительский метод
    this.map.displayInstitutions(institutions);

    // Дополнительная логика для админа
    if (this.map.isAdmin) {
      this.map.bindAdminActions();
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
    this.map.loadInstitutionsForDistrict(districtName);
    if (window.innerWidth <= 768) {
      document.getElementById("filtersSection").classList.add("hidden");
    }
  }
}

// Initialize after map
document.addEventListener("DOMContentLoaded", () => {
  if (typeof lipetskMap !== 'undefined') {
    new AdminManager(lipetskMap);
  }
});