






// ============================
// ✅ PERMISSIONS SYSTEM
// ============================

// الصلاحيات الوظيفية
var FUNCTIONAL_PERMISSIONS = [
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

// صلاحيات الوصول للأنظمة
var SYSTEM_ACCESS_PERMISSIONS = [
    { id: 'access_file_management', name: 'نظام إدارة الملفات', icon: 'fa-folder-open', color: 'var(--accent-emerald)' },
    { id: 'access_withdrawal', name: 'نظام السحب والإيداع', icon: 'fa-exchange-alt', color: 'var(--accent-blue)' },
    { id: 'access_certificate', name: 'نظام حساب الشهادات', icon: 'fa-certificate', color: 'var(--accent-purple)' },
    { id: 'access_desk_services', name: 'الخدمات المكتبية والمعاملات', icon: 'fa-print', color: 'var(--accent-cyan)' }
];

// كل الصلاحيات
var ALL_PERMISSIONS = FUNCTIONAL_PERMISSIONS.concat(SYSTEM_ACCESS_PERMISSIONS);

// صلاحيات الأدمن الكاملة
var ADMIN_FIXED_PERMISSIONS = [
    'view', 'create', 'edit', 'delete', 
    'manage_employees', 'manage_settings', 'view_logs', 
    'manage_delivery', 'upload_files',
    'access_file_management', 'access_withdrawal', 'access_certificate',
    'access_desk_services'
];

// الصلاحيات الافتراضية للموظف
var DEFAULT_EMPLOYEE_PERMISSIONS = [
    'view', 'upload_files', 'manage_delivery',
    'access_file_management', 'access_certificate', 'access_desk_services'
];

var cachedEmployees = [];

document.addEventListener('DOMContentLoaded', async function() {
    var user = window.getCurrentUser();
    if (!user || user.username !== 'boles') {
        alert('ليس لديك صلاحية للدخول إلى هذه الصفحة. هذه الصفحة مخصصة للمدير العام فقط.');
        window.location.href = '../../index.html';
        return;
    }

    var savedTheme = localStorage.getItem('dash_theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);

    await loadEmployees();
    loadLogs();
    setupPermissionsUploadListeners();
});

function switchTab(tab, btn) {
    document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });

    if (btn) btn.classList.add('active');
    var content = document.getElementById('tab-' + tab);
    if (content) content.classList.add('active');

    if (tab === 'logs') loadLogs();
    if (tab === 'certificates') loadCertRecords();
    if (tab === 'desk-services') loadDeskServicesAdmin();
}

async function loadEmployees() {
    var container = document.getElementById('users-container');
    try {
        cachedEmployees = await window.authGetAllEmployees();
        renderEmployees();
    } catch (e) {
        console.error('Error loading employees:', e);
        container.innerHTML = '<div style="width:100%;text-align:center;padding:20px;color:var(--accent-rose);">حدث خطأ أثناء تحميل المستخدمين</div>';
    }
}

function renderEmployees() {
    var container = document.getElementById('users-container');
    container.innerHTML = '';
    
    // إزالة التكرارات
    var seen = {};
    var uniqueEmployees = [];
    for (var i = 0; i < cachedEmployees.length; i++) {
        var emp = cachedEmployees[i];
        if (!emp || !emp.username || seen[emp.username]) continue;
        seen[emp.username] = true;
        
        // تأكيد صلاحيات boles
        if (emp.username === 'boles') {
            emp.role = 'admin';
            emp.permissions = ADMIN_FIXED_PERMISSIONS.slice();
            emp.active = true;
        }
        
        uniqueEmployees.push(emp);
    }
    
    for (var index = 0; index < uniqueEmployees.length; index++) {
        (function(emp, idx) {
            var activePerms = [];
            if (emp.permissions && Array.isArray(emp.permissions)) {
                activePerms = emp.permissions;
            } else if (window.AUTH_ROLE_PERMISSIONS && window.AUTH_ROLE_PERMISSIONS[emp.role]) {
                activePerms = window.AUTH_ROLE_PERMISSIONS[emp.role];
            }
            
            if (emp.username === 'boles') {
                activePerms = ADMIN_FIXED_PERMISSIONS.slice();
            }

            var roleName = emp.role === 'admin' ? 'مدير' : (emp.role === 'supervisor' ? 'مشرف' : (emp.role === 'viewer' ? 'مشاهد' : 'موظف'));
            var badgeClass = emp.role === 'admin' ? 'badge-admin' : 'badge-emp';
            var isBoles = emp.username === 'boles';
            var disabled = isBoles ? 'disabled' : '';

            // الصلاحيات الوظيفية
            var functionalPermsHtml = '';
            for (var fi = 0; fi < FUNCTIONAL_PERMISSIONS.length; fi++) {
                var p = FUNCTIONAL_PERMISSIONS[fi];
                var isChecked = activePerms.indexOf(p.id) !== -1 ? 'checked' : '';
                functionalPermsHtml += '<label class="perm-item"><input type="checkbox" id="perm_' + idx + '_' + p.id + '" value="' + p.id + '" ' + isChecked + ' ' + disabled + '><span>' + p.name + '</span></label>';
            }

            // صلاحيات الأنظمة
            var systemsAccessHtml = '';
            for (var si = 0; si < SYSTEM_ACCESS_PERMISSIONS.length; si++) {
                var sys = SYSTEM_ACCESS_PERMISSIONS[si];
                var isChecked = activePerms.indexOf(sys.id) !== -1 ? 'checked' : '';
                systemsAccessHtml += '<label class="perm-item system-access"><input type="checkbox" id="perm_' + idx + '_' + sys.id + '" value="' + sys.id + '" ' + isChecked + ' ' + disabled + '><i class="fas ' + sys.icon + '" style="color:' + sys.color + ';"></i><span>' + sys.name + '</span></label>';
            }

            // كلمة المرور
            var currentPassword = 'غير معروفة';
            if (emp.plainPassword) {
                currentPassword = emp.plainPassword;
            } else if (emp.password && window.authHashPassword && emp.password === window.authHashPassword('123456')) {
                currentPassword = '123456';
            } else if (emp.password && window.authHashPassword && emp.password === window.authHashPassword('8520')) {
                currentPassword = '8520';
            }

            var escapedName = escapeHtml(emp.name || '');
            var escapedUsername = escapeHtml(emp.username);
            // Escape usernames for JavaScript string context in onclick
            var jsSafeUsername = emp.username.replace(/'/g, "\\'").replace(/"/g, "&quot;");
            var card = document.createElement('div');
            card.style.cssText = 'width:calc(50% - 10px); min-width:400px; margin-bottom:16px;';
            card.innerHTML = 
                '<div class="card h-100">' +
                    '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">' +
                        '<div>' +
                            '<h4 style="margin:0; font-family:\'Changa\', sans-serif; font-weight:700; color:#fff;">' +
                                escapedName + ' ' +
                                '<span class="badge ' + badgeClass + '">' + roleName + '</span>' +
                                (isBoles ? ' <span class="badge badge-protected">🔒 محمي</span>' : '') +
                            '</h4>' +
                            '<div style="color:#ffffff; font-weight:700; font-size:0.85rem; margin-top:4px;"><i class="fas fa-user me-1"></i> ' + escapedUsername + '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">' +
                        '<div style="flex:1; min-width:150px;">' +
                            '<label style="font-size:0.85rem; font-weight:700; color:#ffffff; margin-bottom:4px; display:block;">تعديل الاسم</label>' +
                            '<input type="text" class="input-main" id="name_' + idx + '" value="' + escapedName + '">' +
                        '</div>' +
                        '<div style="flex:1; min-width:150px;">' +
                            '<label style="font-size:0.85rem; font-weight:700; color:#ffffff; margin-bottom:4px; display:block;">الرتبة (الصفة)</label>' +
                            '<select class="input-main" id="role_' + idx + '" ' + disabled + '>' +
                                '<option value="admin" ' + (emp.role === 'admin' ? 'selected' : '') + '>مدير</option>' +
                                '<option value="supervisor" ' + (emp.role === 'supervisor' ? 'selected' : '') + '>مشرف</option>' +
                                '<option value="employee" ' + (emp.role === 'employee' ? 'selected' : '') + '>موظف</option>' +
                                '<option value="viewer" ' + (emp.role === 'viewer' ? 'selected' : '') + '>مشاهد</option>' +
                            '</select>' +
                        '</div>' +
                    '</div>' +
                    '<div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; margin-bottom:12px;">' +
                        '<label style="font-size:0.85rem; font-weight:700; color:#ffffff; margin-bottom:4px; display:block;">كلمة المرور الحالية: <span style="color:var(--accent-amber); direction:ltr; display:inline-block;">' + escapeHtml(currentPassword) + '</span></label>' +
                        '<div style="display:flex; gap: 8px; margin-top: 8px;">' +
                            '<input type="password" class="input-main" id="pass_' + idx + '" placeholder="تغيير كلمة المرور (اختياري)" style="direction:ltr;">' +
                            '<button class="btn-action" style="background: var(--text-secondary); white-space:nowrap;" onclick="resetPassword(' + idx + ', \'' + jsSafeUsername + '\')" title="إعادة ضبط إلى 123456"><i class="fas fa-undo"></i> Reset</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="perm-section" style="border-top: 1px solid var(--border); padding-top: 12px;">' +
                        '<div class="perm-section-title"><i class="fas fa-cogs" style="color:var(--accent-amber);"></i> الصلاحيات الوظيفية' + (isBoles ? ' <span style="font-size:0.7rem;color:var(--accent-amber);font-weight:400;">(ثابتة)</span>' : '') + '</div>' +
                        '<div class="perm-grid">' + functionalPermsHtml + '</div>' +
                    '</div>' +
                    '<div class="perm-section" style="border-top: 1px solid var(--border); padding-top: 12px; margin-top: 12px;">' +
                        '<div class="perm-section-title"><i class="fas fa-th-large" style="color:var(--accent-emerald);"></i> الأنظمة المسموح بها' + (isBoles ? ' <span style="font-size:0.7rem;color:var(--accent-amber);font-weight:400;">(كل الأنظمة)</span>' : '') + '</div>' +
                        '<div class="perm-grid">' + systemsAccessHtml + '</div>' +
                    '</div>' +
                    '<div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px;">' +
                        (isBoles ? '<div><small style="color:var(--text-secondary);">🔒 مدير النظام الأساسي لا يمكن حذفه أو تعديل صلاحياته</small></div>' : '<button class="btn-action" style="background:var(--accent-rose);" onclick="deleteEmployee(\'' + jsSafeUsername + '\')"><i class="fas fa-trash me-1"></i> حذف الموظف</button>') +
                        '<div style="text-align:left;">' +
                            '<span id="msg_' + idx + '" style="font-size:0.85rem; font-weight:bold; margin-left:12px;"></span>' +
                            '<button class="btn-action" onclick="saveUser(' + idx + ', \'' + jsSafeUsername + '\')"><i class="fas fa-save me-1"></i> حفظ التعديلات</button>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            container.appendChild(card);
        })(uniqueEmployees[index], index);
    }
}

async function saveUser(index, username) {
    var emp = null;
    for (var i = 0; i < cachedEmployees.length; i++) {
        if (cachedEmployees[i].username === username) { emp = cachedEmployees[i]; break; }
    }
    if (!emp) return;

    var isBoles = username === 'boles';
    var newNameEl = document.getElementById('name_' + index);
    var newRoleEl = document.getElementById('role_' + index);
    var newPassEl = document.getElementById('pass_' + index);
    var msgEl = document.getElementById('msg_' + index);

    var newName = newNameEl ? newNameEl.value.trim() : '';
    var newRole = isBoles ? 'admin' : (newRoleEl ? newRoleEl.value : 'employee');
    var newPass = newPassEl ? newPassEl.value : '';

    if (!newName) {
        if (msgEl) { msgEl.textContent = '⚠️ الاسم مطلوب!'; msgEl.style.color = 'var(--accent-rose)'; }
        return;
    }

    emp.name = newName;
    emp.role = newRole;

    if (newPass) {
        emp.password = window.authHashPassword(newPass);
        emp.plainPassword = newPass;
    }

    // جمع الصلاحيات
    if (isBoles) {
        emp.permissions = ADMIN_FIXED_PERMISSIONS.slice();
    } else {
        var customPerms = [];
        for (var pi = 0; pi < ALL_PERMISSIONS.length; pi++) {
            var cb = document.getElementById('perm_' + index + '_' + ALL_PERMISSIONS[pi].id);
            if (cb && cb.checked) customPerms.push(ALL_PERMISSIONS[pi].id);
        }
        emp.permissions = customPerms;
    }

    try {
        if (msgEl) { msgEl.textContent = 'جاري الحفظ...'; msgEl.style.color = 'var(--text-secondary)'; }
        
        await saveEmployeeToFirebase(emp);
        await window.authSaveEmployeeToDb(emp);
        
        if (typeof window.authLogActivity === 'function') {
            await window.authLogActivity('تعديل', 'نظام الصلاحيات', emp.username, emp.name, 'تم تعديل بيانات أو صلاحيات الموظف', 'نظام الصلاحيات');
        }
        
        if (msgEl) { msgEl.textContent = '✅ تم الحفظ بنجاح!'; msgEl.style.color = 'var(--accent-emerald)'; }
        setTimeout(function() { if (msgEl) msgEl.textContent = ''; }, 3000);
        await loadEmployees();
    } catch(e) {
        console.error('Save error:', e);
        if (msgEl) { msgEl.textContent = '❌ حدث خطأ!'; msgEl.style.color = 'var(--accent-rose)'; }
    }
}

async function saveEmployeeToFirebase(emp) {
    if (typeof window.AUTH_DB === 'undefined' || !window.AUTH_DB) return;
    
    var key = emp.username.replace(/[.#$\/\[\]]/g, '_');
    var empData = {
        username: emp.username,
        name: emp.name || '',
        password: emp.password || '',
        role: emp.role || 'employee',
        active: emp.active !== false,
        permissions: emp.permissions || DEFAULT_EMPLOYEE_PERMISSIONS,
        employeeId: emp.employeeId || emp.username,
        createdAt: emp.createdAt || new Date().toISOString()
    };
    if (emp.plainPassword) empData.plainPassword = emp.plainPassword;
    
    await window.AUTH_DB.ref('employees/' + key).update(empData);
}

async function deleteEmployee(username) {
    if (username === 'boles') {
        alert('🔒 لا يمكن حذف مدير النظام الأساسي!');
        return;
    }
    if (!confirm('هل أنت متأكد من حذف الموظف: ' + username + ' نهائياً؟\n\n⚠️ لا يمكن التراجع عن هذا الإجراء.')) return;
    try {
        await window.authDeleteEmployeeFromDb(username);
        if (typeof window.authLogActivity === 'function') {
            await window.authLogActivity('حذف', 'نظام الصلاحيات', username, username, 'تم حذف الموظف نهائياً', 'نظام الصلاحيات');
        }
        alert('✅ تم حذف الموظف بنجاح.');
        await loadEmployees();
    } catch (e) {
        console.error('Delete error:', e);
        alert('❌ حدث خطأ أثناء الحذف.');
    }
}

async function resetPassword(index, username) {
    if (!confirm('هل أنت متأكد من إعادة ضبط كلمة مرور ' + username + ' إلى 123456؟')) return;
    
    var emp = null;
    for (var i = 0; i < cachedEmployees.length; i++) {
        if (cachedEmployees[i].username === username) { emp = cachedEmployees[i]; break; }
    }
    if (!emp) return;
    
    emp.password = window.authHashPassword('123456');
    emp.plainPassword = '123456';
    
    if (username === 'boles') {
        emp.role = 'admin';
        emp.permissions = ADMIN_FIXED_PERMISSIONS.slice();
    }
    
    try {
        await saveEmployeeToFirebase(emp);
        await window.authSaveEmployeeToDb(emp);
        if (typeof window.authLogActivity === 'function') {
            await window.authLogActivity('تعديل', 'نظام الصلاحيات', username, emp.name, 'تم إعادة ضبط كلمة المرور', 'نظام الصلاحيات');
        }
        alert('✅ تم إعادة ضبط كلمة المرور بنجاح.');
        await loadEmployees();
    } catch (e) {
        console.error('Reset error:', e);
        alert('❌ حدث خطأ.');
    }
}

async function addNewEmployee() {
    var usernameEl = document.getElementById('new_username');
    var nameEl = document.getElementById('new_name');
    var passwordEl = document.getElementById('new_password');
    var msgEl = document.getElementById('new_emp_msg');

    var username = usernameEl ? usernameEl.value.trim() : '';
    var name = nameEl ? nameEl.value.trim() : '';
    var password = passwordEl ? passwordEl.value : '';

    if (!username || !name || !password) {
        if (msgEl) { msgEl.textContent = '⚠️ يرجى إدخال اسم المستخدم، الاسم بالكامل، وكلمة المرور'; msgEl.style.color = 'var(--accent-rose)'; }
        return;
    }

    if (username.toLowerCase() === 'boles') {
        if (msgEl) { msgEl.textContent = '🔒 اسم المستخدم "boles" محجوز لمدير النظام!'; msgEl.style.color = 'var(--accent-rose)'; }
        return;
    }

    var exists = false;
    for (var i = 0; i < cachedEmployees.length; i++) {
        if (cachedEmployees[i].username === username) { exists = true; break; }
    }
    if (exists) {
        if (msgEl) { msgEl.textContent = '⚠️ اسم المستخدم موجود بالفعل!'; msgEl.style.color = 'var(--accent-rose)'; }
        return;
    }

    if (msgEl) { msgEl.textContent = 'جاري الإضافة...'; msgEl.style.color = 'var(--text-secondary)'; }

    var newEmp = {
        username: username,
        name: name,
        password: window.authHashPassword(password),
        plainPassword: password,
        role: 'employee',
        active: true,
        createdAt: new Date().toISOString(),
        employeeId: username,
        permissions: DEFAULT_EMPLOYEE_PERMISSIONS.slice()
    };

    try {
        await saveEmployeeToFirebase(newEmp);
        await window.authSaveEmployeeToDb(newEmp);
        if (typeof window.authLogActivity === 'function') {
            await window.authLogActivity('إضافة', 'نظام الصلاحيات', username, name, 'تم إضافة موظف جديد', 'نظام الصلاحيات');
        }
        
        if (msgEl) { msgEl.textContent = '✅ تمت إضافة الموظف بنجاح!'; msgEl.style.color = 'var(--accent-emerald)'; }
        
        if (usernameEl) usernameEl.value = '';
        if (nameEl) nameEl.value = '';
        if (passwordEl) passwordEl.value = '';
        
        setTimeout(function() { if (msgEl) msgEl.textContent = ''; }, 3000);
        await loadEmployees();
    } catch (e) {
        console.error('Add error:', e);
        if (msgEl) { msgEl.textContent = '❌ حدث خطأ أثناء إضافة الموظف!'; msgEl.style.color = 'var(--accent-rose)'; }
    }
}

// ==================== LOGS ====================

function renderLogsData(logs) {
    var tbody = document.getElementById('logs-tbody');
    if (!tbody) return;
    
    if (!logs || !logs.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">لا توجد حركات مسجلة حتى الآن</td></tr>';
        return;
    }

    var html = '';
    for (var i = 0; i < logs.length; i++) {
        var log = logs[i];
        var date = log.timestamp ? new Date(log.timestamp) : new Date();
        var dateStr = date.toLocaleDateString('ar-EG') + ' ' + date.toLocaleTimeString('ar-EG');
        
        var badgeStyle = 'background: rgba(245,158,11,0.25); color: #fff; border: 1px solid rgba(245,158,11,0.5); font-size:0.75rem; padding:3px 8px; border-radius:4px; font-weight:700;';
        if (log.system === 'نظام الملفات') {
            badgeStyle = 'background: rgba(16,185,129,0.25); color: #fff; border: 1px solid rgba(16,185,129,0.5); font-size:0.75rem; padding:3px 8px; border-radius:4px; font-weight:700;';
        } else if (log.system === 'نظام السحب' || log.system === 'الخدمات المكتبية' || log.system === 'desk-services') {
            badgeStyle = 'background: rgba(59,130,246,0.25); color: #fff; border: 1px solid rgba(59,130,246,0.5); font-size:0.75rem; padding:3px 8px; border-radius:4px; font-weight:700;';
        } else if (log.system === 'حساب الشهادات') {
            badgeStyle = 'background: rgba(139,92,246,0.25); color: #fff; border: 1px solid rgba(139,92,246,0.5); font-size:0.75rem; padding:3px 8px; border-radius:4px; font-weight:700;';
        }

        html += '<tr>' +
            '<td style="direction:ltr; text-align:right;">' + dateStr + '</td>' +
            '<td><strong>' + (log.employeeName || '—') + '</strong><br><small style="color:#fff;">' + (log.employeeUsername || '—') + '</small></td>' +
            '<td style="color:#fff; font-weight:700;">' + (log.action || '—') + '</td>' +
            '<td><span style="color:#fff; font-weight:700;">' + (log.targetType || '—') + '</span><br><small style="color:#fff;">' + (log.targetName || '—') + '</small></td>' +
            '<td><span class="badge" style="' + badgeStyle + '">' + (log.system || 'عام') + '</span></td>' +
            '<td style="color:#fff;">' + (log.details || '') + '</td>' +
        '</tr>';
    }
    tbody.innerHTML = html;
}

function loadLogs() {
    var tbody = document.getElementById('logs-tbody');
    if (!tbody) return;
    
    if (window.AUTH_DB) {
        window.AUTH_DB.ref('activityLog').on('value', function(snap) {
            try {
                var val = snap.val() || {};
                var list = [];
                if (Array.isArray(val)) {
                    list = val.slice();
                } else {
                    Object.keys(val).forEach(function(k) { list.push(val[k]); });
                }
                list.sort(function(a, b) {
                    var tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                    var tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                    return tB - tA;
                });
                localStorage.setItem('lotus_activity_log', JSON.stringify(list));
                renderLogsData(list);
            } catch (e) {
                var local = JSON.parse(localStorage.getItem('lotus_activity_log') || '[]');
                renderLogsData(local);
            }
        }, function(err) {
            var local = JSON.parse(localStorage.getItem('lotus_activity_log') || '[]');
            renderLogsData(local);
        });
    } else {
        var local = JSON.parse(localStorage.getItem('lotus_activity_log') || '[]');
        renderLogsData(local);
    }
}

function clearLogs() {
    if (confirm('⚠️ هل أنت متأكد من مسح جميع السجلات؟ لا يمكن التراجع عن هذا الإجراء.')) {
        localStorage.setItem('lotus_activity_log', '[]');
        if (window.AUTH_DB) {
            window.AUTH_DB.ref('activityLog').remove().catch(function(){});
        }
        loadLogs();
    }
}

// ==================== CERTIFICATE RECORDS ====================

function getCertRecords() { 
    try { return JSON.parse(localStorage.getItem('lotus_certificate_records') || '[]'); } catch(e) { return []; } 
}

function saveCertRecords(arr) { 
    localStorage.setItem('lotus_certificate_records', JSON.stringify(arr)); 
}

var CERT_TAB_NAMES = { 
    thanaweya: 'المصرية', stem: 'STEM', azhar: 'الأزهرية', 
    saudi: 'السعودية', gulf: 'عمان-قطر-الإمارات', libya: 'ليبيا', 
    jordan: 'الأردن', kuwait: 'الكويت', bahrain: 'البحرين', american: 'أمريكان دبلومة' 
};

function loadCertRecords() {
    try {
        if (window.AUTH_DB && typeof window.AUTH_DB.ref === 'function') {
            window.AUTH_DB.ref('certificateRecords').on('value', function(snap) {
                try {
                    var val = snap.val() || {};
                    var list = [];
                    var keys = Object.keys(val);
                    for (var i = 0; i < keys.length; i++) {
                        list.push(val[keys[i]]);
                    }
                    list.sort(function(a, b) { return (b.id || '').localeCompare(a.id || ''); });
                    saveCertRecords(list);
                    renderCertRecordsTable();
                } catch (e) { renderCertRecordsTable(); }
            });
        } else {
            renderCertRecordsTable();
        }
    } catch(e) { renderCertRecordsTable(); }
}

function renderCertRecordsTable() {
    var tbody = document.getElementById('certRecords-tbody');
    if (!tbody) return;
    
    try {
        var records = getCertRecords();
        var searchEl = document.getElementById('certRecordsSearch');
        var q = searchEl ? searchEl.value.trim().toLowerCase() : '';
        
        if (q) {
            records = records.filter(function(r) {
                var student = (r.studentName || '').toLowerCase();
                var emp = (r.employeeName || r.employeeUsername || '').toLowerCase();
                return student.indexOf(q) !== -1 || emp.indexOf(q) !== -1;
            });
        }

        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4">لا توجد شهادات محفوظة' + (q ? ' تطابق البحث' : '') + '</td></tr>';
            return;
        }

        // Group by employee
        var groups = {};
        for (var i = 0; i < records.length; i++) {
            var r = records[i];
            var empUser = r.employeeUsername || '';
            var empName = r.employeeName || r.employeeUsername || '—';
            var key = empUser + '||' + empName;
            if (!groups[key]) groups[key] = [];
            groups[key].push(r);
        }

        var html = '';
        var gi = 0;
        var groupKeys = Object.keys(groups);
        for (var g = 0; g < groupKeys.length; g++) {
            gi++;
            var gk = groupKeys[g];
            var parts = gk.split('||');
            var empUser = parts[0];
            var empName = parts[1];
            var list = groups[gk];
            var count = list.length;
            var gid = 'emp' + gi;
            
            html += '<tr class="emp-group-row" style="cursor:pointer;background:rgba(245,158,11,0.10);" onclick="toggleEmpGroup(\'' + gid + '\')">' +
                '<td colspan="8" style="padding:10px 14px;">' +
                '<span id="' + gid + '_arrow" style="display:inline-block;transition:transform .2s;margin-left:8px;color:var(--accent-amber);font-weight:900;">▶</span>' +
                '<strong style="color:#fff;font-size:1rem;">' + empName + '</strong>' +
                ' <span style="color:var(--text-secondary);font-size:0.8rem;">' + (empUser ? '(' + empUser + ') · ' : '') + count + ' شهادة</span>' +
                '</td></tr>';
            
            for (var j = 0; j < list.length; j++) {
                var r = list[j];
                var date = r.createdAt ? new Date(r.createdAt).toLocaleDateString('ar-EG') : '—';
                var label = r.certificateLabel || CERT_TAB_NAMES[r.certificateType] || r.certificateType || '—';
                var total = r.totalScore != null ? r.totalScore : '—';
                var equiv = r.equivalentScore != null ? r.equivalentScore : '—';
                var pct = r.totalPercentage != null ? r.totalPercentage.toFixed(1) + '%' : '—';
                
                html += '<tr class="emp-detail-' + gid + '" style="display:none;background:rgba(255,255,255,0.02);">' +
                    '<td style="direction:ltr;text-align:right;color:var(--text-muted);font-size:0.8rem;padding-right:34px;">' + date + '</td>' +
                    '<td><strong style="color:var(--accent-amber);cursor:pointer;text-decoration:underline;text-decoration-style:dotted;" onclick="viewCertRecordDetail(\'' + r.id + '\')">' + (r.studentName || '—') + '</strong></td>' +
                    '<td><span class="badge" style="background:rgba(139,92,246,0.25);color:#fff;border:1px solid rgba(139,92,246,0.5);font-size:0.75rem;padding:3px 8px;border-radius:4px;font-weight:700;">' + label + '</span></td>' +
                    '<td style="color:#fff;font-weight:700;">' + total + '</td>' +
                    '<td style="color:var(--accent-amber);font-weight:700;">' + equiv + '</td>' +
                    '<td style="color:var(--accent-emerald);font-weight:900;">' + pct + '</td>' +
                    '<td style="color:#fff;">' + empName + '</td>' +
                    '<td><button class="btn-action" style="background:var(--accent-rose);padding:4px 10px;font-size:0.75rem;" onclick="deleteCertRecordAdmin(\'' + r.id + '\')"><i class="fas fa-trash"></i></button></td>' +
                '</tr>';
            }
        }
        tbody.innerHTML = html;
    } catch(e) {
        console.error('Render cert error:', e);
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-danger">حدث خطأ في تحميل السجل</td></tr>';
    }
}

function toggleEmpGroup(gid) {
    try {
        var rows = document.querySelectorAll('.emp-detail-' + gid);
        var arrow = document.getElementById(gid + '_arrow');
        var show = false;
        if (rows.length > 0) {
            show = rows[0].style.display === 'none';
        }
        for (var i = 0; i < rows.length; i++) {
            rows[i].style.display = show ? '' : 'none';
        }
        if (arrow) arrow.style.transform = show ? 'rotate(90deg)' : 'rotate(0deg)';
    } catch(e) {
        console.error('toggleEmpGroup error:', e);
    }
}

function deleteCertRecordAdmin(id) {
    if (!confirm('⚠️ هل أنت متأكد من حذف سجل الشهادة هذا؟')) return;
    
    var records = getCertRecords();
    records = records.filter(function(r) { return r.id !== id; });
    saveCertRecords(records);
    
    if (window.AUTH_DB && typeof window.AUTH_DB.ref === 'function') {
        window.AUTH_DB.ref('certificateRecords/' + id).remove().catch(function() {});
    }
    
    renderCertRecordsTable();
    
    try { 
        if (typeof window.authLogActivity === 'function') {
            window.authLogActivity('حذف', 'حساب الشهادات', id, '', 'حذف سجل شهادة من لوحة الإدارة'); 
        }
    } catch(e) {}
}

function clearCertRecords() {
    if (!confirm('⚠️ هل أنت متأكد من مسح جميع سجلات الشهادات المحفوظة؟ لا يمكن التراجع.')) return;
    
    saveCertRecords([]);
    
    if (window.AUTH_DB && typeof window.AUTH_DB.ref === 'function') {
        window.AUTH_DB.ref('certificateRecords').remove().catch(function() {});
    }
    
    renderCertRecordsTable();
    
    try { 
        if (typeof window.authLogActivity === 'function') {
            window.authLogActivity('مسح', 'حساب الشهادات', '', '', 'مسح جميع سجلات الشهادات من لوحة الإدارة'); 
        }
    } catch(e) {}
}

window.viewCertRecordDetail = function(id) {
    var modal = document.getElementById('certDetailModal');
    var body = document.getElementById('certDetailBody');
    if (!modal || !body) return;
    
    body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">جاري تحميل التفاصيل...</div>';
    modal.classList.add('active');
    
    setTimeout(function() {
        try {
            var records = getCertRecords();
            var rec = null;
            for (var i = 0; i < records.length; i++) {
                if (records[i].id === id) { rec = records[i]; break; }
            }
            if (!rec) { 
                body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">لم يتم العثور على السجل</div>'; 
                return; 
            }
            
            var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid var(--border);padding-bottom:12px;">' +
                '<div><strong style="color:#fff;font-size:1.1rem;">' + (rec.studentName || '—') + '</strong>' +
                '<br><span style="color:var(--text-muted);font-size:0.75rem;">' + (rec.certificateLabel || rec.certificateType || '—') + ' | ' + (typeof rec.totalPercentage === 'number' ? rec.totalPercentage.toFixed(1)+'%' : '—') + '</span></div>' +
                '<div style="text-align:left;direction:ltr;font-size:0.7rem;color:var(--text-muted);">' + (rec.createdAt ? new Date(rec.createdAt).toLocaleString('ar-EG') : '—') + '</div></div>';
            
            html += '<div style="text-align:center;padding:20px;color:var(--text-muted);">تفاصيل الشهادة</div>';
            
            if (rec.employeeName || rec.employeeUsername) {
                html += '<div style="margin-top:12px;padding-top:8px;border-top:1px solid var(--border);font-size:0.7rem;color:var(--text-muted);">' +
                    'بواسطة: ' + (rec.employeeName || rec.employeeUsername || '—') +
                    (rec.updatedAt ? ' | آخر تحديث: ' + new Date(rec.updatedAt).toLocaleString('ar-EG') : '') +
                '</div>';
            }
            
            body.innerHTML = html;
        } catch(e) {
            console.error('viewCertRecordDetail error:', e);
            body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--accent-rose);">حدث خطأ في عرض التفاصيل</div>';
        }
    }, 100);
};

window.closeCertDetailModal = function() {
    var modal = document.getElementById('certDetailModal');
    if (modal) modal.classList.remove('active');
};

// Close modal on overlay click
document.addEventListener('click', function(e) {
    var modal = document.getElementById('certDetailModal');
    if (modal && modal.classList.contains('active') && e.target === modal) {
        modal.classList.remove('active');
    }
});

// ==================== EXPORT/IMPORT ====================

async function manualExportBackup() {
    if (!confirm('هل تريد تصدير نسخة احتياطية كاملة من قاعدة بيانات النظام؟')) return;
    
    var progEl = document.getElementById('export-progress-overlay');
    var progFill = document.getElementById('export-progress-fill');
    var progText = document.getElementById('export-progress-text');
    
    if (progEl) progEl.style.display = 'flex';
    
    function setProg(pct, txt) { 
        if (progFill) progFill.style.width = pct + '%'; 
        if (progText) progText.textContent = txt || ''; 
    }
    
    try {
        setProg(5, 'جاري قراءة بيانات الطلاب...');
        var students = {}, withdrawals = {}, colleges = {}, employees = {}, logs = [], config = {}, certRecords = [];

        try { 
            var s = JSON.parse(localStorage.getItem('lotus_students') || '[]'); 
            if (Array.isArray(s)) s.forEach(function(st) { students[st.id || st.studentCode] = st; }); 
        } catch(e) {}
        
        setProg(15, 'جاري قراءة بيانات الموظفين...');
        try { employees = JSON.parse(localStorage.getItem('lotus_employees') || '[]'); } catch(e) {}
        
        setProg(25, 'جاري قراءة سجل النشاطات...');
        try { logs = JSON.parse(localStorage.getItem('lotus_activity_log') || '[]'); } catch(e) {}
        
        setProg(30, 'جاري قراءة إعدادات النظام وسجل الشهادات...');
        try { config = JSON.parse(localStorage.getItem('lotus_config') || '{}'); } catch(e) {}
        try { certRecords = JSON.parse(localStorage.getItem('lotus_certificate_records') || '[]'); } catch(e) {}

        setProg(40, 'جاري مزامنة البيانات مع الخادم...');
        if (typeof window.AUTH_DB !== 'undefined' && window.AUTH_DB) {
            try { 
                var snap = await window.AUTH_DB.ref('students').once('value'); 
                if (snap.exists()) students = Object.assign({}, students, snap.val()); 
            } catch(e) {}
            
            setProg(50, 'جاري مزامنة سجل النشاطات والشهادات...');
            try { 
                var snap2 = await window.AUTH_DB.ref('activityLog').once('value'); 
                if (snap2.exists()) { 
                    var fb = snap2.val(); 
                    Object.keys(fb).forEach(function(k) { 
                        if (!logs.find(function(l) { return l.timestamp === fb[k].timestamp; })) logs.push(fb[k]); 
                    }); 
                } 
            } catch(e) {}
            
            try { 
                var snap3 = await window.AUTH_DB.ref('certificateRecords').once('value'); 
                if (snap3.exists()) { 
                    var fb2 = snap3.val(); 
                    certRecords = Object.keys(fb2).map(function(k) { return fb2[k]; }); 
                } 
            } catch(e) {}
        }
        
        var deskServices = {}, deskServicesFiles = {};
        setProg(55, 'جاري مزامنة بيانات الخدمات المكتبية...');
        if (typeof window.AUTH_DB !== 'undefined' && window.AUTH_DB) {
            try { 
                var snapDS = await window.AUTH_DB.ref('deskServices').once('value'); 
                if (snapDS.exists()) deskServices = snapDS.val(); 
            } catch(e) {}
            try { 
                var snapDSF = await window.AUTH_DB.ref('deskServicesFiles').once('value'); 
                if (snapDSF.exists()) deskServicesFiles = snapDSF.val(); 
            } catch(e) {}
        }
        
        setProg(60, 'جاري مزامنة بيانات السحب...');
        if (typeof window.WITHDRAWAL_DB !== 'undefined' && window.WITHDRAWAL_DB) {
            try { 
                var snap4 = await window.WITHDRAWAL_DB.ref('withdrawalRequests').once('value'); 
                if (snap4.exists()) withdrawals = snap4.val(); 
            } catch(e) {}
            
            setProg(70, 'جاري مزامنة بيانات الكليات...');
            try { 
                var snap5 = await window.WITHDRAWAL_DB.ref('colleges').once('value'); 
                if (snap5.exists()) colleges = snap5.val(); 
            } catch(e) {}
        }
        
        setProg(80, 'جاري تجميع النسخة الاحتياطية...');
        var backup = {
            students: students,
            withdrawalRequests: withdrawals,
            colleges: colleges,
            employees: employees,
            activityLog: logs,
            certificateRecords: certRecords,
            config: config,
            deskServices: deskServices,
            deskServicesFiles: deskServicesFiles,
            backupTime: new Date().toISOString(),
            version: '2.0'
        };
        
        setProg(90, 'جاري إنشاء ملف التصدير...');
        var blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        var dateStr = new Date().toISOString().split('T')[0];
        var days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        var dayName = days[new Date().getDay()];
        
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'نسخة_احتياطية_كاملة_' + dateStr + '_' + dayName + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        if (typeof window.authLogActivity === 'function') {
            window.authLogActivity('export_backup', 'نظام الصلاحيات', '', '', 'تصدير يدوي لنسخة احتياطية كاملة من النظام', 'نظام الصلاحيات');
        }
        
        setProg(100, '✅ تم بنجاح!');
        await new Promise(function(r) { setTimeout(r, 500); });
        if (progEl) progEl.style.display = 'none';
        alert('✅ تم تصدير النسخة الاحتياطية بنجاح!');
    } catch (err) {
        console.error('Export error:', err);
        if (progEl) progEl.style.display = 'none';
        alert('❌ حدث خطأ أثناء التصدير: ' + err.message);
    }
}

async function manualImportBackup(input) {
    var file = input.files[0];
    if (!file) return;
    
    if (!confirm('⚠️ تحذير هام جداً:\n\nسيقوم هذا الإجراء باستعادة كافة البيانات من النسخة الاحتياطية المحددة وكتابتها فوق البيانات الحالية.\n\nهل أنت متأكد من استمرار عملية الاستعادة؟')) {
        input.value = '';
        return;
    }
    
    try {
        if (typeof window.AUTH_DB === 'undefined' || !window.AUTH_DB) {
            alert('❌ خطأ: تعذر الاتصال بقاعدة البيانات.');
            input.value = '';
            return;
        }
        
        var text = await file.text();
        var backup = JSON.parse(text);
        
        if (!backup.students && !backup.withdrawalRequests && !backup.employees) {
            alert('❌ الملف المختار غير صالح أو لا يحتوي على بنية النسخة الاحتياطية الصحيحة.');
            input.value = '';
            return;
        }
        
        if (backup.students) await window.AUTH_DB.ref('students').set(backup.students);
        if (backup.withdrawalRequests && window.WITHDRAWAL_DB) await window.WITHDRAWAL_DB.ref('withdrawalRequests').set(backup.withdrawalRequests);
        if (backup.colleges && window.WITHDRAWAL_DB) await window.WITHDRAWAL_DB.ref('colleges').set(backup.colleges);
        if (backup.employees) await window.AUTH_DB.ref('employees').set(backup.employees);
        if (backup.activityLog) await window.AUTH_DB.ref('activityLog').set(backup.activityLog);
        if (backup.config) await window.AUTH_DB.ref('settings/config').set(backup.config);
        if (backup.deskServices) await window.AUTH_DB.ref('deskServices').set(backup.deskServices);
        if (backup.deskServicesFiles) await window.AUTH_DB.ref('deskServicesFiles').set(backup.deskServicesFiles);
        
        if (backup.certificateRecords && Array.isArray(backup.certificateRecords)) {
            var certObj = {};
            backup.certificateRecords.forEach(function(r) { if (r.id) certObj[r.id] = r; });
            await window.AUTH_DB.ref('certificateRecords').set(certObj);
            localStorage.setItem('lotus_certificate_records', JSON.stringify(backup.certificateRecords));
        }
        
        if (backup.employees) {
            var list = [];
            if (Array.isArray(backup.employees)) {
                backup.employees.forEach(function(e) { if (e.username) list.push(e); });
            } else {
                Object.keys(backup.employees).forEach(function(k) {
                    list.push(Object.assign({ username: k }, backup.employees[k]));
                });
            }
            localStorage.setItem('lotus_employees', JSON.stringify(list));
        }
        
        if (typeof window.authLogActivity === 'function') {
            window.authLogActivity('import_backup', 'نظام الصلاحيات', '', '', 'استيراد يدوي لنسخة احتياطية كاملة واستعادة البيانات', 'نظام الصلاحيات');
        }
        
        alert('✅ تم استعادة البيانات بالكامل من النسخة الاحتياطية بنجاح!\n\nسيتم إعادة تحميل الصفحة لتحديث البيانات.');
        location.reload();
    } catch (err) {
        console.error('Import error:', err);
        alert('❌ حدث خطأ أثناء استيراد النسخة الاحتياطية: ' + err.message);
        input.value = '';
    }
}

// ==================== EXCEL EXPORT ====================

function showToast(msg, type) {
    alert(msg);
}

window.exportEmployeeCertRecordsToExcel = function() {
    if (typeof XLSX === 'undefined') { showToast('مكتبة Excel غير محملة', 'error'); return; }

    var certRecords = [];
    try {
        certRecords = JSON.parse(localStorage.getItem('lotus_certificate_records') || '[]');
    } catch (e) { console.error('خطأ في قراءة شهادات الموظفين:', e); return; }

    if (certRecords.length === 0) {
        showToast('لا توجد شهادات محفوظة للموظفين للتصدير', 'info');
        return;
    }

    var employeeRecords = [];
    var employeeCertificateTypes = {};

    certRecords.forEach(function(record) {
        var email = record.employeeUsername || '';
        var name = record.employeeName || '';
        var role = record.employeeRole || '';
        var timestamp = record.createdAt || record.updatedAt || '';

        employeeRecords.push({
            'اسم الموظف': name,
            'اسم المستخدم': email,
            'الدور': role,
            'اسم الطالب': record.studentName || '',
            'نوع الشهادة': record.certificateLabel || record.certificateType || '',
            'المجموع': record.totalScore || record.totalPercentage || 0,
            'المجموع المكافئ': record.equivalentScore || 0,
            'النسبة': record.totalPercentage || 0,
            'تاريخ الدخول': new Date(timestamp).toLocaleDateString('ar-EG'),
            'تاريخ الانتهاء': new Date(timestamp).toLocaleTimeString('ar-EG'),
            'تاريخ الإنشاء': new Date(timestamp).toLocaleString('ar-EG'),
            'نوع الشهادة الخام': record.certificateType || '',
            'تمت بواسطة': record.employeeUsername || record.employeeName || ''
        });

        var certType = record.certificateLabel || record.certificateType || '';
        if (!employeeCertificateTypes[certType]) employeeCertificateTypes[certType] = 0;
        employeeCertificateTypes[certType]++;
    });

    var currentDate = new Date().toLocaleDateString('ar-EG');
    var currentTime = new Date().toLocaleTimeString('ar-EG');

    var excelData = [];
    excelData.push({
        'عنوان التقرير': 'سجلات شهادات الموظفين',
        '': '',
        'الموقع': 'جامعه اللوتس',
        'التاريخ': currentDate,
        'الوقت': currentTime,
        'إجمالي السجلات': certRecords.length
    });

    excelData.push({ '': '', '': '', '': '', '': '', '': '', '': '' });

    excelData.push({
        'اسم الموظف': 'اسم الموظف',
        'اسم المستخدم': 'اسم المستخدم',
        'الدور': 'الدور',
        'اسم الطالب': 'اسم الطالب',
        'نوع الشهادة': 'نوع الشهادة',
        'المجموع': 'المجموع',
        'المجموع المكافئ': 'المجموع المكافئ',
        'النسبة': 'النسبة',
        'تاريخ الدخول': 'التاريخ',
        'تاريخ الانتهاء': 'الوقت',
        'تاريخ الإنشاء': 'تاريخ الإنشاء',
        'نوع الشهادة الخام': 'النوع الخام',
        'تمت بواسطة': 'تمت بواسطة'
    });

    employeeRecords.forEach(function(record) { excelData.push(record); });

    try {
        var ws = XLSX.utils.json_to_sheet(excelData, { skipHeader: true });
        ws['!cols'] = [
            { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 20 },
            { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 20 }
        ];
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'شهادات_الموظفين');
        
        var wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        var blob = new Blob([wbout], { type: 'application/octet-stream' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'شهادات_الموظفين_' + currentDate.replace(/\//g, '_') + '.xlsx';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('✅ تم تصدير شهادات الموظفين بنجاح إلى Excel', 'success');
    } catch (e) {
        console.error('خطأ في تصدير شهادات الموظفين:', e);
        showToast('❌ خطأ في تصدير البيانات: ' + e.message, 'error');
    }
};

// ==========================================
// ✅ DESK SERVICES MANAGEMENT IN PERMISSIONS
// ==========================================

var cachedDeskServices = [];
var permFormDocuments = [];
var permFormSteps = [];
var permFormAttachedFiles = [];
var currentPermEditingService = null;

function loadDeskServicesAdmin() {
    var tbody = document.getElementById('desk-services-tbody');
    if (!tbody) return;
    
    if (window.AUTH_DB) {
        window.AUTH_DB.ref('deskServices').on('value', function(snap) {
            try {
                cachedDeskServices = [];
                var val = snap.val();
                if (val) {
                    Object.keys(val).forEach(function(key) {
                        cachedDeskServices.push(Object.assign({ id: key }, val[key]));
                    });
                }
                renderDeskServicesTable();
            } catch(e) {
                console.error('Error loading desk services:', e);
                tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-danger">حدث خطأ في تحميل الخدمات: ' + escapeHtml(e.message) + '</td></tr>';
            }
        }, function(err) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-danger">حدث خطأ في تحميل الخدمات</td></tr>';
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-danger">تعذر الاتصال بقاعدة البيانات</td></tr>';
    }
}

function renderDeskServicesTable() {
    var tbody = document.getElementById('desk-services-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (cachedDeskServices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">لا توجد خدمات مكتبية مسجلة حالياً</td></tr>';
        return;
    }
    
    var categories = {
        proofs: 'إثباتات وقيد',
        transfers: 'تحويلات',
        cards: 'بطاقات جامعية',
        withdrawal: 'سحب ملفات',
        others: 'أخرى'
    };
    
    var html = '';
    cachedDeskServices.forEach(function(s, idx) {
        var date = s.lastUpdated ? new Date(s.lastUpdated).toLocaleDateString('ar-EG') : '—';
        var categoryName = categories[s.category] || s.category || 'غير محدد';
        var priceText = s.price > 0 ? s.price + ' ج.م' : 'مجانية';
        
        html += '<tr>' +
            '<td><strong>' + escapeHtml(s.name) + '</strong><br><small style="color:var(--text-muted); font-size:0.75rem;">' + escapeHtml((s.description || '').substring(0, 50)) + '...</small></td>' +
            '<td><span class="badge badge-emp">' + categoryName + '</span></td>' +
            '<td style="color:var(--accent-amber); font-weight:700;">' + priceText + '</td>' +
            '<td>' + escapeHtml(s.duration) + '</td>' +
            '<td style="direction:ltr; text-align:right;">' + date + '</td>' +
            '<td style="text-align:center;">' +
                '<button class="btn-action" style="background:var(--accent-blue); padding:4px 8px; font-size:0.75rem; margin-left:4px;" onclick="openPermissionsEditService(' + idx + ')"><i class="fas fa-edit"></i> تعديل</button>' +
                '<button class="btn-action" style="background:var(--accent-rose); padding:4px 8px; font-size:0.75rem;" onclick="deletePermService(\'' + s.id + '\')"><i class="fas fa-trash"></i></button>' +
            '</td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
}

function openPermissionsAddService() {
    currentPermEditingService = null;
    document.getElementById('perm-service-modal-title').innerHTML = `<i class="fas fa-file-pen me-2 text-info"></i> إضافة خدمة جديدة`;
    document.getElementById('perm-service-form').reset();
    document.getElementById('perm-form-service-id').value = '';
    
    permFormDocuments = [];
    permFormSteps = [];
    permFormAttachedFiles = [];
    
    renderPermFormTags();
    renderPermFormFilesTable();
    openPermModal('permDeskServiceModal');
}

function openPermissionsEditService(index) {
    var service = cachedDeskServices[index];
    if (!service) return;
    
    currentPermEditingService = service;
    document.getElementById('perm-service-modal-title').innerHTML = `<i class="fas fa-file-pen me-2 text-info"></i> تعديل الخدمة (${escapeHtml(service.name)})`;
    document.getElementById('perm-form-service-id').value = service.id;
    document.getElementById('perm-form-name').value = service.name;
    document.getElementById('perm-form-category').value = service.category;
    document.getElementById('perm-form-price').value = service.price;
    document.getElementById('perm-form-duration').value = service.duration;
    document.getElementById('perm-form-description').value = service.description;
    
    permFormDocuments = service.documents ? service.documents.slice() : [];
    permFormSteps = service.steps ? service.steps.slice() : [];
    
    permFormAttachedFiles = [];
    if (service.files) {
        Object.keys(service.files).forEach(function(fKey) {
            permFormAttachedFiles.push(Object.assign({
                fileId: fKey,
                isExisting: true
            }, service.files[fKey]));
        });
    }
    
    renderPermFormTags();
    renderPermFormFilesTable();
    openPermModal('permDeskServiceModal');
}

function openPermModal(id) {
    document.getElementById(id).classList.add('active');
}

function closePermServiceModal() {
    document.getElementById('permDeskServiceModal').classList.remove('active');
}

function renderPermFormTags() {
    var docsContainer = document.getElementById('perm-form-docs-tags');
    docsContainer.innerHTML = '';
    permFormDocuments.forEach(function(doc, i) {
        var pill = document.createElement('span');
        pill.className = 'pill-tag';
        pill.innerHTML = escapeHtml(doc) + ' <i class="fas fa-times-circle" onclick="removePermFormDoc(' + i + ')"></i>';
        docsContainer.appendChild(pill);
    });

    var stepsContainer = document.getElementById('perm-form-steps-tags');
    stepsContainer.innerHTML = '';
    permFormSteps.forEach(function(step, i) {
        var pill = document.createElement('span');
        pill.className = 'pill-tag';
        pill.innerHTML = (i+1) + '. ' + escapeHtml(step) + ' <i class="fas fa-times-circle" onclick="removePermFormStep(' + i + ')"></i>';
        stepsContainer.appendChild(pill);
    });
}

function removePermFormDoc(i) {
    permFormDocuments.splice(i, 1);
    renderPermFormTags();
}

function removePermFormStep(i) {
    permFormSteps.splice(i, 1);
    renderPermFormTags();
}

function setupPermissionsUploadListeners() {
    var dropZone = document.getElementById('perm-upload-drag-zone');
    var fileInput = document.getElementById('perm-file-upload-input');
    
    if (dropZone && fileInput) {
        dropZone.onclick = function() { fileInput.click(); };
        dropZone.addEventListener('dragover', function(e) { e.preventDefault(); dropZone.style.borderColor = 'var(--accent-cyan)'; });
        dropZone.addEventListener('dragleave', function() { dropZone.style.borderColor = 'var(--border)'; });
        dropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--border)';
            var files = Array.from(e.dataTransfer.files);
            processPermFormFiles(files);
        });
        fileInput.addEventListener('change', function(e) {
            var files = Array.from(e.target.files);
            processPermFormFiles(files);
        });
    }

    // Add Key listeners for tags
    document.getElementById('perm-form-doc-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            var val = this.value.trim();
            if (val && permFormDocuments.indexOf(val) === -1) {
                permFormDocuments.push(val);
                this.value = '';
                renderPermFormTags();
            }
        }
    });

    document.getElementById('perm-form-step-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            var val = this.value.trim();
            if (val && permFormSteps.indexOf(val) === -1) {
                permFormSteps.push(val);
                this.value = '';
                renderPermFormTags();
            }
        }
    });
}

function processPermFormFiles(files) {
    files.forEach(function(file) {
        if (file.size > 10 * 1024 * 1024) {
            alert('الملف "' + file.name + '" تجاوز الحد المسموح به (10 ميجابايت)');
            return;
        }
        var fileId = "file_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
        permFormAttachedFiles.push({
            fileId: fileId,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type || getFileTypeByName(file.name),
            purpose: 'template',
            fileRef: file,
            isExisting: false
        });
    });
    renderPermFormFilesTable();
}

function getFileTypeByName(name) {
  var ext = name.toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'doc' || ext === 'docx') return 'application/msword';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image/' + ext;
  return 'application/octet-stream';
}

function renderPermFormFilesTable() {
    var wrapper = document.getElementById('perm-form-files-list-wrapper');
    var tbody = document.getElementById('perm-form-files-tbody');
    if (!tbody || !wrapper) return;
    tbody.innerHTML = '';
    
    if (permFormAttachedFiles.length === 0) {
        wrapper.style.display = 'none';
        return;
    }
    
    wrapper.style.display = 'block';
    
    permFormAttachedFiles.forEach(function(file, i) {
        var tr = document.createElement('tr');
        var sz = formatBytes(file.fileSize);
        var icon = 'fa-file-alt';
        if (file.fileName.toLowerCase().endsWith('.pdf')) icon = 'fa-file-pdf text-danger';
        else if (file.fileName.toLowerCase().endsWith('.doc') || file.fileName.toLowerCase().endsWith('.docx')) icon = 'fa-file-word text-primary';
        else if (file.fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i)) icon = 'fa-file-image text-success';
        
        tr.innerHTML = '<td><i class="fas ' + icon + ' me-1"></i> ' + escapeHtml(file.fileName) + '</td>' +
            '<td class="text-center">' + sz + '</td>' +
            '<td class="text-center">' + file.fileType + '</td>' +
            '<td>' +
                '<select class="input-main" style="padding:4px 8px; font-size:0.75rem; width:100%; border-radius:6px;" onchange="updatePermFormFilePurpose(' + i + ', this.value)">' +
                    '<option value="template" ' + (file.purpose === 'template' ? 'selected' : '') + '>نموذج ورقي قابل للطباعة</option>' +
                    '<option value="attachment" ' + (file.purpose === 'attachment' ? 'selected' : '') + '>مرفق توضيحي/تعليمات</option>' +
                '</select>' +
            '</td>' +
            '<td class="text-center">' +
                '<button type="button" class="btn-action" style="background:var(--accent-rose); padding:4px 8px; font-size:0.7rem;" onclick="removePermFormFile(' + i + ')"><i class="fas fa-trash"></i></button>' +
            '</td>';
        tbody.appendChild(tr);
    });
}

function updatePermFormFilePurpose(index, val) {
    permFormAttachedFiles[index].purpose = val;
}

function removePermFormFile(index) {
    permFormAttachedFiles.splice(index, 1);
    renderPermFormFilesTable();
}

function formatBytes(bytes, decimals) {
  if (!bytes || bytes === 0) return '0 Bytes';
  var k = 1024;
  var dm = decimals === undefined ? 2 : decimals;
  var sizes = ['Bytes', 'KB', 'MB', 'GB'];
  var i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function escapeHtml(text) {
  if (!text) return '';
  var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
}

async function savePermService(event) {
    event.preventDefault();
    if (!window.AUTH_DB) {
        alert('خطأ: تعذر الاتصال بقاعدة البيانات.');
        return;
    }
    
    var serviceId = document.getElementById('perm-form-service-id').value;
    var isEdit = !!serviceId;
    
    var name = document.getElementById('perm-form-name').value.trim();
    var category = document.getElementById('perm-form-category').value;
    var price = parseFloat(document.getElementById('perm-form-price').value) || 0;
    var duration = document.getElementById('perm-form-duration').value.trim();
    var description = document.getElementById('perm-form-description').value.trim();
    
    if (!serviceId) {
        serviceId = "service_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
    }
    
    var updatedPart = "التفاصيل العامة";
    if (isEdit && currentPermEditingService) {
        var oldS = currentPermEditingService;
        var filesChanged = false;
        
        var oldFilesKeys = oldS.files ? Object.keys(oldS.files) : [];
        var newFilesKeys = permFormAttachedFiles.map(function(f) { return f.fileId; });
        
        if (oldFilesKeys.length !== newFilesKeys.length) {
            filesChanged = true;
        } else {
            var hasMismatch = permFormAttachedFiles.some(function(f) { return !f.isExisting; });
            if (hasMismatch) filesChanged = true;
        }
        
        var stepsChanged = JSON.stringify(oldS.steps || []) !== JSON.stringify(permFormSteps);
        var docsChanged = JSON.stringify(oldS.documents || []) !== JSON.stringify(permFormDocuments);
        var priceChanged = (oldS.price || 0) !== price;
        
        if (filesChanged) updatedPart = "المستندات";
        else if (stepsChanged) updatedPart = "الخطوات";
        else if (docsChanged) updatedPart = "الأوراق المطلوبة";
        else if (priceChanged) updatedPart = "السعر";
    } else {
        updatedPart = "الخدمة بالكامل";
    }
    
    var serviceMeta = {
        id: serviceId,
        name: name,
        category: category,
        price: price,
        duration: duration,
        description: description,
        documents: permFormDocuments,
        steps: permFormSteps,
        updatedPart: updatedPart,
        lastUpdated: new Date().toISOString(),
        createdAt: isEdit ? (currentPermEditingService.createdAt || new Date().toISOString()) : new Date().toISOString(),
        viewsCount: isEdit ? (currentPermEditingService.viewsCount || 0) : 0,
        files: {}
    };

    var finalFiles = {};
    var progressContainer = document.getElementById('perm-upload-progress-container');
    var progressBarFill = document.getElementById('perm-upload-progress-fill');
    var progressText = document.getElementById('perm-upload-progress-percent');
    var progressFilename = document.getElementById('perm-upload-progress-filename');

    for (var i = 0; i < permFormAttachedFiles.length; i++) {
        var fileObj = permFormAttachedFiles[i];
        if (fileObj.isExisting) {
            finalFiles[fileObj.fileId] = {
                fileName: fileObj.fileName,
                fileSize: fileObj.fileSize,
                fileType: fileObj.fileType,
                purpose: fileObj.purpose,
                downloadCount: fileObj.downloadCount || 0,
                printCount: fileObj.printCount || 0,
                url: fileObj.url || '',
                uploadedAt: fileObj.uploadedAt || new Date().toISOString()
            };
        } else {
            if (progressContainer) {
                progressFilename.textContent = 'جاري رفع: ' + fileObj.fileName;
                progressBarFill.style.width = '0%';
                progressText.textContent = '0%';
                progressContainer.style.display = 'block';
            }

            try {
                var fileMetadata = await uploadPermFileWithFallback(fileObj.fileRef, serviceId, fileObj.fileId, function(percent) {
                    if (progressBarFill) {
                        progressBarFill.style.width = percent + '%';
                        progressText.textContent = Math.round(percent) + '%';
                    }
                });
                
                finalFiles[fileObj.fileId] = {
                    fileName: fileObj.fileName,
                    fileSize: fileObj.fileSize,
                    fileType: fileObj.fileType,
                    purpose: fileObj.purpose,
                    downloadCount: 0,
                    printCount: 0,
                    url: fileMetadata.url,
                    uploadedAt: new Date().toISOString()
                };
            } catch (err) {
                console.error("Upload failed for file:", fileObj.fileName, err);
                alert('فشل رفع ملف (' + fileObj.fileName + ') - سيتم تخطيه للاستمرار.');
            }
        }
    }

    if (progressContainer) progressContainer.style.display = 'none';
    serviceMeta.files = finalFiles;

    try {
        await window.AUTH_DB.ref('deskServices/' + serviceId).set(serviceMeta);
        
        if (typeof window.authLogActivity === 'function') {
            var actionText = isEdit ? 'تعديل خدمة مكتبية' : 'إضافة خدمة مكتبية جديدة';
            await window.authLogActivity(
                isEdit ? 'edit' : 'create',
                'desk-services',
                serviceId,
                name,
                `${actionText} من الصلاحيات: تم تعديل ${updatedPart}`,
                'الخدمات المكتبية'
            );
        }
        
        alert(isEdit ? "تم تعديل الخدمة بنجاح وتحديث شارة الإشعار!" : "تم إضافة الخدمة بنجاح!");
        closePermServiceModal();
    } catch (err) {
        console.error("Database save failed:", err);
        alert('حدث خطأ أثناء الحفظ في قاعدة البيانات: ' + err.message);
    }
}

function uploadPermFileWithFallback(file, serviceId, fileId, progressCallback) {
  return new Promise(function(resolve, reject) {
    var storageCompleted = false;
    
    var triggerRTDBFallback = function(reason) {
      if (storageCompleted) return;
      storageCompleted = true;
      console.warn('Firebase Storage failed/timed out (' + reason + '), falling back to RTDB...');
      uploadPermFileToRTDB(file, serviceId, fileId, progressCallback).then(resolve).catch(reject);
    };

    try {
      if (typeof firebase !== 'undefined' && firebase.storage) {
        var storageApp = firebase.app('_lotus_auth');
        var storageRef = firebase.storage(storageApp).ref();
        var uploadPath = 'deskServices/' + serviceId + '/' + fileId + '_' + file.name;
        var uploadTask = storageRef.child(uploadPath).put(file);

        var timeoutId = setTimeout(function() {
          if (!storageCompleted) {
            try { uploadTask.cancel(); } catch (err) {}
            triggerRTDBFallback("Timeout after 3 seconds");
          }
        }, 3000);

        uploadTask.on('state_changed', 
          function(snapshot) {
            var percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            progressCallback(percent);
          }, 
          function(error) {
            clearTimeout(timeoutId);
            triggerRTDBFallback("Error event: " + error.message);
          }, 
          async function() {
            clearTimeout(timeoutId);
            if (storageCompleted) return;
            try {
              var downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
              storageCompleted = true;
              resolve({ url: downloadURL });
            } catch (err) {
              triggerRTDBFallback("getDownloadURL error: " + err.message);
            }
          }
        );
      } else {
        triggerRTDBFallback("firebase.storage is undefined");
      }
    } catch (e) {
      triggerRTDBFallback("Exception in storage setup: " + e.message);
    }
  });
}

function uploadPermFileToRTDB(file, serviceId, fileId, progressCallback) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    
    reader.onload = async function() {
      try {
        var base64Str = reader.result;
        var chunkSize = 2.5 * 1024 * 1024;
        var chunks = [];
        var offset = 0;
        
        while (offset < base64Str.length) {
          chunks.push(base64Str.substring(offset, offset + chunkSize));
          offset += chunkSize;
        }

        if (window.AUTH_DB) {
          progressCallback(10);
          await window.AUTH_DB.ref('deskServicesFiles/' + serviceId + '/' + fileId).set({
            fileName: file.name,
            chunks: chunks,
            uploadedAt: new Date().toISOString()
          });
          progressCallback(100);
          resolve({ url: 'db_fallback' });
        } else {
          reject(new Error("Database not connected"));
        }
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = function(err) { reject(err); };
    reader.readAsDataURL(file);
  });
}

async function deletePermService(serviceId) {
    var service = cachedDeskServices.find(function(s) { return s.id === serviceId; });
    if (!service) return;
    
    if (!confirm('هل أنت متأكد من حذف الخدمة المكتبية (' + service.name + ') وجميع ملفاتها نهائياً؟')) return;
    
    try {
        if (window.AUTH_DB) {
            await window.AUTH_DB.ref('deskServices/' + serviceId).remove();
            await window.AUTH_DB.ref('deskServicesFiles/' + serviceId).remove();
            
            if (service.files) {
                var fileKeys = Object.keys(service.files);
                for (var fi = 0; fi < fileKeys.length; fi++) {
                    var file = service.files[fileKeys[fi]];
                    if (file.url && file.url !== 'db_fallback' && file.url.indexOf('firebasestorage') !== -1) {
                        try {
                            var storageApp = firebase.app('_lotus_auth');
                            var storageRef = firebase.storage(storageApp).refFromURL(file.url);
                            await storageRef.delete();
                        } catch(e) {}
                    }
                }
            }
            
            if (typeof window.authLogActivity === 'function') {
                await window.authLogActivity('delete', 'desk-services', serviceId, service.name, 'حذف الخدمة المكتبية: ' + service.name, 'الخدمات المكتبية');
            }
            
            alert('✅ تم حذف الخدمة بنجاح.');
        }
    } catch (e) {
        console.error('Delete service error:', e);
        alert('❌ حدث خطأ أثناء حذف الخدمة.');
    }
}
