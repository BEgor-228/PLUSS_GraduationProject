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
      const adminLoginBtn = document.getElementById('adminLogin');
      if (adminLoginBtn) {
        adminLoginBtn.classList.remove('hidden');
      }
      this.bindEvents();
      this.checkSession();
    }
  
    bindEvents() {
      document.getElementById('adminLogin')?.addEventListener('click', () => {
        if (this.map.isPortalUser) this.handleLogout();
        else this.showLoginModal();
      });
      document.getElementById('loginForm')?.addEventListener('submit', (e) => this.handleLogin(e));
      document.getElementById('cancelLogin')?.addEventListener('click', () => this.hideLoginModal());
      document.getElementById('closeLoginModal')?.addEventListener('click', () => this.hideLoginModal());
      document.getElementById('openRegisterModal')?.addEventListener('click', () => this.showRegisterModal());
      document.getElementById('openLoginFromRegister')?.addEventListener('click', () => this.showLoginFromRegister());
      document.getElementById('closeRegisterModal')?.addEventListener('click', () => this.hideRegisterModal());
      document.getElementById('cancelRegister')?.addEventListener('click', () => this.hideRegisterModal());
      document.getElementById('registerForm')?.addEventListener('submit', (e) => this.handlePortalRegister(e));
      document.getElementById('authRoleUser')?.addEventListener('click', () => this.setAuthRole('portal'));
      document.getElementById('authRoleAdmin')?.addEventListener('click', () => this.setAuthRole('admin'));
      document.getElementById('logout')?.addEventListener('click', () => this.handleLogout());
      this.map.openInstitutionForm = (inst = null) => this.openInstitutionForm(inst);
      this.map.editInstitution = (id) => this.editInstitution(id);
      this.map.deleteInstitution = (id) => this.deleteInstitution(id);
  
      document.getElementById('institutionForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveInstitution();
      });
      document.getElementById('addAoOp')?.addEventListener('click', () => {
        this.addAoOpField();
      });
      document.getElementById('institutionType')?.addEventListener('change', (e) => {
        this.toggleFormFields(e.target.value);
      });

      document.getElementById('addInstitution')?.addEventListener('click', () => {
        const districtName = document.getElementById('regionName')?.textContent;
        const districtId = districtName ? this.map.districtIdMap[districtName] : null;
        const baseUrl = '/institution/new/';
        window.location.href = districtId ? `${baseUrl}?district_id=${districtId}` : baseUrl;
      });
    }
  }