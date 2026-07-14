// ============================
// SYSTEM AUTH - Shared Module
// ============================

const AUTH_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAbYhhg5eL94AUE5BwV4xv6jbFU98QZbdQ",
  authDomain: "loutsresults.firebaseapp.com",
  projectId: "loutsresults",
  storageBucket: "loutsresults.firebasestorage.app",
  messagingSenderId: "801603969666",
  appId: "1:801603969666:web:e6d45a7a6819022bc10a9b",
  databaseURL: "https://loutsresults-default-rtdb.firebaseio.com"
};

let AUTH_DB = null, AUTH_IS_OFFLINE = false;
try {
  if (typeof firebase !== 'undefined') {
    let authApp = null;
    try { authApp = firebase.app('_lotus_auth'); } catch (e) { /* doesn't exist yet */ }
    if (!authApp) {
      authApp = firebase.initializeApp(AUTH_FIREBASE_CONFIG, '_lotus_auth');
    }
    AUTH_DB = firebase.database(authApp);
  } else {
    AUTH_IS_OFFLINE = true;
  }
} catch (e) { AUTH_IS_OFFLINE = true; }

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

let AUTH_CURRENT_USER = null;
const AUTH_SESSION_KEY = 'lotus_session';
const AUTH_ROLE_NAMES = { admin: 'مدير', supervisor: 'مشرف', employee: 'موظف', viewer: 'مشاهد' };
const AUTH_ROLE_PERMISSIONS = {
  admin: ['view','create','edit','delete','manage_employees','manage_settings','view_logs','manage_delivery','upload_files'],
  supervisor: ['view','create','edit','delete','manage_settings','view_logs','manage_delivery','upload_files'],
  employee: ['view','upload_files','manage_delivery'],
  viewer: ['view']
};

function authHashPassword(pw) {
  if (!pw) return '';
  let hash = 0;
  for (let i = 0; i < pw.length; i++) { hash = ((hash << 5) - hash) + pw.charCodeAt(i); hash = hash & hash; }
  return 'h' + Math.abs(hash).toString(36);
}

function authGetSession() {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.username || !s.role) return null;
    if (Date.now() - (s.loginTime || 0) > 28800000) { authClearSession(); return null; }
    return s;
  } catch { return null; }
}

function authSetSession(user) {
  const session = { username: user.username, name: user.name, role: user.role, loginTime: Date.now(), employeeId: user.employeeId || user.username };
  if (user.permissions) session.permissions = user.permissions;
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  AUTH_CURRENT_USER = session;
}

function authClearSession() {
  localStorage.removeItem(AUTH_SESSION_KEY);
  AUTH_CURRENT_USER = null;
}

function authHasPermission(action) {
  const user = AUTH_CURRENT_USER || authGetSession();
  if (!user) return false;
  
  // also make sure AUTH_CURRENT_USER is set for future checks
  AUTH_CURRENT_USER = user;

  if (user.permissions && Array.isArray(user.permissions)) {
    return user.permissions.includes(action);
  }
  const perms = AUTH_ROLE_PERMISSIONS[user.role];
  return perms && perms.includes(action);
}

function authGetLocalEmployees() {
  try { return JSON.parse(localStorage.getItem('lotus_employees') || '[]'); } catch { return []; }
}

function authSaveLocalEmployees(emps) {
  localStorage.setItem('lotus_employees', JSON.stringify(emps));
}

async function authGetAllEmployees() {
  const list = [];
  if (!AUTH_IS_OFFLINE && AUTH_DB) {
    try {
      const snap = await withTimeout(AUTH_DB.ref('employees').once('value'), 1500);
      if (snap.exists()) {
        const data = snap.val();
        Object.keys(data).forEach(k => { list.push({ username: k, ...data[k] }); });
      }
    } catch (e) { /* Firebase not available, fall back to local */ }
  }
  const local = authGetLocalEmployees();
  local.forEach(e => { 
    const idx = list.findIndex(x => x.username === e.username);
    if (idx >= 0) list[idx] = e;
    else list.push(e); 
  });
  
  const deleted = JSON.parse(localStorage.getItem('lotus_deleted_employees') || '[]');
  return list.filter(e => !deleted.includes(e.username));
}

async function authCheckHasAnyEmployee() {
  const list = await authGetAllEmployees();
  return list.length > 0;
}

async function authSaveEmployeeToDb(emp) {
  const key = emp.username.replace(/[.#$\/\[\]]/g, '_');
  const empData = {
    name: emp.name, password: emp.password, role: emp.role || 'employee',
    active: emp.active !== false, createdAt: emp.createdAt || new Date().toISOString(),
    employeeId: emp.employeeId || emp.username
  };
  if (emp.plainPassword) empData.plainPassword = emp.plainPassword;
  if (emp.permissions) empData.permissions = emp.permissions;
  if (!AUTH_IS_OFFLINE && AUTH_DB) {
    try { await withTimeout(AUTH_DB.ref('employees/' + key).set(empData), 1000); } catch (e) { /* save locally only */ }
  }
  const local = authGetLocalEmployees();
  const idx = local.findIndex(e => e.username === emp.username);
  if (idx >= 0) local[idx] = { ...local[idx], ...empData };
  else local.push(empData);
  authSaveLocalEmployees(local);

  const deleted = JSON.parse(localStorage.getItem('lotus_deleted_employees') || '[]');
  const dIdx = deleted.indexOf(emp.username);
  if (dIdx >= 0) {
    deleted.splice(dIdx, 1);
    localStorage.setItem('lotus_deleted_employees', JSON.stringify(deleted));
  }
}

async function authDeleteEmployeeFromDb(username) {
  const key = username.replace(/[.#$\/\[\]]/g, '_');
  if (!AUTH_IS_OFFLINE && AUTH_DB) {
    try { await withTimeout(AUTH_DB.ref('employees/' + key).remove(), 1000); } catch (e) { }
  }
  const local = authGetLocalEmployees();
  const filtered = local.filter(e => e.username !== username);
  authSaveLocalEmployees(filtered);
  
  const deleted = JSON.parse(localStorage.getItem('lotus_deleted_employees') || '[]');
  if (!deleted.includes(username)) {
    deleted.push(username);
    localStorage.setItem('lotus_deleted_employees', JSON.stringify(deleted));
  }
}

async function authLogActivity(action, targetType, targetId, targetName, details) {
  try {
    const entry = {
      action, targetType: targetType || 'unknown', targetId: targetId || '',
      targetName: targetName || '', details: details || '',
      employeeUsername: AUTH_CURRENT_USER ? AUTH_CURRENT_USER.username : 'unknown',
      employeeName: AUTH_CURRENT_USER ? AUTH_CURRENT_USER.name : 'غير معروف',
      timestamp: new Date().toISOString()
    };
    if (!AUTH_IS_OFFLINE && AUTH_DB) {
      try { await AUTH_DB.ref('activityLog').push(entry); } catch (e) { }
    }
    const local = JSON.parse(localStorage.getItem('lotus_activity_log') || '[]');
    local.unshift(entry);
    if (local.length > 1000) local.length = 1000;
    localStorage.setItem('lotus_activity_log', JSON.stringify(local));
  } catch (e) { console.error('authLogActivity error:', e); }
}

// ============================
// SYSTEM-WIDE AUTH FUNCTIONS
// ============================

window.LOGIN_MODAL_OPEN = false;

window.openLoginModal = function() {
  const errEl = document.getElementById('login-error');
  if (errEl) errEl.style.display = 'none';
  const u = document.getElementById('login-username');
  const p = document.getElementById('login-password');
  if (u) u.value = '';
  if (p) p.value = '';
  const modal = document.getElementById('login-modal');
  if (modal) modal.classList.add('active');
  window.LOGIN_MODAL_OPEN = true;
  setTimeout(() => { if (u) u.focus(); }, 100);
};

window.closeLoginModal = function() {
  const modal = document.getElementById('login-modal');
  if (modal) modal.classList.remove('active');
  window.LOGIN_MODAL_OPEN = false;
};

window.submitLogin = async function() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const errEl = document.getElementById('login-error');
  if (!username || !password) {
    if (errEl) { errEl.textContent = 'يرجى إدخال اسم المستخدم وكلمة المرور'; errEl.style.display = 'block'; }
    return;
  }
  if (errEl) errEl.style.display = 'none';
  
  try {
    let emp = null;
    // Check localStorage first (fast, always works)
    const local = authGetLocalEmployees();
    const localData = local.find(e => e.username === username && e.password === authHashPassword(password) && e.active !== false);
    if (localData) {
      emp = { username: localData.username, name: localData.name, role: localData.role, employeeId: localData.employeeId || localData.username, permissions: localData.permissions };
    }
    // If not found in localStorage, try Firebase
    if (!emp && !AUTH_IS_OFFLINE && AUTH_DB) {
      try {
        const snap = await withTimeout(AUTH_DB.ref('employees/' + username.replace(/[.#$\/\[\]]/g, '_')).once('value'), 1500);
        const data = snap.val();
        if (data && data.password === authHashPassword(password) && data.active !== false) {
          emp = { username, name: data.name, role: data.role, employeeId: data.employeeId || username, permissions: data.permissions };
        }
      } catch (fbErr) { /* Firebase not available */ }
    }
    
    // First-time setup: default admin
    if (!emp) {
      const hasEmps = await authCheckHasAnyEmployee();
      if (!hasEmps && username === 'admin' && password === 'admin') {
        emp = { username: 'admin', name: 'مدير النظام', role: 'admin', employeeId: 'admin' };
        await authSaveEmployeeToDb({ username: 'admin', name: 'مدير النظام', password: authHashPassword('admin'), role: 'admin', active: true, createdAt: new Date().toISOString(), employeeId: 'admin' });
      } else {
        if (errEl) { errEl.textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة'; errEl.style.display = 'block'; }
        return;
      }
    }
    
    authSetSession(emp);
    await authLogActivity('login', 'system', emp.username, emp.name, '');
    window.closeLoginModal();
    if (window.AUTH_ON_LOGIN_CALLBACK) window.AUTH_ON_LOGIN_CALLBACK(emp);
  } catch (e) {
    if (errEl) { errEl.textContent = 'خطأ: ' + e.message; errEl.style.display = 'block'; }
  }
};

window.logoutUser = function() {
  if (AUTH_CURRENT_USER) {
    authLogActivity('logout', 'system', AUTH_CURRENT_USER.username, AUTH_CURRENT_USER.name, '');
  }
  authClearSession();
  if (window.AUTH_ON_LOGOUT_CALLBACK) window.AUTH_ON_LOGOUT_CALLBACK();
};

window.getCurrentUser = function() { return AUTH_CURRENT_USER || authGetSession(); };
window.hasPermission = authHasPermission;
window.authGetAllEmployees = authGetAllEmployees;
window.authSaveEmployeeToDb = authSaveEmployeeToDb;
window.authDeleteEmployeeFromDb = authDeleteEmployeeFromDb;
window.authHashPassword = authHashPassword;
window.AUTH_ROLE_PERMISSIONS = AUTH_ROLE_PERMISSIONS;

// ============================
// AUTO-SEED EMPLOYEES
// ============================
(function() {
  var hash8520 = (function(){ let h=0; '8520'.split('').forEach(function(c){h=((h<<5)-h)+c.charCodeAt(0);h=h&h;}); return 'h'+Math.abs(h).toString(36); })();
  var hash123456 = (function(){ let h=0; '123456'.split('').forEach(function(c){h=((h<<5)-h)+c.charCodeAt(0);h=h&h;}); return 'h'+Math.abs(h).toString(36); })();
  var now = new Date().toISOString();
  var allPerms = ['view','create','edit','delete','manage_employees','manage_settings','view_logs','manage_delivery','upload_files'];
  var employees = [
    { username: 'boles', name: 'مهندس بولس سمير', password: hash8520, role: 'admin', permissions: allPerms, active: true, createdAt: now, employeeId: 'boles' },
    { username: 'somya', name: 'د. سمية', password: hash8520, role: 'admin', active: true, createdAt: now, employeeId: 'somya' },
    { username: 'safy', name: 'صفاء', password: hash123456, role: 'employee', active: true, createdAt: now, employeeId: 'safy' },
    { username: 'mai', name: 'مي', password: hash123456, role: 'employee', active: true, createdAt: now, employeeId: 'mai' },
    { username: 'monica', name: 'مونيكا', password: hash123456, role: 'employee', active: true, createdAt: now, employeeId: 'monica' },
    { username: 'ahmed', name: 'أحمد', password: hash123456, role: 'employee', active: true, createdAt: now, employeeId: 'ahmed' },
    { username: 'mahmod', name: 'محمود', password: hash123456, role: 'employee', active: true, createdAt: now, employeeId: 'mahmod' },
    { username: 'peter', name: 'بيتر', password: hash123456, role: 'employee', active: true, createdAt: now, employeeId: 'peter' }
  ];
  // Only override if not exists or if we need to ensure these are present
  var existingStr = localStorage.getItem('lotus_employees');
  var existing = existingStr ? JSON.parse(existingStr) : [];
  var seeded = localStorage.getItem('lotus_seed_done');
  
  if (!seeded) {
    employees.forEach(function(emp) {
      var ex = existing.find(function(e) { return e.username === emp.username; });
      if (!ex) {
        existing.push(emp);
      }
    });
    localStorage.setItem('lotus_seed_done', 'true');
  }

  // Ensure boles exists (so the admin isn't permanently deleted)
  var bolesEx = existing.find(function(e) { return e.username === 'boles'; });
  if (!bolesEx) {
    existing.push(employees[0]); // boles is index 0
  }

  localStorage.setItem('lotus_employees', JSON.stringify(existing));
})();
