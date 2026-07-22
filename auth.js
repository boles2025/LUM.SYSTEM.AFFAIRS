// ============================
// SYSTEM AUTH - Shared Module (FINAL FIXED)
// ============================
// Main DB (dent-35a17): employees, activityLog, all data
// Permissions DB (loutsresults): list of available systems
// Fix: Permissions save and checkboxes persist after refresh & save
// Feature: Password change for employee & admin

const MAIN_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBajCZMATK21mgaEFcccyhLne4pgdaxMfk",
  authDomain: "dent-35a17.firebaseapp.com",
  databaseURL: "https://dent-35a17-default-rtdb.firebaseio.com",
  projectId: "dent-35a17",
  storageBucket: "dent-35a17.firebasestorage.app",
  messagingSenderId: "416163754700",
  appId: "1:416163754700:web:dec496619e3e6fff3e0869"
};

const PERMISSIONS_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAbYhhg5eL94AUE5BwV4xv6jbFU98QZbdQ",
  authDomain: "loutsresults.firebaseapp.com",
  databaseURL: "https://loutsresults-default-rtdb.firebaseio.com",
  projectId: "loutsresults",
  storageBucket: "loutsresults.firebasestorage.app",
  messagingSenderId: "801603969666",
  appId: "1:801603969666:web:e6d45a7a6819022bc10a9b"
};

let AUTH_DB = null, WITHDRAWAL_DB = null, SRC_DB = null, PERMISSIONS_DB = null, AUTH_IS_OFFLINE = false;

try {
  if (typeof firebase !== 'undefined') {
    // Main app (dent-35a17) for employees and data
    let mainApp = null;
    try { mainApp = firebase.app(); } catch (e) {}
    if (!mainApp) mainApp = firebase.initializeApp(MAIN_FIREBASE_CONFIG);
    if (mainApp.auth) mainApp.auth().signInAnonymously().catch(() => {});
    AUTH_DB = firebase.database(mainApp);
    WITHDRAWAL_DB = AUTH_DB;
    SRC_DB = AUTH_DB;

    // Permissions app (loutsresults) for system access list only
    let permApp = null;
    try { permApp = firebase.app('permissionsApp'); } catch (e) {}
    if (!permApp) permApp = firebase.initializeApp(PERMISSIONS_FIREBASE_CONFIG, 'permissionsApp');
    PERMISSIONS_DB = firebase.database(permApp);

    console.log('[AUTH] Dual Firebase ready (Main: dent-35a17 | Permissions: loutsresults)');
  } else {
    AUTH_IS_OFFLINE = true;
    console.warn('[AUTH] Firebase SDK not loaded. Running offline.');
  }
} catch (e) {
  AUTH_IS_OFFLINE = true;
  console.error('[AUTH] Init error:', e.message);
}

// ========== Permissions Definitions ==========
window.SYSTEM_ACCESS_PERMISSIONS = [
  { id: 'access_file_management', name: 'نظام إدارة الملفات', icon: 'fa-folder-open', color: 'var(--accent-emerald)' },
  { id: 'access_withdrawal', name: 'نظام السحب والإيداع', icon: 'fa-exchange-alt', color: 'var(--accent-blue)' },
  { id: 'access_certificate', name: 'نظام حساب الشهادات', icon: 'fa-certificate', color: 'var(--accent-purple)' },
  { id: 'access_desk_services', name: 'الخدمات المكتبية والمعاملات', icon: 'fa-print', color: 'var(--accent-cyan)' }
];

window.FUNCTIONAL_PERMISSIONS = [
  { id: 'view', name: 'عرض البيانات الأساسية' },
  { id: 'create', name: 'إنشاء/إضافة بيانات' },
  { id: 'edit', name: 'تعديل البيانات' },
  { id: 'delete', name: 'حذف البيانات' },
  { id: 'manage_employees', name: 'إدارة الموظفين' },
  { id: 'manage_settings', name: 'إدارة إعدادات النظام' },
  { id: 'view_logs', name: 'استعراض السجلات' },
  { id: 'manage_delivery', name: 'إدارة التسليمات (سحب/إيداع)' },
  { id: 'upload_files', name: 'رفع الملفات المجمعة' }
];

window.ALL_PERMISSIONS = window.FUNCTIONAL_PERMISSIONS.concat(window.SYSTEM_ACCESS_PERMISSIONS);

window.DEFAULT_EMPLOYEE_PERMISSIONS = [
  'view','create','edit','delete','view_logs','manage_delivery','upload_files',
  'access_file_management','access_withdrawal','access_certificate','access_desk_services'
];

window.ADMIN_FIXED_PERMISSIONS = [
  'view','create','edit','delete','manage_employees','manage_settings','view_logs',
  'manage_delivery','upload_files',
  'access_file_management','access_withdrawal','access_certificate','access_desk_services'
];

// ========== Auth Constants ==========
const AUTH_SESSION_KEY = 'lotus_auth_session';
let AUTH_CURRENT_USER = null;

const AUTH_ROLE_NAMES = {
  'admin': 'مدير النظام',
  'employee': 'موظف',
  'viewer': 'مشاهد'
};

const AUTH_ROLE_PERMISSIONS = {
  'admin': [...window.ADMIN_FIXED_PERMISSIONS],
  'employee': [...window.DEFAULT_EMPLOYEE_PERMISSIONS],
  'viewer': ['view', 'view_logs']
};

// ========== Helper: Timeout ==========
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

// ========== Password Hash ==========
function authHashPassword(pw) {
  if (!pw) return '';
  let hash = 0;
  for (let i = 0; i < pw.length; i++) {
    hash = ((hash << 5) - hash) + pw.charCodeAt(i);
    hash = hash & hash;
  }
  return 'h' + Math.abs(hash).toString(36);
}

// ========== Session Management ==========
function authGetSession() {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY) || localStorage.getItem('lotus_session') || localStorage.getItem('auth_session');
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.username || !s.role) return null;
    if (Date.now() - (s.loginTime || 0) > 28800000) {
      authClearSession();
      return null;
    }
    if (s.username === 'boles') {
      s.role = 'admin';
      s.permissions = [...window.ADMIN_FIXED_PERMISSIONS];
    }
    try {
      const jsonStr = JSON.stringify(s);
      localStorage.setItem(AUTH_SESSION_KEY, jsonStr);
      localStorage.setItem('lotus_session', jsonStr);
      localStorage.setItem('auth_session', jsonStr);
    } catch(e) {}
    return s;
  } catch (e) { return null; }
}

function authSetSession(user) {
  const session = {
    username: user.username,
    name: user.name,
    role: user.role,
    loginTime: Date.now(),
    employeeId: user.employeeId || user.username
  };
  if (user.permissions !== undefined && user.permissions !== null) {
    session.permissions = Array.isArray(user.permissions) ? [...user.permissions] : authNormalizePermissions(user.permissions);
  } else {
    session.permissions = [...(AUTH_ROLE_PERMISSIONS[user.role] || [])];
  }
  const jsonStr = JSON.stringify(session);
  localStorage.setItem(AUTH_SESSION_KEY, jsonStr);
  localStorage.setItem('lotus_session', jsonStr);
  localStorage.setItem('auth_session', jsonStr);
  AUTH_CURRENT_USER = session;
}

function authClearSession() {
  localStorage.removeItem(AUTH_SESSION_KEY);
  localStorage.removeItem('lotus_session');
  localStorage.removeItem('auth_session');
  AUTH_CURRENT_USER = null;
}

// ========== Permission Normalization (always returns clean array) ==========
function authNormalizePermissions(perms) {
  if (!perms) return [];
  if (Array.isArray(perms)) {
    return perms.filter(p => typeof p === 'string' && p.length > 0);
  }
  if (typeof perms === 'object') {
    // case: {0: "view", 1: "create"}
    const arr = Object.values(perms).filter(v => typeof v === 'string' && v.length > 0);
    if (arr.length > 0) return arr;
    // case: {view: true, create: false}
    const boolArr = [];
    for (const key of Object.keys(perms)) {
      if (perms[key] === true || perms[key] === 'true') boolArr.push(key);
    }
    return boolArr;
  }
  return [];
}

function authHasPermission(action) {
  const user = AUTH_CURRENT_USER || authGetSession();
  if (!user) return false;
  AUTH_CURRENT_USER = user;
  
  const username = (user.username || '').trim().toLowerCase();

  // Admin has full access to all systems and features
  if (username === 'boles' || user.role === 'admin') return true;

  // Employee Omar has access ONLY to certificate calculation system
  if (username === 'omar') {
    if (action === 'access_certificate' || action === 'view' || action === 'create' || action === 'edit') return true;
    if (action.startsWith('access_')) return false;
  }

  // All other employees have access to all 4 main systems by default
  if (action === 'access_file_management' || action === 'access_withdrawal' || action === 'access_certificate' || action === 'access_desk_services') {
    return true;
  }

  if (user.permissions && Array.isArray(user.permissions)) {
    return user.permissions.includes(action);
  }
  const norm = authNormalizePermissions(user.permissions);
  if (norm.length > 0) return norm.includes(action);
  const perms = AUTH_ROLE_PERMISSIONS[user.role];
  return perms ? perms.includes(action) : false;
}

// ========== Local Employees (fallback) ==========
function authDeduplicateLocalEmployees() {
  try {
    const raw = localStorage.getItem('lotus_employees');
    if (!raw) return [];
    let list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const deduped = [];
    for (const emp of list) {
      if (!emp || !emp.username) continue;
      const uKey = emp.username.trim().toLowerCase();
      if (seen.has(uKey)) continue;
      seen.add(uKey);
      emp.username = uKey;
      if (emp.username === 'boles') {
        emp.role = 'admin';
        emp.permissions = [...window.ADMIN_FIXED_PERMISSIONS];
        emp.active = true;
      }
      deduped.push(emp);
    }
    if (deduped.length !== list.length) localStorage.setItem('lotus_employees', JSON.stringify(deduped));
    return deduped;
  } catch (e) { return []; }
}

function authSaveLocalEmployees(emps) {
  const seen = new Set();
  const deduped = [];
  for (const emp of emps) {
    if (!emp || !emp.username) continue;
    const uKey = emp.username.trim().toLowerCase();
    if (seen.has(uKey)) continue;
    seen.add(uKey);
    emp.username = uKey;
    if (emp.username === 'boles') {
      emp.role = 'admin';
      emp.permissions = [...window.ADMIN_FIXED_PERMISSIONS];
      emp.active = true;
    }
    deduped.push(emp);
  }
  localStorage.setItem('lotus_employees', JSON.stringify(deduped));
}

// ========== Firebase Employees (loutsresults PERMISSIONS_DB) ==========
async function authLoadEmployeesFromFirebase() {
  if (AUTH_IS_OFFLINE) return null;
  const targetDb = PERMISSIONS_DB || AUTH_DB;
  if (!targetDb) return null;
  try {
    const snap = await withTimeout(targetDb.ref('employees').once('value'), 5000);
    if (!snap.exists()) return null;
    const data = snap.val();
    if (!data || typeof data !== 'object') return null;

    const firebaseEmployees = [];
    for (const k of Object.keys(data)) {
      const d = data[k];
      if (!d || !d.username) continue;
      const uKey = d.username.trim().toLowerCase();
      let perms = d.permissions !== undefined && d.permissions !== null
        ? authNormalizePermissions(d.permissions)
        : [...(AUTH_ROLE_PERMISSIONS[d.role || 'employee'] || [])];
      
      const emp = {
        username: uKey,
        name: d.name || '',
        password: d.password || '',
        plainPassword: d.plainPassword || '',
        role: d.role || 'employee',
        active: d.active !== false,
        permissions: perms,   // clean array
        employeeId: d.employeeId || uKey,
        createdAt: d.createdAt || new Date().toISOString()
      };
      if (emp.username === 'boles') {
        emp.role = 'admin';
        emp.permissions = [...window.ADMIN_FIXED_PERMISSIONS];
        emp.active = true;
      }
      firebaseEmployees.push(emp);
    }
    if (firebaseEmployees.length > 0) authSaveLocalEmployees(firebaseEmployees);
    return firebaseEmployees;
  } catch (e) {
    console.warn('[AUTH] Load employees error:', e.message);
    return null;
  }
}

async function authGetAllEmployees() {
  let list = [];
  if (!AUTH_IS_OFFLINE) {
    const fb = await authLoadEmployeesFromFirebase();
    if (fb && fb.length > 0) list = fb;
  }
  if (list.length === 0) list = authDeduplicateLocalEmployees();

  const seen = new Set();
  const deduped = [];
  for (const emp of list) {
    if (!emp || !emp.username) continue;
    const uKey = emp.username.trim().toLowerCase();
    if (seen.has(uKey)) continue;
    seen.add(uKey);
    emp.username = uKey;
    if (emp.username === 'boles') {
      emp.role = 'admin';
      emp.permissions = [...window.ADMIN_FIXED_PERMISSIONS];
      emp.active = true;
    }
    deduped.push(emp);
  }
  const deleted = JSON.parse(localStorage.getItem('lotus_deleted_employees') || '[]')
    .map(x => (x || '').trim().toLowerCase());
  return deduped.filter(e => !deleted.includes(e.username));
}

// ========== Save / Delete Employee (Primary: PERMISSIONS_DB) ==========
async function authSaveEmployeeToDb(emp) {
  if (!emp || !emp.username) return;
  const key = emp.username.replace(/[.#$\/\[\]]/g, '_');
  if (emp.username === 'boles') {
    emp.role = 'admin';
    emp.permissions = [...window.ADMIN_FIXED_PERMISSIONS];
    emp.active = true;
  }
  let perms = [];
  if (emp.permissions !== undefined && emp.permissions !== null) {
    perms = authNormalizePermissions(emp.permissions);
  }
  if (perms.length === 0 && emp.role) {
    perms = [...(AUTH_ROLE_PERMISSIONS[emp.role] || [])];
  }
  const empData = {
    username: emp.username,
    name: emp.name || '',
    password: emp.password || '',
    plainPassword: emp.plainPassword || '',
    role: emp.role || 'employee',
    active: emp.active !== false,
    permissions: perms,
    employeeId: emp.employeeId || emp.username,
    createdAt: emp.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // 1. Save to PERMISSIONS_DB (loutsresults)
  if (!AUTH_IS_OFFLINE && PERMISSIONS_DB) {
    try {
      await withTimeout(PERMISSIONS_DB.ref('employees/' + key).set(empData), 5000);
    } catch (e) {
      console.warn('[AUTH] Save to PERMISSIONS_DB failed:', e.message);
    }
  }
  // 2. Save to AUTH_DB (dent-35a17) as secondary backup
  if (!AUTH_IS_OFFLINE && AUTH_DB && AUTH_DB !== PERMISSIONS_DB) {
    try {
      await withTimeout(AUTH_DB.ref('employees/' + key).set(empData), 5000);
    } catch (e) {}
  }

  // Update local copy
  let local = authDeduplicateLocalEmployees();
  const idx = local.findIndex(e => e.username === emp.username);
  if (idx >= 0) local[idx] = { ...local[idx], ...empData };
  else local.push(empData);
  authSaveLocalEmployees(local);

  // Update active session if same user
  const curSession = authGetSession();
  if (curSession && curSession.username === emp.username) {
    authSetSession({ ...curSession, ...empData });
  }

  // Remove from deleted list if present
  const deleted = JSON.parse(localStorage.getItem('lotus_deleted_employees') || '[]');
  const dIdx = deleted.indexOf(emp.username);
  if (dIdx >= 0) deleted.splice(dIdx, 1);
  localStorage.setItem('lotus_deleted_employees', JSON.stringify(deleted));
  localStorage.setItem('lotus_system_modified', 'true');

  // Dispatch event to notify UI about permission update
  window.dispatchEvent(new CustomEvent('permissionsUpdated', { detail: { username: emp.username, permissions: perms } }));
  return true;
}

async function authDeleteEmployeeFromDb(username) {
  if (!username || username === 'boles') return;
  const key = username.replace(/[.#$\/\[\]]/g, '_');
  if (!AUTH_IS_OFFLINE && PERMISSIONS_DB) {
    try { await withTimeout(PERMISSIONS_DB.ref('employees/' + key).remove(), 3000); } catch (e) {}
  }
  if (!AUTH_IS_OFFLINE && AUTH_DB && AUTH_DB !== PERMISSIONS_DB) {
    try { await withTimeout(AUTH_DB.ref('employees/' + key).remove(), 3000); } catch (e) {}
  }
  const local = authDeduplicateLocalEmployees();
  authSaveLocalEmployees(local.filter(e => e.username !== username));
  const deleted = JSON.parse(localStorage.getItem('lotus_deleted_employees') || '[]');
  if (!deleted.includes(username)) deleted.push(username);
  localStorage.setItem('lotus_deleted_employees', JSON.stringify(deleted));
  localStorage.setItem('lotus_system_modified', 'true');
}

// ========== Password Change ==========
window.changeMyPassword = async function (oldPassword, newPassword) {
  const user = AUTH_CURRENT_USER || authGetSession();
  if (!user) throw new Error('لم يتم تسجيل الدخول');
  const employees = await authGetAllEmployees();
  const emp = employees.find(e => e.username === user.username);
  if (!emp) throw new Error('المستخدم غير موجود');
  if (emp.password && emp.password !== authHashPassword(oldPassword) && emp.plainPassword !== oldPassword) {
    throw new Error('كلمة المرور القديمة غير صحيحة');
  }

  emp.password = authHashPassword(newPassword);
  emp.plainPassword = newPassword;
  await authSaveEmployeeToDb(emp);
  // Update session
  user.password = emp.password;
  user.plainPassword = newPassword;
  authSetSession(user);
  await authLogActivity('change_password', 'user', user.username, user.name, 'تم تغيير كلمة المرور', authDetectSystem());
  return true;
};

window.adminChangePassword = async function (username, newPassword) {
  const user = AUTH_CURRENT_USER || authGetSession();
  if (!user || user.role !== 'admin') throw new Error('صلاحيات غير كافية');
  const employees = await authGetAllEmployees();
  const emp = employees.find(e => e.username === username);
  if (!emp) throw new Error('الموظف غير موجود');

  emp.password = authHashPassword(newPassword);
  emp.plainPassword = newPassword;
  await authSaveEmployeeToDb(emp);
  await authLogActivity('admin_change_password', 'employee', username, emp.name, 'قام المسؤول بتغيير كلمة المرور', authDetectSystem());
  return true;
};

// ========== Activity Log ==========
function authDetectSystem() {
  try {
    const path = window.location.pathname;
    if (path.includes('file-management')) return 'نظام الملفات';
    if (path.includes('file-withdrawal')) return 'نظام السحب';
    if (path.includes('certificate-calc')) return 'حساب الشهادات';
    if (path.includes('permissions')) return 'نظام الصلاحيات';
  } catch (e) {}
  return 'الرئيسية';
}

async function authLogActivity(action, targetType, targetId, targetName, details, system) {
  try {
    const user = AUTH_CURRENT_USER || authGetSession();
    if (user) AUTH_CURRENT_USER = user;
    const entry = {
      action,
      targetType: targetType || 'unknown',
      targetId: targetId || '',
      targetName: targetName || '',
      details: details || '',
      system: system || authDetectSystem(),
      employeeUsername: AUTH_CURRENT_USER ? AUTH_CURRENT_USER.username : 'unknown',
      employeeName: AUTH_CURRENT_USER ? AUTH_CURRENT_USER.name : 'غير معروف',
      timestamp: new Date().toISOString()
    };
    if (!AUTH_IS_OFFLINE && PERMISSIONS_DB) {
      try { await PERMISSIONS_DB.ref('activityLog').push(entry); } catch (e) {}
    }
    if (!AUTH_IS_OFFLINE && AUTH_DB && AUTH_DB !== PERMISSIONS_DB) {
      try { await AUTH_DB.ref('activityLog').push(entry); } catch (e) {}
    }
    const local = JSON.parse(localStorage.getItem('lotus_activity_log') || '[]');
    local.unshift(entry);
    if (local.length > 1000) local.length = 1000;
    localStorage.setItem('lotus_activity_log', JSON.stringify(local));
    if (action !== 'login' && action !== 'logout' && action !== 'access') {
      localStorage.setItem('lotus_system_modified', 'true');
    }
  } catch (e) { console.error('authLogActivity error:', e); }
}

// ==================== SYSTEM ACCESS PERMISSIONS (loutsresults) ====================
window.loadSystemPermissions = async function () {
  if (!PERMISSIONS_DB) return false;
  try {
    const snap = await withTimeout(PERMISSIONS_DB.ref('systemAccessPermissions').once('value'), 3000);
    if (!snap.exists()) return false;
    const data = snap.val();
    if (!data || !data.data || !Array.isArray(data.data)) return false;
    window.SYSTEM_ACCESS_PERMISSIONS = data.data;
    window.ALL_PERMISSIONS = window.FUNCTIONAL_PERMISSIONS.concat(window.SYSTEM_ACCESS_PERMISSIONS);
    window.dispatchEvent(new CustomEvent('systemPermissionsLoaded', { detail: window.SYSTEM_ACCESS_PERMISSIONS }));
    return true;
  } catch (e) { return false; }
};

window.saveSystemAccessPermissions = async function () {
  if (!PERMISSIONS_DB) return false;
  try {
    await withTimeout(PERMISSIONS_DB.ref('systemAccessPermissions').set({
      version: Date.now(),
      lastModified: new Date().toISOString(),
      updatedBy: 'system',
      data: window.SYSTEM_ACCESS_PERMISSIONS
    }), 3000);
    return true;
  } catch (e) { return false; }
};

window.addSystemAccessPermission = async function (id, name, icon, color) {
  if (window.SYSTEM_ACCESS_PERMISSIONS.some(p => p.id === id)) return false;
  window.SYSTEM_ACCESS_PERMISSIONS.push({ id, name, icon, color });
  window.ALL_PERMISSIONS = window.FUNCTIONAL_PERMISSIONS.concat(window.SYSTEM_ACCESS_PERMISSIONS);
  await window.saveSystemAccessPermissions();
  return true;
};

window.removeSystemAccessPermission = async function (id) {
  window.SYSTEM_ACCESS_PERMISSIONS = window.SYSTEM_ACCESS_PERMISSIONS.filter(p => p.id !== id);
  window.ALL_PERMISSIONS = window.FUNCTIONAL_PERMISSIONS.concat(window.SYSTEM_ACCESS_PERMISSIONS);
  await window.saveSystemAccessPermissions();
  return true;
};

// ========== UI Helper: Set checkboxes for an employee (call this whenever you load an employee) ==========
window.renderEmployeePermissions = function (employee) {
  if (!employee) return;
  const perms = authNormalizePermissions(employee.permissions);
  document.querySelectorAll('.emp-perm-checkbox').forEach(cb => {
    const permId = cb.getAttribute('data-perm-id');
    if (permId) {
      cb.checked = perms.includes(permId);
    }
  });
};

// ========== LOGIN MODAL ==========
window.LOGIN_MODAL_OPEN = false;

window.openLoginModal = function () {
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

window.closeLoginModal = function () {
  const modal = document.getElementById('login-modal');
  if (modal) modal.classList.remove('active');
  window.LOGIN_MODAL_OPEN = false;
};

window.submitLogin = async function () {
  const usernameEl = document.getElementById('login-username');
  const passwordEl = document.getElementById('login-password');
  const username = usernameEl ? usernameEl.value.trim() : '';
  const password = passwordEl ? passwordEl.value.trim() : '';
  const errEl = document.getElementById('login-error');

  if (!username || !password) {
    if (errEl) { errEl.textContent = 'يرجى إدخال اسم المستخدم وكلمة المرور'; errEl.style.display = 'block'; }
    return;
  }
  if (errEl) errEl.style.display = 'none';

  try {
    let emp = null;
    const hashedInput = authHashPassword(password);
    const primaryDb = PERMISSIONS_DB || AUTH_DB;

    // Try PERMISSIONS_DB
    if (!AUTH_IS_OFFLINE && primaryDb) {
      try {
        const snap = await withTimeout(primaryDb.ref('employees/' + username.replace(/[.#$\/\[\]]/g, '_')).once('value'), 5000);
        if (snap.exists()) {
          const data = snap.val();
          if ((data.password === hashedInput || data.plainPassword === password) && data.active !== false) {
            let perms = authNormalizePermissions(data.permissions);
            if (perms.length === 0 && data.role) perms = [...(AUTH_ROLE_PERMISSIONS[data.role] || [])];
            emp = { username, name: data.name, role: data.role, employeeId: data.employeeId || username, permissions: perms, password: data.password, plainPassword: data.plainPassword || password };
          }
        }
      } catch (fbErr) {}
    }

    // Fallback local
    if (!emp) {
      const local = authDeduplicateLocalEmployees();
      const match = local.find(e => e.username === username && (e.password === hashedInput || e.plainPassword === password) && e.active !== false);
      if (match) {
        let perms = authNormalizePermissions(match.permissions);
        if (perms.length === 0 && match.role) perms = [...(AUTH_ROLE_PERMISSIONS[match.role] || [])];
        emp = { username: match.username, name: match.name, role: match.role, employeeId: match.employeeId || match.username, permissions: perms, password: match.password, plainPassword: match.plainPassword || password };
      }
    }

    if (emp) {
      if (emp.username === 'boles') { emp.role = 'admin'; emp.permissions = [...window.ADMIN_FIXED_PERMISSIONS]; }
      authSetSession(emp);
      await authLogActivity('login', 'system', emp.username, emp.name, '');
      window.closeLoginModal();
      if (window.AUTH_ON_LOGIN_CALLBACK) window.AUTH_ON_LOGIN_CALLBACK(emp);
    } else {
      if (errEl) { errEl.textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة'; errEl.style.display = 'block'; }
      if (passwordEl) { passwordEl.value = ''; passwordEl.focus(); }
    }
  } catch (e) {
    if (errEl) { errEl.textContent = 'خطأ: ' + e.message; errEl.style.display = 'block'; }
    if (passwordEl) { passwordEl.value = ''; passwordEl.focus(); }
  }
};

window.logoutUser = function () {
  if (AUTH_CURRENT_USER) authLogActivity('logout', 'system', AUTH_CURRENT_USER.username, AUTH_CURRENT_USER.name, '');
  authClearSession();
  if (window.AUTH_ON_LOGOUT_CALLBACK) window.AUTH_ON_LOGOUT_CALLBACK();
};

// ========== Expose Globals ==========
window.getCurrentUser = () => AUTH_CURRENT_USER || authGetSession();
window.hasPermission = authHasPermission;
window.authNormalizePermissions = authNormalizePermissions;
window.authGetAllEmployees = authGetAllEmployees;
window.authSaveEmployeeToDb = authSaveEmployeeToDb;
window.authDeleteEmployeeFromDb = authDeleteEmployeeFromDb;
window.authHashPassword = authHashPassword;
window.authLogActivity = authLogActivity;
window.AUTH_ROLE_NAMES = AUTH_ROLE_NAMES;
window.AUTH_ROLE_PERMISSIONS = AUTH_ROLE_PERMISSIONS;
window.AUTH_DB = AUTH_DB;
window.WITHDRAWAL_DB = WITHDRAWAL_DB;
window.AUTH_IS_OFFLINE = AUTH_IS_OFFLINE;
window.PERMISSIONS_DB = PERMISSIONS_DB;

// ========== Session Init ==========
AUTH_CURRENT_USER = authGetSession();

// ========== One-time Seed (Primary: PERMISSIONS_DB) ==========
let _seedDone = false;
(async function seedIfEmpty() {
  if (_seedDone || AUTH_IS_OFFLINE) return;
  const targetDb = PERMISSIONS_DB || AUTH_DB;
  if (!targetDb) return;
  try {
    const snap = await withTimeout(targetDb.ref('employees').once('value'), 5000).catch(() => null);
    if (snap && snap.exists() && snap.val() && Object.keys(snap.val()).length > 0) {
      _seedDone = true;
      return;
    }
    const hash8520 = authHashPassword('8520');
    const hash123456 = authHashPassword('123456');
    const now = new Date().toISOString();
    const seedData = {
      boles: { username:'boles', name:'مهندس بولس سمير', password:hash8520, plainPassword:'8520', role:'admin', permissions:[...window.ADMIN_FIXED_PERMISSIONS], active:true, createdAt:now, employeeId:'boles' },
      somya: { username:'somya', name:'د. سمية', password:hash123456, plainPassword:'123456', role:'admin', permissions:[...window.ADMIN_FIXED_PERMISSIONS], active:true, createdAt:now, employeeId:'somya' },
      safy: { username:'safy', name:'د صافي', password:hash123456, plainPassword:'123456', role:'employee', permissions:[...window.DEFAULT_EMPLOYEE_PERMISSIONS], active:true, createdAt:now, employeeId:'safy' },
      mai: { username:'mai', name:'د. مي', password:hash123456, plainPassword:'123456', role:'employee', permissions:[...window.DEFAULT_EMPLOYEE_PERMISSIONS], active:true, createdAt:now, employeeId:'mai' },
      monica: { username:'monica', name:'أ. مونيكا', password:hash123456, plainPassword:'123456', role:'employee', permissions:[...window.DEFAULT_EMPLOYEE_PERMISSIONS], active:true, createdAt:now, employeeId:'monica' },
      ahmed: { username:'ahmed', name:'أ. أحمد', password:hash123456, plainPassword:'123456', role:'employee', permissions:[...window.DEFAULT_EMPLOYEE_PERMISSIONS], active:true, createdAt:now, employeeId:'ahmed' },
      mahmod: { username:'mahmod', name:'أ. محمود', password:hash123456, plainPassword:'123456', role:'employee', permissions:[...window.DEFAULT_EMPLOYEE_PERMISSIONS], active:true, createdAt:now, employeeId:'mahmod' },
      peter: { username:'peter', name:'أ. بيتر', password:hash123456, plainPassword:'123456', role:'employee', permissions:[...window.DEFAULT_EMPLOYEE_PERMISSIONS], active:true, createdAt:now, employeeId:'peter' },
      omar: { username:'omar', name:'عمر', password:hash123456, plainPassword:'123456', role:'employee', permissions:['view','access_certificate'], active:true, createdAt:now, employeeId:'omar' }
    };
    // Save to localStorage FIRST so offline/fallback login always works
    authSaveLocalEmployees(Object.values(seedData));
    _seedDone = true;
    try {
      await targetDb.ref('employees').set(seedData);
      if (AUTH_DB && AUTH_DB !== targetDb) {
        try { await AUTH_DB.ref('employees').set(seedData); } catch(e) {}
      }
      console.log('[AUTH] Seed completed on PERMISSIONS_DB (loutsresults)');
    } catch (e) { console.warn('[AUTH] Seed Firebase write skipped:', e.message); }
  } catch (e) { console.warn('[AUTH] Seed skipped:', e.message); }
})();

// Auto-load system permissions from loutsresults
if (!AUTH_IS_OFFLINE && PERMISSIONS_DB) window.loadSystemPermissions();

console.log('[AUTH] ✅ Module fully loaded and ready');

/*
   ================== USAGE INSTRUCTIONS ==================
   1. Include this script before any other app logic.
   2. To edit employee permissions:
      a. Fetch employee: const emp = (await authGetAllEmployees()).find(e => e.username === username);
      b. Render checkboxes: window.renderEmployeePermissions(emp);
         (Make sure checkboxes have class "emp-perm-checkbox" and attribute "data-perm-id" with the permission id.)
      c. When saving, gather checked ids:
         const selected = [];
         document.querySelectorAll('.emp-perm-checkbox:checked').forEach(cb => selected.push(cb.dataset.permId));
         emp.permissions = selected;
         await authSaveEmployeeToDb(emp);
      d. Checkboxes will stay checked because renderEmployeePermissions sets them from emp.permissions.
   3. Password change:
      - Employee self: await changeMyPassword(oldPass, newPass);
      - Admin resets: await adminChangePassword(targetUsername, newPass);
   4. System permissions list (admin side) is automatically loaded from loutsresults.
*/
