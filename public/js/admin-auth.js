// ============================================================
// admin-auth.js — Авторизация: проверка сессии, вход, выход,
//                 отображение/скрытие панели администратора
// ============================================================

Object.assign(AdminManager.prototype, {
    activeAuthRole: "portal",

    showLoginError(message) {
      const errorNode = document.getElementById("loginErrorMessage");
      if (!errorNode) return;
      errorNode.textContent = message || "Ошибка входа";
      errorNode.classList.remove("hidden");
    },

    clearLoginError() {
      const errorNode = document.getElementById("loginErrorMessage");
      if (!errorNode) return;
      errorNode.textContent = "";
      errorNode.classList.add("hidden");
    },

    showRegisterError(message) {
      const errorNode = document.getElementById("registerErrorMessage");
      if (!errorNode) return;
      errorNode.textContent = message || "Ошибка регистрации";
      errorNode.classList.remove("hidden");
    },

    clearRegisterError() {
      const errorNode = document.getElementById("registerErrorMessage");
      if (!errorNode) return;
      errorNode.textContent = "";
      errorNode.classList.add("hidden");
    },

    setAuthRole(role) {
      this.activeAuthRole = role === "admin" ? "admin" : "portal";
      const userBtn = document.getElementById("authRoleUser");
      const adminBtn = document.getElementById("authRoleAdmin");
      const title = document.getElementById("authModalTitle");
      const label = document.getElementById("authLoginLabel");
      const loginInput = document.getElementById("adminLoginInput");
      if (userBtn && adminBtn) {
        userBtn.classList.toggle("active", this.activeAuthRole === "portal");
        adminBtn.classList.toggle("active", this.activeAuthRole === "admin");
      }
      if (title) {
        title.textContent = this.activeAuthRole === "admin" ? "Вход администратора" : "Вход для пользователей";
      }
      if (label) {
        label.textContent = this.activeAuthRole === "admin" ? "Email администратора" : "Логин или Email";
      }
      if (loginInput) {
        loginInput.placeholder = this.activeAuthRole === "admin" ? "Введите email администратора" : "Введите email";
      }
      this.clearLoginError();
    },

    async checkSession() {
      try {
        const response = await fetch('/api/check_session.php');
        const data = await response.json();
        if (data.loggedIn) {
          this.map.isAdmin = true;
          this.showAdminPanel();
          if (!document.getElementById("districtModal")?.classList.contains("hidden")) {
            const districtName = document.getElementById("regionName")?.textContent;
            await this.map.loadInstitutionsForDistrict(districtName);
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
      }
    },
  
    showLoginModal() {
      this.setAuthRole("portal");
      this.clearLoginError();
      document.getElementById('registerModal')?.classList.add('hidden');
      document.getElementById('loginModal')?.classList.remove('hidden');
    },
  
    hideLoginModal() {
      document.getElementById('loginModal')?.classList.add('hidden');
      document.getElementById('loginForm')?.reset();
      this.clearLoginError();
    },

    showRegisterModal() {
      this.hideLoginModal();
      this.clearRegisterError();
      document.getElementById("registerModal")?.classList.remove("hidden");
    },

    hideRegisterModal() {
      document.getElementById("registerModal")?.classList.add("hidden");
      document.getElementById("registerForm")?.reset();
      this.clearRegisterError();
    },

    showLoginFromRegister() {
      this.hideRegisterModal();
      this.showLoginModal();
    },
  
    async handleLogin(e) {
      e.preventDefault();
      const login = document.getElementById('adminLoginInput').value;
      const password = document.getElementById('adminPassword').value;
      const endpoint = this.activeAuthRole === "admin" ? "/api/login.php" : "/api/login_portal.php";
  
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ login, password })
        });
        const data = await response.json();
        if (data.success) {
          this.map.isAdmin = this.activeAuthRole === "admin";
          if (this.map.isAdmin) this.showAdminPanel();
          else {
            document.getElementById('adminPanel')?.classList.add('hidden');
            document.getElementById('adminLogin')?.classList.remove('hidden');
          }
          this.hideLoginModal();
        } else {
          this.showLoginError('Ошибка входа: ' + (data.error || 'Неизвестная ошибка'));
        }
      } catch (error) {
        console.error('Login error:', error);
        this.showLoginError('Ошибка входа. Проверьте подключение и попробуйте снова.');
      }
    },

    async handlePortalRegister(e) {
      e.preventDefault();
      this.clearRegisterError();
      const fullName = document.getElementById("registerFullName")?.value.trim();
      const email = document.getElementById("registerEmail")?.value.trim();
      const password = document.getElementById("registerPassword")?.value || "";
      const confirm = document.getElementById("registerPasswordConfirm")?.value || "";

      if (!fullName || !email || !password) {
        this.showRegisterError("Заполните все обязательные поля.");
        return;
      }
      if (password !== confirm) {
        this.showRegisterError("Пароли не совпадают.");
        return;
      }

      try {
        const response = await fetch("/api/register_portal_user.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            login: email,
            email: email,
            password: password,
            full_name: fullName,
          }),
        });
        const data = await response.json();
        if (!response.ok || data.error) {
          this.showRegisterError("Ошибка регистрации: " + (data.error || `HTTP ${response.status}`));
          return;
        }
        this.hideRegisterModal();
        this.setAuthRole("portal");
        this.showLoginError("Регистрация успешна. Теперь войдите в аккаунт.");
        document.getElementById("loginModal")?.classList.remove("hidden");
      } catch (error) {
        console.error("Register error:", error);
        this.showRegisterError("Ошибка регистрации. Проверьте подключение и попробуйте снова.");
      }
    },
  
    async handleLogout() {
      try {
        await fetch('/api/logout.php', { method: 'POST' });
        this.map.isAdmin = false;
        document.getElementById('adminPanel')?.classList.add('hidden');
        document.getElementById('adminLogin')?.classList.remove('hidden');
        if (!document.getElementById("districtModal")?.classList.contains("hidden")) {
          const districtName = document.getElementById("regionName")?.textContent;
          await this.map.loadInstitutionsForDistrict(districtName);
        }
      } catch (error) {
        console.error('Logout error:', error);
      }
    },
  
    showAdminPanel() {
      document.getElementById('adminLogin')?.classList.add('hidden');
      document.getElementById('adminPanel')?.classList.remove('hidden');
    },
  
  });