// ===== Firebase (موحد على نفس مشروع loutsresults مثل باقي الأنظمة) =====
    const db = window.AUTH_DB || (typeof firebase !== 'undefined' ? firebase.database() : null);
    const requestsRef = db.ref("withdrawalRequests");
    const collegesRef = db.ref("colleges");

    let allRecords = [], colleges = [], currentPage = 1, reportData = [];

    function fmtDate(d) {
      if (!d) return '';
      if (/^\d{2}-\d{2}-\d{4}$/.test(d)) return d;
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d.split('-').reverse().join('-');
      if (/^\d{4,5}$/.test(String(d))) {
        var epoch = new Date(1900, 0, 1);
        epoch.setDate(epoch.getDate() - 2);
        var xlDate = new Date(epoch.getTime() + parseInt(d) * 86400000);
        var dd = ('0' + xlDate.getDate()).slice(-2);
        var mm = ('0' + (xlDate.getMonth() + 1)).slice(-2);
        return dd + '-' + mm + '-' + xlDate.getFullYear();
      }
      var dt = new Date(d);
      if (!isNaN(dt)) {
        var dd2 = ('0' + dt.getDate()).slice(-2);
        var mm2 = ('0' + (dt.getMonth() + 1)).slice(-2);
        return dd2 + '-' + mm2 + '-' + dt.getFullYear();
      }
      return d;
    }
    function toDateInput(d) {
      if (!d) return '';
      var parts = d.split('-');
      if (parts.length === 3 && parts[2].length === 4) return parts[2] + '-' + parts[1] + '-' + parts[0];
      return d;
    }
    const perPage = 15;

    function toast(msg, err) {
      const el = document.createElement('div');
      el.className = 'toast-msg' + (err ? ' error' : '');
      el.innerHTML = `<i class="fas ${err ? 'fa-exclamation-circle' : 'fa-check-circle'} toast-icon"></i><span>${msg}</span>`;
      document.getElementById('toastContainer').appendChild(el);
      setTimeout(() => el.remove(), 2000);
    }
    function successSave(t, m) {
      const o = document.getElementById('successOverlay');
      document.getElementById('successTitle').textContent = t || 'تم الحفظ';
      document.getElementById('successMsg').textContent = m || '';
      o.classList.add('show');
      setTimeout(() => o.classList.remove('show'), 1500);
    }
    function showLoading() { document.getElementById('loading').classList.add('show'); }
    function hideLoading() { document.getElementById('loading').classList.remove('show'); }

    // Dark mode - DEFAULT DARK
    (function() {
      const saved = localStorage.getItem('sys_theme') || 'dark';
      document.body.setAttribute('data-theme', saved);
      const btn = document.getElementById('themeBtn');
      if (btn) btn.querySelector('i').className = saved === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    })();
    window.toggleTheme = function() {
      const body = document.body;
      const isDark = body.getAttribute('data-theme') === 'dark';
      body.setAttribute('data-theme', isDark ? 'light' : 'dark');
      const btn = document.getElementById('themeBtn');
      if (btn) btn.querySelector('i').className = isDark ? 'fas fa-moon' : 'fas fa-sun';
      localStorage.setItem('sys_theme', isDark ? 'light' : 'dark');
    };

    // Tabs
    var settingsUnlocked = false;
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        var pane = tab.dataset.pane;
        if (pane === 'settings' && !settingsUnlocked) {
          var pw = prompt('أدخل كلمة المرور:');
          if (pw !== '8520') { toast('كلمة المرور خاطئة', true); return; }
          settingsUnlocked = true;
        }
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
        document.getElementById(pane).classList.add('active');
        if (pane === 'records') renderTable();
        else if (pane === 'reports') runReport();
        else if (pane === 'settings') { renderCollegeList(); renderSettingsRecords(); renderEmps(); }
      });
    });

    // Years
    function populateYears() {
      const y = new Date().getFullYear(), years = [];
      for (let i = 2024; i <= y + 2; i++) years.push(`${i}-${i + 1}`);
      ['acYear', 'filterYear', 'editYear'].forEach(id => {
        const sel = document.getElementById(id); if (!sel) return;
        sel.innerHTML = `<option value="">${id === 'filterYear' ? 'كل الأعوام' : 'اختر العام'}</option>` + years.map(yr => `<option value="${yr}">${yr}</option>`).join('');
      });
    }
    function parseYearFromStr(d) {
      if (!d) return 0;
      var s = String(d);
      if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return parseInt(s.split('-')[2]);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return parseInt(s.split('-')[0]);
      if (/^\d{4,5}$/.test(s)) {
        var epoch = new Date(1900, 0, 1); epoch.setDate(epoch.getDate() - 2);
        var xlDate = new Date(epoch.getTime() + parseInt(s) * 86400000);
        return xlDate.getFullYear();
      }
      var dt = new Date(s);
      if (!isNaN(dt)) return dt.getFullYear();
      return 0;
    }
    populateYears();
    document.getElementById('date').addEventListener('change', function() {
      var y = parseYearFromStr(this.value);
      if (!y) return;
      const ac = (y - 1) + '-' + y;
      const sel = document.getElementById('acYear');
      if ([...sel.options].some(o => o.value === ac)) sel.value = ac;
    });
    document.getElementById('date').valueAsDate = new Date();
    document.getElementById('date').dispatchEvent(new Event('change'));
    document.getElementById('editDate').addEventListener('change', function() {
      var y = parseYearFromStr(this.value);
      if (!y) return;
      const ac = (y - 1) + '-' + y;
      const sel = document.getElementById('editYear');
      if ([...sel.options].some(o => o.value === ac)) sel.value = ac;
    });

    // Grade auto-display on code input
    function updateGradeDisplay(code, displayId) {
      var val = (code || '').trim();
      var el = document.getElementById(displayId);
      if (!el) return;
      if (val.length >= 2) {
        var grade = getGrade(val);
        var maxNum = 0;
        allRecords.forEach(function(r) {
          if (getGrade(r.studentCode) === grade && r.fileNumber) {
            var n = parseInt(r.fileNumber);
            if (n > maxNum) maxNum = n;
          }
        });
        el.innerHTML = '<div style="font-weight:900;font-size:0.95rem;">' + grade + '</div>';
        var fnEl = document.getElementById('fileNumberInfo');
        if (fnEl) fnEl.textContent = maxNum > 0 ? 'آخر ترقيم ملفات: ' + maxNum : '';
      } else {
        el.innerHTML = '<span style="color:var(--text-muted);">-</span>';
        var fnEl = document.getElementById('fileNumberInfo');
        if (fnEl) fnEl.textContent = '';
      }
    }
    document.getElementById('code').addEventListener('input', function() {
      updateGradeDisplay(this.value, 'addGradeDisplay');
      var val = (this.value || '').trim();
      if (val.length >= 2) {
        var grade = getGrade(val);
        if (grade !== 'غير محدد') {
          document.getElementById('addFileNumber').value = getNextFileNumber(grade);
        } else {
          document.getElementById('addFileNumber').value = '';
        }
      } else {
        document.getElementById('addFileNumber').value = '';
        document.getElementById('college').value = '';
      }
      if (val.length >= 3) {
        var shortName = getCollegeFromCode(val);
        if (shortName) {
          var fullName = matchCollegeName(shortName);
          var sel = document.getElementById('college');
          var opts = Array.from(sel.options).map(function(o) { return o.value; });
          if (opts.indexOf(fullName) > -1) sel.value = fullName;
        }
      } else if (val.length < 2) {
        document.getElementById('college').value = '';
      }
    });
    document.getElementById('editCode').addEventListener('input', function() {
      updateGradeDisplay(this.value, 'editGradeDisplay');
      var val = (this.value || '').trim();
      if (val.length >= 3) {
        var shortName = getCollegeFromCode(val);
        if (shortName) {
          var fullName = matchCollegeName(shortName);
          var sel = document.getElementById('editCollege');
          var opts = Array.from(sel.options).map(function(o) { return o.value; });
          if (opts.indexOf(fullName) > -1) sel.value = fullName;
        }
      }
      if (val.length >= 2) {
        var grade = getGrade(val);
        if (grade !== 'غير محدد') {
          document.getElementById('editFileNumber').value = getNextFileNumber(grade);
        }
      }
    });

    // Colleges
    function renderCollegeSelects() {
      const fromRecords = [...new Set(allRecords.map(r => r.college).filter(Boolean))];
      const allNames = [...new Set([...colleges.map(c => c.name), ...fromRecords])].sort((a, b) => a.localeCompare(b, 'ar'));
      const opts = '<option value="">اختر الكلية</option>' + allNames.map(n => '<option value="' + n + '">' + n + '</option>').join('');
      const fo = '<option value="">كل الكليات</option>' + allNames.map(n => '<option value="' + n + '">' + n + '</option>').join('');
      document.getElementById('college').innerHTML = opts;
      document.getElementById('editCollege').innerHTML = opts;
      document.getElementById('filterCollege').innerHTML = fo;
      document.getElementById('rptCollege').innerHTML = fo;
    }
    function renderCollegeList() {
      var fromRecords = [...new Set(allRecords.map(function(r){ return r.college; }).filter(Boolean))];
      var allNames = [...new Set(colleges.map(function(c){ return c.name; }).concat(fromRecords))].sort(function(a,b){ return a.localeCompare(b, 'ar'); });
      var list = document.getElementById('collegeList'), emp = document.getElementById('collegeEmpty');
      emp.style.display = allNames.length ? 'none' : 'block';
      list.innerHTML = allNames.map(function(name) {
        var managed = colleges.find(function(c){ return c.name === name; });
        var id = managed ? managed.id : '';
        return '<li class="college-item"><span class="college-name"><i class="fas fa-graduation-cap"></i> ' + name + '</span><div style="display:flex;gap:5px;"><button class="action-btn edit" onclick="editCollege(\'' + id + '\',\'' + name.replace(/'/g,"\\'") + '\')"><i class="fas fa-pen"></i></button><button class="action-btn delete" onclick="deleteCollegeAction(\'' + id + '\',\'' + name.replace(/'/g,"\\'") + '\')"><i class="fas fa-trash"></i></button></div></li>';
      }).join('');
    }
    function renderSettingsRecords() {
      var cnt = document.getElementById('settingsCount');
      var tbody = document.getElementById('settingsRecordsBody');
      var empty = document.getElementById('settingsRecordsEmpty');
      if (!cnt || !tbody || !empty) return;
      cnt.textContent = '(' + allRecords.length + ')';
      if (!allRecords.length) { empty.style.display = 'block'; tbody.innerHTML = ''; return; }
      empty.style.display = 'none';
      var rows = '';
      allRecords.forEach(function(r, i) {
        var cls = r.paymentStatus === 'مسدد' ? 'badge-paid' : 'badge-unpaid';
        rows += '<tr><td>' + (r.fileNumber||'-') + '</td><td>' + (r.studentCode||'') + '</td><td>' + (r.studentName||'') + '</td><td>' + (r.college||'') + '</td><td>' + getGrade(r.studentCode) + '</td><td>' + fmtDate(r.withdrawalDate) + '</td><td>' + (r.academicYear||'') + '</td><td><span class="badge-status ' + cls + '">' + (r.paymentStatus||'') + '</span></td></tr>';
      });
      tbody.innerHTML = rows;
    }
    collegesRef.on('value', snap => {
      colleges = [];
      if (snap.exists()) {
        snap.forEach(ch => { const d = ch.val(); colleges.push({ id: ch.key, name: d.name || d.Name || d.collegeName || '', ...d }); });
      }
      console.log('Firebase colleges count:', colleges.length, colleges.map(c => c.name));
      renderCollegeSelects(); renderCollegeList();
    });
    document.getElementById('addCollegeBtn').addEventListener('click', async () => {
      const name = document.getElementById('newCollege').value.trim();
      if (!name) return toast('اكتب اسم الكلية', true);
      if (colleges.some(c => c.name === name)) return toast('الكلية موجودة', true);
      await collegesRef.push({ name, createdAt: Date.now() });
      document.getElementById('newCollege').value = '';
      successSave('تمت الإضافة', name);
    });
    document.getElementById('newCollege').addEventListener('keypress', e => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('addCollegeBtn').click(); } });
    window.deleteCollege = async id => { if (confirm('حذف الكلية؟')) await collegesRef.child(id).remove(); };
    window.deleteCollegeAction = async function(id, name) {
      if (!confirm('حذف الكلية: ' + name + '؟')) return;
      if (id) {
        await collegesRef.child(id).remove();
      }
      var updates = {};
      allRecords.forEach(function(r) {
        if (r.college === name) updates[r.id + '/college'] = '';
      });
      if (Object.keys(updates).length) await requestsRef.update(updates);
      toast('تم الحذف');
    };
    window.editCollege = async function(id, oldName) {
      var newName = prompt('تعديل اسم الكلية:', oldName);
      if (!newName || newName.trim() === oldName) return;
      newName = newName.trim();
      if (colleges.some(function(c){ return c.name === newName; })) return toast('الكلية موجودة بالفعل', true);
      if (id) await collegesRef.child(id).update({ name: newName });
      var updates = {};
      allRecords.forEach(function(r) {
        if (r.college === oldName) updates[r.id + '/college'] = newName;
      });
      if (Object.keys(updates).length) await requestsRef.update(updates);
      toast('تم التعديل');
    };

    // Records
    requestsRef.on('value', snap => {
      allRecords = []; snap.forEach(function(ch) { allRecords.push(Object.assign({ id: ch.key }, ch.val())); });
      console.log('Records loaded:', allRecords.length);
      allRecords.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
      currentPage = 1; renderTable(); renderCollegeSelects(); renderCollegeList(); renderSettingsRecords();
      var fixUpdates = {};
      allRecords.forEach(function(r) {
        if (!r.academicYear || r.academicYear.indexOf('1969') > -1 || r.academicYear.indexOf('1970-') === 0) {
          var y = parseYearFromStr(r.withdrawalDate);
          if (y && y > 2000) fixUpdates[r.id + '/academicYear'] = (y - 1) + '-' + y;
        }
        if (r.studentCode && typeof r.studentCode === 'number') fixUpdates[r.id + '/studentCode'] = String(r.studentCode);
      });
      if (Object.keys(fixUpdates).length) requestsRef.update(fixUpdates);
    });

    function toComparable(d) {
      if (!d) return '';
      if (/^\d{2}-\d{2}-\d{4}$/.test(d)) { var p = d.split('-'); return p[2]+p[1]+p[0]; }
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d.replace(/-/g,'');
      return d;
    }
    function getGrade(code) {
      var c = String(code || '').substring(0, 2);
      if (c === '24') return 'الفرقة الثالثة';
      if (c === '25') return 'الفرقة الثانية';
      if (c === '26') return 'الفرقة الأولى';
      return 'غير محدد';
    }
    function getCollegeFromCode(code) {
      var d = String(code || '').substring(2, 3);
      var map = {
        '1': 'طب الفم والاسنان',
        '2': 'الادارة والاقتصاد والعلوم السياسية',
        '3': 'العلاج الطبيعي',
        '4': 'الحاسبات والمعلومات والذكاء الاصطناعي',
        '5': 'التمريض',
        '6': 'تكنولوجيا العلوم الصحية التطبيقية',
        '7': 'الهندسة',
        '8': 'الصيدلة'
      };
      return map[d] || '';
    }
    function matchCollegeName(shortName) {
      if (!shortName) return '';
      var found = colleges.find(function(c) { return c.name === shortName; });
      if (found) return found.name;
      found = colleges.find(function(c) { return c.name.indexOf(shortName) > -1 || shortName.indexOf(c.name) > -1; });
      if (found) return found.name;
      var aliases = {
        'طب الفم والاسنان': ['أسنان', 'طب أسنان', 'طب الاسنان', 'الأسنان', 'الاسنان', 'اسنان'],
        'الادارة والاقتصاد والعلوم السياسية': ['إدارة', 'الإدارة', 'الاداره', 'ادارة', 'اقتصاد'],
        'العلاج الطبيعي': ['علاج', 'علاج طبيعي'],
        'الحاسبات والمعلومات والذكاء الاصطناعي': ['حاسبات', 'الحاسبات', 'معلومات'],
        'التمريض': ['تمريض', 'التمريض'],
        'تكنولوجيا العلوم الصحية التطبيقية': ['علوم', 'العلوم', 'تكنولوجيا', 'صحية'],
        'الهندسة': ['هندسة', 'هندسه'],
        'الصيدلة': ['صيدلة', 'صيدله']
      };
      for (var key in aliases) {
        if (key === shortName || aliases[key].indexOf(shortName) > -1) {
          found = colleges.find(function(c) { return c.name.indexOf(key) > -1; });
          if (found) return found.name;
        }
      }
      return shortName;
    }
    function getNextFileNumber(grade) {
      var max = 0;
      allRecords.forEach(function(r) {
        if (getGrade(r.studentCode) === grade && r.fileNumber) {
          var n = parseInt(r.fileNumber);
          if (n > max) max = n;
        }
      });
      return max + 1;
    }
    function getFiltered() {
      const s = document.getElementById('searchInput').value.trim().toLowerCase();
      const c = document.getElementById('filterCollege').value;
      const y = document.getElementById('filterYear').value;
      const p = document.getElementById('filterPayment').value;
      const g = document.getElementById('filterGrade').value;
      const df = document.getElementById('filterDateFrom').value;
      const dt = document.getElementById('filterDateTo').value;
      return allRecords.filter(r => {
        if (s) {
          var code = String(r.studentCode || '').toLowerCase();
          var name = String(r.studentName || '').toLowerCase();
          var nid = String(r.nationalId || '');
          if (!(code.includes(s) || name.includes(s) || nid.includes(s))) return false;
        }
        if (c && r.college !== c) return false;
        if (y && r.academicYear !== y) return false;
        if (p && r.paymentStatus !== p) return false;
        if (g && getGrade(r.studentCode) !== g) return false;
        var rd = toComparable(r.withdrawalDate);
        var cdf = toComparable(df);
        var cdt = toComparable(dt);
        if (cdf && rd < cdf) return false;
        if (cdt && rd > cdt) return false;
        return true;
      });
    }

    function renderTable() {
      const filtered = getFiltered(), total = filtered.length;
      const tp = Math.ceil(total / perPage) || 1;
      if (currentPage > tp) currentPage = tp;
      const start = (currentPage - 1) * perPage, page = filtered.slice(start, start + perPage);
      document.getElementById('filterCount').textContent = total + ' سجل';
      const tbody = document.getElementById('recordsBody');
      if (!page.length) { tbody.innerHTML = '<tr><td colspan="13"><div class="empty-state"><i class="fas fa-inbox"></i><p>لا توجد سجلات</p></div></td></tr>'; }
      else {
        var rows = '';
        page.forEach(function(r, i) {
          var num = start + i + 1;
          var cls = r.paymentStatus === 'مسدد' ? 'badge-paid' : 'badge-unpaid';
          var pmt = r.paymentStatus || '';
          rows += '<tr><td>' + (r.fileNumber||'-') + '</td><td><strong>' + (r.studentCode||'') + '</strong></td><td>' + (r.studentName||'') + '</td>';
          rows += '<td dir="ltr">' + (r.nationalId||'') + '</td><td>' + (r.college||'') + '</td><td>' + getGrade(r.studentCode) + '</td><td>' + fmtDate(r.withdrawalDate) + '</td>';
          rows += '<td>' + (r.academicYear||'') + '</td><td><span class="badge-status ' + cls + '">' + pmt + '</span></td>';
          rows += '<td>' + (r.transferUniversity||'-') + '</td><td dir="ltr">' + (r.phone||'-') + '</td><td>' + (r.notes||'-') + '</td>';
          rows += '<td class="no-print"><div class="action-cell">';
          rows += '<button class="action-btn edit" onclick="editRecord(\'' + r.id + '\')" title="تعديل"><i class="fas fa-pen"></i></button>';
          rows += '<button class="action-btn delete" onclick="deleteRecord(\'' + r.id + '\')" title="حذف"><i class="fas fa-trash"></i></button>';
          rows += '<button class="action-btn print" onclick="printSingle(\'' + r.id + '\')" title="طباعة"><i class="fas fa-print"></i></button>';
          rows += '</div></td></tr>';
        });
        tbody.innerHTML = rows;
      }
      document.getElementById('pageInfo').textContent = 'عرض ' + (start + 1) + '-' + Math.min(start + perPage, total) + ' من ' + total;
      let ph = '';
      if (tp > 1) {
        ph += `<button class="page-btn" onclick="goPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
        for (let i = 1; i <= tp; i++) {
          if (i === 1 || i === tp || (i >= currentPage - 2 && i <= currentPage + 2)) ph += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
          else if (i === currentPage - 3 || i === currentPage + 3) ph += `<button class="page-btn" disabled>...</button>`;
        }
        ph += `<button class="page-btn" onclick="goPage(${currentPage + 1})" ${currentPage === tp ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
      }
      document.getElementById('pageBtns').innerHTML = ph;
    }
    window.goPage = p => { currentPage = p; renderTable(); };

    ['searchInput', 'filterCollege', 'filterYear', 'filterPayment', 'filterGrade', 'filterDateFrom', 'filterDateTo'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => { currentPage = 1; renderTable(); });
      document.getElementById(id).addEventListener('change', () => { currentPage = 1; renderTable(); });
    });
    document.getElementById('resetFilters').addEventListener('click', () => {
      ['searchInput', 'filterCollege', 'filterYear', 'filterPayment', 'filterGrade', 'filterDateFrom', 'filterDateTo'].forEach(id => {
        var el = document.getElementById(id);
        if (el) {
          if (el._flatpickr) el._flatpickr.clear();
          else el.value = '';
        }
      });
      currentPage = 1; renderTable();
    });

    // CRUD
    document.getElementById('addForm').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]'); btn.classList.add('loading');
      const data = {
        fileNumber: document.getElementById('addFileNumber').value.trim(),
        studentCode: document.getElementById('code').value.trim(),
        studentName: document.getElementById('name').value.trim(),
        nationalId: document.getElementById('nid').value.trim(),
        college: document.getElementById('college').value,
        withdrawalDate: fmtDate(document.getElementById('date').value),
        academicYear: document.getElementById('acYear').value,
        paymentStatus: document.getElementById('payment').value,
        transferUniversity: document.getElementById('transfer').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        notes: document.getElementById('notes').value.trim(),
        createdAt: Date.now()
      };
      if (!data.studentCode || !data.studentName || !data.nationalId || !data.college || !data.withdrawalDate || !data.academicYear || !data.paymentStatus) { btn.classList.remove('loading'); return toast('جميع الحقول المطلوبة', true); }
      if (data.nationalId.length !== 14 || !/^\d+$/.test(data.nationalId)) { btn.classList.remove('loading'); return toast('الرقم القومي 14 رقماً', true); }
      await requestsRef.push(data);
      if (window.authLogActivity) {
        window.authLogActivity('create_student', 'سحب ملف', data.studentCode, data.studentName, 'سحب ملف طالب جديد', 'نظام السحب');
      }
      btn.classList.remove('loading');
      successSave('تم الحفظ بنجاح', `${data.studentCode} - ${data.studentName}`);
      e.target.reset(); document.getElementById('date').valueAsDate = new Date(); document.getElementById('date').dispatchEvent(new Event('change'));
      document.getElementById('addGradeDisplay').innerHTML = '<span style="color:var(--text-muted);">-</span>';
      var fnEl = document.getElementById('fileNumberInfo');
      if (fnEl) fnEl.textContent = '';
      document.getElementById('addFileNumber').value = '';
    });

    window.deleteRecord = async id => {
      if (confirm('تأكيد الحذف؟')) {
        const r = allRecords.find(x => x.id === id);
        const sName = r ? r.studentName : '';
        const sCode = r ? r.studentCode : '';
        await requestsRef.child(id).remove();
        toast('تم الحذف');
        if (window.authLogActivity) {
          window.authLogActivity('delete_student', 'سحب ملف', sCode, sName, 'حذف طلب سحب ملف طالب', 'نظام السحب');
        }
      }
    };
    window.editRecord = id => {
      const r = allRecords.find(x => x.id === id); if (!r) return;
      document.getElementById('editId').value = id;
      const m = { editCode: 'studentCode', editName: 'studentName', editNid: 'nationalId', editCollege: 'college', editYear: 'academicYear', editPayment: 'paymentStatus', editTransfer: 'transferUniversity', editPhone: 'phone', editNotes: 'notes', editFileNumber: 'fileNumber' };
      Object.keys(m).forEach(f => document.getElementById(f).value = r[m[f]] || '');
      var ed = document.getElementById('editDate');
      if (ed._flatpickr) ed._flatpickr.setDate(fmtDate(r.withdrawalDate || ''));
      else ed.value = toDateInput(r.withdrawalDate || '');
      updateGradeDisplay(r.studentCode, 'editGradeDisplay');
      const el = document.getElementById('editInline');
      el.classList.add('show');
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    window.closeEdit = () => document.getElementById('editInline').classList.remove('show');
    document.getElementById('editForm').addEventListener('submit', async e => {
      e.preventDefault();
      const id = document.getElementById('editId').value;
      const data = { fileNumber: v('editFileNumber'), studentCode: v('editCode'), studentName: v('editName'), nationalId: v('editNid'), college: v('editCollege'), withdrawalDate: fmtDate(v('editDate')), academicYear: v('editYear'), paymentStatus: v('editPayment'), transferUniversity: v('editTransfer'), phone: v('editPhone'), notes: v('editNotes') };
      await requestsRef.child(id).update(data);
      if (window.authLogActivity) {
        window.authLogActivity('update_student', 'سحب ملف', data.studentCode, data.studentName, 'تعديل بيانات طلب سحب ملف', 'نظام السحب');
      }
      successSave('تم التعديل', data.studentName);
      closeEdit();
    });
    function v(id) { return document.getElementById(id).value.trim(); }

    // Print single
    window.printSingle = id => {
      const r = allRecords.find(x => x.id === id); if (!r) return;
      const w = window.open('', '_blank');
      w.document.write(`<html dir="rtl"><head><title>طلب سحب</title><style>
        @page{size:A4;margin:15mm;}body{font-family:'Segoe UI',Tahoma,sans-serif;padding:20px;color:#333;font-size:13px;}
        .header-print{text-align:center;border-bottom:3px double #0d2b4e;padding-bottom:12px;margin-bottom:20px;}
        .header-print h2{color:#0d2b4e;margin:0;font-size:16px;}.header-print h3{color:#c8a84e;margin:4px 0 0;font-size:13px;font-weight:400;}
        table{width:100%;border-collapse:collapse;margin:15px 0;}td{padding:8px 10px;border:1px solid #ddd;font-size:12px;}
        td:first-child{background:#f4f6f9;font-weight:600;width:130px;}
        .footer{margin-top:30px;text-align:center;color:#666;font-size:11px;border-top:1px solid #ddd;padding-top:10px;}
        .footer .name{font-weight:700;color:#0d2b4e;}</style></head><body>
        <div class="header-print"><h2>جامعة اللوتس</h2><h3>شؤون الطلاب - طلب سحب ملف</h3></div>
        <table><tr><td>رقم الملف</td><td>${r.fileNumber||'-'}</td></tr>
        <tr><td>كود الطالب</td><td>${r.studentCode}</td></tr>
        <tr><td>اسم الطالب</td><td>${r.studentName}</td></tr>
        <tr><td>الرقم القومي</td><td>${r.nationalId}</td></tr>
        <tr><td>الكلية</td><td>${r.college}</td></tr>
        <tr><td>الفرقة</td><td>${getGrade(r.studentCode)}</td></tr>
        <tr><td>تاريخ السحب</td><td>' + fmtDate(r.withdrawalDate) + '</td></tr>
        <tr><td>العام الجامعي</td><td>${r.academicYear}</td></tr>
        <tr><td>موقف الدفع</td><td>${r.paymentStatus}</td></tr>
        <tr><td>الجامعة المحول إليها</td><td>${r.transferUniversity||'-'}</td></tr>
        <tr><td>التليفون</td><td>${r.phone||'-'}</td></tr>
        <tr><td>ملاحظات</td><td>${r.notes||'-'}</td></tr></table>
        <div class="footer">جامعة اللوتس - شؤون الطلاب<br>مهندس بولس سمير</div>
        <script>setTimeout(()=>window.print(),400)<\/script></body></html>`);
      w.document.close();
    };

    // Print records
    document.getElementById('printRecords').addEventListener('click', () => {
      const filtered = getFiltered();
      if (!filtered.length) return toast('لا توجد بيانات', true);
      printTablePage(filtered, 'السجلات');
    });
    function printTablePage(data, title) {
      var now = new Date();
      var days = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
      var months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
      var dateStr = now.getDate() + ' ' + months[now.getMonth()] + ' ' + now.getFullYear() + ' - ' + days[now.getDay()];
      var paid = data.filter(function(r){ return r.paymentStatus === 'مسدد'; }).length;
      var w = window.open('', '_blank');

      var tableRows = '';
      var byCol = {};
      data.forEach(function(r){ var c = r.college || 'غير محدد'; if (!byCol[c]) byCol[c] = []; byCol[c].push(r); });
      var idx = 0;
      Object.keys(byCol).sort(function(a,b){ return byCol[b].length - byCol[a].length; }).forEach(function(col){
        tableRows += '<tr><td colspan="10" style="background:#e8ecf1;font-weight:700;text-align:right;padding:8px;font-size:11px;">' + col + ' (' + byCol[col].length + ' طلب)</td></tr>';
        byCol[col].forEach(function(r){
          idx++;
          tableRows += '<tr><td>' + (r.fileNumber||'-') + '</td><td>' + (r.studentCode||'') + '</td><td>' + (r.studentName||'') + '</td><td>' + (r.college||'') + '</td><td>' + getGrade(r.studentCode) + '</td><td>' + fmtDate(r.withdrawalDate) + '</td><td>' + (r.academicYear||'') + '</td><td>' + (r.paymentStatus||'') + '</td><td>' + (r.transferUniversity||'-') + '</td><td>' + (r.notes||'-') + '</td></tr>';
        });
      });

      var html = '<html dir="rtl"><head><title>' + title + '</title><style>';
      html += '@page{size:A4 landscape;margin:12mm;}body{font-family:Tahoma,sans-serif;color:#333;font-size:11px;padding:10px;margin:0;}';
      html += '.hdr{text-align:center;border-bottom:3px double #0d2b4e;padding-bottom:8px;margin-bottom:10px;}';
      html += '.hdr h2{margin:0;color:#0d2b4e;font-size:16px;}';
      html += '.hdr h3{margin:3px 0 0;color:#c8a84e;font-size:12px;font-weight:400;}';
      html += '.meta{display:flex;justify-content:space-between;font-size:10px;color:#666;margin-bottom:8px;}';
      html += 'table{width:100%;border-collapse:collapse;}';
      html += 'th{background:#0d2b4e;color:#fff;padding:6px 5px;font-size:10px;white-space:nowrap;}';
      html += 'td{padding:5px;border:1px solid #ddd;font-size:10px;text-align:center;}';
      html += '.ftr{margin-top:15px;text-align:center;font-size:10px;color:#666;border-top:1px solid #ddd;padding-top:8px;}';
      html += '.ftr .name{font-weight:700;color:#0d2b4e;}</style></head><body>';
      html += '<div class="hdr"><h2>جامعة اللوتس</h2><h3>شؤون الطلاب - ' + title + '</h3></div>';
      html += '<div class="meta"><span>التاريخ: ' + dateStr + '</span><span>الإجمالي: ' + data.length + ' | مسدد: ' + paid + ' | غير مسدد: ' + (data.length - paid) + '</span></div>';
      html += '<table><thead><tr><th>رقم الملف</th><th>الكود</th><th>الاسم</th><th>الكلية</th><th>الفرقة</th><th>التاريخ</th><th>العام</th><th>الدفع</th><th>الجامعة</th><th>ملاحظات</th></tr></thead><tbody>';
      html += tableRows;
      html += '</tbody></table>';
      html += '<div class="ftr">جامعة اللوتس - شؤون الطلاب<br><span class="name">مهندس بولس سمير</span></div>';
      html += '<script>setTimeout(function(){window.print()},400)<\/script></body></html>';
      w.document.write(html);
      w.document.close();
    }

    // Reports - populate year
    ['rptYear'].forEach(id => {
      const sel = document.getElementById(id);
      if (sel) { const y = new Date().getFullYear(), yrs = []; for (let i = 2024; i <= y + 2; i++) yrs.push(i + '-' + (i + 1)); sel.innerHTML = '<option value="كل الأعوام">كل الأعوام</option>' + yrs.map(yr => '<option value="' + yr + '">' + yr + '</option>').join(''); }
    });

    function runReport() {
      const from = document.getElementById('rptDateFrom').value;
      const to = document.getElementById('rptDateTo').value;
      const college = document.getElementById('rptCollege').value;
      const payment = document.getElementById('rptPayment').value;
      const year = document.getElementById('rptYear').value;
      const grade = document.getElementById('rptGrade').value;
      reportData = allRecords.filter(r => {
        var rd = toComparable(r.withdrawalDate);
        var cfrom = toComparable(from);
        var cto = toComparable(to);
        if (cfrom && rd < cfrom) return false;
        if (cto && rd > cto) return false;
        if (college && r.college !== college) return false;
        if (payment && r.paymentStatus !== payment) return false;
        if (year && year !== 'كل الأعوام' && r.academicYear !== year) return false;
        if (grade && getGrade(r.studentCode) !== grade) return false;
        return true;
      });
      const paid = reportData.filter(r => r.paymentStatus === 'مسدد').length;
      document.getElementById('rptResults').style.display = 'block';
      document.getElementById('rptSummary').textContent = reportData.length + ' سجل | مسدد: ' + paid + ' | غير مسدد: ' + (reportData.length - paid);
      const tbody = document.getElementById('rptBody');
      if (!reportData.length) { tbody.innerHTML = '<tr><td colspan="10">لا توجد نتائج</td></tr>'; return; }
      tbody.innerHTML = reportData.map((r, i) => '<tr><td>' + (r.fileNumber||'-') + '</td><td>' + (r.studentCode||'') + '</td><td>' + (r.studentName||'') + '</td><td>' + (r.college||'') + '</td><td>' + getGrade(r.studentCode) + '</td><td>' + fmtDate(r.withdrawalDate) + '</td><td>' + (r.academicYear||'') + '</td><td><span class="badge-status ' + (r.paymentStatus==='مسدد'?'badge-paid':'badge-unpaid') + '">' + (r.paymentStatus||'') + '</span></td><td>' + (r.transferUniversity||'-') + '</td><td>' + (r.notes||'-') + '</td></tr>').join('');
    }

    document.getElementById('generateReport').addEventListener('click', runReport);
    document.getElementById('quickDay').addEventListener('change', function() {
      if (!this.value) return;
      var f1 = document.getElementById('rptDateFrom'), f2 = document.getElementById('rptDateTo');
      if (f1._flatpickr) f1._flatpickr.setDate(this.value); else f1.value = this.value;
      if (f2._flatpickr) f2._flatpickr.setDate(this.value); else f2.value = this.value;
      runReport();
    });
    ['rptDateFrom', 'rptDateTo', 'rptCollege', 'rptPayment', 'rptYear', 'rptGrade'].forEach(id => {
      document.getElementById(id).addEventListener('change', runReport);
    });
    document.getElementById('clearRptFilters').addEventListener('click', () => {
      ['quickDay', 'rptDateFrom', 'rptDateTo', 'rptCollege', 'rptPayment', 'rptYear', 'rptGrade'].forEach(id => {
        var el = document.getElementById(id);
        if (el) {
          if (el._flatpickr) el._flatpickr.clear();
          else el.value = '';
        }
      });
      reportData = [];
      document.getElementById('rptResults').style.display = 'none';
    });

    document.getElementById('printReport').addEventListener('click', () => {
      const data = reportData.length > 0 ? reportData : allRecords;
      if (!data.length) return toast('لا توجد بيانات', true);
      printTablePage(data, 'تقرير سحب الملفات');
    });

    // Export Report
    document.getElementById('exportReport').addEventListener('click', () => {
      const data = (reportData.length > 0 ? reportData : allRecords);
      if (!data.length) return toast('لا توجد بيانات', true);
      exportToExcel(data);
    });
    document.getElementById('exportExcel').addEventListener('click', () => exportToExcel(getFiltered()));

    function exportToExcel(data) {
      var _stuList = []; try { _stuList = JSON.parse(localStorage.getItem('lotus_students') || '[]'); } catch(e) {}
      function _getLevel(code) {
        var _s = _stuList.find(function(x) { return x.studentCode === code || x.code === code; });
        if (_s && _s.level) return _s.level;
        return getGrade(code);
      }
      const rows = data.map((r, i) => ({
        'رقم الملف': r.fileNumber || '', 'كود الطالب': r.studentCode, 'اسم الطالب': r.studentName, 'الرقم القومي': r.nationalId,
        'الكلية': r.college, 'الفرقة': _getLevel(r.studentCode), 'تاريخ السحب': fmtDate(r.withdrawalDate), 'العام الجامعي': r.academicYear,
        'موقف الدفع': r.paymentStatus, 'الجامعة المحول إليها': r.transferUniversity || '', 'التليفون': r.phone || '', 'ملاحظات': r.notes || ''
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const colWidths = Object.keys(rows[0] || {}).map((k, i) => ({ wch: k.length > 6 ? 20 : 12 }));
      ws['!cols'] = colWidths;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'بيانات');
      XLSX.writeFile(wb, `تقرير_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast('تم التصدير');
    }

    // WhatsApp
    function buildWhatsApp(recipientName) {
      var data = reportData.length > 0 ? reportData : allRecords;
      var now = new Date();
      var days = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
      var months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
      var dateStr = now.getDate() + ' ' + months[now.getMonth()] + ' ' + now.getFullYear();
      var dayName = days[now.getDay()];
      var time = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
      var paid = data.filter(function(r){ return r.paymentStatus === 'مسدد'; }).length;
      var unpaid = data.length - paid;

      var t = '';
      t += '====== تقرير سحب الملفات ======\n';
      t += 'جامعة اللوتس - شؤون الطلاب\n';
      t += 'التاريخ: ' + dateStr + '\n';
      t += 'اليوم: ' + dayName + '\n';
      t += '===============================\n\n';

      var byCollege = {};
      data.forEach(function(r){ var c = r.college || 'غير محدد'; if (!byCollege[c]) byCollege[c] = []; byCollege[c].push(r); });
      Object.keys(byCollege).sort(function(a,b){ return byCollege[b].length - byCollege[a].length; }).forEach(function(col){
        var studs = byCollege[col];
        var colPaid = studs.filter(function(r){ return r.paymentStatus === 'مسدد'; }).length;
        t += '>> ' + col + ' (' + studs.length + ' طلب)\n';
        studs.forEach(function(r, i){
          var icon = r.paymentStatus === 'مسدد' ? 'مسدد' : 'غير مسدد';
          t += (i+1) + '. ' + (r.studentName||'') + ' | ' + (r.studentCode||'') + ' | ملف:' + (r.fileNumber||'-') + ' | ' + getGrade(r.studentCode) + ' | ' + icon + ' | ' + fmtDate(r.withdrawalDate) + '\n';
        });
        t += '\n';
      });

      t += '===============================\n';
      t += 'الاجمالي: ' + data.length + ' طلب\n';
      t += 'مسدد: ' + paid + ' | غير مسدد: ' + unpaid + '\n';
      t += '===============================\n';
      return t;
    function generatePDFForWhatsApp(phone, data, title) {
      if (typeof html2pdf === 'undefined') {
        toast('يرجى الانتظار، جاري تحميل مكتبة PDF...', false);
        return;
      }
      toast('جاري تجهيز وتنزيل ملف PDF...', false);
      var now = new Date();
      var days = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
      var months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
      var dateStr = now.getDate() + ' ' + months[now.getMonth()] + ' ' + now.getFullYear() + ' - ' + days[now.getDay()];
      var paid = data.filter(function(r){ return r.paymentStatus === 'مسدد'; }).length;

      var tableRows = '';
      var byCol = {};
      data.forEach(function(r){ var c = r.college || 'غير محدد'; if (!byCol[c]) byCol[c] = []; byCol[c].push(r); });
      var idx = 0;
      Object.keys(byCol).sort(function(a,b){ return byCol[b].length - byCol[a].length; }).forEach(function(col){
        tableRows += '<tr><td colspan="10" style="background:#e8ecf1;font-weight:700;text-align:right;padding:8px;font-size:11px;">' + col + ' (' + byCol[col].length + ' طلب)</td></tr>';
        byCol[col].forEach(function(r){
          idx++;
          tableRows += '<tr><td>' + (r.fileNumber||'-') + '</td><td>' + (r.studentCode||'') + '</td><td>' + (r.studentName||'') + '</td><td>' + (r.college||'') + '</td><td>' + getGrade(r.studentCode) + '</td><td>' + fmtDate(r.withdrawalDate) + '</td><td>' + (r.academicYear||'') + '</td><td>' + (r.paymentStatus||'') + '</td><td>' + (r.transferUniversity||'-') + '</td><td>' + (r.notes||'-') + '</td></tr>';
        });
      });

      var container = document.createElement('div');
      container.dir = 'rtl';
      container.style.cssText = 'font-family:Tahoma,sans-serif;color:#333;font-size:11px;padding:20px;background:#fff;';
      
      var html = '<div style="text-align:center;border-bottom:3px double #0d2b4e;padding-bottom:8px;margin-bottom:15px;">';
      html += '<h2 style="margin:0;color:#0d2b4e;font-size:20px;">جامعة اللوتس</h2>';
      html += '<h3 style="margin:5px 0 0;color:#c8a84e;font-size:14px;">شؤون الطلاب - ' + title + '</h3></div>';
      html += '<div style="display:flex;justify-content:space-between;font-size:12px;color:#666;margin-bottom:10px;"><span>التاريخ: ' + dateStr + '</span><span>الإجمالي: ' + data.length + ' | مسدد: ' + paid + ' | غير مسدد: ' + (data.length - paid) + '</span></div>';
      html += '<table style="width:100%;border-collapse:collapse;border:1px solid #ddd;" border="1"><thead><tr style="background:#0d2b4e;color:#fff;">';
      html += '<th style="padding:8px;font-size:11px;">رقم الملف</th><th style="padding:8px;font-size:11px;">الكود</th><th style="padding:8px;font-size:11px;">الاسم</th><th style="padding:8px;font-size:11px;">الكلية</th><th style="padding:8px;font-size:11px;">الفرقة</th><th style="padding:8px;font-size:11px;">التاريخ</th><th style="padding:8px;font-size:11px;">العام</th><th style="padding:8px;font-size:11px;">الدفع</th><th style="padding:8px;font-size:11px;">الجامعة</th><th style="padding:8px;font-size:11px;">ملاحظات</th></tr></thead><tbody>';
      html += tableRows;
      html += '</tbody></table>';
      
      container.innerHTML = html;
      
      var filename = 'تقرير_سحب_' + now.getTime() + '.pdf';
      var opt = {
        margin:       10,
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };
      
      html2pdf().set(opt).from(container).save().then(function() {
        const cc = phone.startsWith('0') ? phone.slice(1) : phone.replace(/^\+/, '');
        var url = 'https://wa.me/2' + cc;
        let m = document.getElementById('wa-modal');
        if (!m) {
          m = document.createElement('div');
          m.id = 'wa-modal';
          m.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;';
          m.innerHTML = '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:24px;max-width:90vw;width:420px;text-align:center;box-shadow:var(--shadow-xl);">' +
            '<div style="font-size:2rem;color:#25d366;margin-bottom:8px;"><i class="fab fa-whatsapp"></i></div>' +
            '<h3 style="margin-bottom:6px;color:var(--text-primary);" id="wa-name"></h3>' +
            '<p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:14px;" id="wa-desc">تم تنزيل التقرير كملف PDF بنجاح! اضغط لفتح واتساب ثم قم بإرفاق الملف في المحادثة.</p>' +
            '<a id="wa-link" target="_blank" style="display:block;background:#25d366;color:#fff;padding:10px;border-radius:50px;font-weight:700;text-decoration:none;margin-bottom:10px;">فتح واتساب</a>' +
            '<button onclick="document.getElementById(\'wa-modal\').remove()" style="background:var(--bg-card-alt);color:var(--text-secondary);border:1px solid var(--border);border-radius:50px;padding:8px 20px;cursor:pointer;">إغلاق</button>' +
            '</div>';
          document.body.appendChild(m);
        }
        document.getElementById('wa-name').textContent = 'إرسال التقرير (PDF)';
        document.getElementById('wa-link').href = url;
        m.style.display = 'flex';
      });
    }

    function sendWA(phone, name) {
      const data = reportData.length > 0 ? reportData : allRecords;
      if (!data.length) return toast('لا توجد بيانات', true);
      const cc = phone.startsWith('0') ? phone.slice(1) : phone.replace(/^\+/, '');
      const msg = buildWhatsApp(name);
      
      let txt = encodeURIComponent(msg);
      let url = `https://wa.me/2${cc}?text=${txt}`;
      
      // If URL is too long for browsers (usually > 2000 chars), wa.me will reject it, so we generate PDF instead
      if (url.length > 2000) {
        generatePDFForWhatsApp(phone, data, 'تقرير واتساب');
        return;
      }
      
      copyText(msg);
      showWaModal(name, url, msg);
    }
    function showWaModal(name, url, msg) {
      let m = document.getElementById('wa-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'wa-modal';
        m.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;';
        m.innerHTML = '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:24px;max-width:90vw;width:420px;text-align:center;box-shadow:var(--shadow-xl);">' +
          '<div style="font-size:2rem;color:#25d366;margin-bottom:8px;"><i class="fab fa-whatsapp"></i></div>' +
          '<h3 style="margin-bottom:6px;color:var(--text-primary);" id="wa-name"></h3>' +
          '<p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:14px;">اضغط الزر لفتح واتساب، أو انسخ الرابط</p>' +
          '<a id="wa-link" target="_blank" style="display:block;background:#25d366;color:#fff;padding:10px;border-radius:50px;font-weight:700;text-decoration:none;margin-bottom:10px;">فتح واتساب</a>' +
          '<button onclick="copyText(document.getElementById(\'wa-msg\').value);this.textContent=\'تم النسخ ✓\'" style="width:100%;background:var(--accent-blue);color:#fff;border:none;border-radius:50px;padding:10px;font-weight:700;cursor:pointer;margin-bottom:10px;">نسخ الرسالة</button>' +
          '<textarea id="wa-msg" readonly style="width:100%;height:90px;border-radius:10px;border:1px solid var(--border);background:var(--bg-card-alt);color:var(--text-primary);padding:8px;font-size:0.75rem;margin-bottom:10px;"></textarea>' +
          '<button onclick="document.getElementById(\'wa-modal\').remove()" style="background:var(--bg-card-alt);color:var(--text-secondary);border:1px solid var(--border);border-radius:50px;padding:8px 20px;cursor:pointer;">إغلاق</button>' +
          '</div>';
        document.body.appendChild(m);
      }
      document.getElementById('wa-name').textContent = 'إرسال تقرير إلى ' + name;
      document.getElementById('wa-link').href = url;
      document.getElementById('wa-msg').value = msg;
      m.style.display = 'flex';
    }
    function copyText(txt) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).catch(() => fallbackCopy(txt));
      } else fallbackCopy(txt);
    }
    function fallbackCopy(txt) {
      const ta = document.createElement('textarea');
      ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      ta.remove();
    }
    document.getElementById('sendWhatsApp1').addEventListener('click', () => sendWA('01014580091', 'د. سمية'));
    document.getElementById('sendWhatsApp2').addEventListener('click', () => sendWA('01093939137', 'م. بولس'));

    // Print current tab
    window.printCurrentTab = () => {
      const active = document.querySelector('.tab.active').dataset.pane;
      if (active === 'records') { printTablePage(getFiltered(), 'السجلات'); }
      else if (active === 'reports') {
        const data = reportData.length > 0 ? reportData : allRecords;
        printTablePage(data.length ? data : allRecords, 'تقرير سحب الملفات');
      }
      else { window.print(); }
    };

    // Template download
    document.getElementById('downloadTemplate').addEventListener('click', () => {
      const template = [{ 'رقم الملف': '1', 'كود الطالب': '2670001', 'اسم الطالب': 'أحمد محمد', 'الرقم القومي': '12345678901234', 'الكلية': '', 'تاريخ السحب': '2026-07-12', 'العام الجامعي': '', 'موقف الدفع': 'مسدد', 'الجامعة المحول اليها': '', 'التليفون': '01012345678', 'ملاحظات': '' }];
      const ws = XLSX.utils.json_to_sheet(template);
      ws['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 14 }, { wch: 20 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'نموذج');
      XLSX.writeFile(wb, 'نموذج_سحب_ملفات.xlsx');
      toast('تم تحميل النموذج');
    });
    document.getElementById('downloadDataTemplate').addEventListener('click', () => {
      if (!allRecords.length) return toast('لا توجد بيانات', true);
      var colNames = { fileNumber: 'رقم الملف', studentCode: 'كود الطالب', studentName: 'اسم الطالب', nationalId: 'الرقم القومي', college: 'الكلية', withdrawalDate: 'تاريخ السحب', academicYear: 'العام الجامعي', paymentStatus: 'موقف الدفع', transferUniversity: 'الجامعة المحول إليها', phone: 'التليفون', notes: 'ملاحظات' };
      var keys = Object.keys(colNames);
      var sorted = allRecords.slice().sort(function(a, b) {
        var ga = getGrade(a.studentCode), gb = getGrade(b.studentCode);
        if (ga !== gb) return ga.localeCompare(gb, 'ar');
        return (parseInt(a.fileNumber) || 0) - (parseInt(b.fileNumber) || 0);
      });
      var rows = sorted.map(function(r) {
        var row = {};
        keys.forEach(function(k) {
          if (k === 'withdrawalDate') row[colNames[k]] = fmtDate(r[k]) || '';
          else row[colNames[k]] = r[k] || '';
        });
        return row;
      });
      var ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = keys.map(function(k) { return { wch: k === 'studentName' || k === 'transferUniversity' || k === 'notes' ? 22 : k === 'fileNumber' ? 10 : 16 }; });
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'بيانات');
      XLSX.writeFile(wb, 'بيانات_للتعديل_' + new Date().toISOString().split('T')[0] + '.xlsx');
      toast('تم تنزيل البيانات - عدّل وأعد الرفع');
    });

    // Excel upload
    document.getElementById('excelFile').addEventListener('change', e => handleExcel(e.target.files[0]));
    function handleExcel(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
          const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
          const mapped = data.map(function(r) {
            var dateStr = r['تاريخ السحب'] || '';
            var acYear = r['العام الجامعي'] || '';
            var code = r['كود الطالب'] || r['الكود'] || '';
            var college = r['الكلية'] || r['القسم'] || '';
            if (!college && code) {
              var shortName = getCollegeFromCode(code);
              if (shortName) college = matchCollegeName(shortName);
            }
            if (!acYear && dateStr) {
              var y = parseYearFromStr(dateStr);
              if (y) acYear = (y - 1) + '-' + y;
            }
            return {
              fileNumber: r['رقم الملف'] || r['المسلسل'] || '', studentCode: code, studentName: r['اسم الطالب'] || r['الاسم'] || '',
              nationalId: String(r['الرقم القومي'] || r['القومي'] || ''), college: college,
              withdrawalDate: fmtDate(dateStr), academicYear: acYear,
              paymentStatus: r['موقف الدفع'] || r['الدفع'] || '',
              transferUniversity: r['الجامعة المحول اليها'] || r['الجامعة المحول إليها'] || r['الجامعة'] || '',
              phone: r['التليفون'] || r['الموبايل'] || r['التلفون'] || '', notes: r['ملاحظات'] || ''
            };
          }).filter(function(r){ return r.studentCode || r.studentName; });
          const preview = document.getElementById('excelPreview');
          preview.style.display = 'block';
          preview.innerHTML = `<p style="font-size:0.85rem;margin-bottom:8px;">تم العثور على <strong>${mapped.length}</strong> سجل</p>
            <button class="btn btn-primary btn-sm" id="confirmUpload"><i class="fas fa-cloud-upload-alt"></i> رفع ${mapped.length} سجل</button>
            <button class="btn btn-accent btn-sm" id="confirmUpdate"><i class="fas fa-sync"></i> تحديث/إضافة ${mapped.length} سجل</button>
            <button class="btn btn-ghost btn-sm" onclick="this.parentElement.style.display='none'">إلغاء</button>`;
          document.getElementById('confirmUpload').addEventListener('click', async () => {
            const updates = {};
            mapped.forEach(function(r) { const key = requestsRef.push().key; updates[key] = Object.assign({}, r, { createdAt: Date.now() }); });
            await requestsRef.update(updates);
            if (window.authLogActivity) {
              window.authLogActivity('bulk_import', 'سحب ملف', '', '', `رفع مجمّع لعدد ${mapped.length} ملف (إضافة)`, 'نظام السحب');
            }
            var previewTable = '<div style="margin-top:10px;max-height:300px;overflow-y:auto;"><table style="width:100%;font-size:0.8rem;border-collapse:collapse;"><thead><tr><th style="background:var(--primary);color:#fff;padding:6px;">رقم الملف</th><th style="background:var(--primary);color:#fff;padding:6px;">الكود</th><th style="background:var(--primary);color:#fff;padding:6px;">الاسم</th><th style="background:var(--primary);color:#fff;padding:6px;">الرقم القومي</th><th style="background:var(--primary);color:#fff;padding:6px;">الكلية</th><th style="background:var(--primary);color:#fff;padding:6px;">الفرقة</th><th style="background:var(--primary);color:#fff;padding:6px;">التاريخ</th><th style="background:var(--primary);color:#fff;padding:6px;">العام</th><th style="background:var(--primary);color:#fff;padding:6px;">الدفع</th><th style="background:var(--primary);color:#fff;padding:6px;">الجامعة</th></tr></thead><tbody>';
            mapped.forEach(function(r, i) {
              previewTable += '<tr style="border-bottom:1px solid var(--border);"><td style="padding:5px;">' + (r.fileNumber||'-') + '</td><td style="padding:5px;">' + (r.studentCode||'') + '</td><td style="padding:5px;">' + (r.studentName||'') + '</td><td style="padding:5px;" dir="ltr">' + (r.nationalId||'') + '</td><td style="padding:5px;">' + (r.college||'') + '</td><td style="padding:5px;">' + getGrade(r.studentCode) + '</td><td style="padding:5px;">' + fmtDate(r.withdrawalDate) + '</td><td style="padding:5px;">' + (r.academicYear||'') + '</td><td style="padding:5px;">' + (r.paymentStatus||'') + '</td><td style="padding:5px;">' + (r.transferUniversity||'-') + '</td></tr>';
            });
            previewTable += '</tbody></table></div>';
            preview.innerHTML = '<p style="color:var(--success);font-weight:700;">تم رفع ' + mapped.length + ' سجل بنجاح</p>' + previewTable;
            document.getElementById('excelFile').value = '';
          });
          document.getElementById('confirmUpdate').addEventListener('click', async () => {
            var updates = {}, added = 0, updated = 0;
            mapped.forEach(function(r) {
              var existing = allRecords.find(function(x) { return String(x.studentCode) === String(r.studentCode); });
              if (existing) {
                updates[existing.id] = Object.assign({}, existing, r);
                updated++;
              } else {
                const key = requestsRef.push().key;
                updates[key] = Object.assign({}, r, { createdAt: Date.now() });
                added++;
              }
            });
            await requestsRef.update(updates);
            if (window.authLogActivity) {
              window.authLogActivity('bulk_import', 'سحب ملف', '', '', `تحديث/إضافة مجمّعة لعدد ${mapped.length} ملف`, 'نظام السحب');
            }
            var msg = '';
            if (added) msg += added + ' سجل جديد';
            if (updated) msg += (msg ? ' + ' : '') + updated + ' سجل تم تعديله';
            var previewTable = '<div style="margin-top:10px;max-height:300px;overflow-y:auto;"><table style="width:100%;font-size:0.8rem;border-collapse:collapse;"><thead><tr><th style="background:var(--primary);color:#fff;padding:6px;">رقم الملف</th><th style="background:var(--primary);color:#fff;padding:6px;">الكود</th><th style="background:var(--primary);color:#fff;padding:6px;">الاسم</th><th style="background:var(--primary);color:#fff;padding:6px;">الرقم القومي</th><th style="background:var(--primary);color:#fff;padding:6px;">الكلية</th><th style="background:var(--primary);color:#fff;padding:6px;">الفرقة</th><th style="background:var(--primary);color:#fff;padding:6px;">التاريخ</th><th style="background:var(--primary);color:#fff;padding:6px;">العام</th><th style="background:var(--primary);color:#fff;padding:6px;">الدفع</th><th style="background:var(--primary);color:#fff;padding:6px;">الجامعة</th></tr></thead><tbody>';
            mapped.forEach(function(r, i) {
              previewTable += '<tr style="border-bottom:1px solid var(--border);"><td style="padding:5px;">' + (r.fileNumber||'-') + '</td><td style="padding:5px;">' + (r.studentCode||'') + '</td><td style="padding:5px;">' + (r.studentName||'') + '</td><td style="padding:5px;" dir="ltr">' + (r.nationalId||'') + '</td><td style="padding:5px;">' + (r.college||'') + '</td><td style="padding:5px;">' + getGrade(r.studentCode) + '</td><td style="padding:5px;">' + fmtDate(r.withdrawalDate) + '</td><td style="padding:5px;">' + (r.academicYear||'') + '</td><td style="padding:5px;">' + (r.paymentStatus||'') + '</td><td style="padding:5px;">' + (r.transferUniversity||'-') + '</td></tr>';
            });
            previewTable += '</tbody></table></div>';
            preview.innerHTML = '<p style="color:var(--success);font-weight:700;">' + msg + '</p>' + previewTable;
            document.getElementById('excelFile').value = '';
          });
        } catch (err) { toast('خطأ في قراءة الملف', true); }
      };
      reader.readAsArrayBuffer(file);
    }

    // Backup / Restore
    document.getElementById('backupBtn').addEventListener('click', async () => {
      const snap = await requestsRef.once('value');
      const data = []; snap.forEach(ch => data.push({ id: ch.key, ...ch.val() }));
      const cs = await collegesRef.once('value');
      const cols = []; cs.forEach(ch => cols.push({ id: ch.key, ...ch.val() }));
      const blob = new Blob([JSON.stringify({ records: data, colleges: cols, date: new Date().toISOString() }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `backup_${new Date().toISOString().split('T')[0]}.json`; a.click();
      toast('تم التصدير');
    });
    document.getElementById('restoreBtn').addEventListener('click', () => document.getElementById('restoreFile').click());
    document.getElementById('restoreFile').addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      const backup = JSON.parse(await file.text());
      if (!backup.records) return toast('ملف غير صالح', true);
      if (!confirm(`استيراد ${backup.records.length} سجل؟`)) return;
      const ru = {}, cu = {};
      backup.records.forEach(r => { const { id, ...d } = r; ru[requestsRef.push().key] = d; });
      if (backup.colleges) backup.colleges.forEach(c => { const { id, ...d } = c; cu[collegesRef.push().key] = d; });
      await requestsRef.update(ru);
      if (Object.keys(cu).length) await collegesRef.update(cu);
      if (window.authLogActivity) {
        window.authLogActivity('restore_database', 'سحب ملف', '', '', `استعادة قاعدة البيانات من نسخة احتياطية (عدد ${backup.records.length} سجل)`, 'نظام السحب');
      }
      toast('تم الاستيراد');
      e.target.value = '';
    });
    document.getElementById('clearAllBtn').addEventListener('click', async () => {
      if (!confirm('حذف جميع السجلات؟') || !confirm('تأكيد أخير؟')) return;
      await requestsRef.remove(); 
      toast('تم الحذف');
      if (window.authLogActivity) {
        window.authLogActivity('clear_database', 'سحب ملف', '', '', 'مسح كافة سجلات السحب من النظام', 'نظام السحب');
      }
    });

    // Replace column values
    var replaceMatches = [];
    document.getElementById('replacePreview').addEventListener('click', () => {
      var col = document.getElementById('replaceColumn').value;
      var find = document.getElementById('replaceFind').value.trim();
      var repWith = document.getElementById('replaceWith').value.trim();
      if (!col) return toast('اختار العمود', true);
      if (!find) return toast('اكتب القيمة اللي عايز تغيرها', true);
      replaceMatches = allRecords.filter(r => String(r[col] || '') === find);
      var cnt = document.getElementById('replaceCount');
      var res = document.getElementById('replaceResult');
      var applyBtn = document.getElementById('replaceApply');
      if (!replaceMatches.length) {
        cnt.textContent = 'لا توجد سجلات تطابق';
        res.style.display = 'none';
        applyBtn.style.display = 'none';
        return;
      }
      cnt.textContent = replaceMatches.length + ' سجل هيتغير';
      var colNames = { college: 'الكلية', paymentStatus: 'الدفع', academicYear: 'العام', transferUniversity: 'الجامعة', notes: 'ملاحظات' };
      var html = '<div style="font-size:0.8rem;margin-bottom:8px;color:var(--text-muted);">القيم الحالية → القيمة الجديدة</div>';
      html += '<div style="max-height:250px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-sm);">';
      replaceMatches.forEach(function(r) {
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid var(--border);gap:8px;">';
        html += '<span style="font-size:0.8rem;"><strong>' + (r.studentCode || '') + '</strong> - ' + (r.studentName || '') + '</span>';
        html += '<span style="font-size:0.8rem;color:var(--danger);text-decoration:line-through;">' + (r[col] || 'فارغ') + '</span>';
        html += '<i class="fas fa-arrow-left" style="color:var(--accent);font-size:0.7rem;"></i>';
        html += '<span style="font-size:0.8rem;color:var(--success);font-weight:700;">' + (repWith || 'فارغ') + '</span>';
        html += '</div>';
      });
      html += '</div>';
      res.innerHTML = html;
      res.style.display = 'block';
      applyBtn.style.display = 'inline-flex';
    });
    document.getElementById('replaceApply').addEventListener('click', async () => {
      var repWith = document.getElementById('replaceWith').value.trim();
      var col = document.getElementById('replaceColumn').value;
      if (!replaceMatches.length) return;
      if (!confirm('تأكيد استبدال ' + replaceMatches.length + ' سجل؟')) return;
      var updates = {};
      replaceMatches.forEach(function(r) { updates[r.id + '/' + col] = repWith; });
      await requestsRef.update(updates);
      toast('تم الاستبدال لـ ' + replaceMatches.length + ' سجل');
      replaceMatches = [];
      document.getElementById('replaceResult').style.display = 'none';
      document.getElementById('replaceApply').style.display = 'none';
      document.getElementById('replaceCount').textContent = '';
      document.getElementById('replaceFind').value = '';
      document.getElementById('replaceWith').value = '';
    });
