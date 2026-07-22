// ============================
// PERMISSIONS MANAGEMENT (FIXED v2)
// ============================

const ALL_PERMISSIONS = [
    { id: 'view', name: 'عرض البيانات الأساسية' },
    { id: 'create', name: 'إنشاء/إضافة بيانات' },
    { id: 'edit', name: 'تعديل البيانات' },
    { id: 'delete', name: 'حذف البيانات' },
    { id: 'manage_employees', name: 'إدارة الموظفين' },
    { id: 'manage_settings', name: 'إدارة إعدادات النظام' },
    { id: 'view_logs', name: 'استعراض السجلات' },
    { id: 'manage_delivery', name: 'إدارة التسليمات (سحب/إيداع)' },
    { id: 'upload_files', name: 'رفع الملفات المجمعة' },
    { id: 'access_file_management', name: 'نظام إدارة الملفات' },
    { id: 'access_withdrawal', name: 'نظام السحب والإيداع' },
    { id: 'access_certificate', name: 'نظام حساب الشهادات' },
    { id: 'access_desk_services', name: 'الخدمات المكتبية والمعاملات' }
];

// ✅ صلاحيات ثابتة للمدير العام - لا يمكن تعديلها أبداً
const ADMIN_FIXED_PERMISSIONS = [
    'view', 'create', 'edit', 'delete', 
    'manage_employees', 'manage_settings', 'view_logs', 
    'manage_delivery', 'upload_files',
    'access_file_management', 'access_withdrawal', 'access_certificate',
    'access_desk_services'
];

let cachedEmployees = [];

document.addEventListener('DOMContentLoaded', async () => {
    const user = window.getCurrentUser();
    if (!user || user.username !== 'boles') {
        alert('ليس لديك صلاحية للدخول إلى هذه الصفحة. هذه الصفحة مخصصة للمدير العام فقط.');
        window.location.href = '../../index.html';
        return;
    }

    const savedTheme = localStorage.getItem('dash_theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);

    await loadEmployees();
});

function switchTab(tab, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    const activeBtn = btn || document.querySelector(`.tab-btn[onclick*="switchTab('${tab}')"]`);
    if (activeBtn) activeBtn.classList.add('active');
    const content = document.getElementById('tab-' + tab);
    if (content) content.classList.add('active');

    if (tab === 'logs') loadLogs();
    if (tab === 'certificates') loadCertRecords();
}

async function loadEmployees() {
    const container = document.getElementById('users-container');
    try {
        // ✅ تحميل من Firebase أولاً ثم localStorage
        cachedEmployees = await window.authGetAllEmployees();
        
        // ✅ مزامنة مع Firebase للتأكد من وجود boles بالصلاحيات الكاملة
        await syncBolesPermissions();
        
        renderEmployees();
    } catch (e) {
        console.error('Error loading employees:', e);
        container.innerHTML = '<div class="alert alert-danger">حدث خطأ أثناء تحميل المستخدمين</div>';
    }
}

// ✅ دالة لتأكيد صلاحيات boles في Firebase
async function syncBolesPermissions() {
    if (typeof window.AUTH_DB === 'undefined' || !window.AUTH_DB) return;
    
    try {
        const bolesSnap = await window.AUTH_DB.ref('employees/boles').once('value');
        if (bolesSnap.exists()) {
            const bolesData = bolesSnap.val();
            let needsUpdate = false;
            
            if (bolesData.role !== 'admin') {
                bolesData.role = 'admin';
                needsUpdate = true;
            }
            if (!bolesData.permissions || bolesData.permissions.length < ADMIN_FIXED_PERMISSIONS.length) {
                bolesData.permissions = [...ADMIN_FIXED_PERMISSIONS];
                needsUpdate = true;
            }
            if (bolesData.active !== true) {
                bolesData.active = true;
                needsUpdate = true;
            }
            
            if (needsUpdate) {
                await window.AUTH_DB.ref('employees/boles').update(bolesData);
                console.log('[PERMISSIONS] Synced boles permissions to Firebase');
            }
        }
    } catch (e) {
        console.warn('[PERMISSIONS] Could not sync boles:', e.message);
    }
}

function renderEmployees() {
    const container = document.getElementById('users-container');
    container.innerHTML = '';
    
    // ✅ إزالة التكرارات قبل العرض
    const seen = new Set();
    const uniqueEmployees = [];
    for (const emp of cachedEmployees) {
        if (!emp || !emp.username) continue;
        if (seen.has(emp.username)) continue;
        seen.add(emp.username);
        
        // ✅ تأكيد صلاحيات boles
        if (emp.username === 'boles') {
            emp.role = 'admin';
            emp.permissions = [...ADMIN_FIXED_PERMISSIONS];
            emp.active = true;
        }
        
        uniqueEmployees.push(emp);
    }
    
    uniqueEmployees.forEach((emp, index) => {
        // Determine active permissions
        let activePerms = [];
        if (emp.permissions && Array.isArray(emp.permissions)) {
            activePerms = emp.permissions;
        } else {
            activePerms = window.AUTH_ROLE_PERMISSIONS[emp.role] || [];
        }
        
        // ✅ تأكيد صلاحيات boles مرة أخرى
        if (emp.username === 'boles') {
            activePerms = [...ADMIN_FIXED_PERMISSIONS];
        }

        const roleName = emp.role === 'admin' ? 'مدير' : (emp.role === 'supervisor' ? 'مشرف' : (emp.role === 'viewer' ? 'مشاهد' : 'موظف'));
        const badgeClass = emp.role === 'admin' ? 'badge-admin' : 'badge-emp';

        let permsHtml = '';
        ALL_PERMISSIONS.forEach(p => {
            const isChecked = activePerms.includes(p.id) ? 'checked' : '';
            // ✅ تعطيل تعديل صلاحيات boles
            const disabled = emp.username === 'boles' ? 'disabled' : '';
            permsHtml += `
                <label class="perm-item">
                    <input type="checkbox" id="perm_${index}_${p.id}" value="${p.id}" ${isChecked} ${disabled}>
                    <span>${p.name}</span>
                </label>
            `;
        });

        // ✅ عرض كلمة المرور بشكل أفضل
        let currentPassword = 'غير معروفة';
        if (emp.plainPassword) {
            currentPassword = emp.plainPassword;
        } else if (emp.password === window.authHashPassword('123456')) {
            currentPassword = '123456';
        } else if (emp.password === window.authHashPassword('8520')) {
            currentPassword = '8520';
        }

        const card = document.createElement('div');
        card.className = 'col-md-6 mb-4';
        card.innerHTML = `
            <div class="card h-100">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
                    <div>
                        <h4 style="margin:0; font-family:'Changa', sans-serif; font-weight:700; color:#fff;">
                            ${emp.name || 'بدون اسم'} 
                            <span class="badge ${badgeClass}">${roleName}</span>
                            ${emp.username === 'boles' ? ' <span class="badge" style="background:rgba(245,158,11,0.3);color:#fff;border:1px solid rgba(245,158,11,0.5);">🔒 محمي</span>' : ''}
                        </h4>
                        <div style="color:#ffffff; font-weight:700; font-size:0.85rem; margin-top:4px;">
                            <i class="fas fa-user me-1"></i> ${emp.username}
                        </div>
                    </div>
                </div>
                
                <div class="row g-2 mb-3">
                    <div class="col-6">
                        <label style="font-size:0.85rem; font-weight:700; color:#ffffff; margin-bottom:4px;">تعديل الاسم</label>
                        <input type="text" class="input-main" id="name_${index}" value="${emp.name || ''}">
                    </div>
                    <div class="col-6">
                        <label style="font-size:0.85rem; font-weight:700; color:#ffffff; margin-bottom:4px;">الرتبة (الصفة)</label>
                        <select class="input-main" id="role_${index}" ${emp.username === 'boles' ? 'disabled' : ''}>
                            <option value="admin" ${emp.role === 'admin' ? 'selected' : ''}>مدير</option>
                            <option value="supervisor" ${emp.role === 'supervisor' ? 'selected' : ''}>مشرف</option>
                            <option value="employee" ${emp.role === 'employee' ? 'selected' : ''}>موظف</option>
                            <option value="viewer" ${emp.role === 'viewer' ? 'selected' : ''}>مشاهد</option>
                        </select>
                    </div>
                    <div class="col-12 mt-2" style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px;">
                        <label style="font-size:0.85rem; font-weight:700; color:#ffffff; margin-bottom:4px;">
                            كلمة المرور الحالية: 
                            <span style="color:var(--accent-amber); direction:ltr; display:inline-block;">${currentPassword}</span>
                        </label>
                        <div style="display:flex; gap: 8px; margin-top: 8px;">
                            <input type="password" class="input-main" id="pass_${index}" placeholder="تغيير كلمة المرور (اختياري)" style="direction:ltr;">
                            <button class="btn-action" style="background: var(--text-secondary); white-space:nowrap;" onclick="resetPassword(${index}, '${emp.username}')" title="إعادة ضبط إلى 123456">
                                <i class="fas fa-undo"></i> Reset
                            </button>
                        </div>
                    </div>
                </div>

                <div style="border-top: 1px solid var(--border); padding-top: 12px; margin-top: 12px;">
                    <h5 style="font-size:0.95rem; font-weight:700; color:#fff; margin-bottom:10px;">
                        <i class="fas fa-shield-alt me-1 text-warning"></i> 
                        الصلاحيات المخصصة
                        ${emp.username === 'boles' ? ' <span style="font-size:0.7rem;color:var(--accent-amber);">(ثابتة - لا يمكن تعديلها)</span>' : ''}
                    </h5>
                    <div class="perm-grid">
                        ${permsHtml}
                    </div>
                </div>
                
                <div class="mt-4" style="display:flex; justify-content:space-between; align-items:center;">
                    ${emp.username === 'boles' ? 
                        '<div><small style="color:var(--text-secondary);">🔒 مدير النظام الأساسي لا يمكن حذفه أو تعديل صلاحياته</small></div>' : 
                        `<button class="btn-action" style="background:var(--accent-rose);" onclick="deleteEmployee('${emp.username}')"><i class="fas fa-trash me-1"></i> حذف الموظف</button>`
                    }
                    <div class="text-end">
                        <span id="msg_${index}" style="font-size:0.85rem; font-weight:bold; margin-left:12px;"></span>
                        <button class="btn-action" onclick="saveUser(${index}, '${emp.username}')">
                            <i class="fas fa-save me-1"></i> حفظ التعديلات
                        </button>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

async function saveUser(index, username) {
    const emp = cachedEmployees.find(e => e.username === username);
    if (!emp) return;

    // ✅ منع تعديل صلاحيات boles
    if (username === 'boles') {
        const msgEl = document.getElementById('msg_' + index);
        msgEl.textContent = '🔒 لا يمكن تعديل صلاحيات مدير النظام الأساسي!';
        msgEl.style.color = 'var(--accent-amber)';
        setTimeout(() => { msgEl.textContent = ''; }, 3000);
        
        // مع ذلك نحفظ الاسم وكلمة المرور فقط
        const newName = document.getElementById('name_' + index).value.trim();
        const newPass = document.getElementById('pass_' + index).value;
        
        if (newName) emp.name = newName;
        if (newPass) {
            emp.password = window.authHashPassword(newPass);
            emp.plainPassword = newPass;
        }
        
        // ✅ تأكيد الصلاحيات الثابتة
        emp.role = 'admin';
        emp.permissions = [...ADMIN_FIXED_PERMISSIONS];
        emp.active = true;
        
        try {
            msgEl.textContent = 'جاري الحفظ...';
            msgEl.style.color = 'var(--text-secondary)';
            
            // ✅ حفظ في Firebase أولاً
            await saveEmployeeToFirebase(emp);
            await window.authSaveEmployeeToDb(emp);
            await window.authLogActivity('تعديل', 'نظام الصلاحيات', emp.username, emp.name, 'تم تعديل بيانات مدير النظام (الصلاحيات ثابتة)', 'نظام الصلاحيات');
            
            msgEl.textContent = '✅ تم الحفظ!';
            msgEl.style.color = 'var(--accent-emerald)';
            setTimeout(() => { msgEl.textContent = ''; }, 3000);
            
            await loadEmployees();
        } catch(e) {
            msgEl.textContent = '❌ حدث خطأ!';
            msgEl.style.color = 'var(--accent-rose)';
        }
        return;
    }

    const newName = document.getElementById('name_' + index).value.trim();
    const newRole = document.getElementById('role_' + index).value;
    const newPass = document.getElementById('pass_' + index).value;
    const msgEl = document.getElementById('msg_' + index);

    if (!newName) {
        msgEl.textContent = '⚠️ الاسم مطلوب!';
        msgEl.style.color = 'var(--accent-rose)';
        return;
    }

    emp.name = newName;
    emp.role = newRole;

    if (newPass) {
        emp.password = window.authHashPassword(newPass);
        emp.plainPassword = newPass;
    }

    // ✅ جمع الصلاحيات المخصصة
    const customPerms = [];
    ALL_PERMISSIONS.forEach(p => {
        const cb = document.getElementById(`perm_${index}_${p.id}`);
        if (cb && cb.checked) customPerms.push(p.id);
    });
    
    emp.permissions = customPerms;

    try {
        msgEl.textContent = 'جاري الحفظ...';
        msgEl.style.color = 'var(--text-secondary)';
        
        // ✅ حفظ في Firebase أولاً
        await saveEmployeeToFirebase(emp);
        await window.authSaveEmployeeToDb(emp);
        await window.authLogActivity('تعديل', 'نظام الصلاحيات', emp.username, emp.name, 'تم تعديل بيانات أو صلاحيات الموظف', 'نظام الصلاحيات');
        
        msgEl.textContent = '✅ تم الحفظ بنجاح!';
        msgEl.style.color = 'var(--accent-emerald)';
        
        setTimeout(() => { msgEl.textContent = ''; }, 3000);
        
        // إعادة تحميل القائمة للتحديث
        await loadEmployees();
    } catch(e) {
        console.error('Save error:', e);
        msgEl.textContent = '❌ حدث خطأ!';
        msgEl.style.color = 'var(--accent-rose)';
    }
}

// ✅ دالة لحفظ الموظف مباشرة في Firebase
async function saveEmployeeToFirebase(emp) {
    if (typeof window.AUTH_DB === 'undefined' || !window.AUTH_DB) return;
    
    const key = emp.username.replace(/[.#$\/\[\]]/g, '_');
    const empData = {
        username: emp.username,
        name: emp.name || '',
        password: emp.password || '',
        role: emp.role || 'employee',
        active: emp.active !== false,
        permissions: emp.permissions || [],
        employeeId: emp.employeeId || emp.username,
        createdAt: emp.createdAt || new Date().toISOString()
    };
    if (emp.plainPassword) empData.plainPassword = emp.plainPassword;
    
    await window.AUTH_DB.ref('employees/' + key).update(empData);
}

async function deleteEmployee(username) {
    // ✅ منع حذف boles
    if (username === 'boles') {
        alert('🔒 لا يمكن حذف مدير النظام الأساسي!');
        return;
    }
    
    if (!confirm(`هل أنت متأكد من حذف الموظف: ${username} نهائياً؟\n\n⚠️ لا يمكن التراجع عن هذا الإجراء.`)) {
        return;
    }
    
    try {
        await window.authDeleteEmployeeFromDb(username);
        await window.authLogActivity('حذف', 'نظام الصلاحيات', username, username, 'تم حذف الموظف نهائياً', 'نظام الصلاحيات');
        alert('✅ تم حذف الموظف بنجاح.');
        await loadEmployees();
    } catch (e) {
        console.error('Delete error:', e);
        alert('❌ حدث خطأ أثناء الحذف.');
    }
}

async function resetPassword(index, username) {
    if (!confirm(`هل أنت متأكد من إعادة ضبط كلمة مرور ${username} إلى 123456؟`)) return;
    
    const emp = cachedEmployees.find(e => e.username === username);
    if (!emp) return;
    
    emp.password = window.authHashPassword('123456');
    emp.plainPassword = '123456';
    
    // ✅ تأكيد صلاحيات boles
    if (username === 'boles') {
        emp.role = 'admin';
        emp.permissions = [...ADMIN_FIXED_PERMISSIONS];
    }
    
    try {
        // ✅ حفظ في Firebase أولاً
        await saveEmployeeToFirebase(emp);
        await window.authSaveEmployeeToDb(emp);
        await window.authLogActivity('تعديل', 'نظام الصلاحيات', username, emp.name, 'تم إعادة ضبط كلمة المرور للموظف', 'نظام الصلاحيات');
        alert('✅ تم إعادة ضبط كلمة المرور بنجاح.');
        await loadEmployees();
    } catch (e) {
        console.error('Reset error:', e);
        alert('❌ حدث خطأ.');
    }
}

async function addNewEmployee() {
    const username = document.getElementById('new_username').value.trim();
    const name = document.getElementById('new_name').value.trim();
    const password = document.getElementById('new_password').value;
    const msgEl = document.getElementById('new_emp_msg');

    if (!username || !name || !password) {
        msgEl.textContent = '⚠️ يرجى إدخال اسم المستخدم، الاسم بالكامل، وكلمة المرور';
        msgEl.style.color = 'var(--accent-rose)';
        return;
    }

    // ✅ منع إنشاء مستخدم باسم boles
    if (username.toLowerCase() === 'boles') {
        msgEl.textContent = '🔒 اسم المستخدم "boles" محجوز لمدير النظام!';
        msgEl.style.color = 'var(--accent-rose)';
        return;
    }

    const exists = cachedEmployees.find(e => e.username === username);
    if (exists) {
        msgEl.textContent = '⚠️ اسم المستخدم موجود بالفعل!';
        msgEl.style.color = 'var(--accent-rose)';
        return;
    }

    msgEl.textContent = 'جاري الإضافة...';
    msgEl.style.color = 'var(--text-secondary)';

    const newEmp = {
        username: username,
        name: name,
        password: window.authHashPassword(password),
        plainPassword: password,
        role: 'employee',
        active: true,
        createdAt: new Date().toISOString(),
        employeeId: username,
        permissions: [...(window.AUTH_ROLE_PERMISSIONS['employee'] || [])]
    };

    try {
        // ✅ حفظ في Firebase أولاً
        await saveEmployeeToFirebase(newEmp);
        await window.authSaveEmployeeToDb(newEmp);
        await window.authLogActivity('إضافة', 'نظام الصلاحيات', username, name, 'تم إضافة موظف جديد', 'نظام الصلاحيات');
        
        msgEl.textContent = '✅ تمت إضافة الموظف بنجاح!';
        msgEl.style.color = 'var(--accent-emerald)';
        
        document.getElementById('new_username').value = '';
        document.getElementById('new_name').value = '';
        document.getElementById('new_password').value = '';
        
        setTimeout(() => { msgEl.textContent = ''; }, 3000);
        await loadEmployees();
    } catch (e) {
        console.error('Add error:', e);
        msgEl.textContent = '❌ حدث خطأ أثناء إضافة الموظف!';
        msgEl.style.color = 'var(--accent-rose)';
    }
}

// ==================== LOGS ====================

function loadLogs() {
    const tbody = document.getElementById('logs-tbody');
    if (!tbody) return;
    
    try {
        const raw = localStorage.getItem('lotus_activity_log') || '[]';
        const logs = JSON.parse(raw);
        
        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">لا توجد حركات مسجلة حتى الآن</td></tr>';
            return;
        }

        let html = '';
        logs.forEach(log => {
            const date = new Date(log.timestamp);
            const dateStr = date.toLocaleDateString('ar-EG') + ' ' + date.toLocaleTimeString('ar-EG');
            
            let systemBadgeStyle = 'background: rgba(245,158,11,0.25); color: #fff; border: 1px solid rgba(245,158,11,0.5); font-size:0.75rem; padding:3px 8px; border-radius:4px; font-weight:700; ';
            if (log.system === 'نظام الملفات') {
                systemBadgeStyle = 'background: rgba(16,185,129,0.25); color: #fff; border: 1px solid rgba(16,185,129,0.5); font-size:0.75rem; padding:3px 8px; border-radius:4px; font-weight:700; ';
            } else if (log.system === 'نظام السحب') {
                systemBadgeStyle = 'background: rgba(59,130,246,0.25); color: #fff; border: 1px solid rgba(59,130,246,0.5); font-size:0.75rem; padding:3px 8px; border-radius:4px; font-weight:700; ';
            } else if (log.system === 'حساب الشهادات') {
                systemBadgeStyle = 'background: rgba(139,92,246,0.25); color: #fff; border: 1px solid rgba(139,92,246,0.5); font-size:0.75rem; padding:3px 8px; border-radius:4px; font-weight:700; ';
            }

            const detailsText = log.details || '';

            html += `
                <tr>
                    <td style="direction:ltr; text-align:right;">${dateStr}</td>
                    <td><strong>${log.employeeName || '—'}</strong><br><small style="color:#fff;">${log.employeeUsername || '—'}</small></td>
                    <td style="color:#fff; font-weight:700;">${log.action || '—'}</td>
                    <td><span style="color:#fff; font-weight:700;">${log.targetType || '—'}</span><br><small style="color:#fff;">${log.targetName || '—'}</small></td>
                    <td><span class="badge" style="${systemBadgeStyle}">${log.system || 'عام'}</span></td>
                    <td style="color:#fff;">${detailsText}</td>
                </tr>`;
        });
        tbody.innerHTML = html;
    } catch(e) {
        console.error('Logs error:', e);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-danger">حدث خطأ في تحميل السجل</td></tr>';
    }
}

function clearLogs() {
    if (confirm('⚠️ هل أنت متأكد من مسح جميع السجلات؟ لا يمكن التراجع عن هذا الإجراء.')) {
        localStorage.setItem('lotus_activity_log', '[]');
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

function loadCertRecords() {
    // Live sync from the unified Firebase DB
    try {
        if (window.AUTH_DB && typeof window.AUTH_DB.ref === 'function') {
            window.AUTH_DB.ref('certificateRecords').on('value', function(snap) {
                try {
                    const val = snap.val() || {};
                    const list = Object.keys(val).map(k => val[k]);
                    list.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
                    saveCertRecords(list);
                    renderCertRecordsTable();
                } catch (e) { 
                    console.error('Cert sync error:', e);
                    renderCertRecordsTable(); 
                }
            });
        } else {
            renderCertRecordsTable();
        }
    } catch(e) { 
        console.error('Cert load error:', e);
        renderCertRecordsTable(); 
    }
}

function renderCertRecordsTable() {
    const tbody = document.getElementById('certRecords-tbody');
    if (!tbody) return;
    
    try {
        let records = getCertRecords();
        const q = document.getElementById('certRecordsSearch')?.value?.trim()?.toLowerCase() || '';
        
        if (q) {
            records = records.filter(r => {
                const student = (r.studentName || '').toLowerCase();
                const emp = (r.employeeName || r.employeeUsername || '').toLowerCase();
                return student.includes(q) || emp.includes(q);
            });
        }

        if (records.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4">لا توجد شهادات محفوظة${q ? ' تطابق البحث' : ''}</td></tr>`;
            return;
        }

        const tabNames = { 
            thanaweya: 'المصرية', stem: 'STEM', azhar: 'الأزهرية', 
            saudi: 'السعودية', gulf: 'عمان-قطر-الإمارات', libya: 'ليبيا', 
            jordan: 'الأردن', kuwait: 'الكويت', bahrain: 'البحرين', american: 'أمريكان دبلومة' 
        };

        // Group by employee
        const groups = {};
        records.forEach(r => {
            const empUser = r.employeeUsername || '';
            const empName = r.employeeName || r.employeeUsername || '—';
            const key = empUser + '||' + empName;
            if (!groups[key]) groups[key] = [];
            groups[key].push(r);
        });

        let html = '';
        let gi = 0;
        Object.keys(groups).forEach(gk => {
            gi++;
            const parts = gk.split('||');
            const empUser = parts[0], empName = parts[1];
            const list = groups[gk];
            const count = list.length;
            const gid = 'emp' + gi;
            
            html += `<tr class="emp-group-row" style="cursor:pointer;background:rgba(245,158,11,0.10);" onclick="toggleEmpGroup('${gid}')">
                <td colspan="8" style="padding:10px 14px;">
                    <span id="${gid}_arrow" style="display:inline-block;transition:transform .2s;margin-left:8px;color:var(--accent-amber);font-weight:900;">▶</span>
                    <strong style="color:#fff;font-size:1rem;">${empName}</strong>
                    <span style="color:var(--text-secondary);font-size:0.8rem;">${empUser ? ' (' + empUser + ') · ' : ''}${count} شهادة</span>
                </td>
            </tr>`;
            
            list.forEach(r => {
                const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString('ar-EG') : '—';
                const label = r.certificateLabel || tabNames[r.certificateType] || r.certificateType || '—';
                const total = r.totalScore != null ? r.totalScore : '—';
                const equiv = r.equivalentScore != null ? r.equivalentScore : '—';
                const pct = r.totalPercentage != null ? r.totalPercentage.toFixed(1) + '%' : '—';
                
                html += `<tr class="emp-detail-${gid}" style="display:none;background:rgba(255,255,255,0.02);">
                    <td style="direction:ltr;text-align:right;color:var(--text-muted);font-size:0.8rem;padding-right:34px;">${date}</td>
                    <td><strong style="color:var(--accent-amber);cursor:pointer;text-decoration:underline;text-decoration-style:dotted;" onclick="viewCertRecordDetail('${r.id}')">${r.studentName || '—'}</strong></td>
                    <td><span class="badge" style="background:rgba(139,92,246,0.25);color:#fff;border:1px solid rgba(139,92,246,0.5);font-size:0.75rem;padding:3px 8px;border-radius:4px;font-weight:700;">${label}</span></td>
                    <td style="color:#fff;font-weight:700;">${total}</td>
                    <td style="color:var(--accent-amber);font-weight:700;">${equiv}</td>
                    <td style="color:var(--accent-emerald);font-weight:900;">${pct}</td>
                    <td style="color:#fff;">${empName}</td>
                    <td><button class="btn-action" style="background:var(--accent-rose);padding:4px 10px;font-size:0.75rem;" onclick="deleteCertRecordAdmin('${r.id}')"><i class="fas fa-trash"></i></button></td>
                </tr>`;
            });
        });
        tbody.innerHTML = html;
    } catch(e) {
        console.error('Render cert error:', e);
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-danger">حدث خطأ في تحميل السجل</td></tr>';
    }
}

function toggleEmpGroup(gid) {
    try {
        const rows = document.querySelectorAll('.emp-detail-' + gid);
        const arrow = document.getElementById(gid + '_arrow');
        const show = rows.length > 0 && rows[0].style.display === 'none';
        rows.forEach(r => { r.style.display = show ? '' : 'none'; });
        if (arrow) arrow.style.transform = show ? 'rotate(90deg)' : 'rotate(0deg)';
    } catch(e) {}
}

function deleteCertRecordAdmin(id) {
    if (!confirm('⚠️ هل أنت متأكد من حذف سجل الشهادة هذا؟')) return;
    
    let records = getCertRecords();
    records = records.filter(r => r.id !== id);
    saveCertRecords(records);
    
    if (window.AUTH_DB && typeof window.AUTH_DB.ref === 'function') {
        window.AUTH_DB.ref('certificateRecords/' + id).remove().catch(() => {});
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
        window.AUTH_DB.ref('certificateRecords').remove().catch(() => {});
    }
    
    renderCertRecordsTable();
    
    try { 
        if (typeof window.authLogActivity === 'function') {
            window.authLogActivity('مسح', 'حساب الشهادات', '', '', 'مسح جميع سجلات الشهادات من لوحة الإدارة'); 
        }
    } catch(e) {}
}

// ==================== EXPORT/IMPORT ====================

async function manualExportBackup() {
    if (!confirm('هل تريد تصدير نسخة احتياطية كاملة من قاعدة بيانات النظام؟')) return;
    
    const progEl = document.getElementById('export-progress-overlay');
    const progFill = document.getElementById('export-progress-fill');
    const progText = document.getElementById('export-progress-text');
    
    if (progEl) progEl.style.display = 'flex';
    
    function setProg(pct, txt) { 
        if (progFill) progFill.style.width = pct + '%'; 
        if (progText) progText.textContent = txt || ''; 
    }
    
    try {
        setProg(5, 'جاري قراءة بيانات الطلاب...');
        let students = {}, withdrawals = {}, colleges = {}, employees = {}, logs = [], config = {}, certRecords = [];

        try { 
            const s = JSON.parse(localStorage.getItem('lotus_students') || '[]'); 
            if (Array.isArray(s)) s.forEach(st => { students[st.id || st.studentCode] = st; }); 
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
                const snap = await window.AUTH_DB.ref('students').once('value'); 
                if (snap.exists()) students = { ...students, ...snap.val() }; 
            } catch(e) {}
            
            setProg(50, 'جاري مزامنة سجل النشاطات والشهادات...');
            try { 
                const snap = await window.AUTH_DB.ref('activityLog').once('value'); 
                if (snap.exists()) { 
                    const fb = snap.val(); 
                    Object.keys(fb).forEach(k => { 
                        if (!logs.find(l => l.timestamp === fb[k].timestamp)) logs.push(fb[k]); 
                    }); 
                } 
            } catch(e) {}
            
            try { 
                const snap = await window.AUTH_DB.ref('certificateRecords').once('value'); 
                if (snap.exists()) { 
                    const fb = snap.val(); 
                    certRecords = Object.keys(fb).map(k => fb[k]); 
                } 
            } catch(e) {}
        }
        
        setProg(60, 'جاري مزامنة بيانات السحب...');
        if (typeof window.WITHDRAWAL_DB !== 'undefined' && window.WITHDRAWAL_DB) {
            try { 
                const snap = await window.WITHDRAWAL_DB.ref('withdrawalRequests').once('value'); 
                if (snap.exists()) withdrawals = snap.val(); 
            } catch(e) {}
            
            setProg(70, 'جاري مزامنة بيانات الكليات...');
            try { 
                const snap = await window.WITHDRAWAL_DB.ref('colleges').once('value'); 
                if (snap.exists()) colleges = snap.val(); 
            } catch(e) {}
        }
        
        setProg(80, 'جاري تجميع النسخة الاحتياطية...');
        const backup = {
            students,
            withdrawalRequests: withdrawals,
            colleges,
            employees,
            activityLog: logs,
            certificateRecords: certRecords,
            config,
            backupTime: new Date().toISOString(),
            version: '2.0'
        };
        
        setProg(90, 'جاري إنشاء ملف التصدير...');
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const dateStr = new Date().toISOString().split('T')[0];
        const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const dayName = days[new Date().getDay()];
        
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `نسخة_احتياطية_كاملة_${dateStr}_${dayName}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        
        if (window.authLogActivity) {
            window.authLogActivity('export_backup', 'نظام الصلاحيات', '', '', 'تصدير يدوي لنسخة احتياطية كاملة من النظام', 'نظام الصلاحيات');
        }
        
        setProg(100, '✅ تم بنجاح!');
        await new Promise(r => setTimeout(r, 500));
        if (progEl) progEl.style.display = 'none';
        alert('✅ تم تصدير النسخة الاحتياطية بنجاح!');
    } catch (err) {
        console.error('Export error:', err);
        if (progEl) progEl.style.display = 'none';
        alert('❌ حدث خطأ أثناء التصدير: ' + err.message);
    }
}

async function manualImportBackup(input) {
    const file = input.files[0];
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
        
        const text = await file.text();
        const backup = JSON.parse(text);
        
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
        
        if (backup.certificateRecords && Array.isArray(backup.certificateRecords)) {
            const certObj = {};
            backup.certificateRecords.forEach(r => { if (r.id) certObj[r.id] = r; });
            await window.AUTH_DB.ref('certificateRecords').set(certObj);
            localStorage.setItem('lotus_certificate_records', JSON.stringify(backup.certificateRecords));
        }
        
        if (backup.employees) {
            const list = [];
            if (Array.isArray(backup.employees)) {
                backup.employees.forEach(e => { if (e.username) list.push(e); });
            } else {
                Object.keys(backup.employees).forEach(k => {
                    list.push({ username: k, ...backup.employees[k] });
                });
            }
            localStorage.setItem('lotus_employees', JSON.stringify(list));
        }
        
        if (window.authLogActivity) {
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

// ==================== MODAL CLOSE HANDLERS ====================

document.addEventListener('click', function(e) {
    const modal = document.getElementById('certDetailModal');
    if (modal && modal.classList.contains('active') && e.target === modal) {
        modal.classList.remove('active');
    }
});

window.closeCertDetailModal = function() {
    const modal = document.getElementById('certDetailModal');
    if (modal) modal.classList.remove('active');
};

// ==================== CERTIFICATE DETAIL VIEW ====================

window.viewCertRecordDetail = function(id) {
    const modal = document.getElementById('certDetailModal');
    const body = document.getElementById('certDetailBody');
    if (!modal || !body) return;
    
    body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">جاري تحميل التفاصيل...</div>';
    modal.classList.add('active');
    
    setTimeout(function() {
        try {
            const records = getCertRecords();
            const rec = records.find(r => r.id === id);
            if (!rec) { 
                body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">لم يتم العثور على السجل</div>'; 
                return; 
            }
            
            const sc = rec.scores || {};
            const type = rec.certificateType || '';
            
            let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid var(--border);padding-bottom:12px;">
                <div>
                    <strong style="color:#fff;font-size:1.1rem;">${rec.studentName || '—'}</strong>
                    <br><span style="color:var(--text-muted);font-size:0.75rem;">${rec.certificateLabel || type} | ${typeof rec.totalPercentage === 'number' ? rec.totalPercentage.toFixed(1)+'%' : '—'}</span>
                </div>
                <div style="text-align:left;direction:ltr;font-size:0.7rem;color:var(--text-muted);">${rec.createdAt ? new Date(rec.createdAt).toLocaleString('ar-EG') : '—'}</div>
            </div>`;
            
            // Simplified certificate details
            html += `<div style="text-align:center;padding:20px;color:var(--text-muted);">تفاصيل الشهادة</div>`;
            
            if (rec.employeeName || rec.employeeUsername) {
                html += `<div class="mt-3 pt-2" style="border-top:1px solid var(--border);font-size:0.7rem;color:var(--text-muted);">
                    بواسطة: ${rec.employeeName || rec.employeeUsername || '—'}
                    ${rec.updatedAt ? ' | آخر تحديث: ' + new Date(rec.updatedAt).toLocaleString('ar-EG') : ''}
                </div>`;
            }
            
            body.innerHTML = html;
        } catch(e) {
            console.error('viewCertRecordDetail error:', e);
            body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--accent-rose);">حدث خطأ في عرض التفاصيل</div>';
        }
    }, 100);
};

// ==================== EXCEL EXPORT ====================

window.exportEmployeeCertRecordsToExcel = function() {
    if (typeof XLSX === 'undefined') { 
        alert('مكتبة Excel غير محملة'); 
        return; 
    }

    let certRecords = [];
    try {
        certRecords = JSON.parse(localStorage.getItem('lotus_certificate_records') || '[]');
    } catch (e) { 
        console.error('خطأ في قراءة شهادات الموظفين:', e); 
        return; 
    }

    if (certRecords.length === 0) {
        alert('لا توجد شهادات محفوظة للموظفين للتصدير');
        return;
    }

    const employeeRecords = [];
    const employeeCertificateTypes = {};

    certRecords.forEach(record => {
        const email = record.employeeUsername || '';
        const name = record.employeeName || '';
        const role = record.employeeRole || '';
        const timestamp = record.createdAt || record.updatedAt || '';

        employeeRecords.push({
            "اسم الموظف": name,
            "اسم المستخدم": email,
            "الدور": role,
            "اسم الطالب": record.studentName || '',
            "نوع الشهادة": record.certificateLabel || record.certificateType || '',
            "المجموع": record.totalScore || record.totalPercentage || 0,
            "المجموع المكافئ": record.equivalentScore || 0,
            "النسبة": record.totalPercentage || 0,
            "تاريخ الدخول": new Date(timestamp).toLocaleDateString('ar-EG'),
            "تاريخ الانتهاء": new Date(timestamp).toLocaleTimeString('ar-EG'),
            "تاريخ الإنشاء": new Date(timestamp).toLocaleString('ar-EG'),
            "نوع الشهادة الخام": record.certificateType || '',
            "تمت بواسطة": record.employeeUsername || record.employeeName || ''
        });

        const certType = record.certificateLabel || record.certificateType || '';
        if (!employeeCertificateTypes[certType]) employeeCertificateTypes[certType] = 0;
        employeeCertificateTypes[certType]++;
    });

    const currentDate = new Date().toLocaleDateString('ar-EG');
    const currentTime = new Date().toLocaleTimeString('ar-EG');

    let excelData = [];
    excelData.push({
        "عنوان التقرير": "سجلات شهادات الموظفين",
        "": "",
        "الموقع": "جامعه اللوتس",
        "التاريخ": currentDate,
        "الوقت": currentTime,
        "إجمالي السجلات": certRecords.length
    });

    excelData.push({ "": "", "": "", "": "", "": "", "": "", "": "" });

    const summaryRows = [
        { "الفئة": "إجمالي السجلات", "القيمة": certRecords.length },
        { "الفئة": "الموظفين المتميزين", "القيمة": new Set(certRecords.map(r => r.employeeUsername)).size },
        { "الفئة": "أنواع الشهادات المختلفة", "القيمة": new Set(certRecords.map(r => r.certificateLabel || r.certificateType)).size },
        { "الفئة": "الطلاب المتفردين", "القيمة": new Set(certRecords.map(r => r.studentName)).size },
        { "الفئة": "متوسط النسبة", "القيمة": (certRecords.reduce((s, r) => s + (r.totalPercentage || 0), 0) / certRecords.length).toFixed(1) + "%" },
        { "الفئة": "أعلى نسبة", "القيمة": Math.max(...certRecords.map(r => r.totalPercentage || 0)).toFixed(1) + "%" },
        { "الفئة": "أقل نسبة", "القيمة": Math.min(...certRecords.map(r => r.totalPercentage || 0)).toFixed(1) + "%" }
    ];
    excelData = excelData.concat(summaryRows);
    excelData.push({ "": "" });

    excelData.push({
        "اسم الموظف": "اسم الموظف",
        "اسم المستخدم": "اسم المستخدم",
        "الدور": "الدور",
        "اسم الطالب": "اسم الطالب",
        "نوع الشهادة": "نوع الشهادة",
        "المجموع": "المجموع",
        "المجموع المكافئ": "المجموع المكافئ",
        "النسبة": "النسبة",
        "تاريخ الدخول": "التاريخ",
        "تاريخ الانتهاء": "الوقت",
        "تاريخ الإنشاء": "تاريخ الإنشاء",
        "نوع الشهادة الخام": "النوع الخام",
        "تمت بواسطة": "تمت بواسطة"
    });

    employeeRecords.forEach(record => { excelData.push(record); });

    excelData.push({ "": "" });
    excelData.push({ "نوع الشهادة": "نوع الشهادة", "العدد": "العدد", "النسبة": "النسبة %" });
    Object.keys(employeeCertificateTypes).forEach(certType => {
        const count = employeeCertificateTypes[certType];
        excelData.push({ "نوع الشهادة": certType, "العدد": String(count), "النسبة": ((count / certRecords.length) * 100).toFixed(1) + "%" });
    });

    excelData.push({ "": "" });
    excelData.push({ "اسم الموظف": "اسم الموظف", "اسم المستخدم": "اسم المستخدم", "الدور": "الدور", "أنواع الشهادات": "أنواع الشهادات", "عدد الشهادات": "عدد الشهادات" });

    const employeeStats = {};
    certRecords.forEach(record => {
        const email = record.employeeUsername || '';
        const name = record.employeeName || '';
        const role = record.role || '';
        if (!employeeStats[email]) {
            employeeStats[email] = { name: name, role: role, certTypes: {}, certCount: 0 };
        }
        const ct = record.certificateLabel || record.certificateType;
        if (ct) employeeStats[email].certTypes[ct] = true;
        employeeStats[email].certCount++;
    });
    
    Object.keys(employeeStats).forEach(email => {
        const st = employeeStats[email];
        excelData.push({
            "اسم الموظف": st.name,
            "اسم المستخدم": email,
            "الدور": st.role,
            "أنواع الشهادات": Object.keys(st.certTypes).join('، '),
            "عدد الشهادات": String(st.certCount)
        });
    });

    excelData.push({ "": "" });
    excelData.push({ "الملاحظات": "بيانات شهادات الموظفين من نظام حساب شهادات جامعة اللوتس", "المحلل": "النظام", "بتاريخ": currentDate });

    try {
        const ws = XLSX.utils.json_to_sheet(excelData, { skipHeader: true });
        ws['!cols'] = [
            { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 20 },
            { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 20 }
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "شهادات_الموظفين");
        
        const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([wbout], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "شهادات_الموظفين_" + currentDate.replace(/\//g, '_') + ".xlsx";
        document.body.appendChild(a); 
        a.click(); 
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('✅ تم تصدير شهادات الموظفين بنجاح إلى Excel');
    } catch (e) {
        console.error("خطأ في تصدير شهادات الموظفين:", e);
        alert('❌ خطأ في تصدير البيانات: ' + e.message);
    }
};
