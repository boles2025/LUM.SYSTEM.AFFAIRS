const firebaseConfig = {
  apiKey: "AIzaSyAbYhhg5eL94AUE5BwV4xv6jbFU98QZbdQ",
  authDomain: "loutsresults.firebaseapp.com",
  projectId: "loutsresults",
  storageBucket: "loutsresults.firebasestorage.app",
  messagingSenderId: "801603969666",
  appId: "1:801603969666:web:e6d45a7a6819022bc10a9b",
  databaseURL: "https://loutsresults-default-rtdb.firebaseio.com"
};

let db = null, isOfflineMode = false;
if (typeof firebase !== 'undefined') {
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
  } catch (e) { isOfflineMode = true; }
} else { isOfflineMode = true; }

let globalConfig = {
  globalAttachments: [
    { id: "national_id", name: "صورة بطاقة الرقم القومي", required: true },
    { id: "birth_cert", name: "شهادة الميلاد الأصلية", required: true },
    { id: "high_school", name: "شهادة الثانوية العامة", required: true }
  ],
  customFieldsSchema: [],
  colleges: [
    "كلية الهندسة",
    "كلية طب الفم والاسنان",
    "كلية العلاج الطبيعي",
    "كلية التمريض",
    "كلية الحاسبات والمعلومات والذكاء الاصطناعي",
    "كلية الادارة والاقتصاد والعلوم السياسية",
    "كلية تكنولوجيا العلوم الصحية التطبيقية"
  ],
  levels: [
    "الفرقة الاولى",
    "الفرقة الثانية",
    "الفرقة الثالثة",
    "الفرقة الرابعة",
    "الفرقة الخامسة"
  ],
  whatsappPreamble: "السلام عليكم ورحمة الله وبركاته\nعزيزي الطالب {name} (الكود: {code})\nنرجو التكرم باستكمال المستندات الناقصة التالية قبل موعد التسليم:\n{missing}\nمع خالص تحيات إدارة الجامعة.",
  universityName: "جامعة اللوتس",
  universityLogo: "https://i.ibb.co/kgfm88mq/logo.png"
};

let studentsIndex = [], selectedStudent = null, currentScreen = "search", allStudentsList = [], bulkSelectedStudent = null;

const searchInput = document.getElementById("search-input");
const autocompleteDropdown = document.getElementById("autocomplete-dropdown");
const studentCard = document.getElementById("student-card");
const searchBtn = document.getElementById("search-btn");

const FILE_MATCHING_RULES = [
  { patterns: ["national_id","national-id","nationalid","قومي","national","بطاقة","هوية","identity","بطاقه"], attachmentId: "national_id" },
  { patterns: ["birth_cert","birth-cert","birthcert","birth","ميلاد","مولد"], attachmentId: "birth_cert" },
  { patterns: ["high_school","high-school","highschool","ثانوية","ثانوي","temple"], attachmentId: "high_school" },
  { patterns: ["military","تجنيد","التجنيد","عسكري"], attachmentId: "military_cert" },
  { patterns: ["fees","receipt","مصاريف","ايصال","إيصال","فواتير"], attachmentId: "fees_receipt" },
  { patterns: ["medical","صحة","طبي","طب"], attachmentId: "medical_cert" },
  { patterns: ["transcript","كشف","grades","درجات"], attachmentId: "transcript" },
  { patterns: ["photo","صورة","personal","شخصي","الصوره"], attachmentId: "personal_photo" },
  { patterns: ["passport","جواز"], attachmentId: "passport" },
  { patterns: ["visa","تأشيرة"], attachmentId: "visa" },
  { patterns: ["residence","إقامة"], attachmentId: "residence" },
  { patterns: ["consent","موافقة"], attachmentId: "consent" },
  { patterns: ["contract","عقد"], attachmentId: "contract" },
  { patterns: ["certificate","شهاده"], attachmentId: "high_school" },
  { patterns: ["insurance","تأمين"], attachmentId: "insurance" },
];

function escapeHtml(s) { if (!s) return ''; const d = document.createElement('div'); d.appendChild(document.createTextNode(s)); return d.innerHTML; }

// Archive log functions
function getArchiveLog() {
  try { return JSON.parse(localStorage.getItem('lotus_archive_log') || '[]'); } catch { return []; }
}
function logToArchive(student) {
  const log = getArchiveLog();
  log.unshift({
    id: student.id || 'unknown',
    name: student.name || 'غير معروف',
    code: student.code || '-',
    college: student.college || '-',
    nationalId: student.nationalId || '-',
    deletedAt: new Date().toISOString(),
    attachmentsCount: student.attachments ? Object.keys(student.attachments).length : 0
  });
  if (log.length > 500) log.length = 500;
  localStorage.setItem('lotus_archive_log', JSON.stringify(log));
}
function clearArchiveLog() {
  if (!confirm("هل أنت متأكد من مسح سجل الأرشيف بالكامل؟")) return;
  localStorage.removeItem('lotus_archive_log');
  renderArchiveLog();
  showToast("تم مسح السجل.", "success");
}

function promiseWithTimeout(p, ms, msg) {
  let id; const t = new Promise((_, r) => { id = setTimeout(() => r(new Error(msg)), ms); });
  return Promise.race([p, t]).then(r => { clearTimeout(id); return r; }, e => { clearTimeout(id); throw e; });
}

document.addEventListener("DOMContentLoaded", async () => {
  // Initially hide connection indicator
  const connIndicator = document.getElementById("connection-indicator");
  if (connIndicator) connIndicator.style.display = "none";
  
  if (isOfflineMode || !db) {
    initLocalDatabase(); updateModeUI(); renderSettingsControls(); renderAdminStudentsTable(); renderRegisteredStudentsTable(); renderReports();
  } else {
    try {
      await promiseWithTimeout(loadSettingsConfig(), 5000, "مهلة الاتصال");
      await promiseWithTimeout(loadSearchIndex(), 5000, "مهلة التحميل");
      updateModeUI();
      setupRealtimeListener();
    } catch (e) {
      initLocalDatabase(); updateModeUI();
    } finally { renderSettingsControls(); renderAdminStudentsTable(); renderRegisteredStudentsTable(); renderReports(); }
  }
  setupEventListeners();
  setupBulkUploadZone();
  setupDeliverySearch();
});

function seedMockStudents() {
  studentsIndex = [];
  allStudentsList = [];
}

let realtimeListenerActive = false;
function setupRealtimeListener() {
  if (!db || isOfflineMode || realtimeListenerActive) return;
  realtimeListenerActive = true;
  
  db.ref("students").on("value", (snapshot) => {
    const data = snapshot.val();
    const newStudents = [];
    if (data) {
      Object.keys(data).forEach(key => {
        const d = data[key];
        newStudents.push({ id: key, name: d.name||"", code: d.code||"", nationalId: d.nationalId||"", level: d.level||"", college: d.college||"", fileNo: d.fileNo||"", cabinetNo: d.cabinetNo||"", attachments: d.attachments||{}, delivery: d.delivery||{}, customFields: d.customFields||{}, createdAt: d.createdAt||null, address: d.address||"", phone: d.phone||"", whatsapp: d.whatsapp||"" });
      });
    }
    
    // Merge local students
    const cs = localStorage.getItem("lotus_students");
    if (cs) {
      try {
        const parsed = JSON.parse(cs);
        parsed.forEach(s => {
          if (s.id && (s.id.startsWith("local_") || s.id.startsWith("mock_"))) {
            if (!newStudents.find(ns => ns.code === s.code && s.code !== "")) {
              newStudents.push(s);
            }
          }
        });
      } catch(e) {}
    }
    
    studentsIndex = newStudents;
    allStudentsList = [...studentsIndex];
    localStorage.setItem("lotus_students", JSON.stringify(studentsIndex));

    if (selectedStudent) {
      const fresh = studentsIndex.find(s => s.id === selectedStudent.id);
      if (fresh) selectedStudent = fresh;
    }

    renderAdminStudentsTable();
    renderRegisteredStudentsTable();
    renderReports();
    renderCollegeStats();
    rerenderActiveScreen();
  });

  db.ref("settings/config").on("value", (snap) => {
    if (snap.exists()) {
      const cfg = snap.val();
      if (cfg && typeof cfg === "object") {
        globalConfig = cfg;
        if (!globalConfig.globalAttachments) globalConfig.globalAttachments = [];
        if (!globalConfig.customFieldsSchema) globalConfig.customFieldsSchema = [];
      }
    }
    renderSettingsControls();
    renderDocReportOptions();
    if (currentScreen === "delivery" && selectedStudent) renderDeliveryReview(selectedStudent);
  });
}

function rerenderActiveScreen() {
  if (currentScreen === "search") {
    if (selectedStudent) refreshSelectedStudentDetails();
  } else if (currentScreen === "delivery") {
    if (selectedStudent) renderDeliveryReview(selectedStudent);
  } else if (currentScreen === "reports") {
    const fsel = document.getElementById("doc-filter-select");
    const fval = fsel ? fsel.value : "__all__";
    renderReports();
    if (fsel) { fsel.value = fval; renderDocReport(); }
    renderMissingReport();
    renderUnshelved();
  }
}

function stopRealtimeListener() {
  if (db) db.ref("students").off();
  realtimeListenerActive = false;
}

function initLocalDatabase() {
  isOfflineMode = true;
  const cc = localStorage.getItem("lotus_config");
  if (cc) try { 
    const parsed = JSON.parse(cc); 
    globalConfig = {...globalConfig, ...parsed};
    if (!globalConfig.colleges) globalConfig.colleges = ["كلية الهندسة","كلية طب الفم والاسنان","كلية العلاج الطبيعي","كلية التمريض","كلية الحاسبات والمعلومات والذكاء الاصطناعي","كلية الادارة وال الاقتصاد والعلوم السياسية","كلية تكنولوجيا العلوم الصحية التطبيقية"];
    if (!globalConfig.levels) globalConfig.levels = ["الفرقة الاولى","الفرقة الثانية","الفرقة الثالثة","الفرقة الرابعة","الفرقة الخامسة"];
  } catch (e) {}
  const cs = localStorage.getItem("lotus_students");
  if (cs) try { studentsIndex = JSON.parse(cs); allStudentsList = [...studentsIndex]; } catch (e) { seedMockStudents(); }
  else seedMockStudents();
}

async function loadSettingsConfig() {
  if (isOfflineMode || !db) throw new Error("Offline");
  const snapshot = await db.ref("settings/config").once("value");
  if (snapshot.exists()) { globalConfig = snapshot.val(); if (!globalConfig.globalAttachments) globalConfig.globalAttachments = []; if (!globalConfig.customFieldsSchema) globalConfig.customFieldsSchema = []; }
  else await db.ref("settings/config").set(globalConfig);
  localStorage.setItem("lotus_config", JSON.stringify(globalConfig));
}

async function saveSettingsConfig() {
  if (!globalConfig.globalAttachments) globalConfig.globalAttachments = [];
  if (!globalConfig.customFieldsSchema) globalConfig.customFieldsSchema = [];
  if (isOfflineMode || !db) { localStorage.setItem("lotus_config", JSON.stringify(globalConfig)); showToast("تم الحفظ محلياً!", "success"); renderSettingsControls(); if (selectedStudent) refreshSelectedStudentDetails(); return; }
  try { await db.ref("settings/config").set(globalConfig); localStorage.setItem("lotus_config", JSON.stringify(globalConfig)); showToast("تم الحفظ!", "success"); renderSettingsControls(); if (selectedStudent) refreshSelectedStudentDetails(); }
  catch (e) { showToast("خطأ: " + e.message, "error"); }
}

async function loadSearchIndex() {
  if (isOfflineMode || !db) throw new Error("Offline");
  
  // First, load any local students from localStorage
  const localStudents = [];
  const cs = localStorage.getItem("lotus_students");
  if (cs) try { 
    const parsed = JSON.parse(cs);
    parsed.forEach(s => {
      if (s.id && (s.id.startsWith("local_") || s.id.startsWith("mock_"))) {
        localStudents.push(s);
      }
    });
  } catch (e) {}
  
  // Then load from Realtime Database
  const snapshot = await db.ref("students").once("value");
  studentsIndex = []; allStudentsList = [];
  const data = snapshot.val();
  if (data) {
    Object.keys(data).forEach(key => {
      const d = data[key];
       const s = { id: key, name: d.name||"", code: d.code||"", nationalId: d.nationalId||"", level: d.level||"", college: d.college||"", fileNo: d.fileNo||"", cabinetNo: d.cabinetNo||"", attachments: d.attachments||{}, delivery: d.delivery||{}, customFields: d.customFields||{}, createdAt: d.createdAt||null, whatsapp: d.whatsapp||"" };
      studentsIndex.push(s);
      allStudentsList.push(s);
    });
  }
  
  // Merge local students (avoid duplicates by code)
  localStudents.forEach(ls => {
    if (!studentsIndex.find(s => s.code === ls.code && s.code !== "")) {
      studentsIndex.push(ls);
      allStudentsList.push(ls);
    }
  });
  
  localStorage.setItem("lotus_students", JSON.stringify(studentsIndex));
  renderAdminStudentsTable();
  renderRegisteredStudentsTable();
}

function updateModeUI() {
  const t = document.getElementById("mode-status-text"), b = document.getElementById("mode-toggle-btn");
  if (!b || !t) return; const i = b.querySelector(".status-indicator");
  if (isOfflineMode) { t.textContent = "محلي (Local)"; b.style.borderColor = "var(--primary)"; if (i) { i.style.backgroundColor = "var(--primary)"; i.style.boxShadow = "0 0 8px var(--primary)"; } }
  else { t.textContent = "سحابي (Cloud)"; b.style.borderColor = "rgba(60,208,112,0.4)"; if (i) { i.style.backgroundColor = "var(--success)"; i.style.boxShadow = "0 0 8px var(--success)"; } }
  
  // Update connection indicator
  const connIndicator = document.getElementById("connection-indicator");
  if (connIndicator) {
    if (isOfflineMode) {
      connIndicator.style.display = "none";
    } else {
      connIndicator.style.display = "flex";
    }
  }
}

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
  const modeToggleBtn = document.getElementById("mode-toggle-btn");
  if (modeToggleBtn) modeToggleBtn.addEventListener("click", () => {
    isOfflineMode = !isOfflineMode;
    if (isOfflineMode) { initLocalDatabase(); showToast("وضع محلي.", "info"); }
    else if (typeof firebase !== 'undefined' && db) { isOfflineMode = false; showToast("جاري التحديث...", "info"); loadSearchIndex().then(() => showToast("تم التحديث.", "success")).catch(() => { showToast("فشل. العودة للوضع المحلي.", "warning"); initLocalDatabase(); }); }
    else { showToast("Firebase غير محمل.", "warning"); isOfflineMode = true; }
    updateModeUI(); renderSettingsControls(); renderAdminStudentsTable();
    if (selectedStudent) { const u = studentsIndex.find(s => s.code === selectedStudent.code); if (u) selectedStudent = u; refreshSelectedStudentDetails(); }
  });

  let tabProcessing = false;
  document.querySelectorAll(".tab-btn").forEach(btn => btn.addEventListener("click", () => {
    if (tabProcessing) return;
    const sid = btn.getAttribute("data-screen");
    if (sid === "admin") {
      openPasscodeModal(pw => { if (pw === "8520") { switchScreen("admin"); document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active")); btn.classList.add("active"); if (!isOfflineMode && db) loadSearchIndex().catch(() => { renderAdminStudentsTable(); renderArchiveLog(); }); else { renderAdminStudentsTable(); renderArchiveLog(); } } else showToast("رمز خاطئ!", "error"); });
    } else if (sid === "registered") {
      tabProcessing = true;
      switchScreen("registered"); document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active")); btn.classList.add("active");
      setTimeout(() => { renderRegisteredStudentsTable(); tabProcessing = false; }, 50);
    } else if (sid === "reports") {
      switchScreen("reports"); document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active")); btn.classList.add("active");
      renderReports(); renderDocReportOptions(); renderDocReport(); renderMissingReport(); renderUnshelved();
    } else if (sid === "delivery") {
      switchScreen("delivery"); document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active")); btn.classList.add("active");
      if (selectedStudent) renderDeliveryReview(selectedStudent);
      else { const c = document.getElementById("delivery-review"); if (c) c.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">اختر طالباً من البحث أعلاه لمراجعة تسليم ملفاته.</p>'; }
    } else { switchScreen(sid); document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active")); btn.classList.add("active"); }
  }));

  if (searchInput) searchInput.addEventListener("input", e => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) { 
      autocompleteDropdown.style.display = "none"; 
      if (studentCard) studentCard.style.display = "none";
      selectedStudent = null;
      return; 
    }
    const r = studentsIndex.filter(s => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.nationalId.toLowerCase().includes(q)).slice(0, 8);
    if (r.length > 0) { autocompleteDropdown.innerHTML = ""; r.forEach(s => { const it = document.createElement("div"); it.className = "autocomplete-item"; it.innerHTML = `<span class="student-name">${escapeHtml(s.name)}</span><span class="student-meta">${escapeHtml(s.code)} | ${escapeHtml(s.level)}</span>`; it.addEventListener("click", () => selectStudent(s)); autocompleteDropdown.appendChild(it); }); autocompleteDropdown.style.display = "block"; } else autocompleteDropdown.style.display = "none";
  });

  document.addEventListener("click", e => { if (autocompleteDropdown && !e.target.closest(".search-container")) autocompleteDropdown.style.display = "none"; });
  if (searchBtn) searchBtn.addEventListener("click", performSearch);
  if (searchInput) searchInput.addEventListener("keypress", e => { if (e.key === "Enter") performSearch(); });

  const af = document.getElementById("add-attachment-form");
  if (af) af.addEventListener("submit", e => { e.preventDefault(); const inp = document.getElementById("new-attachment-name"); const n = inp.value.trim(); if (!n) return; if (!globalConfig.globalAttachments) globalConfig.globalAttachments = []; globalConfig.globalAttachments.push({ id: "att_" + Date.now(), name: n }); inp.value = ""; saveSettingsConfig(); });

  const cf = document.getElementById("add-custom-field-form");
  if (cf) cf.addEventListener("submit", e => { e.preventDefault(); const inp = document.getElementById("new-field-name"); const n = inp.value.trim(); if (!n) return; if (!globalConfig.customFieldsSchema) globalConfig.customFieldsSchema = []; globalConfig.customFieldsSchema.push({ id: "custom_" + Date.now(), name: n, type: "text" }); inp.value = ""; saveSettingsConfig(); });

  const clf = document.getElementById("add-college-form");
  if (clf) clf.addEventListener("submit", e => { e.preventDefault(); const inp = document.getElementById("new-college-name"); const n = inp.value.trim(); if (!n) return; if (!globalConfig.colleges) globalConfig.colleges = []; if (globalConfig.colleges.includes(n)) { showToast("الكلية موجودة بالفعل!", "warning"); return; } globalConfig.colleges.push(n); inp.value = ""; saveSettingsConfig(); renderSettingsControls(); });

  const lvf = document.getElementById("add-level-form");
  if (lvf) lvf.addEventListener("submit", e => { e.preventDefault(); const inp = document.getElementById("new-level-name"); const n = inp.value.trim(); if (!n) return; if (!globalConfig.levels) globalConfig.levels = []; if (globalConfig.levels.includes(n)) { showToast("الفرقة موجودة بالفعل!", "warning"); return; } globalConfig.levels.push(n); inp.value = ""; saveSettingsConfig(); renderSettingsControls(); });

  const dz = document.getElementById("excel-dropzone"), fi = document.getElementById("excel-file-input");
  if (dz && fi) { dz.addEventListener("click", () => fi.click()); dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("dragover"); }); dz.addEventListener("dragleave", () => dz.classList.remove("dragover")); dz.addEventListener("drop", e => { e.preventDefault(); dz.classList.remove("dragover"); if (e.dataTransfer.files.length > 0) handleExcelFile(e.dataTransfer.files[0]); }); fi.addEventListener("change", e => { if (e.target.files.length > 0) handleExcelFile(e.target.files[0]); }); }
}

// ==================== BULK UPLOAD ====================

function setupBulkUploadZone() {
  const zone = document.getElementById("bulk-upload-zone"), inp = document.getElementById("bulk-upload-input");
  if (!zone || !inp) return;

  zone.addEventListener("click", () => inp.click());
  zone.addEventListener("dragover", e => { e.preventDefault(); e.stopPropagation(); zone.classList.add("dragover"); });
  zone.addEventListener("dragleave", e => { e.preventDefault(); zone.classList.remove("dragover"); });

  zone.addEventListener("drop", e => {
    e.preventDefault(); e.stopPropagation(); zone.classList.remove("dragover");
    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const entries = [];
      for (let i = 0; i < items.length; i++) { const en = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null; if (en) entries.push(en); }
      if (entries.length > 0) { handleDroppedEntries(entries); return; }
    }
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) processBulkFiles(files);
  });

  inp.addEventListener("change", e => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    // Detect student from folder name using webkitRelativePath
    let detected = false;
    for (const f of files) {
      const rp = f.webkitRelativePath || "";
      if (rp) {
        const folderName = rp.split("/")[0];
        if (folderName) {
          const code = extractStudentCode(folderName);
          if (code) {
            const st = studentsIndex.find(s => s.code === code);
            if (st) { bulkSelectedStudent = st; selectedStudent = st; showDetectedStudent(st, files); detected = true; break; }
          }
        }
      }
    }
    if (!detected) showManualSearch();
    processBulkFiles(files);
  });
}

async function handleDroppedEntries(entries) {
  let folderName = null, allFiles = [];
  function readEntry(entry, path) {
    return new Promise(resolve => {
      if (entry.isFile) { entry.file(f => { f._relativePath = path + f.name; allFiles.push(f); resolve(); }, () => resolve()); }
      else if (entry.isDirectory) {
        if (!folderName) folderName = entry.name;
        const reader = entry.createReader();
        const readBatch = () => reader.readEntries(async batch => {
          if (batch.length === 0) { resolve(); return; }
          for (const child of batch) await readEntry(child, path + entry.name + "/");
          readBatch();
        }, () => resolve());
        readBatch();
      } else resolve();
    });
  }
  for (const entry of entries) await readEntry(entry, "");

  if (folderName) {
    const code = extractStudentCode(folderName);
    if (code) {
      const st = studentsIndex.find(s => s.code === code);
      if (st) { bulkSelectedStudent = st; selectedStudent = st; showDetectedStudent(st, allFiles); showToast(`تم التعرف على: ${st.name} (${st.code})`, "success"); await processBulkFiles(allFiles); return; }
      else showToast(`الكود "${code}" غير موجود.`, "warning");
    } else showToast(`لم يتعرف على كود من "${folderName}".`, "warning");
  }
  showManualSearch();
  await processBulkFiles(allFiles);
}

function extractStudentCode(text) {
  if (!text) return null;
  const d = text.replace(/\D/g, '');
  if (d.length >= 3 && d.length <= 6) return d;
  const m = text.match(/\d{3,6}/);
  return m ? m[0] : null;
}

function showDetectedStudent(st, files) {
  const el = document.getElementById("bulk-detected-student"), m = document.getElementById("bulk-manual-search");
  if (!el) return; el.style.display = "block"; if (m) m.style.display = "none";
  const n = document.getElementById("bulk-detected-name"), c = document.getElementById("bulk-detected-code"), l = document.getElementById("bulk-detected-level"), f = document.getElementById("bulk-detected-files");
  if (n) n.textContent = st.name; if (c) c.textContent = `(${st.code})`; if (l) l.textContent = st.level || ""; if (f) f.textContent = `${files.length} ملف جاهز للمعالجة`;
}

function showManualSearch() { const m = document.getElementById("bulk-manual-search"); if (m) m.style.display = "block"; }

function matchFileToAttachment(filename) {
  const lower = filename.toLowerCase().replace(/[._\-]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const rule of FILE_MATCHING_RULES) {
    for (const p of rule.patterns) { if (lower.includes(p.toLowerCase())) return rule.attachmentId; }
  }
  const am = { "national_id": ["قومي","بطاقة","هوية","identity"], "birth_cert": ["ميلاد","مولد","birth"], "high_school": ["ثانوي","شهادة"], "military_cert": ["تجنيد","عسكري"], "fees_receipt": ["مصاريف","ايصال","إيصال","فواتير"], "medical_cert": ["صحي","طبي","صحة"], "transcript": ["كشف","درجات"], "personal_photo": ["صورة","photo","شخصي"], "passport": ["جواز"], "visa": ["تأشيرة"], "residence": ["إقامة"], "consent": ["موافقة"], "contract": ["عقد"], "insurance": ["تأمين"] };
  for (const [id, kws] of Object.entries(am)) { for (const kw of kws) { if (lower.includes(kw)) return id; } }
  return null;
}

async function processBulkFiles(files) {
  const student = bulkSelectedStudent || selectedStudent;
  if (!student) { showToast("حدد طالب أولاً!", "warning"); return; }

  const pEl = document.getElementById("bulk-upload-progress"), pf = document.getElementById("bulk-upload-progress-fill"), pt = document.getElementById("bulk-upload-progress-text"), rEl = document.getElementById("bulk-upload-results");
  if (pEl) pEl.style.display = "block"; if (rEl) rEl.style.display = "none";

  let matched = 0, unmatched = 0, unmatchedFiles = [], matchedFiles = [], total = files.length;

  for (let i = 0; i < total; i++) {
    const file = files[i];
    if (pf) pf.style.width = `${Math.round(((i+1)/total)*100)}%`;
    if (pt) pt.textContent = `جاري معالجة ${i+1} من ${total}...`;
    const attId = matchFileToAttachment(file.name);
    if (attId) { await saveFileToStudent(file, attId, student); matched++; matchedFiles.push({ file: file.name, attachment: getAttachmentName(attId) }); }
    else { unmatched++; unmatchedFiles.push(file.name); }
  }

  if (pt) pt.textContent = `تم! ${matched} ملف تم توزيعها.`;
  if (pf) pf.style.width = "100%";
  showResults(matchedFiles, unmatchedFiles, total);
  setTimeout(() => { if (pEl) pEl.style.display = "none"; }, 5000);
  refreshSelectedStudentDetails();
}

function saveFileToStudent(file, attachmentId, student) {
  return new Promise(resolve => {
    // Always save locally first (base64)
    if (file.size > 2 * 1024 * 1024) { showToast(`${file.name} كبير جداً!`, "warning"); resolve(); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const url = reader.result;
      if (!student.attachments) student.attachments = {};
      student.attachments[attachmentId] = { fileName: file.name, fileUrl: url, size: file.size, uploadedAt: new Date().toISOString() };

      // Sync to studentsIndex and localStorage
      const idx = studentsIndex.findIndex(s => s.id === student.id);
      if (idx !== -1) { studentsIndex[idx].attachments = student.attachments; }
      localStorage.setItem("lotus_students", JSON.stringify(studentsIndex));

      // Also try cloud if online
      if (!isOfflineMode && db && !student.id.startsWith("mock_")) {
        try {
          await db.ref(`students/${student.id}/attachments/${attachmentId}`).set({ fileName: file.name, fileUrl: url, size: file.size, uploadedAt: new Date().toISOString() });
        } catch (e) { /* saved locally anyway */ }
      }
      resolve();
    };
    reader.onerror = () => resolve();
    reader.readAsDataURL(file);
  });
}

function getAttachmentName(id) { const f = globalConfig.globalAttachments.find(a => a.id === id); return f ? f.name : id; }

function showResults(matched, unmatched, total) {
  const el = document.getElementById("bulk-upload-results"); if (!el) return;
  let h = `<div style="padding:15px; background:rgba(12,24,18,0.5); border-radius:8px; border:1px solid rgba(212,175,55,0.15);">`;
  h += `<div style="font-weight:600; color:var(--text-gold); margin-bottom:10px; font-family:var(--font-title);">تقرير (${total} ملف)</div>`;
  if (matched.length) { h += `<div style="margin-bottom:10px;"><span style="color:var(--success); font-weight:600;">✓ ${matched.length} تم توزيعها:</span><ul style="list-style:none; margin-top:5px; padding-right:15px;">`; matched.forEach(m => { h += `<li style="font-size:13px; color:var(--text-muted); padding:3px 0;"><i class="fas fa-file" style="color:var(--success); margin-left:5px;"></i><strong>${escapeHtml(m.file)}</strong> → <span style="color:var(--text-gold);">${escapeHtml(m.attachment)}</span></li>`; }); h += `</ul></div>`; }
  if (unmatched.length) { h += `<div><span style="color:var(--warning); font-weight:600;">⚠ ${unmatched.length} لم يتم التعرف:</span><ul style="list-style:none; margin-top:5px; padding-right:15px;">`; unmatched.forEach(u => { h += `<li style="font-size:13px; color:var(--text-muted); padding:3px 0;"><i class="fas fa-question-circle" style="color:var(--warning); margin-left:5px;"></i>${escapeHtml(u)}</li>`; }); h += `</ul></div>`; }
  h += `</div>`; el.innerHTML = h; el.style.display = "block";
}

// ==================== BULK STUDENT SEARCH ====================

window.handleBulkStudentSearch = function(q) {
  const dd = document.getElementById("bulk-student-dropdown"); if (!dd) return;
  q = q.trim().toLowerCase(); if (!q) { dd.style.display = "none"; return; }
  const r = studentsIndex.filter(s => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)).slice(0, 5);
  if (r.length > 0) { dd.innerHTML = ""; r.forEach(s => { const it = document.createElement("div"); it.className = "autocomplete-item"; it.innerHTML = `<span class="student-name">${escapeHtml(s.name)}</span><span class="student-meta">${escapeHtml(s.code)} | ${escapeHtml(s.level)}</span>`; it.addEventListener("click", () => { bulkSelectedStudent = s; selectedStudent = s; document.getElementById("bulk-student-search").value = s.name; dd.style.display = "none"; const det = document.getElementById("bulk-detected-student"); if (det) { det.style.display = "block"; document.getElementById("bulk-detected-name").textContent = s.name; document.getElementById("bulk-detected-code").textContent = `(${s.code})`; } showToast(`تم اختيار: ${s.name}`, "success"); }); dd.appendChild(it); }); dd.style.display = "block"; } else dd.style.display = "none";
};

// ==================== CORE FUNCTIONS ====================

function switchScreen(id) { currentScreen = id; document.querySelectorAll(".screen").forEach(s => s.classList.remove("active")); const t = document.getElementById(`${id}-screen`); if (t) t.classList.add("active"); }

function performSearch() {
  if (!searchInput) return; const q = searchInput.value.trim().toLowerCase();
  if (!q) { showToast("أدخل كود أو اسم للبحث", "info"); return; }
  const m = studentsIndex.filter(s => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.nationalId.toLowerCase().includes(q));
  if (m.length === 1) selectStudent(m[0]);
  else if (m.length > 1) { selectStudent(m[0]); showToast(`${m.length} نتائج، تم عرض الأولى.`, "info"); }
  else showToast("لا توجد نتائج", "warning");
  if (autocompleteDropdown) autocompleteDropdown.style.display = "none";
}

function selectStudent(s) { selectedStudent = s; if (searchInput) searchInput.value = s.name; if (autocompleteDropdown) autocompleteDropdown.style.display = "none"; refreshSelectedStudentDetails(); if (currentScreen === "delivery") renderDeliveryReview(s); }

function refreshSelectedStudentDetails() {
  if (!selectedStudent) return;
  const set = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
  set("card-student-name", selectedStudent.name); set("val-name", selectedStudent.name); set("val-college", selectedStudent.college || "غير محدد"); set("val-level", selectedStudent.level || "غير محدد");
  set("val-code", selectedStudent.code); set("val-national-id", selectedStudent.nationalId || "غير مسجل");
  set("val-cabinet", selectedStudent.cabinetNo || "غير محدد"); set("val-file", selectedStudent.fileNo || "غير محدد");
  set("val-whatsapp", (selectedStudent.whatsapp && selectedStudent.whatsapp.trim()) ? selectedStudent.whatsapp : "غير مسجل");
  set("print-student-name", selectedStudent.name); set("print-student-code", selectedStudent.code);

  const cf = document.getElementById("custom-fields-display");
  if (cf) { cf.innerHTML = ""; if (globalConfig && globalConfig.customFieldsSchema) globalConfig.customFieldsSchema.forEach(f => { const v = selectedStudent.customFields ? (selectedStudent.customFields[f.id] || "غير مسجل") : "غير مسجل"; const b = document.createElement("div"); b.className = "info-block"; b.innerHTML = `<div class="info-label">${escapeHtml(f.name)}</div><div class="info-value">${escapeHtml(v)}</div>`; cf.appendChild(b); }); }
  renderStudentAttachments(); if (studentCard) studentCard.style.display = "block";
}

function renderStudentAttachments() {
  const c = document.getElementById("attachments-grid"); if (!c) return; c.innerHTML = "";
  const sa = selectedStudent.attachments || {}; const rid = new Set();
  
  // Download All button
  const attachedFiles = Object.entries(sa).filter(([k,v]) => v && v.fileUrl);
  if (attachedFiles.length > 1) {
    const dlAllBtn = document.createElement("div");
    dlAllBtn.className = "download-all-btn";
    dlAllBtn.innerHTML = `<i class="fas fa-download"></i> تحميل جميع المرفقات (${attachedFiles.length})`;
    dlAllBtn.addEventListener("click", downloadAllAttachments);
    c.appendChild(dlAllBtn);
  }
  
  if (globalConfig && globalConfig.globalAttachments) globalConfig.globalAttachments.forEach(a => { rid.add(a.id); c.appendChild(createAttachmentCard(a.id, a.name, sa[a.id])); });
  Object.keys(sa).forEach(id => { if (!rid.has(id)) { const d = sa[id]; if (d && d.fileUrl) c.appendChild(createAttachmentCard(id, d.customName || id, d, true)); } });
  const btn = document.createElement("div"); btn.className = "attachment-add-btn"; btn.innerHTML = `<i class="fas fa-plus"></i>`; btn.title = "إضافة مرفق"; btn.addEventListener("click", promptAddCustomAttachment); c.appendChild(btn);
}

function createAttachmentCard(id, name, data, isCustom = false) {
  const card = document.createElement("div"); card.className = "attachment-card";
  const has = !!(data && data.fileUrl); if (has) card.classList.add("has-file");
  const isImage = has && /\.(jpg|jpeg|png|gif|webp|bmp|svg)/i.test(data.fileName || data.fileUrl);
  const isPDF = has && /\.(pdf)/i.test(data.fileName || data.fileUrl);
  card.innerHTML = `
    <div class="attachment-info">
      <div class="attachment-name">${escapeHtml(name)}</div>
      <div class="attachment-status ${has ? 'status-attached' : 'status-missing'}">
        <span class="status-indicator"></span>
        <span>${has ? 'مرفق متاح' : ''} ${has && data.size ? '(' + formatBytes(data.size) + ')' : ''}</span>
      </div>
    </div>
    <div class="attachment-actions">
      ${has ? `<button class="btn-icon" onclick="previewAttachment('${escapeHtml(data.fileUrl)}')"><i class="fas fa-eye"></i></button><button class="btn-icon" onclick="printAttachment('${escapeHtml(data.fileUrl)}','${escapeHtml(data.fileName)}')"><i class="fas fa-print"></i></button><button class="btn-icon" onclick="downloadAttachment('${escapeHtml(data.fileUrl)}','${escapeHtml(data.fileName)}')"><i class="fas fa-download"></i></button><button class="btn-icon btn-delete" onclick="deleteAttachment('${escapeHtml(id)}',${isCustom})"><i class="fas fa-trash-alt"></i></button>` : `<button class="btn-icon btn-upload-trigger" onclick="triggerFileUpload('${escapeHtml(id)}')"><i class="fas fa-upload"></i> ارفاق</button>`}
    </div>
    <input type="file" id="file-input-${escapeHtml(id)}" class="file-input-hidden" onchange="uploadAttachmentFile(this,'${escapeHtml(id)}','${escapeHtml(name)}',${isCustom})">`;
  if (has) {
    card.addEventListener('mouseenter', e => showAttachmentPreview(e, data.fileUrl, isImage));
    card.addEventListener('mouseleave', hideAttachmentPreview);
  }
  return card;
}

window.triggerFileUpload = id => { const el = document.getElementById(`file-input-${id}`); if (el) el.click(); };

window.printAttachment = function(fileUrl, fileName) {
  const isPDF = /\.pdf/i.test(fileName || fileUrl);
  const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)/i.test(fileName || fileUrl);
  const printWindow = window.open('', '_blank');
  let content = '';
  if (isPDF) {
    content = `<iframe src="${fileUrl}" style="width:100%;height:100%;border:none;"></iframe>`;
  } else if (isImage) {
    content = `<img src="${fileUrl}" style="max-width:100%;max-height:100%;display:block;margin:auto;">`;
  } else {
    content = `<div style="padding:20px;text-align:center;">الملف: ${fileName || ''}<br><a href="${fileUrl}" download="${fileName}">اضغط للتحميل</a></div>`;
  }
  printWindow.document.write(`
    <html><head><title>طباعة - ${fileName || ''}</title>
    <style>@media print{body{margin:0;}}</style></head>
    <body style="margin:0;display:flex;justify-content:center;align-items:center;height:100vh;">${content}</body></html>`);
  printWindow.document.close();
  setTimeout(() => { printWindow.print(); }, 1000);
};

function saveAttachmentLocally(file, attachmentId, attachmentName, isCustom, targetStudent) {
  const st = targetStudent || selectedStudent;
  return new Promise(resolve => {
    if (!st) { resolve(); return; }
    if (file.size > 2 * 1024 * 1024) { showToast("الملف كبير جداً!", "warning"); resolve(); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const url = reader.result;
      if (!st.attachments) st.attachments = {};
      st.attachments[attachmentId] = { fileName: file.name, fileUrl: url, size: file.size, customName: isCustom ? attachmentName : null, uploadedAt: new Date().toISOString() };
      const idx = studentsIndex.findIndex(s => s.id === st.id);
      if (idx !== -1) { studentsIndex[idx].attachments = st.attachments; localStorage.setItem("lotus_students", JSON.stringify(studentsIndex)); }
      if (!isOfflineMode && db && !st.id.startsWith("mock_") && file.size < 700 * 1024) {
        try { await db.ref(`students/${st.id}/attachments/${attachmentId}`).set({ fileName: file.name, fileUrl: url, size: file.size, customName: isCustom ? attachmentName : null, uploadedAt: new Date().toISOString() }); } catch (e) {}
      }
      resolve();
    };
    reader.onerror = () => resolve();
    reader.readAsDataURL(file);
  });
}

window.uploadAttachmentFile = async function(input, attachmentId, attachmentName, isCustom) {
  if (input.files.length === 0) return; const file = input.files[0];
  await saveAttachmentLocally(file, attachmentId, attachmentName, isCustom, selectedStudent);
  if (window.authLogActivity) window.authLogActivity('رفع ملف', 'نظام الملفات', selectedStudent.code, selectedStudent.name, 'تم رفع ملف: ' + (attachmentName || file.name));
  showToast("تم حفظ الملف!", "success"); refreshSelectedStudentDetails();
};

window.previewAttachment = function(url) { if (!url) return; if (url.startsWith("data:")) { const w = window.open(); if (w) w.document.write(`<iframe src="${url}" frameborder="0" style="border:0;width:100%;height:100%;" allowfullscreen></iframe>`); } else window.open(url, "_blank"); };

// Hover preview tooltip
let previewTooltip = null;
function showAttachmentPreview(e, url, isImage) {
  hideAttachmentPreview();
  previewTooltip = document.createElement('div');
  previewTooltip.className = 'attachment-preview-tooltip';
  if (isImage) {
    previewTooltip.innerHTML = `<img src="${url}" alt="معاينة">`;
  } else {
    previewTooltip.innerHTML = `<div style="padding:20px;text-align:center;"><i class="fas fa-file-pdf" style="font-size:40px;color:#e74c3c;"></i><div style="margin-top:8px;font-size:12px;color:#999;">PDF</div></div>`;
  }
  document.body.appendChild(previewTooltip);
  const rect = e.currentTarget.getBoundingClientRect();
  previewTooltip.style.left = (rect.right + 10) + 'px';
  previewTooltip.style.top = rect.top + 'px';
  // Keep in viewport
  const tr = previewTooltip.getBoundingClientRect();
  if (tr.right > window.innerWidth) previewTooltip.style.left = (rect.left - tr.width - 10) + 'px';
  if (tr.bottom > window.innerHeight) previewTooltip.style.top = (window.innerHeight - tr.height - 10) + 'px';
}
function hideAttachmentPreview() { if (previewTooltip) { previewTooltip.remove(); previewTooltip = null; } }

// Download all attachments to D:\ملفات الطلاب\{code}\
async function downloadAllAttachments() {
  if (!selectedStudent || !selectedStudent.attachments) return;
  const files = Object.values(selectedStudent.attachments).filter(a => a && a.fileUrl);
  if (files.length === 0) { showToast("لا توجد ملفات للتحميل", "info"); return; }
  const name = selectedStudent.name || "";
  const code = selectedStudent.code || "";
  const college = selectedStudent.college || "";
  const folderName = `${name} - ${code}${college ? ' - ' + college : ''}`;

  if (typeof JSZip === 'undefined') {
    showToast("جاري تحميل المكتبات...", "warning");
    return;
  }

  showToast("جاري إنشاء الملف المضغوط...", "info");

  try {
    const zip = new JSZip();
    const folder = zip.folder(folderName);

    for (const file of files) {
      try {
        let blob;
        if (file.fileUrl.startsWith('data:')) {
          const parts = file.fileUrl.split(',');
          const mime = parts[0].match(/:(.*?);/)[1];
          const b64 = atob(parts[1]);
          const arr = new Uint8Array(b64.length);
          for (let i = 0; i < b64.length; i++) arr[i] = b64.charCodeAt(i);
          blob = new Blob([arr], { type: mime });
        } else {
          const resp = await fetch(file.fileUrl);
          blob = await resp.blob();
        }
        folder.file(file.fileName || `file_${Date.now()}`, blob);
      } catch (err) { console.error('ZIP add error:', err); }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const zipName = `${folderName}.zip`;

    if (typeof saveAs !== 'undefined') {
      saveAs(content, zipName);
    } else {
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    showToast(`تم تحميل ${files.length} ملف في ${zipName}`, "success");
  } catch (e) {
    console.error('ZIP error:', e);
    showToast("خطأ في إنشاء الملف المضغوط", "error");
  }
}

window.downloadAttachment = function(url, fn) {
  if (!url) return;
  try {
    let blob;
    if (url.startsWith('data:')) {
      const parts = url.split(',');
      const mime = parts[0].match(/:(.*?);/)[1];
      const b64 = atob(parts[1]);
      const arr = new Uint8Array(b64.length);
      for (let i = 0; i < b64.length; i++) arr[i] = b64.charCodeAt(i);
      blob = new Blob([arr], { type: mime });
    } else {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.responseType = 'blob';
      xhr.send();
      blob = xhr.response;
    }
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fn || "file";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (e) { console.error('Download error:', e); }
};

window.deleteAttachment = async function(id, isCustom) {
  if (!confirm("حذف المرفق؟")) return;
  delete selectedStudent.attachments[id];
  const idx = studentsIndex.findIndex(s => s.id === selectedStudent.id);
  if (idx !== -1) { studentsIndex[idx].attachments = selectedStudent.attachments; localStorage.setItem("lotus_students", JSON.stringify(studentsIndex)); }
  if (!isOfflineMode && db && !selectedStudent.id.startsWith("mock_")) { try { await db.ref(`students/${selectedStudent.id}/attachments/${id}`).remove(); } catch (e) {} }
  if (window.authLogActivity) window.authLogActivity('حذف ملف', 'نظام الملفات', selectedStudent.code, selectedStudent.name, 'تم حذف ملف المرفق');
  showToast("تم الحذف.", "success"); refreshSelectedStudentDetails();
};

let customAttFile = null;

function promptAddCustomAttachment() {
  if (!selectedStudent) { showToast("اختر طالب أولاً!", "warning"); return; }
  customAttFile = null;
  const modal = document.getElementById("custom-attachment-modal");
  const nameInput = document.getElementById("custom-att-name");
  const fileInput = document.getElementById("custom-att-file-input");
  const uploadArea = document.getElementById("custom-att-upload-area");
  const saveBtn = document.getElementById("custom-att-save-btn");
  const msgEl = document.getElementById("custom-att-msg");
  
  nameInput.value = "";
  fileInput.value = "";
  uploadArea.style.display = "none";
  saveBtn.disabled = true;
  if (msgEl) msgEl.style.display = "none";
  modal.classList.add("active");
  nameInput.focus();
}

document.addEventListener("DOMContentLoaded", () => {
  const nameInput = document.getElementById("custom-att-name");
  const fileInput = document.getElementById("custom-att-file-input");
  const saveBtn = document.getElementById("custom-att-save-btn");
  
  if (nameInput) nameInput.addEventListener("input", () => {
    saveBtn.disabled = !nameInput.value.trim() || !customAttFile;
  });
  
  if (fileInput) fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast("الملف أكبر من 5MB!", "warning"); return; }
    customAttFile = file;
    document.getElementById("custom-att-file-name").textContent = file.name;
    document.getElementById("custom-att-file-size").textContent = formatBytes(file.size);
    document.getElementById("custom-att-upload-area").style.display = "block";
    const msgEl = document.getElementById("custom-att-msg");
    if (msgEl) { msgEl.querySelector("span").textContent = "✓ تم ارفاق ملف: " + file.name; msgEl.style.display = "block"; }
    saveBtn.disabled = !nameInput.value.trim();
  });
});

window.saveCustomAttachment = async function() {
  const nameInput = document.getElementById("custom-att-name");
  const name = nameInput.value.trim();
  if (!name || !customAttFile || !selectedStudent) return;
  
  const saveBtn = document.getElementById("custom-att-save-btn");
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
  
  try {
    const url = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("File read error"));
      reader.readAsDataURL(customAttFile);
    });
    
    const id = "custom_" + Date.now();
    
    // Initialize attachments if needed
    if (!selectedStudent.attachments) selectedStudent.attachments = {};
    
    // Add the attachment
    selectedStudent.attachments[id] = { 
      customName: name, 
      fileName: customAttFile.name, 
      fileUrl: url, 
      size: customAttFile.size, 
      uploadedAt: new Date().toISOString() 
    };
    
    // Update in studentsIndex
    const idx = studentsIndex.findIndex(s => s.code === selectedStudent.code);
    if (idx !== -1) {
      studentsIndex[idx].attachments = {...selectedStudent.attachments};
      localStorage.setItem("lotus_students", JSON.stringify(studentsIndex));
      // Keep selectedStudent in sync
      selectedStudent = studentsIndex[idx];
    }
    
    // Save to Realtime Database
    if (!isOfflineMode && db && selectedStudent.id && !selectedStudent.id.startsWith("mock_")) {
      try { 
        await db.ref(`students/${selectedStudent.id}/attachments/${id}`).set({ customName: name, fileName: customAttFile.name, fileUrl: url, size: customAttFile.size, uploadedAt: new Date().toISOString() }); 
      } catch (e) { console.error("Realtime DB error:", e); }
    }
    
    closeCustomAttachmentModal();
    refreshSelectedStudentDetails();
    showToast("تم حفظ المرفق!", "success");
  } catch (e) {
    console.error("Save error:", e);
    showToast("خطأ في الحفظ!", "error");
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ المرفق';
  }
};

window.closeCustomAttachmentModal = function() {
  const modal = document.getElementById("custom-attachment-modal");
  if (modal) modal.classList.remove("active");
  customAttFile = null;
};

window.printStudentCard = () => window.print();

window.triggerEditStudent = function() {
  if (!selectedStudent) return; const m = document.getElementById("edit-student-modal"); if (!m) return;
  document.getElementById("edit-name").value = selectedStudent.name; document.getElementById("edit-code").value = selectedStudent.code;
  document.getElementById("edit-nationalId").value = selectedStudent.nationalId || ""; document.getElementById("edit-college").value = selectedStudent.college || "";
  document.getElementById("edit-level").value = selectedStudent.level || "";
  document.getElementById("edit-cabinetNo").value = selectedStudent.cabinetNo || ""; document.getElementById("edit-fileNo").value = selectedStudent.fileNo || "";
  const ew = document.getElementById("edit-whatsapp"); if (ew) ew.value = selectedStudent.whatsapp || "";
  const ci = document.getElementById("edit-custom-fields-container"); if (ci) { ci.innerHTML = ""; if (globalConfig.customFieldsSchema) globalConfig.customFieldsSchema.forEach(f => { const v = selectedStudent.customFields ? (selectedStudent.customFields[f.id] || "") : ""; const d = document.createElement("div"); d.className = "form-group"; d.innerHTML = `<label class="form-label">${escapeHtml(f.name)}</label><input type="text" id="edit-custom-${escapeHtml(f.id)}" class="form-control" value="${escapeHtml(v)}">`; ci.appendChild(d); }); }
  m.classList.add("active");
};

window.closeEditModal = function() { const el = document.getElementById("edit-student-modal"); if (el) el.classList.remove("active"); };

window.saveStudentEdits = async function() {
  if (!selectedStudent) return;
  const name = document.getElementById("edit-name").value.trim(), code = document.getElementById("edit-code").value.trim();
  const nationalId = document.getElementById("edit-nationalId").value.trim(), college = document.getElementById("edit-college").value.trim(), level = document.getElementById("edit-level").value.trim();
  const cabinetNo = document.getElementById("edit-cabinetNo").value.trim(), fileNo = document.getElementById("edit-fileNo").value.trim();
  const whatsapp = document.getElementById("edit-whatsapp") ? document.getElementById("edit-whatsapp").value.trim() : "";
  if (!name || !code) { showToast("الاسم والكود إجباريين!", "warning"); return; }
  const cf = {}; if (globalConfig.customFieldsSchema) globalConfig.customFieldsSchema.forEach(f => { const i = document.getElementById(`edit-custom-${f.id}`); if (i) cf[f.id] = i.value.trim(); });
  const ud = { name, code, nationalId, college, level, cabinetNo, fileNo, whatsapp, customFields: cf };
  if (isOfflineMode || !db || selectedStudent.id.startsWith("mock_")) {
    const idx = studentsIndex.findIndex(s => s.id === selectedStudent.id); if (idx !== -1) { studentsIndex[idx] = Object.assign({}, studentsIndex[idx], ud); localStorage.setItem("lotus_students", JSON.stringify(studentsIndex)); }
    Object.assign(selectedStudent, ud); 
    if (window.authLogActivity) window.authLogActivity('تعديل', 'نظام الملفات', selectedStudent.code, selectedStudent.name, 'تم تعديل بيانات الطالب');
    showToast("تم التحديث محلياً.", "success"); closeEditModal(); refreshSelectedStudentDetails(); renderAdminStudentsTable(); return;
  }
  try { await db.ref(`students/${selectedStudent.id}`).update(ud); Object.assign(selectedStudent, ud); const idx = studentsIndex.findIndex(s => s.id === selectedStudent.id); if (idx !== -1) { studentsIndex[idx] = Object.assign({}, studentsIndex[idx], ud); localStorage.setItem("lotus_students", JSON.stringify(studentsIndex)); } 
  if (window.authLogActivity) window.authLogActivity('تعديل', 'نظام الملفات', selectedStudent.code, selectedStudent.name, 'تم تعديل بيانات الطالب');
  showToast("تم التحديث.", "success"); closeEditModal(); refreshSelectedStudentDetails(); loadSearchIndex().catch(() => {}); } catch (e) { showToast("خطأ: " + e.message, "error"); }
};

window.deleteStudentCompletely = async function() {
  if (!selectedStudent) return; if (!confirm(`حذف "${selectedStudent.name}" نهائياً؟`)) return;
  logToArchive(selectedStudent);
  if (isOfflineMode || !db || selectedStudent.id.startsWith("mock_")) {
    studentsIndex = studentsIndex.filter(s => s.id !== selectedStudent.id); allStudentsList = allStudentsList.filter(s => s.id !== selectedStudent.id); localStorage.setItem("lotus_students", JSON.stringify(studentsIndex));
    if (window.authLogActivity) window.authLogActivity('حذف', 'نظام الملفات', selectedStudent.code, selectedStudent.name, 'تم حذف الطالب نهائياً');
    showToast("تم الحذف.", "success"); selectedStudent = null; if (studentCard) studentCard.style.display = "none"; if (searchInput) searchInput.value = ""; renderAdminStudentsTable(); renderReports(); return;
  }
  try {
    await db.ref(`students/${selectedStudent.id}`).remove();
    studentsIndex = studentsIndex.filter(s => s.id !== selectedStudent.id); allStudentsList = allStudentsList.filter(s => s.id !== selectedStudent.id); localStorage.setItem("lotus_students", JSON.stringify(studentsIndex));
    if (window.authLogActivity) window.authLogActivity('حذف', 'نظام الملفات', selectedStudent.code, selectedStudent.name, 'تم حذف الطالب نهائياً');
    showToast("تم الحذف.", "success"); selectedStudent = null; if (studentCard) studentCard.style.display = "none"; if (searchInput) searchInput.value = ""; loadSearchIndex().catch(() => {});
  } catch (e) { showToast("خطأ: " + e.message, "error"); }
};

// ==================== ADMIN ====================

function renderSettingsControls() {
  if (!globalConfig) globalConfig = {};
  if (!globalConfig.globalAttachments) globalConfig.globalAttachments = [{ id: "national_id", name: "صورة بطاقة الرقم القومي", required: true }, { id: "birth_cert", name: "شهادة الميلاد الأصلية", required: true }, { id: "high_school", name: "شهادة الثانوية العامة", required: true }];
  if (!globalConfig.customFieldsSchema) globalConfig.customFieldsSchema = [];
  if (!globalConfig.colleges) globalConfig.colleges = ["كلية الهندسة","كلية طب الفم والاسنان","كلية العلاج الطبيعي","كلية التمريض","كلية الحاسبات والمعلومات والذكاء الاصطناعي","كلية الادارة والاقتصاد والعلوم السياسية","كلية تكنولوجيا العلوم الصحية التطبيقية"];
  if (!globalConfig.levels) globalConfig.levels = ["الفرقة الاولى","الفرقة الثانية","الفرقة الثالثة","الفرقة الرابعة","الفرقة الخامسة"];
  
  const al = document.getElementById("admin-attachments-list");
  if (al) { al.innerHTML = ""; globalConfig.globalAttachments.forEach(a => { const li = document.createElement("li"); li.className = "manager-item"; li.style.display = "flex"; li.style.alignItems = "center"; li.style.gap = "10px"; li.innerHTML = `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" ${a.required !== false ? 'checked' : ''} onchange="toggleAttachmentRequired('${escapeHtml(a.id)}', this.checked)" style="width:16px;height:16px;cursor:pointer;"></label><span class="manager-item-text" style="flex:1;">${escapeHtml(a.name)}</span><button class="btn-delete-small" onclick="editAttachmentName('${escapeHtml(a.id)}')" title="تعديل" style="background:rgba(212,175,55,0.15);border-color:rgba(212,175,55,0.3);color:var(--text-gold);"><i class="fas fa-pen"></i></button><button class="btn-delete-small" onclick="removeGlobalAttachmentType('${escapeHtml(a.id)}')"><i class="fas fa-trash-alt"></i></button>`; al.appendChild(li); }); }
  const fl = document.getElementById("admin-custom-fields-list");
  if (fl) { fl.innerHTML = ""; globalConfig.customFieldsSchema.forEach(f => { const li = document.createElement("li"); li.className = "manager-item"; li.innerHTML = `<span class="manager-item-text">${escapeHtml(f.name)}</span><button class="btn-delete-small" onclick="removeCustomFieldSchema('${escapeHtml(f.id)}')"><i class="fas fa-trash-alt"></i></button>`; fl.appendChild(li); }); }
  
  const cl = document.getElementById("admin-colleges-list");
  if (cl) { cl.innerHTML = ""; globalConfig.colleges.forEach(c => { const li = document.createElement("li"); li.className = "manager-item"; li.innerHTML = `<span class="manager-item-text">${escapeHtml(c)}</span><button class="btn-delete-small" onclick="removeCollege('${escapeHtml(c)}')"><i class="fas fa-trash-alt"></i></button>`; cl.appendChild(li); }); }
  const lv = document.getElementById("admin-levels-list");
  if (lv) { lv.innerHTML = ""; globalConfig.levels.forEach(l => { const li = document.createElement("li"); li.className = "manager-item"; li.innerHTML = `<span class="manager-item-text">${escapeHtml(l)}</span><button class="btn-delete-small" onclick="removeLevel('${escapeHtml(l)}')"><i class="fas fa-trash-alt"></i></button>`; lv.appendChild(li); }); }

  const un = document.getElementById("university-name"); if (un) un.value = globalConfig.universityName || "";
  const ul = document.getElementById("university-logo"); if (ul) ul.value = globalConfig.universityLogo || "";
  const wp = document.getElementById("whatsapp-preamble"); if (wp) wp.value = globalConfig.whatsappPreamble || "";
}

window.saveGlobalSettings = function() {
  const un = document.getElementById("university-name"); if (un) globalConfig.universityName = un.value.trim() || "جامعة اللوتس";
  const ul = document.getElementById("university-logo"); if (ul) globalConfig.universityLogo = ul.value.trim();
  const wp = document.getElementById("whatsapp-preamble"); if (wp) globalConfig.whatsappPreamble = wp.value;
  saveSettingsConfig();
};

window.toggleAttachmentRequired = function(id, checked) {
  const att = globalConfig.globalAttachments.find(a => a.id === id);
  if (att) { att.required = checked; saveSettingsConfig(); }
};

window.editAttachmentName = function(id) {
  const att = globalConfig.globalAttachments.find(a => a.id === id);
  if (!att) return;
  const newName = prompt("أدخل الاسم الجديد للمرفق:", att.name);
  if (newName && newName.trim() && newName.trim() !== att.name) {
    att.name = newName.trim();
    saveSettingsConfig();
    renderSettingsControls();
  }
};

window.removeGlobalAttachmentType = id => { if (!confirm("حذف المرفق العام؟")) return; globalConfig.globalAttachments = globalConfig.globalAttachments.filter(a => a.id !== id); saveSettingsConfig(); };
window.removeCustomFieldSchema = id => { if (!confirm("حذف الحقل؟")) return; globalConfig.customFieldsSchema = globalConfig.customFieldsSchema.filter(f => f.id !== id); saveSettingsConfig(); };
window.removeCollege = id => { if (!confirm("حذف الكلية؟")) return; globalConfig.colleges = globalConfig.colleges.filter(c => c !== id); saveSettingsConfig(); renderSettingsControls(); };
window.removeLevel = id => { if (!confirm("حذف الفرقة؟")) return; globalConfig.levels = globalConfig.levels.filter(l => l !== id); saveSettingsConfig(); renderSettingsControls(); };

function renderAdminStudentsTable() {
  const tb = document.getElementById("admin-students-tbody"); if (!tb) return; tb.innerHTML = "";
  if (allStudentsList.length === 0) { tb.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);">لا يوجد طلاب.</td></tr>`; const c = document.getElementById("student-list-counter"); if (c) c.textContent = "(0)"; return; }
  const lim = allStudentsList.slice(0, 100); const c = document.getElementById("student-list-counter"); if (c) c.textContent = `(${allStudentsList.length} طالب)`;
  lim.forEach(s => {
    const attCount = s.attachments ? Object.keys(s.attachments).filter(k => s.attachments[k] && s.attachments[k].fileUrl).length : 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.code)}</td><td>${escapeHtml(s.college)||"-"}</td><td>${escapeHtml(s.level)||"-"}</td><td>${escapeHtml(s.nationalId)||"-"}</td><td>${escapeHtml(s.fileNo)||"-"}</td><td>${escapeHtml(s.cabinetNo)||"-"}</td><td><span class="att-count-badge" onclick="showStudentGallery('${escapeHtml(s.id)}')" title="عرض المرفقات">${attCount} <i class="fas fa-images"></i></span></td><td style="display:flex;gap:5px;"><button class="btn-icon" style="padding:4px 8px;display:inline-flex;" onclick="adminSelectAndEdit('${escapeHtml(s.id)}')"><i class="fas fa-edit"></i></button><button class="btn-icon btn-delete" style="padding:4px 8px;display:inline-flex;" onclick="adminDeleteStudent('${escapeHtml(s.id)}')"><i class="fas fa-trash-alt"></i></button></td>`;
    tb.appendChild(tr);
  });
}

function renderArchiveLog() {
  const tb = document.getElementById("archive-log-tbody");
  if (!tb) return;
  const log = getArchiveLog();
  if (log.length === 0) {
    tb.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">لا يوجد سجل حذف بعد.</td></tr>`;
    return;
  }
  let html = "";
  log.forEach(item => {
    const date = new Date(item.deletedAt);
    const dateStr = date.toLocaleDateString('ar-EG') + ' ' + date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    html += `<tr style="opacity:0.7;"><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.code)}</td><td>${escapeHtml(item.college)||"-"}</td><td>${escapeHtml(item.nationalId)||"-"}</td><td style="color:var(--text-gold);">${item.attachmentsCount || 0}</td><td style="color:#ff5f5f;">${dateStr}</td></tr>`;
  });
  tb.innerHTML = html;
}

function renderReports() {
  const stats = document.getElementById("reports-stats");
  const details = document.getElementById("reports-details");
  if (!stats || !details) return;

  const total = allStudentsList.length;
  const withCabinet = allStudentsList.filter(s => s.cabinetNo && s.cabinetNo.trim());
  const withoutCabinet = allStudentsList.filter(s => !s.cabinetNo || !s.cabinetNo.trim());
  const withAttachments = allStudentsList.filter(s => s.attachments && Object.values(s.attachments).some(a => a && a.fileUrl));
  const withoutAttachments = allStudentsList.filter(s => !s.attachments || !Object.values(s.attachments).some(a => a && a.fileUrl));
  
  const males = allStudentsList.filter(s => {
    if (!s.nationalId || s.nationalId.length !== 14) return false;
    return parseInt(s.nationalId.charAt(12)) % 2 === 1;
  });
  const females = allStudentsList.filter(s => {
    if (!s.nationalId || s.nationalId.length !== 14) return false;
    return parseInt(s.nationalId.charAt(12)) % 2 === 0;
  });

  const colleges = {};
  allStudentsList.forEach(s => {
    const c = s.college || "غير محدد";
    if (!colleges[c]) colleges[c] = [];
    colleges[c].push(s);
  });

  const levels = {};
  allStudentsList.forEach(s => {
    const l = s.level || "غير محدد";
    if (!levels[l]) levels[l] = [];
    levels[l].push(s);
  });

  let statsHTML = `
    <div onclick="showReportDetails('all')" style="cursor:pointer;background:rgba(60,208,112,0.08);border:1px solid rgba(60,208,112,0.2);border-radius:10px;padding:15px;text-align:center;transition:transform 0.15s,box-shadow 0.15s;" onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 15px rgba(60,208,112,0.15)'" onmouseleave="this.style.transform='';this.style.boxShadow=''">
      <div style="font-size:28px;font-weight:700;color:var(--success);">${total}</div>
      <div style="font-size:13px;color:var(--text-muted);margin-top:5px;">إجمالي الطلاب</div>
    </div>
    <div onclick="showReportDetails('no-cabinet')" style="cursor:pointer;background:rgba(255,95,95,0.08);border:1px solid rgba(255,95,95,0.2);border-radius:10px;padding:15px;text-align:center;transition:transform 0.15s,box-shadow 0.15s;" onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 15px rgba(255,95,95,0.15)'" onmouseleave="this.style.transform='';this.style.boxShadow=''">
      <div style="font-size:28px;font-weight:700;color:#ff5f5f;">${withoutCabinet.length}</div>
      <div style="font-size:13px;color:var(--text-muted);margin-top:5px;">لم يُسكن (بلا دولاب)</div>
    </div>
    <div onclick="showReportDetails('with-cabinet')" style="cursor:pointer;background:rgba(60,208,112,0.08);border:1px solid rgba(60,208,112,0.2);border-radius:10px;padding:15px;text-align:center;transition:transform 0.15s,box-shadow 0.15s;" onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 15px rgba(60,208,112,0.15)'" onmouseleave="this.style.transform='';this.style.boxShadow=''">
      <div style="font-size:28px;font-weight:700;color:var(--success);">${withCabinet.length}</div>
      <div style="font-size:13px;color:var(--text-muted);margin-top:5px;">تم السكن</div>
    </div>
    <div onclick="showReportDetails('with-attachments')" style="cursor:pointer;background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.2);border-radius:10px;padding:15px;text-align:center;transition:transform 0.15s,box-shadow 0.15s;" onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 15px rgba(212,175,55,0.15)'" onmouseleave="this.style.transform='';this.style.boxShadow=''">
      <div style="font-size:28px;font-weight:700;color:var(--text-gold);">${withAttachments.length}</div>
      <div style="font-size:13px;color:var(--text-muted);margin-top:5px;">رفع ملفات</div>
    </div>
    <div onclick="showReportDetails('males')" style="cursor:pointer;background:rgba(100,150,255,0.08);border:1px solid rgba(100,150,255,0.2);border-radius:10px;padding:15px;text-align:center;transition:transform 0.15s,box-shadow 0.15s;" onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 15px rgba(100,150,255,0.15)'" onmouseleave="this.style.transform='';this.style.boxShadow=''">
      <div style="font-size:28px;font-weight:700;color:#6496ff;">♂ ${males.length}</div>
      <div style="font-size:13px;color:var(--text-muted);margin-top:5px;">ذكور</div>
    </div>
    <div onclick="showReportDetails('females')" style="cursor:pointer;background:rgba(255,150,200,0.08);border:1px solid rgba(255,150,200,0.2);border-radius:10px;padding:15px;text-align:center;transition:transform 0.15s,box-shadow 0.15s;" onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 15px rgba(255,150,200,0.15)'" onmouseleave="this.style.transform='';this.style.boxShadow=''">
      <div style="font-size:28px;font-weight:700;color:#ff96c8;">♀ ${females.length}</div>
      <div style="font-size:13px;color:var(--text-muted);margin-top:5px;">إناث</div>
    </div>`;
  stats.innerHTML = statsHTML;

  // === Detailed Reports ===
  let detailsHTML = "";

  // 1. Students without cabinet
  detailsHTML += `<div class="admin-card"><h3 class="admin-card-title"><span style="color:#ff5f5f;">${withoutCabinet.length} طالب</span>لم يُسكنوا بعد (بلا دولاب/ملف)</h3>`;
  if (withoutCabinet.length === 0) {
    detailsHTML += `<p style="color:var(--text-muted);text-align:center;padding:20px;">جميع الطلاب تم سكنهم ✓</p>`;
  } else {
    detailsHTML += `<div class="settings-table-container"><table class="settings-table"><thead><tr><th>#</th><th>الاسم</th><th>الكود</th><th>الكلية</th><th>الفرقة</th><th>رقم الملف</th><th>رقم الدولاب</th></tr></thead><tbody>`;
    withoutCabinet.forEach((s, i) => {
      detailsHTML += `<tr><td>${i+1}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.code)}</td><td>${escapeHtml(s.college)||"-"}</td><td>${escapeHtml(s.level)||"-"}</td><td>${escapeHtml(s.fileNo)||"-"}</td><td>${escapeHtml(s.cabinetNo)||"-"}</td></tr>`;
    });
    detailsHTML += `</tbody></table></div>`;
  }
  detailsHTML += `</div>`;

  // 2. Students per college
  detailsHTML += `<div class="admin-card"><h3 class="admin-card-title">الطلاب حسب الكلية</h3>`;
  Object.entries(colleges).sort((a,b) => b[1].length - a[1].length).forEach(([name, students]) => {
    const pct = total > 0 ? Math.round((students.length/total)*100) : 0;
    detailsHTML += `<div style="margin-bottom:15px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-weight:600;color:var(--text-gold);">${escapeHtml(name)}</span><span style="font-size:13px;color:var(--text-muted);">${students.length} طالب (${pct}%)</span></div>`;
    detailsHTML += `<div class="settings-table-container"><table class="settings-table"><thead><tr><th>#</th><th>الاسم</th><th>الكود</th><th>الفرقة</th><th>الرقم القومي</th><th>الملف</th><th>الدولاب</th></tr></thead><tbody>`;
    students.forEach((s, i) => {
      detailsHTML += `<tr><td>${i+1}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.code)}</td><td>${escapeHtml(s.level)||"-"}</td><td>${escapeHtml(s.nationalId)||"-"}</td><td>${escapeHtml(s.fileNo)||"-"}</td><td>${escapeHtml(s.cabinetNo)||"-"}</td></tr>`;
    });
    detailsHTML += `</tbody></table></div></div>`;
  });
  detailsHTML += `</div>`;

  // 3. Students per level
  detailsHTML += `<div class="admin-card"><h3 class="admin-card-title">الطلاب حسب الفرقة</h3>`;
  Object.entries(levels).sort((a,b) => b[1].length - a[1].length).forEach(([name, students]) => {
    detailsHTML += `<div style="margin-bottom:15px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-weight:600;color:var(--text-gold);">${escapeHtml(name)}</span><span style="font-size:13px;color:var(--text-muted);">${students.length} طالب</span></div>`;
    detailsHTML += `<div class="settings-table-container"><table class="settings-table"><thead><tr><th>#</th><th>الاسم</th><th>الكود</th><th>الكلية</th><th>الرقم القومي</th><th>الملف</th><th>الدولاب</th></tr></thead><tbody>`;
    students.forEach((s, i) => {
      detailsHTML += `<tr><td>${i+1}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.code)}</td><td>${escapeHtml(s.college)||"-"}</td><td>${escapeHtml(s.nationalId)||"-"}</td><td>${escapeHtml(s.fileNo)||"-"}</td><td>${escapeHtml(s.cabinetNo)||"-"}</td></tr>`;
    });
    detailsHTML += `</tbody></table></div></div>`;
  });
  detailsHTML += `</div>`;

  // 4. Males
  detailsHTML += `<div class="admin-card"><h3 class="admin-card-title"><span style="color:#6496ff;">♂ ${males.length} طالب</span>الذكور</h3>`;
  if (males.length === 0) {
    detailsHTML += `<p style="color:var(--text-muted);text-align:center;padding:20px;">لا يوجد ذكور مسجلين</p>`;
  } else {
    detailsHTML += `<div class="settings-table-container"><table class="settings-table"><thead><tr><th>#</th><th>الاسم</th><th>الكود</th><th>الكلية</th><th>الفرقة</th><th>الرقم القومي</th></tr></thead><tbody>`;
    males.forEach((s, i) => {
      detailsHTML += `<tr><td>${i+1}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.code)}</td><td>${escapeHtml(s.college)||"-"}</td><td>${escapeHtml(s.level)||"-"}</td><td>${escapeHtml(s.nationalId)}</td></tr>`;
    });
    detailsHTML += `</tbody></table></div>`;
  }
  detailsHTML += `</div>`;

  // 5. Females
  detailsHTML += `<div class="admin-card"><h3 class="admin-card-title"><span style="color:#ff96c8;">♀ ${females.length} طالبة</span>الإناث</h3>`;
  if (females.length === 0) {
    detailsHTML += `<p style="color:var(--text-muted);text-align:center;padding:20px;">لا يوجد إناث مسجلات</p>`;
  } else {
    detailsHTML += `<div class="settings-table-container"><table class="settings-table"><thead><tr><th>#</th><th>الاسم</th><th>الكود</th><th>الكلية</th><th>الفرقة</th><th>الرقم القومي</th></tr></thead><tbody>`;
    females.forEach((s, i) => {
      detailsHTML += `<tr><td>${i+1}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.code)}</td><td>${escapeHtml(s.college)||"-"}</td><td>${escapeHtml(s.level)||"-"}</td><td>${escapeHtml(s.nationalId)}</td></tr>`;
    });
    detailsHTML += `</tbody></table></div>`;
  }
  detailsHTML += `</div>`;

  // 6. Students with attachments
  detailsHTML += `<div class="admin-card"><h3 class="admin-card-title"><span style="color:var(--text-gold);">📎 ${withAttachments.length} طالب</span>رفعوا ملفات</h3>`;
  if (withAttachments.length === 0) {
    detailsHTML += `<p style="color:var(--text-muted);text-align:center;padding:20px;">لا يوجد طلاب رفعوا مرفقات</p>`;
  } else {
    detailsHTML += `<div class="settings-table-container"><table class="settings-table"><thead><tr><th>#</th><th>الاسم</th><th>الكود</th><th>الكلية</th><th>عدد المرفقات</th></tr></thead><tbody>`;
    withAttachments.forEach((s, i) => {
      const attCount = Object.values(s.attachments).filter(a => a && a.fileUrl).length;
      detailsHTML += `<tr><td>${i+1}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.code)}</td><td>${escapeHtml(s.college)||"-"}</td><td style="color:var(--text-gold);font-weight:600;">${attCount}</td></tr>`;
    });
    detailsHTML += `</tbody></table></div>`;
  }
  detailsHTML += `</div>`;

  details.innerHTML = detailsHTML;
}

let currentReportData = { title: "", students: [] };

function showReportDetails(type) {
  const modal = document.getElementById("report-modal");
  const titleEl = document.getElementById("report-modal-title");
  const body = document.getElementById("report-modal-body");
  if (!modal || !titleEl || !body) return;

  let students = [];
  let title = "";

  switch (type) {
    case "all":
      students = allStudentsList;
      title = "جميع الطلاب";
      break;
    case "no-cabinet":
      students = allStudentsList.filter(s => !s.cabinetNo || !s.cabinetNo.trim());
      title = "الطلاب الذين لم يُسكنوا بعد (بلا دولاب)";
      break;
    case "with-cabinet":
      students = allStudentsList.filter(s => s.cabinetNo && s.cabinetNo.trim());
      title = "الطلاب الذين تم سكنهم";
      break;
    case "with-attachments":
      students = allStudentsList.filter(s => s.attachments && Object.values(s.attachments).some(a => a && a.fileUrl));
      title = "الطلاب الذين رفعوا ملفات";
      break;
    case "males":
      students = allStudentsList.filter(s => {
        if (!s.nationalId || s.nationalId.length !== 14) return false;
        return parseInt(s.nationalId.charAt(12)) % 2 === 1;
      });
      title = "الذكور";
      break;
    case "females":
      students = allStudentsList.filter(s => {
        if (!s.nationalId || s.nationalId.length !== 14) return false;
        return parseInt(s.nationalId.charAt(12)) % 2 === 0;
      });
      title = "الإناث";
      break;
  }

  currentReportData = { title, students };
  titleEl.innerHTML = `<i class="fas fa-users" style="color:var(--text-gold);margin-left:8px;"></i> ${title} (${students.length} طالب)`;

  if (students.length === 0) {
    body.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fas fa-inbox" style="font-size:40px;margin-bottom:15px;display:block;"></i>لا يوجد طلاب في هذه الفئة</div>`;
  } else {
    let html = `<div class="settings-table-container"><table class="settings-table"><thead><tr><th>#</th><th>الاسم</th><th>الكود</th><th>الكلية</th><th>الفرقة</th><th>الرقم القومي</th><th>رقم الملف</th><th>رقم الدولاب</th><th>المرفقات</th></tr></thead><tbody>`;
    students.forEach((s, i) => {
      const attCount = s.attachments ? Object.values(s.attachments).filter(a => a && a.fileUrl).length : 0;
      html += `<tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.code)}</td>
        <td>${escapeHtml(s.college) || "-"}</td>
        <td>${escapeHtml(s.level) || "-"}</td>
        <td>${escapeHtml(s.nationalId) || "-"}</td>
        <td>${escapeHtml(s.fileNo) || "-"}</td>
        <td>${escapeHtml(s.cabinetNo) || "-"}</td>
        <td style="color:var(--text-gold);font-weight:600;">${attCount}</td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
    body.innerHTML = html;
  }

  modal.classList.add("active");
}

function closeReportModal() {
  const modal = document.getElementById("report-modal");
  if (modal) modal.classList.remove("active");
}

function exportReportToExcel() {
  if (!currentReportData.students.length) { showToast("لا توجد بيانات للتصدير", "error"); return; }
  const data = currentReportData.students.map((s, i) => ({
    "#": i + 1,
    "الاسم": s.name || "",
    "الكود": s.code || "",
    "الكلية": s.college || "",
    "الفرقة": s.level || "",
    "الرقم القومي": s.nationalId || "",
    "رقم الملف": s.fileNo || "",
    "رقم الدولاب": s.cabinetNo || "",
    "المرفقات": s.attachments ? Object.values(s.attachments).filter(a => a && a.fileUrl).length : 0
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{ wch: 5 }, { wch: 25 }, { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "report.xlsx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("تم التصدير بنجاح", "success");
}

function printReport() {
  if (!currentReportData.students.length) { showToast("لا توجد بيانات للطباعة", "error"); return; }
  let printContent = `
    <html dir="rtl"><head><meta charset="utf-8"><title>${currentReportData.title} - جامعة اللوتس</title>
    <style>
      body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20px; color: #333; }
      h2 { text-align: center; color: #1a3a5c; margin-bottom: 5px; }
      h3 { text-align: center; color: #666; font-weight: normal; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { background: #1a3a5c; color: white; padding: 8px 5px; text-align: right; }
      td { padding: 6px 5px; border-bottom: 1px solid #eee; text-align: right; }
      tr:nth-child(even) { background: #f9f9f9; }
      .footer { text-align: center; margin-top: 30px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
    </style></head><body>
    <h2>جامعة اللوتس</h2>
    <h3>${currentReportData.title} (${currentReportData.students.length} طالب)</h3>
    <table><thead><tr><th>#</th><th>الاسم</th><th>الكود</th><th>الكلية</th><th>الفرقة</th><th>الرقم القومي</th><th>رقم الملف</th><th>رقم الدولاب</th></tr></thead><tbody>`;
  currentReportData.students.forEach((s, i) => {
    printContent += `<tr><td>${i + 1}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.code)}</td><td>${escapeHtml(s.college) || "-"}</td><td>${escapeHtml(s.level) || "-"}</td><td>${escapeHtml(s.nationalId) || "-"}</td><td>${escapeHtml(s.fileNo) || "-"}</td><td>${escapeHtml(s.cabinetNo) || "-"}</td></tr>`;
  });
  printContent += `</tbody></table>
    <div class="footer">تصميم وبرمجة المهندس بولس سمير - جميع الحقوق محفوظة © جامعة اللوتس ٢٠٢٦</div>
    </body></html>`;
  const w = window.open("", "_blank");
  w.document.write(printContent);
  w.document.close();
  w.print();
}

window.adminSelectAndEdit = id => { const s = studentsIndex.find(x => x.id === id); if (s) { switchScreen("search"); document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active")); const sb = document.querySelector("[data-screen='search']"); if (sb) sb.classList.add("active"); selectStudent(s); triggerEditStudent(); } };

window.showStudentGallery = function(id) {
  const s = studentsIndex.find(x => x.id === id);
  if (!s) return;
  const atts = s.attachments || {};
  const files = Object.entries(atts).filter(([k, v]) => v && v.fileUrl);
  if (files.length === 0) { showToast("لا توجد مرفقات لهذا الطالب", "info"); return; }
  
  let galleryHTML = `<div class="gallery-modal"><div class="gallery-header"><h3>${escapeHtml(s.name)} (${escapeHtml(s.code)})</h3><span>${files.length} مرفق</span><button class="gallery-close" onclick="closeGalleryModal()"><i class="fas fa-times"></i></button></div><div class="gallery-grid">`;
  
  files.forEach(([key, file]) => {
    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)/i.test(file.fileName || file.fileUrl);
    const isPDF = /\.(pdf)/i.test(file.fileName || file.fileUrl);
    if (isImage) {
      galleryHTML += `<div class="gallery-item" onclick="previewGalleryItem('${escapeHtml(file.fileUrl)}', 'image')"><img src="${escapeHtml(file.fileUrl)}" alt="${escapeHtml(file.fileName)}"><div class="gallery-item-name">${escapeHtml(file.fileName)}</div></div>`;
    } else if (isPDF) {
      galleryHTML += `<div class="gallery-item" onclick="previewGalleryItem('${escapeHtml(file.fileUrl)}', 'pdf')"><div class="gallery-item-icon"><i class="fas fa-file-pdf"></i></div><div class="gallery-item-name">${escapeHtml(file.fileName)}</div></div>`;
    } else {
      galleryHTML += `<div class="gallery-item" onclick="previewGalleryItem('${escapeHtml(file.fileUrl)}', 'other')"><div class="gallery-item-icon"><i class="fas fa-file"></i></div><div class="gallery-item-name">${escapeHtml(file.fileName)}</div></div>`;
    }
  });
  
  galleryHTML += `</div></div>`;
  
  const overlay = document.createElement("div");
  overlay.className = "gallery-overlay";
  overlay.id = "gallery-overlay";
  overlay.innerHTML = galleryHTML;
  overlay.addEventListener("click", e => { if (e.target === overlay) closeGalleryModal(); });
  document.body.appendChild(overlay);
};

window.closeGalleryModal = function() {
  const overlay = document.getElementById("gallery-overlay");
  if (overlay) overlay.remove();
};

window.previewGalleryItem = function(url, type) {
  if (type === 'image') {
    const w = window.open("", "_blank");
    if (w) w.document.write(`<html><head><title>معاينة</title><style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#111;}img{max-width:95%;max-height:95vh;object-fit:contain;}</style></head><body><img src="${url}"></body></html>`);
  } else {
    window.open(url, "_blank");
  }
};

window.adminDeleteStudent = async function(id) {
  const s = studentsIndex.find(x => x.id === id);
  if (!s) return;
  if (!confirm(`هل أنت متأكد من حذف الطالب "${s.name}" (الكود: ${s.code})؟\n\n سيتم حذف جميع بياناته ومرفقاته نهائياً!`)) return;
  logToArchive(s);
  if (isOfflineMode || !db || id.startsWith("mock_")) {
    studentsIndex = studentsIndex.filter(x => x.id !== id);
    allStudentsList = allStudentsList.filter(x => x.id !== id);
    localStorage.setItem("lotus_students", JSON.stringify(studentsIndex));
    showToast("تم حذف الطالب وجميع بياناته.", "success");
    renderAdminStudentsTable();
    renderRegisteredStudentsTable();
    renderReports();
    return;
  }
  try {
    await db.ref(`students/${id}`).remove();
    studentsIndex = studentsIndex.filter(x => x.id !== id);
    allStudentsList = allStudentsList.filter(x => x.id !== id);
    localStorage.setItem("lotus_students", JSON.stringify(studentsIndex));
    showToast("تم حذف الطالب وجميع بياناته.", "success");
    renderAdminStudentsTable();
    renderRegisteredStudentsTable();
    renderReports();
  } catch (e) { showToast("خطأ: " + e.message, "error"); }
};

// ==================== REGISTERED STUDENTS ====================

function getRegisteredStudents() {
  return allStudentsList.filter(s => s.createdAt || (s.id && !s.id.startsWith("mock_") && studentsIndex.indexOf(s) !== -1));
}

function renderRegisteredStudentsTable() {
  const tb = document.getElementById("registered-students-tbody");
  const counter = document.getElementById("registered-counter");
  if (!tb) return;
  tb.innerHTML = "";
  const registered = allStudentsList.filter(s => s.id && !s.id.startsWith("mock_"));
  if (registered.length === 0) {
    tb.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">لا يوجد طلاب مسجلين بعد.</td></tr>`;
    if (counter) counter.textContent = "(0 طالب)";
    renderCollegeStats();
    return;
  }
  if (counter) counter.textContent = `(${registered.length} طالب)`;
  let html = "";
  registered.forEach(s => {
    const attCount = s.attachments ? Object.keys(s.attachments).filter(k => s.attachments[k] && s.attachments[k].fileUrl).length : 0;
    const dateStr = s.createdAt ? (typeof s.createdAt === 'string' ? new Date(s.createdAt).toLocaleDateString('ar-EG') : '-') : '-';
    const sid = (s.id || '').replace(/'/g, "\\'");
    html += `<tr><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.code)}</td><td>${escapeHtml(s.college)||"-"}</td><td>${escapeHtml(s.nationalId)||"-"}</td><td>${dateStr}</td><td><span style="color:var(--text-gold);font-weight:600;">${attCount}</span></td><td style="display:flex;gap:5px;"><button class="btn-icon" style="padding:4px 8px;display:inline-flex;" onclick="viewRegisteredStudent('${sid}')" title="عرض"><i class="fas fa-eye"></i></button><button class="btn-icon" style="padding:4px 8px;display:inline-flex;" onclick="editRegisteredStudent('${sid}')" title="تعديل"><i class="fas fa-pen"></i></button><button class="btn-icon" style="padding:4px 8px;display:inline-flex;background:rgba(212,175,55,0.15);color:var(--text-gold);" onclick="downloadStudentZip('${sid}')" title="تحميل"><i class="fas fa-download"></i></button><button class="btn-icon btn-delete" style="padding:4px 8px;display:inline-flex;" onclick="adminDeleteStudent('${sid}')" title="حذف"><i class="fas fa-trash-alt"></i></button></td></tr>`;
  });
  tb.innerHTML = html;
  renderCollegeStats();
}

function renderCollegeStats() {
  const container = document.getElementById("college-stats-container");
  if (!container) return;
  container.innerHTML = "";
  
  const registered = allStudentsList.filter(s => s.id && !s.id.startsWith("mock_"));
  if (registered.length === 0) return;
  
  const collegeCounts = {};
  registered.forEach(s => {
    const college = s.college || "غير محدد";
    collegeCounts[college] = (collegeCounts[college] || 0) + 1;
  });
  
  const colors = ['#d4af37', '#4ecdc4', '#ff6b6b', '#45b7d1', '#96ceb4', '#f39c12', '#9b59b6'];
  let colorIndex = 0;
  
  let html = "";
  Object.entries(collegeCounts).forEach(([college, count]) => {
    const color = colors[colorIndex % colors.length];
    colorIndex++;
    const safeCollege = college.replace(/'/g, "\\'");
    html += `<div class="stat-ellipse" style="border-color:${color}" onclick="showCollegeDetails('${safeCollege}')"><div class="stat-count" style="color:${color}">${count}</div><div class="stat-label">${escapeHtml(college)}</div></div>`;
  });
  container.innerHTML = html;
}

window.showCollegeDetails = function(college) {
  const registered = allStudentsList.filter(s => s.id && !s.id.startsWith("mock_") && (s.college || "غير محدد") === college);
  
  let html = `<div class="college-modal"><div class="college-modal-header"><h3>${escapeHtml(college)}</h3><span>${registered.length} طالب</span><button class="gallery-close" onclick="closeCollegeModal()"><i class="fas fa-times"></i></button></div><div class="college-modal-body">`;
  
  if (registered.length === 0) {
    html += `<p style="text-align:center;color:var(--text-muted);">لا يوجد طلاب في هذه الكلية</p>`;
  } else {
    html += `<table class="settings-table"><thead><tr><th>الاسم</th><th>الكود</th><th>الرقم القومي</th><th>تاريخ التسجيل</th></tr></thead><tbody>`;
    registered.forEach(s => {
      const dateStr = s.createdAt ? (typeof s.createdAt === 'string' ? new Date(s.createdAt).toLocaleDateString('ar-EG') : '-') : '-';
      html += `<tr><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.code)}</td><td>${escapeHtml(s.nationalId)||"-"}</td><td>${dateStr}</td></tr>`;
    });
    html += `</tbody></table>`;
  }
  
  html += `</div></div>`;
  
  const overlay = document.createElement("div");
  overlay.className = "gallery-overlay";
  overlay.id = "college-overlay";
  overlay.innerHTML = html;
  overlay.addEventListener("click", e => { if (e.target === overlay) closeCollegeModal(); });
  document.body.appendChild(overlay);
};

window.closeCollegeModal = function() {
  const overlay = document.getElementById("college-overlay");
  if (overlay) overlay.remove();
};

window.downloadStudentZip = async function(id) {
  const s = studentsIndex.find(x => x.id === id);
  if (!s) return;
  const atts = s.attachments || {};
  const files = Object.values(atts).filter(a => a && a.fileUrl);
  if (files.length === 0) { showToast("لا توجد ملفات لهذا الطالب", "info"); return; }
  if (typeof JSZip === 'undefined') { showToast("جاري تحميل المكتبات...", "warning"); return; }
  
  const name = s.name || "";
  const code = s.code || "";
  const college = s.college || "";
  const folderName = `${name} - ${code}${college ? ' - ' + college : ''}`;
  
  showToast("جاري إنشاء الملف...", "info");
  try {
    const zip = new JSZip();
    const folder = zip.folder(folderName);
    for (const file of files) {
      try {
        let blob;
        if (file.fileUrl.startsWith('data:')) {
          const parts = file.fileUrl.split(',');
          const mime = parts[0].match(/:(.*?);/)[1];
          const b64 = atob(parts[1]);
          const arr = new Uint8Array(b64.length);
          for (let i = 0; i < b64.length; i++) arr[i] = b64.charCodeAt(i);
          blob = new Blob([arr], { type: mime });
        } else {
          const resp = await fetch(file.fileUrl);
          blob = await resp.blob();
        }
        folder.file(file.fileName || `file_${Date.now()}`, blob);
      } catch (err) { console.error('ZIP error:', err); }
    }
    const content = await zip.generateAsync({ type: 'blob' });
    const zipName = `${folderName}.zip`;
    if (typeof saveAs !== 'undefined') {
      saveAs(content, zipName);
    } else {
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url; a.download = zipName;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    }
    showToast(`تم تحميل ${files.length} ملف`, "success");
  } catch (e) {
    showToast("خطأ في إنشاء الملف", "error");
  }
};

window.viewRegisteredStudent = function(id) {
  const s = studentsIndex.find(x => x.id === id);
  if (s) { switchScreen("search"); document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active")); const sb = document.querySelector("[data-screen='search']"); if (sb) sb.classList.add("active"); selectStudent(s); }
};

window.editRegisteredStudent = function(id) {
  const s = studentsIndex.find(x => x.id === id);
  if (s) { switchScreen("search"); document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active")); const sb = document.querySelector("[data-screen='search']"); if (sb) sb.classList.add("active"); selectStudent(s); triggerEditStudent(); }
};

// ==================== DOWNLOAD ALL STUDENTS ====================

window.downloadAllRegisteredStudents = async function() {
  const registered = allStudentsList.filter(s => !s.id.startsWith("mock_") && s.attachments && Object.keys(s.attachments).some(k => s.attachments[k] && s.attachments[k].fileUrl));
  if (registered.length === 0) { showToast("لا توجد ملفات للتحميل!", "warning"); return; }
  if (typeof JSZip === 'undefined') { showToast("جاري تحميل المكتبات...", "warning"); return; }

  const pc = document.getElementById("download-all-progress");
  const pf = document.getElementById("download-all-progress-fill");
  const pt = document.getElementById("download-all-progress-text");
  if (pc) pc.style.display = "block";

  try {
    const zip = new JSZip();
    const total = registered.length;
    let processed = 0;

    for (const student of registered) {
      const name = student.name || "";
      const code = student.code || "";
      const college = student.college || "";
      const folderName = `${name} - ${code}${college ? ' - ' + college : ''}`;
      const folder = zip.folder(folderName);
      const atts = student.attachments || {};

      for (const [k, fileData] of Object.entries(atts)) {
        if (!fileData || !fileData.fileUrl) continue;
        try {
          let blob;
          if (fileData.fileUrl.startsWith('data:')) {
            const parts = fileData.fileUrl.split(',');
            const mime = parts[0].match(/:(.*?);/)[1];
            const b64 = atob(parts[1]);
            const arr = new Uint8Array(b64.length);
            for (let i = 0; i < b64.length; i++) arr[i] = b64.charCodeAt(i);
            blob = new Blob([arr], { type: mime });
          } else {
            const resp = await fetch(fileData.fileUrl);
            blob = await resp.blob();
          }
          folder.file(fileData.fileName || `file_${Date.now()}`, blob);
        } catch (err) { console.error('ZIP add error:', err); }
      }
      processed++;
      const p = Math.round((processed / total) * 100);
      if (pf) pf.style.width = `${p}%`;
      if (pt) pt.textContent = `جاري تحميل ${processed} من ${total} طالب...`;
    }

    if (pt) pt.textContent = "جاري إنشاء الملف المضغوط...";
    const content = await zip.generateAsync({ type: 'blob' });
    const zipName = `جميع_الطلاب.zip`;

    if (typeof saveAs !== 'undefined') {
      saveAs(content, zipName);
    } else {
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url; a.download = zipName;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    }
    showToast(`تم تحميل ملفات ${total} طالب بنجاح!`, "success");
  } catch (e) {
    console.error('ZIP error:', e);
    showToast("خطأ في إنشاء الملف المضغوط", "error");
  }
  setTimeout(() => { if (pc) pc.style.display = "none"; }, 3000);
};

document.addEventListener("DOMContentLoaded", () => {
  const f = document.getElementById("add-student-form"); if (f) f.addEventListener("submit", async e => {
    e.preventDefault(); const name = document.getElementById("add-name-new").value.trim(), code = document.getElementById("add-code-new").value.trim();
    const nationalId = document.getElementById("add-nationalId-new").value.trim(), college = document.getElementById("add-college-new").value.trim(), level = document.getElementById("add-level-new").value.trim();
    const fileNo = document.getElementById("add-fileNo-new").value.trim(), cabinetNo = document.getElementById("add-cabinetNo-new").value.trim();
    const whatsapp = document.getElementById("add-whatsapp-new") ? document.getElementById("add-whatsapp-new").value.trim() : "";
    if (!name || !code) { showToast("الاسم والكود مطلوبين!", "warning"); return; }
    if (studentsIndex.find(s => s.code === code)) { showToast("الكود مسجل بالفعل!", "error"); return; }
    showToast("جاري التسجيل...", "info");
    if (isOfflineMode || !db) { const ns = { id: "student_" + Date.now(), name, code, nationalId, college, level, fileNo, cabinetNo, whatsapp, attachments: {}, delivery: {}, customFields: {}, createdAt: new Date().toISOString() }; studentsIndex.push(ns); allStudentsList.push(ns); localStorage.setItem("lotus_students", JSON.stringify(studentsIndex)); showToast("تم التسجيل محلياً.", "success"); e.target.reset(); renderAdminStudentsTable(); return; }
    const ns = { name, code, nationalId, college, level, fileNo, cabinetNo, whatsapp, attachments: {}, delivery: {}, customFields: {}, createdAt: new Date().toISOString() };
    try { const dr = await db.ref("students").push(ns); ns.id = dr.key; studentsIndex.push(ns); allStudentsList.push(ns); localStorage.setItem("lotus_students", JSON.stringify(studentsIndex)); showToast("تم التسجيل.", "success"); e.target.reset(); renderAdminStudentsTable(); } catch (err) { showToast("خطأ: " + err.message, "error"); }
  });
});

function handleExcelFile(file) {
  if (!file || typeof XLSX === 'undefined') { showToast("مكتبة Excel غير محملة.", "error"); return; }
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" }); const ws = wb.Sheets[wb.SheetNames[0]]; const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (rows.length < 2) { showToast("الملف فارغ.", "warning"); return; }
      const h = rows[0].map(x => String(x).trim()); const cm = { name: h.findIndex(x => x.includes("الاسم")||x.includes("كامل")), code: h.findIndex(x => x.includes("كود")||x.includes("الكود")), nationalId: h.findIndex(x => x.includes("القومي")||x.includes("القومى")||x.includes("الهوية")), college: h.findIndex(x => x.includes("الكلية")||x.includes("كليه")), level: h.findIndex(x => x.includes("الفرقة")||x.includes("المستوى")), fileNo: h.findIndex(x => x.includes("الملف")), cabinetNo: h.findIndex(x => x.includes("الدولاب")) };
      if (cm.name === -1 || cm.code === -1) { showToast("أعمدة 'الاسم' و 'الكود' مطلوبة.", "error"); return; }
      const st = []; for (let i = 1; i < rows.length; i++) { const r = rows[i]; if (!r||!r.length||!r[cm.name]) continue; const cv = r[cm.code]?String(r[cm.code]).trim():""; if (!cv) continue; st.push({ name: String(r[cm.name]).trim(), code: cv, nationalId: cm.nationalId!==-1&&r[cm.nationalId]?String(r[cm.nationalId]).trim():"", college: cm.college!==-1&&r[cm.college]?String(r[cm.college]).trim():"", level: cm.level!==-1&&r[cm.level]?String(r[cm.level]).trim():"", fileNo: cm.fileNo!==-1&&r[cm.fileNo]?String(r[cm.fileNo]).trim():"", cabinetNo: cm.cabinetNo!==-1&&r[cm.cabinetNo]?String(r[cm.cabinetNo]).trim():"", attachments: {}, customFields: {} }); }
      if (!st.length) { showToast("لا توجد سجلات صالحة.", "warning"); return; }
      if (confirm(`${st.length} طالب. بدأ الاستيراد؟`)) importStudentsInBatches(st);
    } catch (err) { showToast("خطأ في قراءة الملف.", "error"); }
  };
  reader.readAsArrayBuffer(file);
}

async function importStudentsInBatches(students) {
  const pc = document.getElementById("excel-progress-container"), pf = document.getElementById("excel-progress-fill"), pt = document.getElementById("excel-progress-text");
  if (pc) pc.style.display = "block"; if (pf) pf.style.width = "0%"; if (pt) pt.textContent = "جاري...";
  const total = students.length;
  if (isOfflineMode || !db) { students.forEach((s, i) => { s.id = "student_" + Date.now() + "_" + i; const di = studentsIndex.findIndex(x => x.code === s.code); if (di !== -1) studentsIndex[di] = s; else studentsIndex.push(s); }); allStudentsList = [...studentsIndex]; localStorage.setItem("lotus_students", JSON.stringify(studentsIndex)); if (pf) pf.style.width = "100%"; if (pt) pt.textContent = `تم ${total} محلياً!`; showToast(`تم ${total} بنجاح!`, "success"); setTimeout(() => { if (pc) pc.style.display = "none"; }, 3000); renderAdminStudentsTable(); return; }
  let ok = 0;
  for (let i = 0; i < total; i++) {
    const s = students[i];
    try {
      const dr = await db.ref("students").push(s);
      s.id = dr.key;
      ok++;
      const p = Math.round((ok/total)*100);
      if (pf) pf.style.width = `${p}%`;
      if (pt) pt.textContent = `${ok}/${total} (${p}%)`;
    } catch (e) { showToast("خطأ في السجل " + (i+1), "warning"); }
  }
  showToast(`اكتمل! ${ok} طالب.`, "success"); setTimeout(() => { if (pc) pc.style.display = "none"; }, 3000); loadSearchIndex().catch(() => {});
}

// ==================== PASSCODE ====================

let passcodeCallback = null;
function openPasscodeModal(cb) { passcodeCallback = cb; const m = document.getElementById("passcode-modal"); if (m) { m.classList.add("active"); const i = document.getElementById("admin-passcode-input"); if (i) { i.value = ""; i.focus(); } } }
window.closePasscodeModal = function() { const m = document.getElementById("passcode-modal"); if (m) m.classList.remove("active"); passcodeCallback = null; };
window.submitPasscode = function() { const i = document.getElementById("admin-passcode-input"); const p = i ? i.value : ""; const cb = passcodeCallback; closePasscodeModal(); if (cb) cb(p); };

// ==================== UTILITIES ====================

function formatBytes(b, d = 2) { if (!b) return '0 Bytes'; const k = 1024, s = ['Bytes','KB','MB','GB'], i = Math.floor(Math.log(b)/Math.log(k)); return parseFloat((b/Math.pow(k,i)).toFixed(d<0?0:d)) + ' ' + s[i]; }

function showToast(msg, type = "info") {
  const c = document.getElementById("toast-container"); if (!c) return;
  const t = document.createElement("div"); t.className = `toast toast-${type}`;
  let icon = '<i class="fas fa-info-circle"></i>'; if (type === "success") icon = '<i class="fas fa-check-circle"></i>'; if (type === "error") icon = '<i class="fas fa-times-circle"></i>'; if (type === "warning") icon = '<i class="fas fa-exclamation-triangle"></i>';
  t.innerHTML = `${icon}<span>${escapeHtml(msg)}</span>`; c.appendChild(t);
  setTimeout(() => { t.style.animation = "fadeIn 0.3s reverse forwards"; setTimeout(() => { if (t.parentNode === c) c.removeChild(t); }, 300); }, 4000);
}

// ==================== DELIVERY REVIEW ====================

function setupDeliverySearch() {
  bindDeliverySearch("delivery-search-input", "delivery-autocomplete");
}

function bindDeliverySearch(inpId, ddId) {
  const inp = document.getElementById(inpId);
  const dd = document.getElementById(ddId);
  if (!inp || !dd) return;
  inp.addEventListener("input", e => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) { dd.style.display = "none"; return; }
    const r = studentsIndex.filter(s => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || (s.nationalId||"").toLowerCase().includes(q)).slice(0, 8);
    if (r.length > 0) { dd.innerHTML = ""; r.forEach(s => { const it = document.createElement("div"); it.className = "autocomplete-item"; it.innerHTML = `<span class="student-name">${escapeHtml(s.name)}</span><span class="student-meta">${escapeHtml(s.code)} | ${escapeHtml(s.level)}</span>`; it.addEventListener("click", () => { inp.value = s.name; dd.style.display = "none"; selectStudent(s); }); dd.appendChild(it); }); dd.style.display = "block"; }
    else dd.style.display = "none";
  });
  document.addEventListener("click", e => { if (dd && !e.target.closest("#delivery-screen")) dd.style.display = "none"; });
}

window.renderDeliveryReview = function(student) {
  const c = document.getElementById("delivery-review");
  if (!c) return;
  if (!student) { c.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">اختر طالباً.</p>'; return; }
  if (!globalConfig.globalAttachments || !globalConfig.globalAttachments.length) { c.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">لا توجد مستندات معرفة.</p>'; return; }
  const sa = student.attachments || {};
  const dl = student.delivery || {};
  let html = `<div class="delivery-student-header"><i class="fas fa-user-graduate"></i> <strong>${escapeHtml(student.name)}</strong> <span style="color:var(--text-muted)">(${escapeHtml(student.code)})</span> <span style="color:var(--text-muted)">${escapeHtml(student.college||"")}</span></div>`;
  html += `<div class="delivery-list">`;
  globalConfig.globalAttachments.forEach(a => {
    const rec = dl[a.id] || {};
    const delivered = rec.delivered === true;
    const notes = rec.notes || "";
    html += `<div class="delivery-row ${delivered?'delivered':''}">
      <label class="delivery-check">
        <input type="checkbox" ${delivered ? "checked" : ""} onchange="onDeliveryChange('${escapeHtml(student.id)}','${escapeHtml(a.id)}', this.checked)">
        <span class="delivery-name ${delivered?'delivered':''}">${escapeHtml(a.name)} ${delivered?'<i class="ck fas fa-check-circle"></i>':''}</span>
      </label>
      <input type="text" class="input-main delivery-notes" placeholder="ملاحظات..." value="${escapeHtml(notes)}" onchange="onDeliveryNotes('${escapeHtml(student.id)}','${escapeHtml(a.id)}', this.value)">
      ${delivered && rec.deliveredAt ? `<span class="delivery-date-inline">📅 ${formatDateTime(rec.deliveredAt)}</span>` : ''}
    </div>`;
  });
  const customKeys = Object.keys(dl).filter(k => k.startsWith("custom_") && dl[k] && dl[k].name);
  customKeys.forEach(k => {
    const rec = dl[k];
    html += `<div class="delivery-row delivered">
      <label class="delivery-check">
        <input type="checkbox" checked disabled>
        <span class="delivery-name delivered">${escapeHtml(rec.name)} <i class="ck fas fa-check-circle"></i></span>
        <span class="badge-online" title="مستند إضافي سلّمه الطالب">إضافي</span>
      </label>
      <input type="text" class="input-main delivery-notes" placeholder="ملاحظات..." value="${escapeHtml(rec.notes||"")}" onchange="onDeliveryNotes('${escapeHtml(student.id)}','${escapeHtml(k)}', this.value)">
      ${rec.deliveredAt ? `<span class="delivery-date-inline">📅 ${formatDateTime(rec.deliveredAt)}</span>` : ''}
      <button class="btn-icon btn-delete" title="حذف المستند الإضافي" onclick="removeCustomDelivery('${escapeHtml(student.id)}','${escapeHtml(k)}')"><i class="fas fa-times"></i></button>
    </div>`;
  });
  html += `</div>`;
  html += `<div class="delivery-add-row">
    <input type="text" id="custom-doc-input" class="input-main" placeholder="أضف مستنداً سلّمه الطالب يدوياً..." onkeydown="if(event.key==='Enter'){addCustomDeliveryDoc('${escapeHtml(student.id)}');}">
    <button class="btn-action btn-save" onclick="addCustomDeliveryDoc('${escapeHtml(student.id)}')"><i class="fas fa-plus"></i> إضافة مستند</button>
  </div>`;
  html += `<div class="delivery-summary" id="delivery-summary"></div>`;
  c.innerHTML = html;
  updateDeliverySummary(student);
};

function formatDateTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const p = n => (n < 10 ? "0" + n : "" + n);
    return `${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch (e) { return ""; }
}

function updateDeliverySummary(student) {
  const el = document.getElementById("delivery-summary");
  if (!el) return;
  const atts = globalConfig.globalAttachments || [];
  const dl = student.delivery || {};
  const sa = student.attachments || {};
  let delivered = 0, missing = 0, total = 0;
  atts.forEach(a => {
    total++;
    const rec = dl[a.id] || {};
    const isDel = rec.delivered === true;
    if (isDel) delivered++; else missing++;
  });
  Object.keys(dl).forEach(k => { if (k.startsWith("custom_") && dl[k] && dl[k].name) { total++; delivered++; } });
  el.innerHTML = `<span class="summary-pill delivered">تم التسليم: ${delivered}</span><span class="summary-pill missing">ناقص: ${missing}</span><span class="summary-pill total">الإجمالي: ${total}</span>`;
}

window.addCustomDeliveryDoc = async function(studentId) {
  const st = studentsIndex.find(s => s.id === studentId) || selectedStudent;
  if (!st) return;
  const inp = document.getElementById("custom-doc-input");
  if (!inp) return;
  const name = inp.value.trim();
  if (!name) { showToast("اكتب اسم المستند أولاً", "warning"); return; }
  if (!globalConfig.globalAttachments) globalConfig.globalAttachments = [];
  const existing = globalConfig.globalAttachments.find(a => (a.name||"").trim().toLowerCase() === name.toLowerCase());
  if (!st.delivery) st.delivery = {};
  if (existing) {
    st.delivery[existing.id] = { delivered: true, deliveredAt: new Date().toISOString(), notes: "" };
    persistDelivery(st, existing.id);
    inp.value = "";
    renderDeliveryReview(st);
    showToast("تم التسليم: " + name, "success");
    return;
  }
  const key = "custom_" + Date.now();
  st.delivery[key] = { delivered: true, deliveredAt: new Date().toISOString(), notes: "", name: name };
  persistDelivery(st, key);
  inp.value = "";
  renderDeliveryReview(st);
  showToast("تمت الإضافة: " + name, "success");
};

window.removeCustomDelivery = function(studentId, key) {
  const st = studentsIndex.find(x => x.id === studentId) || selectedStudent;
  if (!st || !st.delivery) return;
  delete st.delivery[key];
  persistDelivery(st, key);
  if (currentScreen === "delivery") renderDeliveryReview(st);
  else updateDeliverySummary(st);
};

window.onDeliveryChange = function(studentId, attId, checked) {
  const st = studentsIndex.find(s => s.id === studentId) || selectedStudent;
  if (!st) return;
  if (!st.delivery) st.delivery = {};
  if (!st.delivery[attId]) st.delivery[attId] = {};
  st.delivery[attId].delivered = checked;
  if (checked) st.delivery[attId].deliveredAt = new Date().toISOString();
  else delete st.delivery[attId].deliveredAt;
  persistDelivery(st, attId);
  if (currentScreen === "delivery") renderDeliveryReview(st);
  else updateDeliverySummary(st);
};

window.onDeliveryNotes = function(studentId, attId, val) {
  const st = studentsIndex.find(s => s.id === studentId) || selectedStudent;
  if (!st) return;
  if (!st.delivery) st.delivery = {};
  if (!st.delivery[attId]) st.delivery[attId] = {};
  st.delivery[attId].notes = val;
  persistDelivery(st, attId);
};

function persistDelivery(st, attId) {
  const idx = studentsIndex.findIndex(s => s.id === st.id);
  if (idx !== -1) { studentsIndex[idx].delivery = st.delivery; localStorage.setItem("lotus_students", JSON.stringify(studentsIndex)); }
  if (!isOfflineMode && db && st.id && !st.id.startsWith("mock_")) {
    try { db.ref(`students/${st.id}/delivery/${attId}`).set(st.delivery[attId]); } catch (e) {}
  }
}

// ==================== DOCUMENT DELIVERY REPORTS ====================

function getMissingDocs(student) {
  const atts = globalConfig.globalAttachments || [];
  const dl = student.delivery || {};
  const sa = student.attachments || {};
  const missing = [];
  atts.forEach(a => {
    const rec = dl[a.id] || {};
    const isDel = rec.delivered === true;
    if (!isDel) missing.push(a.name);
  });
  return missing;
}

function getCustomDocNames() {
  const set = {};
  allStudentsList.forEach(s => {
    const dl = s.delivery || {};
    Object.keys(dl).forEach(k => { if (k.indexOf("custom_") === 0 && dl[k] && dl[k].name) set[dl[k].name] = true; });
  });
  return Object.keys(set);
}

function getDocBaseList() {
  const f = document.getElementById("doc-college-filter");
  const c = f ? f.value : "";
  if (!c) return allStudentsList;
  return allStudentsList.filter(s => (s.college || "غير محدد") === c);
}

function isCustomDelivered(s, name) {
  const dl = s.delivery || {};
  return Object.keys(dl).some(k => k.indexOf("custom_") === 0 && dl[k] && dl[k].name === name && dl[k].delivered === true);
}

function getCustomDeliveredAt(s, name) {
  const dl = s.delivery || {};
  const ek = Object.keys(dl).find(k => k.indexOf("custom_") === 0 && dl[k] && dl[k].name === name);
  return ek ? dl[ek].deliveredAt : "";
}

window.switchReportTab = function(tab) {
  document.querySelectorAll("#reports-inner-tabs .inner-tab").forEach(b => b.classList.remove("active"));
  const btn = document.querySelector(`#reports-inner-tabs .inner-tab[onclick="switchReportTab('${tab}')"]`);
  if (btn) btn.classList.add("active");
  const docs = document.getElementById("rtab-docs");
  const arc = document.getElementById("rtab-archive");
  if (docs) docs.style.display = (tab === "docs") ? "block" : "none";
  if (arc) arc.style.display = (tab === "archive") ? "block" : "none";
  if (tab === "archive") renderUnshelved();
};

function renderUnshelved() {
  const cont = document.getElementById("archive-unshelved-container");
  if (!cont) return;
  const list = allStudentsList.filter(s => !s.fileNo || !s.fileNo.trim() || !s.cabinetNo || !s.cabinetNo.trim());
  if (!list.length) { cont.innerHTML = '<p style="text-align:center;color:var(--success);padding:20px;">🎉 جميع الطلاب مسكنين بالأرشيف</p>'; return; }
  let html = `<div class="missing-summary">إجمالي غير المسكنين: <strong>${list.length}</strong></div>`;
  html += `<div class="missing-table-wrap"><table class="settings-table missing-table"><thead><tr><th>#</th><th>الاسم</th><th>الكود</th><th>الكلية</th><th>رقم الملف</th><th>رقم الدولاب</th><th>الحالة</th></tr></thead><tbody>`;
  list.forEach((s, i) => {
    const noFile = !s.fileNo || !s.fileNo.trim();
    const noCab = !s.cabinetNo || !s.cabinetNo.trim();
    const status = noFile && noCab ? "بلا ملف ودولاب" : (noFile ? "بلا رقم ملف" : "بلا رقم دولاب");
    html += `<tr>
      <td>${i+1}</td>
      <td>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.code)}</td>
      <td>${escapeHtml(s.college||"-")}</td>
      <td style="${noFile?'color:#ff5f5f;font-weight:600;':''}">${escapeHtml(s.fileNo||"-")}</td>
      <td style="${noCab?'color:#ff5f5f;font-weight:600;':''}">${escapeHtml(s.cabinetNo||"-")}</td>
      <td><span class="chip chip-missing">${escapeHtml(status)}</span></td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  cont.innerHTML = html;
}

window.exportUnshelvedToExcel = function() {
  const list = allStudentsList.filter(s => !s.fileNo || !s.fileNo.trim() || !s.cabinetNo || !s.cabinetNo.trim());
  if (!list.length) { showToast("لا يوجد طلاب غير مسكنين", "info"); return; }
  const data = list.map(s => ({ "الاسم": s.name||"", "الكود": s.code||"", "الكلية": s.college||"", "رقم الملف": s.fileNo||"", "رقم الدولاب": s.cabinetNo||"", "الحالة": ((!s.fileNo||!s.fileNo.trim())&&(!s.cabinetNo||!s.cabinetNo.trim()))?"بلا ملف ودولاب":((!s.fileNo||!s.fileNo.trim())?"بلا رقم ملف":"بلا رقم دولاب") }));
  exportToExcel(data, "تقرير_عدم_تسكين_ارشيف");
};

window.renderDocReportOptions = function() {
  const sel = document.getElementById("doc-filter-select");
  if (!sel) return;
  sel.innerHTML = `<option value="__all__">كل المستندات</option>` + (globalConfig.globalAttachments||[]).map(a => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)}</option>`).join("") + getCustomDocNames().map(n => `<option value="custom::${escapeHtml(n)}">${escapeHtml(n)} (إضافي)</option>`).join("");
  if (!sel.dataset.bound) { sel.addEventListener("change", renderDocReport); sel.dataset.bound = "1"; }
  const cf = document.getElementById("doc-college-filter");
  if (cf) {
    const cur = cf.value;
    const uniq = [...new Set(allStudentsList.map(s => s.college || "غير محدد"))];
    cf.innerHTML = `<option value="">كل الكليات</option>` + uniq.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    cf.value = cur;
  }
};

window.renderDocReport = function() {
  const cont = document.getElementById("doc-delivery-report");
  const sel = document.getElementById("doc-filter-select");
  if (!cont || !sel) return;
  const attId = sel.value;
  const atts = globalConfig.globalAttachments || [];
  let targets;
  if (attId === "__all__") { targets = atts.slice(); getCustomDocNames().forEach(n => targets.push({ id: "custom::"+n, name: n, _custom: true })); }
  else if (attId.indexOf("custom::") === 0) { targets = [{ id: attId, name: attId.slice("custom::".length), _custom: true }]; }
  else { targets = atts.filter(a => a.id === attId); }
  if (!targets.length) { cont.innerHTML = '<p style="color:var(--text-muted);text-align:center;">اختر مستنداً.</p>'; return; }

  let html = "";
  const base = getDocBaseList();
  targets.forEach(a => {
    const isDeliveredFn = s => { if (a._custom) return isCustomDelivered(s, a.name); const rec = (s.delivery||{})[a.id] || {}; return rec.delivered === true; };
    const delivered = base.filter(isDeliveredFn);
    const missing = base.filter(s => !isDeliveredFn(s));
    const pct = base.length ? Math.round((delivered.length/base.length)*100) : 0;
    html += `<div class="doc-report-block">
      <div class="doc-report-title"><i class="fas fa-file-alt"></i> ${escapeHtml(a.name)}</div>
      <div class="doc-report-stats">
        <span class="summary-pill delivered">سلم: ${delivered.length}</span>
        <span class="summary-pill missing">ناقص: ${missing.length}</span>
        <span class="summary-pill total">نسبة التسليم: ${pct}%</span>
      </div>
      <div class="doc-report-cols">
        <div><div class="doc-report-sub">الطلاب الذين سلموا</div><div class="doc-report-list">${delivered.length?delivered.map(s=>{ let ds = a._custom ? (getCustomDeliveredAt(s, a.name) ? formatDateTime(getCustomDeliveredAt(s, a.name)) : "") : (function(){ const d=(s.delivery||{})[a.id]||{}; return d.deliveredAt?formatDateTime(d.deliveredAt):""; })(); return `<span class="chip">${escapeHtml(s.name)} <small>(${escapeHtml(s.code)})</small>${ds?` <small style="color:var(--accent-emerald)">📅 ${ds}</small>`:""}</span>`; }).join(""):'<span style="color:var(--text-muted)">لا يوجد</span>'}</div></div>
        <div><div class="doc-report-sub">الطلاب الناقصين</div><div class="doc-report-list">${missing.length?missing.map(s=>`<span class="chip chip-missing">${escapeHtml(s.name)} <small>(${escapeHtml(s.code)})</small></span>`).join(""):'<span style="color:var(--text-muted)">لا يوجد</span>'}</div></div>
      </div>
    </div>`;
  });
  cont.innerHTML = html;
};

window.exportDocReportToExcel = function() {
  const sel = document.getElementById("doc-filter-select");
  if (!sel) return;
  const attId = sel.value;
  const atts = globalConfig.globalAttachments || [];
  let targets;
  if (attId === "__all__") { targets = atts.slice(); getCustomDocNames().forEach(n => targets.push({ id: "custom::"+n, name: n, _custom: true })); }
  else if (attId.indexOf("custom::") === 0) { targets = [{ id: attId, name: attId.slice("custom::".length), _custom: true }]; }
  else { targets = atts.filter(a => a.id === attId); }
  const base = getDocBaseList();
  const data = [];
  targets.forEach(a => {
    base.forEach(s => {
      let rec, isDel, dateStr;
      if (a._custom) { const dl = s.delivery || {}; const ek = Object.keys(dl).find(k => k.indexOf("custom_") === 0 && dl[k] && dl[k].name === a.name); rec = ek ? dl[ek] : {}; }
      else { rec = (s.delivery||{})[a.id] || {}; }
      isDel = (rec.delivered === true);
      dateStr = rec.deliveredAt ? formatDateTime(rec.deliveredAt) : "";
      data.push({ "المستند": a.name, "الاسم": s.name||"", "الكود": s.code||"", "الكلية": s.college||"", "الحالة": isDel?"مسلم":"ناقص", "تاريخ التسليم": dateStr, "ملاحظات": rec.notes||"" });
    });
  });
  if (!data.length) { showToast("لا توجد بيانات", "warning"); return; }
  exportToExcel(data, "تقرير_المستندات");
};

window.printDocReport = function() {
  const sel = document.getElementById("doc-filter-select");
  if (!sel) return;
  const attId = sel.value;
  const atts = globalConfig.globalAttachments || [];
  let targets;
  if (attId === "__all__") { targets = atts.slice(); getCustomDocNames().forEach(n => targets.push({ id: "custom::"+n, name: n, _custom: true })); }
  else if (attId.indexOf("custom::") === 0) { targets = [{ id: attId, name: attId.slice("custom::".length), _custom: true }]; }
  else { targets = atts.filter(a => a.id === attId); }
  if (!targets.length) { showToast("لا يوجد بيانات", "warning"); return; }

  const uniName = globalConfig.universityName || "جامعة اللوتس";
  const logo = globalConfig.universityLogo || "";
  const base = getDocBaseList();
  let blocks = "";
  targets.forEach(a => {
    const isDeliveredFn = s => a._custom ? isCustomDelivered(s, a.name) : ((s.delivery||{})[a.id]||{}).delivered === true;
    const delivered = base.filter(isDeliveredFn);
    const missing = base.filter(s => !isDeliveredFn(s));
    const pct = base.length ? Math.round((delivered.length/base.length)*100) : 0;
    const dateOf = s => a._custom ? getCustomDeliveredAt(s, a.name) : ((s.delivery||{})[a.id]||{}).deliveredAt;
    let rows = "";
    delivered.forEach((s, i) => {
      const ds = dateOf(s) ? formatDateTime(dateOf(s)) : "-";
      rows += `<tr><td>${i+1}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.code)}</td><td>${escapeHtml(s.college||"-")}</td><td class="ok">مسلم</td><td>${ds}</td></tr>`;
    });
    missing.forEach((s, i) => {
      rows += `<tr><td>${delivered.length+i+1}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.code)}</td><td>${escapeHtml(s.college||"-")}</td><td class="no">ناقص</td><td>-</td></tr>`;
    });
    blocks += `<div class="rep-block">
      <h3>${escapeHtml(a.name)} <span class="rep-sub">سُلّم: ${delivered.length} · ناقص: ${missing.length} · النسبة: ${pct}%</span></h3>
      <table><thead><tr><th>#</th><th>الاسم</th><th>الكود</th><th>الكلية</th><th>الحالة</th><th>تاريخ التسليم</th></tr></thead><tbody>${rows}</tbody></table>
    </div>`;
  });
  const cf = document.getElementById("doc-college-filter");
  const collegeLabel = cf && cf.value ? cf.value : "";
  printReportWindow(uniName, logo, "تقرير تسليم المستندات" + (collegeLabel ? " - كلية: " + collegeLabel : ""), blocks);
};

function printReportWindow(uniName, logo, subTitle, blocksHtml) {
  const now = new Date();
  const dt = now.toLocaleDateString('ar-EG') + " " + now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  const content = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${escapeHtml(subTitle)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Tajawal', Tahoma, sans-serif; color:#1a1a1a; margin:0; padding:0; }
    .doc-header { text-align:center; border-bottom:3px double #1a3a5c; padding-bottom:12px; margin-bottom:18px; }
    .doc-header img { height:70px; margin-bottom:6px; }
    .doc-header h1 { margin:0; font-size:22px; color:#1a3a5c; }
    .doc-header p { margin:4px 0 0; font-size:13px; color:#555; }
    .rep-block { margin-bottom:22px; page-break-inside: avoid; }
    .rep-block h3 { margin:0 0 8px; font-size:15px; color:#1a3a5c; border-bottom:1px solid #ccc; padding-bottom:5px; }
    .rep-sub { font-size:12px; color:#666; font-weight:normal; }
    table { width:100%; border-collapse:collapse; font-size:12px; }
    th { background:#1a3a5c; color:#fff; padding:7px 6px; border:1px solid #1a3a5c; text-align:right; }
    td { padding:6px; border:1px solid #ccc; vertical-align:top; text-align:right; }
    tr:nth-child(even) td { background:#f4f7fb; }
    td.ok { color:#0a7d4f; font-weight:700; }
    td.no { color:#c0344d; font-weight:700; }
  </style></head><body>
    <div class="doc-header">
      ${logo?`<img src="${escapeHtml(logo)}">`:''}
      <h1>${escapeHtml(uniName)}</h1>
      <p>${escapeHtml(subTitle)}</p>
      <p>تاريخ الطباعة: ${dt}</p>
    </div>
    ${blocksHtml}
    <script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script>
  </body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(content); w.document.close(); }
  else showToast("تم حظر النافذة، اسمح بالنوافذ المنبثقة", "warning");
}

// ==================== CONSOLIDATED MISSING REPORT ====================

window.renderMissingReport = function() {
  const cont = document.getElementById("missing-report-container");
  if (!cont) return;
  const filter = document.getElementById("missing-college-filter");
  const college = filter ? filter.value : "";
  if (filter) {
    const uniq = [...new Set(allStudentsList.map(s=>s.college||"غير محدد"))];
    filter.innerHTML = `<option value="">كل الكليات</option>` + uniq.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    filter.value = college;
  }
  let list = allStudentsList.filter(s => getMissingDocs(s).length > 0);
  if (college) list = list.filter(s => (s.college||"غير محدد") === college);
  let html = "";
  if (!list.length) { html = '<p style="text-align:center;color:var(--text-gold);padding:20px;">🎉 لا يوجد طلاب بنواقص</p>'; }
  else {
    html += `<div class="missing-summary">إجمالي الطلاب بنواقص: <strong>${list.length}</strong></div>`;
    html += `<div class="missing-table-wrap"><table class="settings-table missing-table"><thead><tr><th>#</th><th>الاسم</th><th>الكود</th><th>الكلية</th><th>المستندات الناقصة</th><th>واتساب</th></tr></thead><tbody>`;
    list.forEach((s, i) => {
      const miss = getMissingDocs(s);
      const wp = (s.whatsapp||"").trim();
      html += `<tr>
        <td>${i+1}</td>
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.code)}</td>
        <td>${escapeHtml(s.college||"-")}</td>
        <td>${miss.map(m=>`<span class="chip chip-missing">${escapeHtml(m)}</span>`).join(" ")}</td>
        <td>${wp?`<button class="btn-icon btn-whatsapp-sm" onclick="sendMissingWhatsapp('${escapeHtml(s.id)}')" title="إرسال واتساب"><i class="fab fa-whatsapp"></i></button>`:'<span style="color:var(--text-muted)">—</span>'}</td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
  }
  cont.innerHTML = html;
};

window.exportMissingReportToExcel = function() {
  const filter = document.getElementById("missing-college-filter");
  const college = filter ? filter.value : "";
  let list = allStudentsList.filter(s => getMissingDocs(s).length > 0);
  if (college) list = list.filter(s => (s.college||"غير محدد") === college);
  const data = list.map(s => ({ "الاسم": s.name||"", "الكود": s.code||"", "الكلية": s.college||"", "المستندات الناقصة": getMissingDocs(s).join(" - "), "واتساب": s.whatsapp||"" }));
  if (!data.length) { showToast("لا توجد نواقص", "warning"); return; }
  exportToExcel(data, "تقرير_النواقص");
};

window.printMissingReportWord = function() {
  const filter = document.getElementById("missing-college-filter");
  const college = filter ? filter.value : "";
  let list = allStudentsList.filter(s => getMissingDocs(s).length > 0);
  if (college) list = list.filter(s => (s.college||"غير محدد") === college);
  const uniName = globalConfig.universityName || "جامعة اللوتس";
  const logo = globalConfig.universityLogo || "";
  let rows = "";
  list.forEach((s, i) => {
    const miss = getMissingDocs(s);
    rows += `<tr><td>${i+1}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.code)}</td><td>${escapeHtml(s.college||"-")}</td><td>${miss.map(m=>`<div>• ${escapeHtml(m)}</div>`).join("")}</td><td>${(s.whatsapp||"")}</td></tr>`;
  });
  const content = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>تقرير النواقص</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Tajawal', Tahoma, sans-serif; color:#1a1a1a; margin:0; padding:0; }
    .doc-header { text-align:center; border-bottom:3px double #1a3a5c; padding-bottom:12px; margin-bottom:18px; }
    .doc-header img { height:70px; margin-bottom:6px; }
    .doc-header h1 { margin:0; font-size:22px; color:#1a3a5c; }
    .doc-header p { margin:4px 0 0; font-size:13px; color:#555; }
    table { width:100%; border-collapse:collapse; font-size:12px; }
    th { background:#1a3a5c; color:#fff; padding:8px 6px; border:1px solid #1a3a5c; text-align:right; }
    td { padding:6px; border:1px solid #ccc; vertical-align:top; text-align:right; }
    tr:nth-child(even) td { background:#f4f7fb; }
    .ttl { text-align:center; margin:10px 0; font-size:14px; font-weight:bold; }
  </style></head><body>
    <div class="doc-header">
      ${logo?`<img src="${escapeHtml(logo)}">`:''}
      <h1>${escapeHtml(uniName)}</h1>
      <p>تقرير مجمع بالمستندات الناقصة للطلاب</p>
      <p>${college?('الكلية: '+escapeHtml(college)+' · '):''}تاريخ: ${new Date().toLocaleDateString('ar-EG')}</p>
    </div>
    <div class="ttl">إجمالي الطلاب بنواقص: ${list.length}</div>
    <table><thead><tr><th>#</th><th>الاسم</th><th>الكود</th><th>الكلية</th><th>المستندات الناقصة</th><th>واتساب</th></tr></thead><tbody>${rows}</tbody></table>
    <script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script>
  </body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(content); w.document.close(); }
  else showToast("تم حظر النافذة، اسمح بالنوافذ المنبثقة", "warning");
};

// ==================== WHATSAPP ====================

function buildWhatsappMessage(student) {
  const miss = getMissingDocs(student);
  if (!miss.length) return null;
  let tpl = globalConfig.whatsappPreamble || "السلام عليكم {name}\nالكلية: {college}\nالنواقص:\n{missing}";
  const missingList = miss.map((m,i)=>`${i+1}- ${m}`).join("\n");
  let msg = tpl.replace(/\{name\}/g, student.name||"").replace(/\{code\}/g, student.code||"").replace(/\{college\}/g, student.college||"").replace(/\{missing\}/g, missingList);
  const col = student.college || "";
  if (col && msg.indexOf(col) === -1) msg = "الكلية: " + col + "\n" + msg;
  return msg;
}

function openWhatsapp(student, message) {
  let phone = (student.whatsapp || student.phone || "").replace(/[^0-9]/g, "");
  if (!phone) { showToast("لا يوجد رقم واتساب للطالب", "warning"); return; }
  if (phone.startsWith("00")) phone = phone.slice(2);
  if (phone.startsWith("0")) phone = "20" + phone.slice(1);
  if (phone.startsWith("+")) phone = phone.slice(1);
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}

window.sendMissingWhatsapp = function(studentId) {
  const st = studentsIndex.find(s => s.id === studentId);
  if (!st) return;
  const msg = buildWhatsappMessage(st);
  if (!msg) { showToast("لا توجد نواقص لهذا الطالب", "info"); return; }
  openWhatsapp(st, msg);
};

window.sendStudentMissingViaWhatsapp = function() {
  if (!selectedStudent) { showToast("اختر طالباً أولاً", "warning"); return; }
  const msg = buildWhatsappMessage(selectedStudent);
  if (!msg) { showToast("الطالب لا يوجد له نواقص", "info"); return; }
  openWhatsapp(selectedStudent, msg);
};

window.sendAllMissingViaWhatsapp = function() {
  const list = allStudentsList.filter(s => getMissingDocs(s).length > 0);
  if (!list.length) { showToast("لا يوجد طلاب بنواقص", "info"); return; }
  showToast(`سيتم فتح ${list.length} نافذة واتساب...`, "info");
  list.forEach((s, i) => {
    const msg = buildWhatsappMessage(s);
    if (!msg) return;
    setTimeout(() => openWhatsapp(s, msg), i * 1200);
  });
};

window.exportEmployeeCertRecordsToExcel = function() {
  if (typeof XLSX === 'undefined') { showToast("مكتبة Excel غير محملة", "error"); return; }
  
  // Get all certificate records from localStorage
  let certRecords = [];
  try {
    certRecords = JSON.parse(localStorage.getItem('lotus_certificate_records') || '[]');
  } catch(e) { console.error('خطأ في قراءة شهادات الموظفين:', e); return; }
  
  if (certRecords.length === 0) {
    showToast("لا توجد شهادات محفوظة للموظفين للتصدير", "info");
    return;
  }
  
  // Filter records by employee certificates and organize by employee role
  const employeeRecords = [];
  const employeeCertificateTypes = {};
  
  certRecords.forEach(record => {
    const email = record.employeeUsername || '';
    const name = record.employeeName || '';
    const role = record.employeeRole || '';
    const timestamp = record.createdAt || record.updatedAt || '';
    
    const recordData = {
      "اسم الموظف": name,
      "اسم المستخدم": email,
      "الدور": role,
      "الشرطة": record.studentName || '',
      "نوع الشهادة": record.certificateLabel || record.certificateType || '',
      "المجموع": record.totalScore || record.totalPercentage || 0,
      "المجموع المكافئ": record.equivalentScore || 0,
      "النسبة": record.totalPercentage || 0,
      "تاريخ الدخول": new Date(timestamp).toLocaleDateString('ar-EG'),
      "تاريخ الانتهاء": new Date(timestamp).toLocaleTimeString('ar-EG'),
      "تاريخ الإنشاء": new Date(timestamp).toLocaleString('ar-EG'),
      "نوع الشهادة الخام": record.certificateType || '',
      "تمت بواسطة": record.employeeUsername || record.employeeName || ''
    };
    
    employeeRecords.push(recordData);
    
    // Track certificate types for grouping
    const certType = record.certificateLabel || record.certificateType || '';
    if (!employeeCertificateTypes[certType]) {
      employeeCertificateTypes[certType] = 0;
    }
    employeeCertificateTypes[certType]++;
  });
  
  // Create main data sheet
  let excelData = [];
  const currentDate = new Date().toLocaleDateString('ar-EG');
  const currentTime = new Date().toLocaleTimeString('ar-EG');
  
  // Title row
  excelData.push({
    "عنوان التقرير": "سجلات شهادات الموظفين",
    "": "",
    "الموقع": "جامعه اللوتس",
    "التاريخ": currentDate,
    "الوقت": currentTime,
    "إجمالي السجلات": certRecords.length
  });
  
  excelData.push({
    "": "",
    "": "",
    "": "",
    "": ""
  });
  
  // Summary statistics
  const summaryRows = [
    { "الفئة": "إجمالي السجلات", "القيمة": certRecords.length },
    { "الفئة": "الموظفين المتميزين", "القيمة": new Set(certRecords.map(r => r.employeeUsername)).size },
    { "الفئة": "أنواع الشهادات المختلفة", "القيمة": new Set(certRecords.map(r => r.certificateLabel || r.certificateType)).size },
    { "الفئة": "الطلاب المتفردين", "القيمة": new Set(certRecords.map(r => r.studentName)).size },
    { "الفئة": "متوسط النسبة", "القيمة": (certRecords.reduce((sum, r) => sum + (r.totalPercentage || 0), 0) / certRecords.length).toFixed(1) + "%" },
    { "الفئة": "أعلى نسبة", "القيمة": Math.max(...certRecords.map(r => r.totalPercentage || 0)).toFixed(1) + "%" },
    { "الفئة": "أقل نسبة", "القيمة": Math.min(...certRecords.map(r => r.totalPercentage || 0)).toFixed(1) + "%" }
  ];
  
  excelData = excelData.concat(summaryRows);
  
  excelData.push({
    "": ""
  });
  
  // Main data table
  excelData.push({
    "اسم الموظف": "اسم الموظف",
    "اسم المستخدم": "اسم المستخدم",
    "الدور": "الدور",
    "الشرطة": "اسم الطالب",
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
  
  employeeRecords.forEach(record => {
    excelData.push(record);
  });
  
  // Add certificate type breakdown
  excelData.push({
    "": ""
  });
  
  excelData.push({
    "نوع الشهادة": "نوع الشهادة",
    "العدد": "العدد",
    "النسبة": "النسبة %"
  });
  
  Object.entries(employeeCertificateTypes).forEach(([certType, count]) => {
    const percentage = ((count / certRecords.length) * 100).toFixed(1);
    excelData.push({
      "نوع الشهادة": certType,
      "العدد": count.toString(),
      "النسبة": percentage + "%"
    });
  });
  
  // Add detailed employee performance info
  excelData.push({
    "": ""
  });
  
  excelData.push({
    "اسم الموظف": "اسم الموظف",
    "اسم المستخدم": "اسم المستخدم",
    "الدور": "الدور",
    "أنواع الشهادات": "أنواع الشهادات",
    "عدد الشهادات": "عدد الشهادات",
    "متوسط النسبة": "متوسط النسبة"
  });
  
  // Group by employee
  const employeeStats = {};
  certRecords.forEach(record => {
    const email = record.employeeUsername || '';
    const name = record.employeeName || '';
    const role = record.role || '';
    
    if (!employeeStats[email]) {
      employeeStats[email] = {
        name: name,
        role: role,
        certTypes: new Set(),
        certCount: 0,
        totalScore: 0,
        avgPercentage: 0
      };
    }
    
    employeeStats[email].certTypes.add(record.certificateLabel || record.certificateType);
    employeeStats[email].certCount++;
    employeeStats[email].totalScore += (record.totalScore || record.totalPercentage || 0);
  });
  
   // Calculate averages
   Object.values(employeeStats).forEach(stats => {
     stats.avgPercentage = (stats.totalScore / stats.certCount).toFixed(1);
   });
  
  // Add employee rows
  Object.values(employeeStats).forEach(stats => {
    excelData.push({
      "اسم الموظف": stats.name,
      "اسم المستخدم": stats.name.includes('@') ? stats.name : (stats.name + '@lotus.edu'),
      "الدور": stats.role,
      "أنواع الشهادات": Array.from(stats.certTypes).join('، '),
      "عدد الشهادات": stats.certCount.toString(),
      "متوسط النسبة": stats.avgPercentage + "%"
    });
  });
  
  // Add footer
  excelData.push({
    "": ""
  });
  
  excelData.push({
    "الملاحظات": "بيانات شهادات الموظفين من نظام حساب شهادات جامعة اللوتس",
    "المحلل": "النظام",
    "بتاريخ": currentDate
  });
  
  // Export with appropriate styling for employee certificates
  try {
    const ws = XLSX.utils.json_to_sheet(excelData, { header: true, skipHeader: false });
    
    // Set column widths for better readability
    ws['!cols'] = [
      { wch: 25 }, // اسم الموظف
      { wch: 20 }, // اسم المستخدم
      { wch: 15 }, // الدور
      { wch: 20 }, // الشرطة
      { wch: 20 }, // نوع الشهادة
      { wch: 15 }, // المجموع
      { wch: 15 }, // المجموع المكافئ
      { wch: 12 }, // النسبة
      { wch: 15 }, // التاريخ
      { wch: 12 }, // الوقت
      { wch: 20 }  // تاريخ الإنشاء
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "شهادات_الموظفين");
    
    // Add color styling for headers and sections
    ws['A1'].s = {
      font: { bold: true, sz: 18, color: { rgb: 'FFFFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'FF2563EB' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    };
    
    // Add summary section styling
    const summaryStartRow = 5;
    for (let i = summaryStartRow; i < summaryRows.length + summaryStartRow; i++) {
      const row = XLSX.utils.encode_row(i);
      ws[`${row}A`].s = {
        font: { bold: true, color: { rgb: 'FF1E40AF' } },
        fill: { patternType: 'solid', fgColor: { rgb: 'FFE3F2FD' } }
      };
    }
    
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `شهادات_الموظفين_${currentDate.replace(/\//g, '_')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast("تم تصدير شهادات الموظفين بنجاح إلى Excel", "success");
  } catch (e) {
    console.error("خطأ في تصدير شهادات الموظفين:", e);
    showToast("خطأ في تصدير البيانات: " + e.message, "error");
  }
};

function exportToExcel(data, fileName, sheetName = "جدول البيانات") {
  if (typeof XLSX === 'undefined') {
    showToast("مكتبة Excel غير محملة", "error");
    return;
  }
  const ws = XLSX.utils.json_to_sheet(data, { header: true, skipHeader: false });
  
  // Apply formatting based on fileName to different sheets
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  
  // Set column widths based on content and purpose
  if (sheetName.includes("المصرية") || sheetName.includes("الثانوية")) {
    ws['!cols'] = [
      { wch: 4 },   // رقم
      { wch: 25 },  // الاسم
      { wch: 12 },  // الكود
      { wch: 20 },  // الكلية
      { wch: 10 },  // الفرقة
      { wch: 15 },  // المجموع
      { wch: 12 },  // النسبة
      { wch: 15 }   // تاريخ الدخول
    ];
  } else if (sheetName.includes("الازهرية") || sheetName.includes("الأزهرية")) {
    ws['!cols'] = [
      { wch: 4 },   // رقم
      { wch: 25 },  // الاسم
      { wch: 12 },  // الكود
      { wch: 20 },  // الكلية
      { wch: 10 },  // مجموع اللغة العربية
      { wch: 10 },  // مجموع المواد الثقافية
      { wch: 12 },  // النسبة
      { wch: 15 }   // تاريخ الدخول
    ];
  } else if (sheetName.includes("السعودية") || sheetName.includes("السعودية")) {
    ws['!cols'] = [
      { wch: 4 },   // رقم
      { wch: 25 },  // الاسم
      { wch: 12 },  // الكود
      { wch: 20 },  // الكلية
      { wch: 12 },  // متوسط المدرسة
      { wch: 12 },  // القدرات
      { wch: 10 },  // النسبة
      { wch: 15 }   // تاريخ الدخول
    ];
  } else if (sheetName.includes("الخليج") || sheetName.includes("الخليج")) {
    ws['!cols'] = [
      { wch: 4 },   // رقم
      { wch: 25 },  // الاسم
      { wch: 12 },  // الكود
      { wch: 20 },  // الكلية
      { wch: 15 },  // الدرجات (7 مواد)
      { wch: 10 },  // النسبة
      { wch: 15 }   // تاريخ الدخول
    ];
  } else if (sheetName.includes("الأردن") || sheetName.includes("الأردن")) {
    ws['!cols'] = [
      { wch: 4 },   // رقم
      { wch: 25 },  // الاسم
      { wch: 12 },  // الكود
      { wch: 20 },  // الكلية
      { wch: 15 },  // الدرجات (7 مواد)
      { wch: 10 },  // النسبة
      { wch: 15 }   // تاريخ الدخول
    ];
  } else if (sheetName.includes("ليبيا") || sheetName.includes("ليبيا")) {
    ws['!cols'] = [
      { wch: 4 },   // رقم
      { wch: 25 },  // الاسم
      { wch: 12 },  // الكود
      { wch: 20 },  // الكلية
      { wch: 15 },  // الدرجات (8 مواد)
      { wch: 10 },  // النسبة
      { wch: 15 }   // تاريخ الدخول
    ];
  } else if (sheetName.includes("الكويت") || sheetName.includes("الكويت")) {
    ws['!cols'] = [
      { wch: 4 },   // رقم
      { wch: 25 },  // الاسم
      { wch: 12 },  // الكود
      { wch: 20 },  // الكلية
      { wch: 12 },  // المرحلة 10
      { wch: 12 },  // المرحلة 11
      { wch: 12 },  // المرحلة 12
      { wch: 10 },  // النسبة الإجمالية
      { wch: 15 }   // تاريخ الدخول
    ];
  } else if (sheetName.includes("البحرين") || sheetName.includes("البحرين")) {
    ws['!cols'] = [
      { wch: 4 },   // رقم
      { wch: 25 },  // الاسم
      { wch: 12 },  // الكود
      { wch: 20 },  // الكلية
      { wch: 15 },  // المتوسط المرجح (3 مراحل)
      { wch: 10 },  // النسبة
      { wch: 15 }   // تاريخ الدخول
    ];
  } else if (sheetName.includes("STEM") || sheetName.includes("STEM")) {
    ws['!cols'] = [
      { wch: 4 },   // رقم
      { wch: 25 },  // الاسم
      { wch: 12 },  // الكود
      { wch: 20 },  // الكلية
      { wch: 15 },  // الدرجات
      { wch: 10 },  // النسبة
      { wch: 15 }   // تاريخ الدخول
    ];
  } else if (sheetName.includes("امريكان") || sheetName.includes("أمريكان دبلومة")) {
    ws['!cols'] = [
      { wch: 4 },   // رقم
      { wch: 25 },  // الاسم
      { wch: 12 },  // الكود
      { wch: 20 },  // الكلية
      { wch: 10 },  // Est1
      { wch: 10 },  // Est2
      { wch: 10 },  // GPA
      { wch: 10 },  // النسبة الإجمالية
      { wch: 15 }   // تاريخ الدخول
    ];
  }
  
  // Apply large Excel format for certificate records
  ws['A1'].s = {
    font: { bold: true, sz: 14, color: { rgb: 'FF2563EB' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'FFEBF5FF' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };
  
  if (sheetName.includes("المصرية") || sheetName.includes("الثانوية")) {
    ws['A1'].s.fill.fgColor.rgb = 'FFEBF5FF';
    ws['A1'].s.font.color.rgb = 'FF1E40AF';
  } else if (sheetName.includes("الازهرية") || sheetName.includes("الأزهرية")) {
    ws['A1'].s.fill.fgColor.rgb = 'FFFCE4EC';
    ws['A1'].s.font.color.rgb = 'FFC2187F';
  } else if (sheetName.includes("السعودية") || sheetName.includes("السعودية")) {
    ws['A1'].s.fill.fgColor.rgb = 'FFD1FAE5';
    ws['A1'].s.font.color.rgb = 'FF065F46';
  } else if (sheetName.includes("الخليج") || sheetName.includes("الخليج")) {
    ws['A1'].s.fill.fgColor.rgb = 'FEF3C7';
    ws['A1'].s.font.color.rgb = 'DC2626';
  } else if (sheetName.includes("الأردن") || sheetName.includes("الأردن")) {
    ws['A1'].s.fill.fgColor.rgb = 'EDE9FE';
    ws['A1'].s.font.color.rgb = '7C3AED';
  } else if (sheetName.includes("ليبيا") || sheetName.includes("ليبيا")) {
    ws['A1'].s.fill.fgColor.rgb = 'FFE0E5';
    ws['A1'].s.font.color.rgb = 'BE185D';
  } else if (sheetName.includes("الكويت") || sheetName.includes("الكويت")) {
    ws['A1'].s.fill.fgColor.rgb = 'FFECF2FF';
    ws['A1'].s.font.color.rgb = '1E40AF';
  } else if (sheetName.includes("البحرين") || sheetName.includes("البحرين")) {
    ws['A1'].s.fill.fgColor.rgb = 'FFE8E5';
    ws['A1'].s.font.color.rgb = '9F1239';
  }
  
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = fileName + ".xlsx";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("تم تصدير الشهادات بنجاح", "success");
}

function printGeneric(title, bodyHtml) {
  const content = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
  <style>body{font-family:'Tajawal',Tahoma,sans-serif;padding:20px;color:#222;}h2{text-align:center;color:#1a3a5c;}</style></head>
  <body><h2>${escapeHtml(title)}</h2>${bodyHtml}<script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script></body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(content); w.document.close(); }
  else showToast("تم حظر النافذة، اسمح بالنوافذ المنبثقة", "warning");
}

// ==================== THEME ====================

window.toggleTheme = function() {
  const e = document.body, t = document.getElementById("themeToggleBtn"), n = t ? t.querySelector("i") : null;
  const o = e.getAttribute("data-theme");
  const s = "dark" === o ? "light" : "dark";
  e.setAttribute("data-theme", s);
  if (n) n.className = "dark" === s ? "fas fa-sun" : "fas fa-moon";
  try { localStorage.setItem("theme", s); } catch (e) {}
};

window.handleLogoError = function() {
  const e = document.getElementById("logoImg"), t = document.getElementById("logoFallback"), n = document.querySelector(".logo-inner");
  if (e && t && n) { e.style.display = "none"; t.style.display = "flex"; }
};

(function() {
  let saved = "dark";
  try { saved = localStorage.getItem("theme") || "dark"; } catch (e) {}
  document.body.setAttribute("data-theme", saved);
  const t = document.querySelector("#themeToggleBtn i");
  if (t) t.className = "dark" === saved ? "fas fa-sun" : "fas fa-moon";
  const li = document.getElementById("logoImg");
  if (li && li.complete && li.naturalWidth === 0) window.handleLogoError();
})();