
// Auth session check - DIRECT approach
(function() {
  // Password hash (same algorithm as auth.js)
  function hashPw(pw) { if (!pw) return ''; var h = 0; for (var i = 0; i < pw.length; i++) { h = ((h << 5) - h) + pw.charCodeAt(i); h = h & h; } return 'h' + Math.abs(h).toString(36); }


  function showUserMenu(s) {
    var um = document.getElementById('user-menu');
    if (um) um.style.display = 'flex';
    var av = document.getElementById('user-avatar');
    if (av) av.textContent = (s.username || 'U').charAt(0).toUpperCase();
    var nd = document.getElementById('user-name-display');
    if (nd) nd.textContent = s.name || s.username;
    var badge = document.getElementById('user-role-badge');
    if (badge) { badge.textContent = s.role || 'employee'; badge.className = 'role-badge ' + (s.role || 'employee'); }
    var ec = document.getElementById('employees-card');
    if (ec && s.role === 'admin') ec.style.display = '';
  }

  // Check existing session
  var session = window.getCurrentUser ? window.getCurrentUser() : (function(){ try { return JSON.parse(localStorage.getItem('lotus_session')); } catch(e) { return null; } })();
  if (session && session.username && session.loginTime && Date.now() - session.loginTime < 28800000) {
    showUserMenu(session);
    renderEmps();
  } else {
    localStorage.removeItem('lotus_session');
    // Show login modal
    var modal = document.getElementById('login-modal');
    if (modal) modal.classList.add('active');

    // Direct login handler (overrides auth.js submitLogin for this page)
    var loginBtn = document.getElementById('login-submit-btn');
    if (loginBtn) {
      loginBtn.onclick = function() {
        if (window.submitLogin) {
          window.submitLogin();
        } else {
          // Fallback if auth.js not loaded
          var u = document.getElementById('login-username').value.trim();
          var p = document.getElementById('login-password').value.trim();
          var errEl = document.getElementById('login-error');
          if (!u || !p) { if (errEl) { errEl.textContent = 'يرجى إدخال اسم المستخدم وكلمة المرور'; errEl.style.display = 'block'; } return; }
          if (errEl) errEl.style.display = 'none';
          var emp = null;
          var local = (function(){ try { return JSON.parse(localStorage.getItem('lotus_employees') || '[]'); } catch(e) { return []; } })();
          local.forEach(function(e) { if (e.username === u && e.password === hashPw(p) && e.active !== false) emp = e; });
          if (emp) {
            var s = { username: emp.username, name: emp.name, role: emp.role, loginTime: Date.now() };
            localStorage.setItem('lotus_session', JSON.stringify(s));
            if (modal) modal.classList.remove('active');
            showUserMenu(s);
            renderEmps();
          } else {
            if (errEl) { errEl.textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة'; errEl.style.display = 'block'; }
          }
        }
      };
    }
  }

  // Register login/logout callbacks for auth.js
  window.AUTH_ON_LOGIN_CALLBACK = function(emp) {
    var modal = document.getElementById('login-modal');
    if (modal) modal.classList.remove('active');
    showUserMenu(emp);
    renderEmps();
  };

  window.AUTH_ON_LOGOUT_CALLBACK = function() {
    localStorage.removeItem('lotus_session');
    location.reload();
  };

  document.addEventListener('click', function(e) {
    var dd = document.getElementById('user-dropdown');
    var avatar = document.getElementById('user-avatar');
    if (dd && avatar && !avatar.contains(e.target) && !dd.contains(e.target)) dd.classList.remove('show');
  });
})();

// Employee management
var editingEmp = '';
function renderEmps() {
  if (!window.authGetAllEmployees) return;
  authGetAllEmployees().then(function(list) {
    var tb = document.getElementById('emp-tbody');
    var cnt = document.getElementById('emp-count');
    if (cnt) cnt.textContent = '(' + list.length + ')';
    if (!list.length) { tb.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">لا يوجد موظفين</td></tr>'; return; }
    var curSession = (function(){ try { return JSON.parse(localStorage.getItem('lotus_session')); } catch(e) { return null; } })();
    var html = '';
    list.forEach(function(e) {
      var isSelf = curSession && curSession.username === e.username;
      html += '<tr><td>' + (e.name || e.username) + '</td><td>' + e.username + '</td>' +
        '<td><span class="role-badge ' + (e.role || 'employee') + '">' + ({admin:'مدير',supervisor:'مشرف',employee:'موظف',viewer:'مشاهد'}[e.role] || e.role) + '</span></td>' +
        '<td><div class="action-cell">' +
        '<button class="action-btn edit" onclick="openEmpModal(\'' + e.username + '\')"><i class="fas fa-pen"></i></button>' +
        (isSelf ? '' : '<button class="action-btn delete" onclick="deleteEmp(\'' + e.username + '\')"><i class="fas fa-trash"></i></button>') +
        '</div></td></tr>';
    });
    tb.innerHTML = html;
  });
}
function openEmpModal(username) {
  var err = document.getElementById('emp-modal-error');
  if (err) err.style.display = 'none';
  document.getElementById('emp-name').value = '';
  document.getElementById('emp-username').value = '';
  document.getElementById('emp-username').disabled = false;
  document.getElementById('emp-password').value = '';
  document.getElementById('emp-password').placeholder = 'كلمة المرور';
  document.getElementById('emp-role').value = 'employee';
  editingEmp = '';
  if (username) {
    editingEmp = username;
    authGetAllEmployees().then(function(list) {
      var e = list.find(function(x) { return x.username === username; });
      if (!e) return;
      document.getElementById('emp-modal-title').textContent = 'تعديل موظف';
      document.getElementById('emp-name').value = e.name || '';
      document.getElementById('emp-username').value = e.username || '';
      document.getElementById('emp-username').disabled = true;
      document.getElementById('emp-password').value = '';
      document.getElementById('emp-password').placeholder = 'اتركه فارغاً إن لم ترد التغيير';
      document.getElementById('emp-role').value = e.role || 'employee';
      document.getElementById('emp-modal').classList.add('active');
    });
  } else {
    document.getElementById('emp-modal-title').textContent = 'إضافة موظف جديد';
    document.getElementById('emp-modal').classList.add('active');
  }
}
function closeEmpModal() {
  document.getElementById('emp-modal').classList.remove('active');
  document.getElementById('emp-username').disabled = false;
  document.getElementById('emp-password').placeholder = 'كلمة المرور';
}
function saveEmp() {
  var name = document.getElementById('emp-name').value.trim();
  var username = document.getElementById('emp-username').value.trim();
  var password = document.getElementById('emp-password').value;
  var role = document.getElementById('emp-role').value;
  var err = document.getElementById('emp-modal-error');
  if (!name || !username) {
    if (err) { err.textContent = 'الاسم واسم المستخدم مطلوبان'; err.style.display = 'block'; }
    return;
  }
  if (!editingEmp && (!password || password.length < 3)) {
    if (err) { err.textContent = 'كلمة المرور يجب أن تكون 3 أحرف على الأقل'; err.style.display = 'block'; }
    return;
  }
  if (err) err.style.display = 'none';
  authGetAllEmployees().then(function(list) {
    if (!editingEmp && list.find(function(x) { return x.username === username; })) {
      if (err) { err.textContent = 'اسم المستخدم موجود بالفعل'; err.style.display = 'block'; }
      return;
    }
    var existing = list.find(function(x) { return x.username === (editingEmp || username); });
    var pw = password ? (window.authHashPassword ? window.authHashPassword(password) : (function(){ let h=0; for(var i=0;i<password.length;i++){h=((h<<5)-h)+password.charCodeAt(i);h=h&h;} return 'h'+Math.abs(h).toString(36); })()) : (existing ? existing.password : '');
    var empData = { name: name, username: editingEmp || username, password: pw, role: role, active: true, employeeId: editingEmp || username, createdAt: existing ? existing.createdAt : new Date().toISOString() };
    if (existing) {
      if (existing.permissions) empData.permissions = existing.permissions; // preserve permissions!
      if (existing.plainPassword && !password) empData.plainPassword = existing.plainPassword;
    } else {
      empData.permissions = window.AUTH_ROLE_PERMISSIONS ? (window.AUTH_ROLE_PERMISSIONS[role] || []) : []; // set default permissions!
    }
    if (password) empData.plainPassword = password;

    authSaveEmployeeToDb(empData).then(function() {
      closeEmpModal();
      renderEmps();
      try {
        if (typeof window.authLogActivity === 'function') {
          var action = editingEmp ? 'تعديل' : 'إضافة';
          window.authLogActivity(action, 'موظف', empData.username, empData.name, (editingEmp ? 'تم تعديل بيانات الموظف' : 'تم إضافة موظف جديد'), 'نظام الصلاحيات');
        }
      } catch(e) {}
      try { toast('تم الحفظ'); } catch(e) {}
    });
  });
}
function deleteEmp(username) {
  if (!confirm('حذف الموظف ' + username + '؟')) return;
  authGetAllEmployees().then(function(list) {
    var empName = '';
    var found = list.find(function(e) { return e.username === username; });
    if (found) empName = found.name;
    if (window.authDeleteEmployeeFromDb) {
      window.authDeleteEmployeeFromDb(username).then(function() {
        renderEmps();
        if (typeof window.authLogActivity === 'function') {
          window.authLogActivity('حذف', 'موظف', username, empName || username, 'تم حذف الموظف نهائياً', 'نظام الصلاحيات');
        }
        try { toast('تم الحذف'); } catch(e) {}
      });
    } else {
      // Fallback
      var local = (function(){ try { return JSON.parse(localStorage.getItem('lotus_employees') || '[]'); } catch(e) { return []; } })();
      local = local.filter(function(e) { return e.username !== username; });
      localStorage.setItem('lotus_employees', JSON.stringify(local));
      if (typeof AUTH_DB !== 'undefined' && AUTH_DB) {
        try { AUTH_DB.ref('employees/' + username.replace(/[.#$\/\[\]]/g, '_')).remove(); } catch(e) {}
      }
      renderEmps();
      try { toast('تم الحذف'); } catch(e) {}
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  if (typeof flatpickr !== 'undefined') {
    flatpickr('input[type="date"]', {
      dateFormat: 'd-m-Y',
      locale: 'ar',
      disableMobile: true,
      allowInput: true
    });
  }
});
