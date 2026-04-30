// ============================================================
// admin.js — Класс AdminManager: конструктор, init, bindEvents.
// ============================================================

class AdminManager {
    constructor(map) {
      this.map = map;
      this.aoopCounter = 0;
      this.init();
    }
  
    init() {
      document.getElementById('adminLogin').classList.remove('hidden');
      this.bindEvents();
      this.checkSession();
    }
  
    bindEvents() {
      document.getElementById('adminLogin').addEventListener('click', () => this.showLoginModal());
      document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
      document.getElementById('cancelLogin').addEventListener('click', () => this.hideLoginModal());
      document.getElementById('closeLoginModal').addEventListener('click', () => this.hideLoginModal());
      document.getElementById('logout').addEventListener('click', () => this.handleLogout());
      this.map.openInstitutionForm = (inst = null) => this.openInstitutionForm(inst);
      this.map.editInstitution = (id) => this.editInstitution(id);
      this.map.deleteInstitution = (id) => this.deleteInstitution(id);
  
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
  }