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
    // Переопределяем методы карты для админа
    this.map.openInstitutionForm = (inst = null) => this.openInstitutionForm(inst);
    this.map.editInstitution = (id) => this.editInstitution(id);
    this.map.deleteInstitution = (id) => this.deleteInstitution(id);

    // Привязываем submit формы учреждения
    document.getElementById('institutionForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveInstitution();
    });
    document.getElementById('addAoOp').addEventListener('click', () => {
      this.addAoOpField();
    });
    document.getElementById('institutionType').addEventListener('change', (e) => {
      this.toggleFormFields(e.target.value);
    });

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
        const districtName = document.getElementById("regionName").textContent;
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
          this.addAoOpField();
          const fields = aoopList.querySelectorAll('.aoop-field');
          const lastField = fields[fields.length - 1];
          lastField.querySelector('.aoop-name').value = prog.name || '';
          lastField.querySelector('.aoop-url').value = prog.url || '';
        });
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
        const districtName = document.getElementById("regionName").textContent;
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
        const districtName = document.getElementById("regionName").textContent;
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

  displayInstitutions(institutions) {
    // Вызываем родительский метод
    this.map.displayInstitutions(institutions);

    // Дополнительная логика для админа
    if (this.map.isAdmin) {
      this.map.bindAdminActions();
    }
  }
}

// Initialize after map
document.addEventListener("DOMContentLoaded", () => {
  if (typeof lipetskMap !== 'undefined') {
    new AdminManager(lipetskMap);
  }
});