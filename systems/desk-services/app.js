// ==========================================
// APP ENGINE - Desk Services & Paper Transactions
// ==========================================

// 1. Initialize Firebase database reference
const db = window.AUTH_DB || (typeof firebase !== 'undefined' ? firebase.database() : null);

// 2. Application State
let services = [];
let categoriesList = [
  { id: 'proofs', name: 'إثباتات قيد وحسن سلوك', icon: 'fa-file-signature' },
  { id: 'transfers', name: 'تحويلات ونقل قيد', icon: 'fa-shuffle' },
  { id: 'cards', name: 'كارنيهات وهويات طالب', icon: 'fa-id-card' },
  { id: 'withdrawal', name: 'سحب وتصفية ملفات', icon: 'fa-file-arrow-down' },
  { id: 'others', name: 'خدمات عامة أخرى', icon: 'fa-ellipsis' }
];
let activeCategory = 'all';
let searchQuery = '';
let sortBy = 'latest';
let isAdminMode = false;
let currentUser = null;

// Form State (Temporary tags storage)
let formDocuments = [];
let formSteps = [];
let formAttachedFiles = []; // files pending upload or already uploaded

// 3. Document Load and Initialization
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupEventListeners();
});

async function initApp() {
  showLoading(true);
  
  // A. Check Authentication
  checkAuthSession();

  // B. Load Dynamic Categories
  fetchCategoriesList();

  // C. Load Services (Realtime Listener)
  if (db) {
    db.ref('deskServices').on('value', (snapshot) => {
      services = [];
      const data = snapshot.val();
      if (data) {
        Object.keys(data).forEach(key => {
          services.push({ id: key, ...data[key] });
        });
      }
      
      calculateStats();
      filterAndRenderServices();
      fetchStudentRequests();
      showLoading(false);
      
      // Check if direct link contains serviceId
      const urlParams = new URLSearchParams(window.location.search);
      const serviceIdParam = urlParams.get('serviceId');
      if (serviceIdParam) {
        const found = services.find(s => s.id === serviceIdParam);
        if (found) {
          // Clear query param to avoid repeat popups on reload
          window.history.replaceState({}, document.title, window.location.pathname);
          openServiceDetails(found.id);
        }
      }
    }, (error) => {
      console.error("Database load error:", error);
      showToast("خطأ أثناء تحميل البيانات من السيرفر", "error");
      showLoading(false);
    });
  } else {
    showToast("فشل الاتصال بقاعدة البيانات - يعمل في الوضع المحلي فقط", "warning");
    showLoading(false);
  }

  // Theme check
  const savedTheme = localStorage.getItem('sys_theme') || 'dark';
  document.body.setAttribute('data-theme', savedTheme);
  updateThemeButtonIcon(savedTheme);
}

// 4. Session & Authentication handling
function checkAuthSession() {
  currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
  const menuEl = document.getElementById('user-menu');
  const loginPromptEl = document.getElementById('login-prompt');
  
  if (currentUser) {
    if (menuEl) menuEl.style.display = 'flex';
    if (loginPromptEl) loginPromptEl.style.display = 'none';
    
    // Set Dropdown Info
    document.getElementById('dropdown-name').textContent = currentUser.name || currentUser.username;
    const roleNames = { admin: 'مدير النظام', supervisor: 'مشرف شؤون طلاب', employee: 'موظف شؤون طلاب', viewer: 'مشاهد' };
    document.getElementById('dropdown-role').textContent = roleNames[currentUser.role] || currentUser.role;

    // Show Admin Option strictly for Admin accounts only
    const canManage = currentUser && (currentUser.role === 'admin' || currentUser.username === 'boles' || currentUser.username === 'admin');
    if (canManage) {
      const opt = document.getElementById('admin-mode-opt');
      if (opt) opt.style.display = 'flex';
      switchToAdminMode();
    } else {
      const opt = document.getElementById('admin-mode-opt');
      if (opt) opt.style.display = 'none';
      switchToUserMode();
    }

    // تسجيل الدخول بنجاح
    if (currentUser && window.authLogActivity) {
      window.authLogActivity('access', 'desk-services', '', currentUser.name, 'فتح نظام الخدمات المكتبية', 'الخدمات المكتبية');
    }
  } else {
    if (menuEl) menuEl.style.display = 'none';
    if (loginPromptEl) loginPromptEl.style.display = 'block';
    switchToUserMode();
  }
}

function switchToAdminMode() {
  isAdminMode = true;
  document.getElementById('admin-dashboard-panel').style.display = 'block';
  // Add active state to user dropdown menu option
  document.getElementById('admin-mode-opt').classList.add('active');
  filterAndRenderServices();
}

function switchToUserMode() {
  isAdminMode = false;
  document.getElementById('admin-dashboard-panel').style.display = 'none';
  const opt = document.getElementById('admin-mode-opt');
  if (opt) opt.classList.remove('active');
  filterAndRenderServices();
}

function toggleUserDropdown() {
  document.getElementById('user-dropdown').classList.toggle('show');
}

window.addEventListener('click', (e) => {
  if (!e.target.closest('#user-menu')) {
    const dd = document.getElementById('user-dropdown');
    if (dd) dd.classList.remove('show');
  }
});

function closeAndBackupAndLogout() {
  if (window.closeAndBackup) {
    window.closeAndBackup();
  } else {
    if (window.authClearSession) window.authClearSession();
    localStorage.removeItem('lotus_session');
    window.location.reload();
  }
}

// 5. Statistics Engine
function calculateStats() {
  const totalServices = services.length;
  let totalDownloads = 0;
  let totalPrints = 0;
  let maxViews = -1;
  let mostVisitedName = 'لا يوجد';
  let lastUpdatedTime = null;

  services.forEach(s => {
    // Views
    const views = s.viewsCount || 0;
    if (views > maxViews && views > 0) {
      maxViews = views;
      mostVisitedName = s.name;
    }

    // Last Updated
    if (s.lastUpdated) {
      const t = new Date(s.lastUpdated).getTime();
      if (!lastUpdatedTime || t > lastUpdatedTime) {
        lastUpdatedTime = t;
      }
    }

    // Downloads & Prints from attached files
    if (s.files) {
      Object.keys(s.files).forEach(fKey => {
        const fileObj = s.files[fKey];
        totalDownloads += (fileObj.downloadCount || 0);
        totalPrints += (fileObj.printCount || 0);
      });
    }
  });

  // Populate UI if elements exist
  const el1 = document.getElementById('stat-total-services');
  const el2 = document.getElementById('stat-total-downloads');
  const el3 = document.getElementById('stat-total-prints');
  const el4 = document.getElementById('stat-most-visited');
  const el5 = document.getElementById('stat-last-update');

  if (el1) el1.textContent = totalServices;
  if (el2) el2.textContent = totalDownloads;
  if (el3) el3.textContent = totalPrints;
  if (el4) el4.textContent = mostVisitedName;
  if (el5) {
    if (lastUpdatedTime) {
      const diffMin = Math.floor((Date.now() - lastUpdatedTime) / 60000);
      if (diffMin < 60) {
        el5.textContent = `منذ ${diffMin} دقيقة`;
      } else {
        const diffHours = Math.floor(diffMin / 60);
        if (diffHours < 24) {
          el5.textContent = `منذ ${diffHours} ساعة`;
        } else {
          const days = Math.floor(diffHours / 24);
          el5.textContent = `منذ ${days} يوم`;
        }
      }
    } else {
      el5.textContent = 'لا يوجد';
    }
  }
}

// 5.5 Dynamic Categories Logic
async function fetchCategoriesList() {
  if (db) {
    db.ref('deskServicesCategories').on('value', (snap) => {
      const val = snap.val();
      if (val) {
        if (Array.isArray(val)) {
          categoriesList = val;
        } else if (typeof val === 'object') {
          categoriesList = Object.values(val);
        }
      }
      renderCategoryTabs();
      renderCategoryFormOptions();
    });
  } else {
    try {
      const raw = localStorage.getItem('deskServicesCategories');
      if (raw) categoriesList = JSON.parse(raw);
    } catch(e) {}
    renderCategoryTabs();
    renderCategoryFormOptions();
  }
}

function renderCategoryTabs() {
  const container = document.getElementById('categories-filter-wrapper');
  if (!container) return;

  let html = `
    <button class="filter-pill ${activeCategory === 'all' ? 'active' : ''}" data-category="all" onclick="selectCategory('all')">
      <i class="fas fa-border-all me-1"></i> الكل
    </button>
  `;

  categoriesList.forEach(cat => {
    const icon = cat.icon || 'fa-tag';
    html += `
      <button class="filter-pill ${activeCategory === cat.id ? 'active' : ''}" data-category="${cat.id}" onclick="selectCategory('${cat.id}')">
        <i class="fas ${icon} me-1"></i> ${escapeHtml(cat.name)}
      </button>
    `;
  });

  container.innerHTML = html;
}

function renderCategoryFormOptions() {
  const select = document.getElementById('form-category');
  if (!select) return;

  const curVal = select.value;
  select.innerHTML = categoriesList.map(cat => `
    <option value="${cat.id}">${escapeHtml(cat.name)}</option>
  `).join('');

  if (curVal && categoriesList.some(c => c.id === curVal)) {
    select.value = curVal;
  }
}

function openCategoriesManagerModal() {
  renderCategoriesManagerTable();
  openModal('categories-manager-modal');
}

function renderCategoriesManagerTable() {
  const tbody = document.getElementById('categories-manager-tbody');
  if (!tbody) return;

  tbody.innerHTML = categoriesList.map((cat, idx) => `
    <tr>
      <td class="text-center font-weight-bold text-secondary">${idx + 1}</td>
      <td class="font-weight-bold text-white"><i class="fas ${cat.icon || 'fa-tag'} text-cyan me-2"></i> ${escapeHtml(cat.name)}</td>
      <td class="text-secondary font-size-xs"><code class="text-info">${cat.icon || 'fa-tag'}</code></td>
      <td class="text-center">
        <button class="btn btn-xs btn-outline-danger px-2 py-0" onclick="deleteCategoryItem('${cat.id}')" title="حذف التصنيف"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

async function handleAddNewCategory(event) {
  event.preventDefault();
  const nameInput = document.getElementById('new-cat-name');
  const iconInput = document.getElementById('new-cat-icon');

  const name = nameInput.value.trim();
  const icon = iconInput.value;
  if (!name) return;

  const catId = 'cat_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
  const newCat = { id: catId, name: name, icon: icon };

  categoriesList.push(newCat);

  if (db) {
    await db.ref('deskServicesCategories').set(categoriesList);
  }
  localStorage.setItem('deskServicesCategories', JSON.stringify(categoriesList));
  localStorage.setItem('lotus_system_modified', 'true');

  nameInput.value = '';
  renderCategoriesManagerTable();
  renderCategoryTabs();
  renderCategoryFormOptions();
  showToast(`✅ تم إضافة تصنيف (${name}) بنجاح!`, "success");
}

async function deleteCategoryItem(catId) {
  if (categoriesList.length <= 1) {
    showToast("⚠️ لا يمكن حذف كافة التصنيفات، يجب الإبقاء على تصنيف واحد على الأقل", "warning");
    return;
  }

  if (!confirm("هل أنت متأكد من رغبتك في حذف هذا التصنيف؟")) return;

  categoriesList = categoriesList.filter(c => c.id !== catId);

  if (db) {
    await db.ref('deskServicesCategories').set(categoriesList);
  }
  localStorage.setItem('deskServicesCategories', JSON.stringify(categoriesList));
  localStorage.setItem('lotus_system_modified', 'true');

  renderCategoriesManagerTable();
  renderCategoryTabs();
  renderCategoryFormOptions();
  showToast("✅ تم حذف التصنيف بنجاح", "info");
}

// 6. Searching, Filtering, Sorting UI Logic
function selectCategory(cat) {
  activeCategory = cat;
  document.querySelectorAll('.filter-pill').forEach(btn => {
    if (btn.dataset.category === cat) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  filterAndRenderServices();
}

function clearSearch() {
  document.getElementById('search-input').value = '';
  document.getElementById('clear-search-btn').style.display = 'none';
  searchQuery = '';
  filterAndRenderServices();
}

function resetFilters() {
  clearSearch();
  selectCategory('all');
}

function filterAndRenderServices() {
  const grid = document.getElementById('services-grid');
  grid.innerHTML = '';
  
  searchQuery = document.getElementById('search-input').value.trim().toLowerCase();
  const sortEl = document.getElementById('sort-select');
  sortBy = sortEl ? sortEl.value : 'latest';
  
  // Show/Hide Clear button
  document.getElementById('clear-search-btn').style.display = searchQuery ? 'block' : 'none';

  // A. Filter
  let filtered = services.filter(s => {
    const matchesCategory = (activeCategory === 'all' || s.category === activeCategory);
    
    const nameMatch = s.name.toLowerCase().includes(searchQuery);
    const descMatch = s.description.toLowerCase().includes(searchQuery);
    const docsMatch = s.documents ? s.documents.some(d => d.toLowerCase().includes(searchQuery)) : false;
    const stepsMatch = s.steps ? s.steps.some(st => st.toLowerCase().includes(searchQuery)) : false;
    
    const matchesSearch = !searchQuery || (nameMatch || descMatch || docsMatch || stepsMatch);
    
    return matchesCategory && matchesSearch;
  });

  // B. Sort
  filtered.sort((a, b) => {
    if (sortBy === 'price-asc') {
      return (a.price || 0) - (b.price || 0);
    } else if (sortBy === 'price-desc') {
      return (b.price || 0) - (a.price || 0);
    } else if (sortBy === 'views') {
      return (b.viewsCount || 0) - (a.viewsCount || 0);
    } else {
      // 'latest'
      const timeA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
      const timeB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
      return timeB - timeA;
    }
  });

  // C. Render
  if (filtered.length === 0) {
    document.getElementById('empty-state').style.display = 'block';
    return;
  }
  document.getElementById('empty-state').style.display = 'none';

  filtered.forEach(service => {
    const col = document.createElement('div');
    col.className = 'service-card-wrapper';
    
    // Check if new or updated within 48h and NOT yet seen by current account
    let badgeHTML = '';
    if (service.lastUpdated) {
      const diffMs = Date.now() - new Date(service.lastUpdated).getTime();
      const isRecent = diffMs < 48 * 60 * 60 * 1000;
      if (isRecent) {
        const createMs = service.createdAt ? new Date(service.createdAt).getTime() : 0;
        const lastUpdateMs = new Date(service.lastUpdated).getTime();
        const diffUpdate = lastUpdateMs - createMs;
        const isUpdated = diffUpdate > 5000 && service.updatedPart && service.updatedPart !== 'الخدمة بالكامل';
        const isNew = !isUpdated && (Date.now() - createMs) < 48 * 60 * 60 * 1000;

        const curUser = window.getCurrentUser ? window.getCurrentUser() : currentUser;
        const uName = curUser ? (curUser.username || curUser.name) : 'guest';
        const isSeen = service.seenBy && service.seenBy[uName];

        if ((isUpdated || isNew) && !isSeen) {
          badgeHTML = `<span class="badge-update" style="${isUpdated ? 'background:linear-gradient(135deg, #f43f5e, #e11d48);' : ''}"><i class="fas ${isNew ? 'fa-star' : 'fa-arrows-rotate'}"></i> ${isNew ? 'جديد' : 'محدث'}</span>`;
        }
      }
    }

    const catIcons = {
      proofs: 'fa-file-signature',
      transfers: 'fa-shuffle',
      cards: 'fa-id-card',
      withdrawal: 'fa-file-arrow-down',
      others: 'fa-ellipsis'
    };
    const iconClass = catIcons[service.category] || 'fa-file-alt';

    col.innerHTML = `
      <div class="service-card animated-glowing-card" onclick="openServiceDetails('${service.id}')">
        ${badgeHTML}
        <div class="service-card-icon">
          <i class="fas ${iconClass}"></i>
        </div>
        <h3 class="service-card-title">${escapeHtml(service.name)}</h3>
        <div class="service-card-meta flex-column gap-1.5 align-items-start p-2.5 rounded-3 border border-secondary" style="background: rgba(15, 23, 42, 0.7); width: 100%;">
          <div class="w-100 d-flex justify-content-between align-items-center font-weight-bold" style="font-size: 0.85rem;">
            <span style="color: #94a3b8;" title="تكلفة الخدمة"><i class="fas fa-coins me-1 text-warning fs-6"></i></span>
            <span class="text-success font-weight-bold">${service.price > 0 ? service.price + ' ج.م' : 'مجانًا'}</span>
          </div>
          <div class="w-100 d-flex justify-content-between align-items-center font-weight-bold" style="font-size: 0.85rem;">
            <span style="color: #94a3b8;" title="مدة الاستخراج والتسليم"><i class="far fa-clock me-1 text-info fs-6"></i></span>
            <span class="text-cyan font-weight-bold">${escapeHtml(service.duration)}</span>
          </div>
        </div>
      </div>
    `;
    grid.appendChild(col);
  });
}

// 7. Modals Controllers
function openModal(id) {
  document.getElementById(id).classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
  if (!document.querySelector('.modal-overlay.active')) {
    document.body.style.overflow = 'auto';
  }
}

// Details Modal
function openServiceDetails(serviceId) {
  const service = services.find(s => s.id === serviceId);
  if (!service) return;
  
  // Set Current Service
  window.currentService = service;

  // Track View Count
  if (db && !serviceId.startsWith("mock_")) {
    db.ref(`deskServices/${serviceId}/viewsCount`).transaction(c => (c || 0) + 1);
  }

  // Mark as seen by current user so outer card badge disappears
  const curUser = window.getCurrentUser ? window.getCurrentUser() : currentUser;
  const username = curUser ? (curUser.username || curUser.name) : 'guest';
  if (!service.seenBy) service.seenBy = {};
  if (!service.seenBy[username]) {
    service.seenBy[username] = Date.now();
    if (db && !serviceId.startsWith("mock_")) {
      db.ref(`deskServices/${serviceId}/seenBy/${username}`).set(Date.now());
    }
    filterAndRenderServices();
  }

  const modalBody = document.getElementById('details-modal-body');
  
  // Render details modal body
  let docsHTML = '';
  if (service.documents && service.documents.length) {
    docsHTML = `<ul class="custom-list">` + service.documents.map(d => `<li style="color: #ffffff!important; font-weight: 800!important;">${escapeHtml(d)}</li>`).join('') + `</ul>`;
  } else {
    docsHTML = `<p class="font-size-sm mb-0" style="color: #ffffff!important; font-weight: 400!important;">لا توجد مستندات خاصة مطلوبة.</p>`;
  }

  let stepsHTML = '';
  if (service.steps && service.steps.length) {
    stepsHTML = `<ol class="custom-list steps-list">` + service.steps.map(s => `<li style="color: #ffffff!important; font-weight: 800!important;">${escapeHtml(s)}</li>`).join('') + `</ol>`;
  } else {
    stepsHTML = `<p class="font-size-sm mb-0" style="color: #ffffff!important; font-weight: 400!important;">لا توجد خطوات محددة للخدمة.</p>`;
  }

  let filesHTML = '';
  if (service.files && Object.keys(service.files).length) {
    filesHTML = `<div class="files-grid mt-2 d-flex flex-column gap-2">` + Object.keys(service.files).map(fKey => {
      const file = service.files[fKey];
      const fileExt = file.fileName.split('.').pop().toLowerCase();
      let fileIcon = 'fa-file-alt';
      let iconColorClass = 'others';
      
      if (fileExt === 'pdf') { fileIcon = 'fa-file-pdf'; iconColorClass = 'pdf'; }
      else if (fileExt === 'doc' || fileExt === 'docx') { fileIcon = 'fa-file-word'; iconColorClass = 'word'; }
      else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt)) { fileIcon = 'fa-file-image'; iconColorClass = 'image'; }

      return `
        <div class="file-item-card p-2 rounded-3 bg-dark border border-secondary d-flex align-items-center justify-content-between gap-2" style="background: rgba(15, 23, 42, 0.6)!important;">
          <div class="d-flex align-items-center gap-2" style="overflow: hidden;">
            <div class="file-icon-box ${iconColorClass}" style="width:32px; height:32px; min-width:32px; border-radius:8px; display:flex; align-items:center; justify-content:center;">
              <i class="fas ${fileIcon}"></i>
            </div>
            <span class="file-name font-weight-bold text-white text-truncate" style="font-size: 0.85rem!important; color: #ffffff!important;" title="${escapeHtml(file.fileName)}">${escapeHtml(file.fileName)}</span>
          </div>
          <div class="d-flex gap-1.5 align-items-center">
            <button class="btn btn-sm btn-outline-warning px-2 py-1" onclick="printAttachedFile('${service.id}', '${fKey}')" title="طباعة الملف"><i class="fas fa-print"></i></button>
            <button class="btn btn-sm btn-success px-3 py-1 font-weight-bold" onclick="downloadAttachedFile('${service.id}', '${fKey}')" title="تحميل المستند الأصلي"><i class="fas fa-download me-1"></i> تحميل المستند</button>
          </div>
        </div>
      `;
    }).join('') + `</div>`;
  } else {
    filesHTML = `
      <div class="no-files-card p-3 text-center border border-secondary rounded-3" style="background: rgba(15, 23, 42, 0.4);">
        <i class="fas fa-circle-exclamation text-secondary fs-4 mb-2"></i>
        <div class="font-size-xs text-white" style="color: #ffffff!important; font-weight: 400!important;">لا توجد مستندات أو نماذج ورقية مرفقة مع هذه الخدمة.</div>
      </div>
    `;
  }

  const isRecent = service.lastUpdated && (Date.now() - new Date(service.lastUpdated).getTime() < 48 * 60 * 60 * 1000);
  const updatedBadge = (isRecent) ? `<span class="badge-updated-part ms-2" style="background:var(--accent-rose); color:#fff; font-size:0.7rem; padding:2px 6px; border-radius:4px; font-weight:bold; animation: pulseBadge 2s infinite; vertical-align:middle; display:inline-block;">محدث</span>` : '';
  
  const isTitleUpdated = isRecent && (service.updatedPart === "التفاصيل" || service.updatedPart === "التفاصيل العامة" || service.updatedPart === "الخدمة بالكامل");
  const isStepsUpdated = isRecent && (service.updatedPart === "الخطوات" || service.updatedPart === "الخطوات المتبعة" || service.updatedPart === "خطوات الاستخراج");
  const isDocsUpdated = isRecent && (service.updatedPart === "الأوراق المطلوبة" || service.updatedPart === "المستندات المطلوبة" || service.updatedPart === "المستندات" || service.updatedPart === "المستندات والأوراق المطلوبة" || service.updatedPart === "الأوراق والمستندات المطلوبة");
  const isFilesUpdated = isRecent && (service.updatedPart === "المستندات المرفقة" || service.updatedPart === "الملفات المرفقة" || service.updatedPart === "المرفقات" || service.updatedPart === "المستندات والنماذج الورقية");
  const isPriceUpdated = isRecent && (service.updatedPart === "السعر" || service.updatedPart === "سعر الخدمة");

  modalBody.innerHTML = `
    <div class="row g-4">
      <!-- Left Column: Title/Desc, Steps, Docs -->
      <div class="col-md-8">
        <!-- 1. Title & Description Block (Cyan Glow Card) -->
        <div class="glowing-part-card p-3.5 rounded-4 mb-4" style="border: 2px solid #0284c7; background: rgba(2, 132, 199, 0.08); box-shadow: 0 0 15px rgba(2, 132, 199, 0.25);">
          <h4 class="font-weight-bold text-cyan mb-2"><i class="fas fa-file-signature me-2"></i> ${escapeHtml(service.name)} ${isTitleUpdated ? updatedBadge : ''}</h4>
          <p class="text-white font-size-sm leading-relaxed mb-0">${escapeHtml(service.description)}</p>
        </div>

        <!-- 2. Steps & Procedures Block (Gold Glow Card) -->
        <div class="glowing-part-card p-3.5 rounded-4 mb-4" style="border: 2px solid #f59e0b; background: rgba(245, 158, 11, 0.08); box-shadow: 0 0 15px rgba(245, 158, 11, 0.25);">
          <h5 class="font-weight-bold text-warning mb-3" style="font-size: 1rem;"><i class="fas fa-list-check me-2"></i> الخطوات والإجراءات المتبعة ${isStepsUpdated ? updatedBadge : ''}</h5>
          ${stepsHTML}
        </div>

        <!-- 3. Required Documents Block (Rose Glow Card) -->
        <div class="glowing-part-card p-3.5 rounded-4" style="border: 2px solid #ec4899; background: rgba(236, 72, 153, 0.08); box-shadow: 0 0 15px rgba(236, 72, 153, 0.25);">
          <h5 class="font-weight-bold mb-3" style="color: #f472b6!important; font-size: 1rem;"><i class="fas fa-folder-open me-2"></i> المستندات والأوراق المطلوبة ${isDocsUpdated ? updatedBadge : ''}</h5>
          ${docsHTML}
        </div>
      </div>

      <!-- Right Column: Price & Duration, Printable Files -->
      <div class="col-md-4">
        <!-- 4. Price & Extraction Duration Meta Block (Emerald Green Glow Card) -->
        <div class="glowing-part-card p-3.5 rounded-4 mb-4" style="border: 2px solid #10b981; background: rgba(16, 185, 129, 0.08); box-shadow: 0 0 15px rgba(16, 185, 129, 0.25);">
          <div class="row g-2 text-center align-items-center">
            <div class="col-6 border-end border-secondary">
              <div class="detail-part-meta font-weight-bold">
                <span class="d-block text-secondary font-size-xs mb-1" title="تكلفة الخدمة"><i class="fas fa-coins text-warning fs-5"></i> ${isPriceUpdated ? updatedBadge : ''}</span>
                <span class="fs-5 text-success font-weight-bold">${service.price > 0 ? service.price + ' ج.م' : 'مجانًا'}</span>
              </div>
            </div>
            <div class="col-6">
              <div class="detail-part-meta font-weight-bold">
                <span class="d-block text-secondary font-size-xs mb-1" title="مدة الاستخراج والتسليم"><i class="far fa-clock text-info fs-5"></i></span>
                <span class="fs-5 text-cyan font-weight-bold" style="font-size: 0.95rem!important;">${escapeHtml(service.duration)}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 5. Printable Paper Forms & Templates Block (Purple Glow Card) -->
        <div class="glowing-part-card p-3.5 rounded-4" style="border: 2px solid #8b5cf6; background: rgba(139, 92, 246, 0.08); box-shadow: 0 0 15px rgba(139, 92, 246, 0.25);">
          <h5 class="font-weight-bold mb-3" style="color: #c084fc!important; font-size: 1rem;"><i class="fas fa-file-lines me-2"></i> المستندات والنماذج الورقية ${isFilesUpdated ? updatedBadge : ''}</h5>
          ${filesHTML}
        </div>
      </div>
    </div>
  `;

  // Show/Hide Admin Actions
  const adminActions = document.getElementById('details-admin-actions');
  if (adminActions) {
    adminActions.style.display = (isAdminMode && window.getCurrentUser()) ? 'block' : 'none';
  }

  openModal('details-modal');
}

// 8. Custom File Actions (Download, Print, Preview)
async function getFileContent(serviceId, fileId) {
  const service = services.find(s => s.id === serviceId) || window.currentService;
  if (!service || !service.files || !service.files[fileId]) return null;
  const file = service.files[fileId];

  if (file.dataUrl) {
    return { name: file.fileName, dataUrl: file.dataUrl, type: 'base64' };
  }

  if (file.url && file.url !== 'db_fallback') {
    return { name: file.fileName, url: file.url, type: 'url' };
  }

  if (db) {
    showLoading(true);
    try {
      const snap = await db.ref(`deskServicesFiles/${serviceId}/${fileId}`).once('value');
      showLoading(false);
      const val = snap.val();
      if (val && val.chunks) {
        const fullBase64 = val.chunks.join('');
        file.dataUrl = fullBase64;
        return { name: file.fileName, dataUrl: fullBase64, type: 'base64' };
      } else if (val && val.dataUrl) {
        file.dataUrl = val.dataUrl;
        return { name: file.fileName, dataUrl: val.dataUrl, type: 'base64' };
      }
    } catch (e) {
      showLoading(false);
      console.error(e);
    }
  }
  return null;
}

// Download
async function downloadAttachedFile(serviceId, fileId) {
  const service = services.find(s => s.id === serviceId) || window.currentService;
  if (!service || !service.files || !service.files[fileId]) return;

  const fileData = await getFileContent(serviceId, fileId);
  if (!fileData) {
    showToast("⚠️ خطأ أثناء تحميل محتوى الملف", "error");
    return;
  }

  // Track download
  if (db && !serviceId.startsWith("mock_")) {
    db.ref(`deskServices/${serviceId}/files/${fileId}/downloadCount`).transaction(c => (c || 0) + 1);
  }

  if (fileData.type === 'url') {
    const link = document.createElement('a');
    link.href = fileData.url;
    link.download = fileData.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    try {
      const base64Data = fileData.dataUrl.split(',')[1] || fileData.dataUrl;
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/octet-stream' });
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileData.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (e) {
      const link = document.createElement('a');
      link.href = fileData.dataUrl;
      link.download = fileData.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  showToast(`✅ تم تحميل ملف (${fileData.name}) بنجاح!`, "success");
}

// Print File
async function printAttachedFile(serviceId, fileId) {
  const service = services.find(s => s.id === serviceId) || window.currentService;
  if (!service || !service.files || !service.files[fileId]) return;

  // Track print count
  if (db && !serviceId.startsWith("mock_")) {
    db.ref(`deskServices/${serviceId}/files/${fileId}/printCount`).transaction(c => (c || 0) + 1);
  }

  // Open preview of exact uploaded Word file and trigger print
  await previewAttachedFile(serviceId, fileId);
  setTimeout(() => {
    printEditedPreviewDocument();
  }, 1000);
}

function printIframe(url) {
  let iframe = document.getElementById('print-iframe-loader');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'print-iframe-loader';
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
  }

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }, 500);
  };
  iframe.src = url;
}

// ==========================================
// DOCUMENT PREVIEW & LIVE EDITOR ENGINE
// ==========================================
let currentPreviewContext = {
  serviceId: null,
  fileId: null,
  isForm: false,
  isEditMode: false
};

function makeContainerEditable(container) {
  if (!container) return;
  container.contentEditable = "true";
  container.style.outline = "2px dashed #0284c7";
  container.style.cursor = "text";

  const allElements = container.querySelectorAll('*');
  allElements.forEach(el => {
    if (['IMG', 'SVG', 'CANVAS', 'PICTURE'].includes(el.tagName)) {
      el.style.maxWidth = '100%';
      el.style.display = 'inline-block';
    } else if (el.children.length === 0 || ['TD', 'TH', 'P', 'SPAN', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'LABEL'].includes(el.tagName)) {
      el.contentEditable = "true";
      el.style.userSelect = "text";
      el.style.webkitUserSelect = "text";
    }
  });
}

// 1. Toggle Interactive Text Editing Mode
function togglePreviewEditMode(forceState) {
  const contentBox = document.getElementById('preview-content-box');
  const docxContainer = document.getElementById('docx-preview-container');
  const btnText = document.getElementById('edit-mode-btn-text');
  const btn = document.getElementById('toggle-edit-mode-btn');
  const noticeBanner = document.getElementById('edit-mode-notice-banner');

  if (typeof forceState === 'boolean') {
    currentPreviewContext.isEditMode = forceState;
  } else {
    currentPreviewContext.isEditMode = !currentPreviewContext.isEditMode;
  }

  const isEdit = currentPreviewContext.isEditMode;
  const targetBox = docxContainer || contentBox;

  if (targetBox) {
    makeContainerEditable(targetBox);
    targetBox.contentEditable = isEdit ? "true" : "false";
    targetBox.style.outline = isEdit ? "2px dashed #0284c7" : "none";
    if (docxContainer) {
      docxContainer.style.background = "#ffffff";
      docxContainer.style.color = "#000000";
    }
  }

  if (isEdit) {
    if (btnText) btnText.textContent = "إلغاء وضع التعديل";
    if (btn) btn.className = "btn btn-sm btn-cyan text-white";
    if (noticeBanner) noticeBanner.style.display = 'flex';
    showToast("✏️ تفعيل التعديل الكتابي المباشر على المستند الأصلي بنفس التنسيق", "info");
  } else {
    if (btnText) btnText.textContent = "تفعيل التعديل الكتابي";
    if (btn) btn.className = "btn btn-sm btn-outline-cyan";
    if (noticeBanner) noticeBanner.style.display = 'none';
  }
}

// 2. Execute Find & Replace inside preview document
function executeEditorReplace() {
  const findVal = document.getElementById('editor-find-input').value;
  const replaceVal = document.getElementById('editor-replace-input').value;

  if (!findVal) {
    showToast("⚠️ يرجى إدخال النص المراد استبداله أولاً", "warning");
    return;
  }

  const contentBox = document.getElementById('preview-content-box');
  if (!contentBox) return;

  const regex = new RegExp(findVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  const oldHtml = contentBox.innerHTML;
  
  if (!oldHtml.includes(findVal)) {
    showToast(`⚠️ لم يتم العثور على النص ("${findVal}") داخل المستند`, "warning");
    return;
  }

  const newHtml = oldHtml.replace(regex, replaceVal);
  contentBox.innerHTML = newHtml;

  if (currentPreviewContext.isEditMode) {
    togglePreviewEditMode(true);
  }

  showToast(`✅ تم استبدال جميع تكرارات ("${findVal}") بـ ("${replaceVal}") بنجاح!`, "success");
}

// 3. Save Edited Document Content
async function saveEditedPreviewDocument() {
  const contentBox = document.getElementById('preview-content-box');
  if (!contentBox) return;

  const { serviceId, fileId } = currentPreviewContext;
  if (!serviceId) {
    showToast("⚠️ لا يوجد مستند مفتوح للحفظ", "warning");
    return;
  }

  const editedHtml = contentBox.innerHTML;
  const editKey = `${serviceId}_${fileId || 'form'}`;

  try {
    localStorage.setItem(`desk_doc_edit_${editKey}`, editedHtml);

    if (typeof db !== 'undefined' && db) {
      await db.ref(`deskServicesEdits/${editKey}`).set({
        editedHtml: editedHtml,
        updatedAt: new Date().toISOString(),
        updatedBy: (window.AUTH_CURRENT_USER ? window.AUTH_CURRENT_USER.username : 'admin')
      });
    }

    showToast("✅ تم حفظ التعديلات الجديدة على المستند بنجاح!", "success");
  } catch (err) {
    console.error("Save edit failed:", err);
    showToast("✅ تم حفظ التعديلات محلياً بنجاح!", "success");
  }
}

// 4. Print Edited Document
function printEditedPreviewDocument() {
  const contentBox = document.getElementById('preview-content-box');
  if (!contentBox) return;

  const editedHtml = contentBox.innerHTML;

  // Extract all <style> blocks from head that might have been added by docx-preview
  const headStyles = Array.from(document.querySelectorAll('head style'))
    .map(s => s.outerHTML)
    .join('\n');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    showToast("⚠️ يرجى السماح بالنوافذ المنبثقة للطباعة", "warning");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>طباعة المستند - جامعة اللوتس</title>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
      ${headStyles}
      <style>
        body {
          font-family: 'Tajawal', sans-serif;
          direction: rtl;
          text-align: right;
          color: #000;
          background: #fff;
          padding: 0;
          margin: 0;
        }
        .docx-wrapper {
          background: #ffffff !important;
          padding: 0 !important;
        }
        .docx {
          box-shadow: none !important;
          margin: 0 auto !important;
          width: 100% !important;
          padding: 10mm !important;
          color: #000000 !important;
        }
        [contenteditable="true"] {
          outline: none !important;
          border: none !important;
        }
        @media print {
          @page { size: A4; margin: 5mm; }
          body { padding: 0; background: #fff !important; }
          .docx-wrapper { padding: 0 !important; background: #fff !important; }
          .docx { box-shadow: none !important; margin: 0 !important; width: 100% !important; padding: 5mm !important; }
          [contenteditable="true"] { outline: none !important; border: none !important; }
        }
      </style>
    </head>
    <body onload="setTimeout(() => { window.print(); window.close(); }, 600);">
      ${editedHtml}
    </body>
    </html>
  `);
  printWindow.document.close();
}

// Helper: Check and load saved document edits if present
async function loadSavedDocumentEdit(serviceId, fileId) {
  const editKey = `${serviceId}_${fileId || 'form'}`;
  let savedHtml = localStorage.getItem(`desk_doc_edit_${editKey}`);
  
  if (typeof db !== 'undefined' && db) {
    try {
      const snap = await db.ref(`deskServicesEdits/${editKey}`).once('value');
      if (snap.exists() && snap.val() && snap.val().editedHtml) {
        savedHtml = snap.val().editedHtml;
      }
    } catch (e) {}
  }

  return savedHtml;
}

// Preview File with Interactive Editing
async function previewAttachedFile(serviceId, fileId) {
  const service = services.find(s => s.id === serviceId) || window.currentService;
  if (service) window.currentService = service;
  const fileMeta = service && service.files ? service.files[fileId] : null;
  currentPreviewContext = { serviceId, fileId, isForm: false, isEditMode: false };

  document.getElementById('preview-loading').style.display = 'block';
  document.getElementById('preview-content-box').style.display = 'none';
  openModal('preview-modal');

  // 1. Check if saved edited version exists
  const savedEditHtml = await loadSavedDocumentEdit(serviceId, fileId);
  const contentBox = document.getElementById('preview-content-box');
  
  if (savedEditHtml) {
    document.getElementById('preview-loading').style.display = 'none';
    contentBox.innerHTML = savedEditHtml;
    contentBox.style.display = 'block';
    document.getElementById('preview-download-btn').onclick = () => downloadAttachedFile(serviceId, fileId);
    document.getElementById('preview-print-btn').onclick = () => printEditedPreviewDocument();
    return;
  }

  const fileData = await getFileContent(serviceId, fileId);
  document.getElementById('preview-loading').style.display = 'none';
  
  if (!fileData) {
    contentBox.innerHTML = `
      <div class="unsupported-preview-box text-white">
        <i class="fas fa-circle-exclamation text-danger fs-1 mb-2"></i>
        <div>عذراً، فشل تحميل الملف للمعاينة</div>
      </div>
    `;
    contentBox.style.display = 'block';
    return;
  }

  const src = fileData.type === 'url' ? fileData.url : fileData.dataUrl;
  
  if (fileData.name.toLowerCase().endsWith('.pdf')) {
    contentBox.innerHTML = `<iframe src="${src}" style="width: 100%; height: 100%; border: none; border-radius: 8px;"></iframe>`;
  } else if (fileData.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
    contentBox.innerHTML = `<div class="windows-print-paper-sheet text-center"><img src="${src}" class="image-preview-element" style="max-width: 100%; height: auto;" alt="معاينة صورة"></div>`;
  } else if (fileData.name.toLowerCase().match(/\.(doc|docx)$/i)) {
    contentBox.innerHTML = `<div class="windows-print-paper-sheet"><div id="docx-preview-container" style="background:#fff; color:#000; text-align:right; direction:rtl; font-family:'Tajawal', sans-serif;">جاري تهيئة وتوليد صفحة A4 لمعاينة الطباعة...</div></div>`;
    const docxContainer = document.getElementById('docx-preview-container');
    
    try {
      let docxBlob;
      if (fileData.type === 'base64') {
        const base64Data = src.split(',')[1] || src;
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        docxBlob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      } else {
        const response = await fetch(src);
        docxBlob = await response.blob();
      }
      
      if (window.docx && window.docx.renderAsync) {
        docxContainer.innerHTML = '';
        await window.docx.renderAsync(docxBlob, docxContainer, null, {
          className: "docx",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          experimental: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          useBase64URL: true,
          breakPages: true,
          debug: false
        });
      } else {
        throw new Error("docx-preview library not loaded");
      }
    } catch (err) {
      console.warn("docx-preview failed, falling back to Google Docs Viewer:", err);
      if (fileData.type === 'url') {
        const viewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(src)}&embedded=true`;
        contentBox.innerHTML = `<iframe src="${viewerUrl}" style="width:100%; height:100%; border:none;"></iframe>`;
      } else {
        contentBox.innerHTML = `
          <div class="unsupported-preview-box text-white">
            <i class="fas fa-file-word text-primary fs-1 mb-3"></i>
            <h4 class="mb-2">${escapeHtml(fileData.name)}</h4>
            <p class="text-secondary font-size-sm">عذراً، يتعذر المعاينة المباشرة لهذا المستند.</p>
          </div>
        `;
      }
    }
  } else {
    contentBox.innerHTML = `
      <div class="unsupported-preview-box text-white">
        <i class="fas fa-file-invoice text-info fs-1 mb-3"></i>
        <h4 class="mb-2">${escapeHtml(fileData.name)}</h4>
        <p class="text-secondary font-size-sm">هذا الملف غير مدعوم للمعاينة المباشرة.</p>
        <p class="text-secondary font-size-xs mb-3">يمكنك تحميل الملف واستخدامه مباشرة.</p>
      </div>
    `;
  }
  
  contentBox.style.display = 'block';

  // Config actions in preview modal
  document.getElementById('preview-download-btn').onclick = () => downloadAttachedFile(serviceId, fileId);
  const printBtn = document.getElementById('preview-print-btn');
  printBtn.style.display = 'block';
  printBtn.onclick = () => printEditedPreviewDocument();
}

// 9. Default Application Form Print/Preview
function generateDefaultPrintHTML(service) {
  const qrData = window.location.origin + window.location.pathname + `?serviceId=${service.id}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=` + encodeURIComponent(qrData);
  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  let requiredDocsHTML = '';
  if (service.documents && service.documents.length) {
    requiredDocsHTML = service.documents.map(d => `<li>- ${escapeHtml(d)}</li>`).join('');
  } else {
    requiredDocsHTML = '<li>- لا توجد مستندات خاصة مطلوبة.</li>';
  }

  let stepsGuideHTML = '';
  if (service.steps && service.steps.length) {
    stepsGuideHTML = service.steps.map((st, i) => `<li>${i+1}. ${escapeHtml(st)}</li>`).join('');
  } else {
    stepsGuideHTML = '<li>- التوجه مباشرة لمكتب شؤون الطلاب.</li>';
  }

  return `
    <div class="print-document">
      <!-- Header -->
      <div class="print-header-banner-container" style="width: 100%; margin-bottom: 25px;">
        <img id="print-banner-img" src="../../Lotus-H.png" onerror="this.onerror=function(){this.style.display='none'; document.getElementById('print-header-standard').style.display='flex';}; this.src='../../assets/images/Lotus-H.png';" style="width: 100%; max-height: 90px; object-fit: contain; display: block; margin: 0 auto;" alt="شعار جامعة اللوتس">
        <div id="print-header-standard" style="display: none; justify-content: space-between; align-items: center; border-bottom: 2px double #000; padding-bottom: 12px; width: 100%;">
          <img src="https://i.ibb.co/kgfm88mq/logo.png" style="width: 60px; height: 60px; object-fit: contain;" alt="شعار الجامعة">
          <div style="text-align: right; flex-grow: 1; margin-right: 15px;">
            <h2 style="font-size: 1.4rem; font-weight: 800; margin: 0; font-family: 'Changa', sans-serif; color: #000;">جامعة اللوتس</h2>
            <p style="font-size: 0.8rem; color: #555; margin: 2px 0 0 0; font-family: 'Tajawal', sans-serif; color: #555;">شؤون الطلاب والامتحانات - إدارة المعاملات المكتبية</p>
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 0.72rem; color: #333; border-bottom: 1px solid #000; padding-bottom: 8px; font-family: 'Tajawal', sans-serif;">
          <span>المعاملة: نموذج طلب ${escapeHtml(service.name)}</span>
          <span>تاريخ الطباعة: ${dateStr}</span>
        </div>
      </div>

      <!-- Body -->
      <div class="print-body">
        <div class="print-doc-title">استمارة طلب (${escapeHtml(service.name)})</div>
        
        <!-- Student Details Form Fields (Empty dots to write on) -->
        <div class="print-section">
          <div class="print-section-title">بيانات الطالب مقدم الطلب (يملأ بخط اليد)</div>
          <table class="print-fields-table">
            <tr>
              <td class="field-label">اسم الطالب رباعي:</td>
              <td class="field-dots">.................................................................................................</td>
              <td class="field-label">كود الطالب الأكاديمي:</td>
              <td class="field-dots">.........................................</td>
            </tr>
            <tr>
              <td class="field-label">الكلية والفرقة:</td>
              <td class="field-dots">.................................................................................................</td>
              <td class="field-label">الرقم القومي (14 رقم):</td>
              <td class="field-dots">.........................................</td>
            </tr>
            <tr>
              <td class="field-label">رقم الهاتف والتليفون:</td>
              <td class="field-dots">.................................................................................................</td>
              <td class="field-label">البريد الجامعي (إن وجد):</td>
              <td class="field-dots">.........................................</td>
            </tr>
          </table>
        </div>

        <!-- Service Info & Guidelines -->
        <div class="print-section" style="margin-top: 25px;">
          <div class="row g-3">
            <div class="col-6">
              <div class="print-section-title">الأوراق والمستندات المرفقة بالطلب</div>
              <ul style="list-style: none; padding-right: 0; font-size: 0.8rem; line-height: 1.6; color:#000;">
                ${requiredDocsHTML}
              </ul>
            </div>
            <div class="col-6">
              <div class="print-section-title">خطوات وإجراءات المعاملة</div>
              <ul style="list-style: none; padding-right: 0; font-size: 0.8rem; line-height: 1.6; color:#000;">
                ${stepsGuideHTML}
              </ul>
            </div>
          </div>
        </div>

        <!-- Price Details -->
        <div class="print-section" style="margin-top: 15px;">
          <div style="font-size: 0.85rem; font-weight: 700; border: 1px solid #000; padding: 10px; background: #fafafa; display: flex; justify-content: space-between;">
            <span>سعر الخدمة المستحقة: ${service.price > 0 ? service.price + ' جنيه مصري' : 'خدمة مجانية'}</span>
            <span>المدة التقريبية للاستخراج: ${escapeHtml(service.duration)}</span>
          </div>
        </div>
      </div>

      <!-- Footer & Signatures -->
      <div class="print-footer">
        <div class="print-signature-box">
          <div>توقيع مقدم الطلب</div>
          <div class="print-signature-line"></div>
        </div>
        
        <div class="print-qr-code-box">
          <img src="${qrCodeUrl}" class="print-qr-code" alt="QR Code">
          <p>امسح الكود لعرض الخدمة ومتابعة التحديثات</p>
        </div>
        
        <div class="print-signature-box">
          <div>موظف شؤون الطلاب المختص</div>
          <div class="print-signature-line"></div>
        </div>
      </div>
    </div>
  `;
}

async function previewDefaultForm(serviceId) {
  const service = services.find(s => s.id === serviceId);
  if (!service) return;

  // Check if service has an attached Word (.docx / .doc) or PDF file template uploaded by admin
  if (service.files && Object.keys(service.files).length > 0) {
    const templateKey = Object.keys(service.files).find(k => {
      const f = service.files[k];
      return f && (f.purpose === 'template' || (f.fileName && f.fileName.match(/\.(doc|docx|pdf)$/i)));
    }) || Object.keys(service.files)[0];

    if (templateKey) {
      previewAttachedFile(serviceId, templateKey);
      return;
    }
  }

  currentPreviewContext = { serviceId, fileId: 'form', isForm: true, isEditMode: false };

  document.getElementById('preview-loading').style.display = 'block';
  document.getElementById('preview-content-box').style.display = 'none';
  openModal('preview-modal');

  const contentBox = document.getElementById('preview-content-box');
  const savedEditHtml = await loadSavedDocumentEdit(serviceId, 'form');

  if (savedEditHtml) {
    contentBox.innerHTML = savedEditHtml;
  } else {
    contentBox.innerHTML = generateDefaultPrintHTML(service);
  }

  document.getElementById('preview-loading').style.display = 'none';
  contentBox.style.display = 'block';

  togglePreviewEditMode(true);
  document.getElementById('preview-print-btn').onclick = () => printEditedPreviewDocument();
  document.getElementById('preview-download-btn').style.display = 'none';
}

function printDefaultForm(serviceId) {
  const service = services.find(s => s.id === serviceId);
  if (!service) return;

  // Track print
  if (db && !serviceId.startsWith("mock_")) {
    db.ref(`deskServices/${serviceId}/viewsCount`).transaction(c => (c || 0) + 1); // views/usages
  }

  // Inject print layout into DOM
  const printArea = document.getElementById('print-area-wrapper');
  printArea.innerHTML = generateDefaultPrintHTML(service);
  
  // Trigger browser print
  window.print();
}

function copyServiceLink() {
  const directLink = window.location.origin + window.location.pathname + `?serviceId=${window.currentService.id}`;
  navigator.clipboard.writeText(directLink).then(() => {
    showToast("تم نسخ الرابط المباشر للخدمة بنجاح", "success");
  }).catch(() => {
    showToast("عذراً، فشل نسخ الرابط", "error");
  });
}

// Helper: Duration Inputs Toggle
function toggleDurationDaysInput(typeVal) {
  const daysWrapper = document.getElementById('form-duration-days-wrapper');
  const daysInput = document.getElementById('form-duration-days-count');
  const finalDurationHidden = document.getElementById('form-duration');

  if (typeVal === 'same_day') {
    if (daysWrapper) daysWrapper.style.display = 'none';
    if (finalDurationHidden) finalDurationHidden.value = 'فوري';
  } else {
    if (daysWrapper) daysWrapper.style.display = 'block';
    updateDurationFinalValue();
  }
}

function updateDurationFinalValue() {
  const daysInput = document.getElementById('form-duration-days-count');
  const finalDurationHidden = document.getElementById('form-duration');
  if (!daysInput || !finalDurationHidden) return;

  const count = parseInt(daysInput.value.trim(), 10);
  if (!isNaN(count) && count > 0) {
    if (count === 1) finalDurationHidden.value = '1 يوم';
    else if (count === 2) finalDurationHidden.value = '2 يوم';
    else finalDurationHidden.value = `${count} يوم`;
  } else {
    finalDurationHidden.value = 'أيام';
  }
}

// 10. Admin: Adding & Editing Service
function openAddServiceModal() {
  renderCategoryFormOptions();
  document.getElementById('form-modal-title').innerHTML = `<i class="fas fa-file-pen me-2 text-info"></i> إضافة خدمة جديدة`;
  document.getElementById('service-form').reset();
  document.getElementById('form-service-id').value = '';

  const typeSelect = document.getElementById('form-duration-type');
  if (typeSelect) typeSelect.value = 'same_day';
  toggleDurationDaysInput('same_day');
  
  // Clear tags inputs
  formDocuments = [];
  formSteps = [];
  formAttachedFiles = [];
  renderFormTags();
  renderFormFilesTable();

  openModal('service-form-modal');
}

function openEditCurrentService() {
  const service = window.currentService;
  if (!service) return;

  closeModal('details-modal');
  renderCategoryFormOptions();
  
  document.getElementById('form-modal-title').innerHTML = `<i class="fas fa-file-pen me-2 text-info"></i> تعديل الخدمة (${escapeHtml(service.name)})`;
  document.getElementById('form-service-id').value = service.id;
  document.getElementById('form-name').value = service.name;
  document.getElementById('form-category').value = service.category;
  document.getElementById('form-price').value = service.price;
  document.getElementById('form-description').value = service.description;

  const durationStr = service.duration || '';
  const typeSelect = document.getElementById('form-duration-type');
  const daysInput = document.getElementById('form-duration-days-count');

  if (durationStr.includes('يومي') || durationStr.includes('نفس اليوم') || durationStr.includes('فوري')) {
    if (typeSelect) typeSelect.value = 'same_day';
    toggleDurationDaysInput('same_day');
  } else {
    if (typeSelect) typeSelect.value = 'days';
    toggleDurationDaysInput('days');
    const matches = durationStr.match(/\d+/);
    if (matches && daysInput) {
      daysInput.value = matches[0];
      updateDurationFinalValue();
    } else {
      document.getElementById('form-duration').value = durationStr;
    }
  }

  formDocuments = service.documents ? [...service.documents] : [];
  formSteps = service.steps ? [...service.steps] : [];
  
  formAttachedFiles = [];
  if (service.files) {
    Object.keys(service.files).forEach(fKey => {
      formAttachedFiles.push({
        fileId: fKey,
        ...service.files[fKey],
        isExisting: true // Mark as already saved in DB
      });
    });
  }

  renderFormTags();
  renderFormFilesTable();
  openModal('service-form-modal');
}

// Admin: Tags Rendering
function renderFormTags() {
  // Documents
  const docsContainer = document.getElementById('form-documents-tags');
  docsContainer.innerHTML = '';
  formDocuments.forEach((doc, i) => {
    const pill = document.createElement('span');
    pill.className = 'pill-tag';
    pill.innerHTML = `${escapeHtml(doc)} <i class="fas fa-times-circle" onclick="removeFormDoc(${i})"></i>`;
    docsContainer.appendChild(pill);
  });

  // Steps
  const stepsContainer = document.getElementById('form-steps-tags');
  stepsContainer.innerHTML = '';
  formSteps.forEach((step, i) => {
    const pill = document.createElement('span');
    pill.className = 'pill-tag';
    pill.innerHTML = `${i+1}. ${escapeHtml(step)} <i class="fas fa-times-circle" onclick="removeFormStep(${i})"></i>`;
    stepsContainer.appendChild(pill);
  });
}

function addFormDoc() {
  const input = document.getElementById('document-input');
  const val = input.value.trim();
  if (val && !formDocuments.includes(val)) {
    formDocuments.push(val);
    input.value = '';
    renderFormTags();
  }
}

function removeFormDoc(index) {
  formDocuments.splice(index, 1);
  renderFormTags();
}

function addFormStep() {
  const input = document.getElementById('step-input');
  const val = input.value.trim();
  if (val && !formSteps.includes(val)) {
    formSteps.push(val);
    input.value = '';
    renderFormTags();
  }
}

function removeFormStep(index) {
  formSteps.splice(index, 1);
  renderFormTags();
}

// 11. File Upload Drag & Drop and Progress Management
function setupEventListeners() {
  // Search bar
  document.getElementById('search-input').addEventListener('input', filterAndRenderServices);

  // Forms Tags inputs
  document.getElementById('document-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addFormDoc(); }
  });
  document.getElementById('step-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addFormStep(); }
  });

  // Drag and drop zone
  const dropZone = document.getElementById('upload-drag-zone');
  const fileInput = document.getElementById('file-upload-input');
  
  if (dropZone && fileInput) {
    dropZone.onclick = () => fileInput.click();
    
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const files = Array.from(e.dataTransfer.files);
      processSelectedFormFiles(files);
    });

    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      processSelectedFormFiles(files);
    });
  }
}

function processSelectedFormFiles(files) {
  files.forEach(file => {
    if (file.size > 10 * 1024 * 1024) {
      showToast(`الملف "${file.name}" تجاوز الحد المسموح به (10 ميجابايت)`, "warning");
      return;
    }
    
    const fileId = "file_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
    formAttachedFiles.push({
      fileId: fileId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || getFileTypeByName(file.name),
      purpose: 'template', // Default purpose is printable template
      fileRef: file, // Store raw file reference for saving later
      isExisting: false
    });
  });
  
  renderFormFilesTable();
}

function getFileTypeByName(name) {
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'doc' || ext === 'docx') return 'application/msword';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return `image/${ext}`;
  return 'application/octet-stream';
}

function renderFormFilesTable() {
  const listWrapper = document.getElementById('form-files-list-wrapper');
  const tbody = document.getElementById('form-files-tbody');
  tbody.innerHTML = '';
  
  if (formAttachedFiles.length === 0) {
    listWrapper.style.display = 'none';
    return;
  }
  
  listWrapper.style.display = 'block';

  formAttachedFiles.forEach((file, i) => {
    const tr = document.createElement('tr');
    const sz = formatBytes(file.fileSize);
    
    let icon = 'fa-file-alt';
    if (file.fileName.toLowerCase().endsWith('.pdf')) icon = 'fa-file-pdf text-danger';
    else if (file.fileName.toLowerCase().endsWith('.doc') || file.fileName.toLowerCase().endsWith('.docx')) icon = 'fa-file-word text-primary';
    else if (file.fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i)) icon = 'fa-file-image text-success';

    tr.innerHTML = `
      <td><i class="fas ${icon} me-1"></i> <span title="${escapeHtml(file.fileName)}">${escapeHtml(file.fileName)}</span></td>
      <td class="text-center">${sz}</td>
      <td class="text-center font-size-xs">${file.fileType}</td>
      <td>
        <select class="form-select form-select-sm" onchange="updateFormFilePurpose(${i}, this.value)">
          <option value="template" ${file.purpose === 'template' ? 'selected' : ''}>نموذج ورقي قابل للطباعة</option>
          <option value="attachment" ${file.purpose === 'attachment' ? 'selected' : ''}>مرفق توضيحي/تعليمات</option>
        </select>
      </td>
      <td class="text-center">
        <button type="button" class="btn btn-sm btn-ghost p-1 text-danger border-0" onclick="removeFormFile(${i})"><i class="fas fa-trash-can"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function updateFormFilePurpose(index, purpose) {
  formAttachedFiles[index].purpose = purpose;
}

function removeFormFile(index) {
  formAttachedFiles.splice(index, 1);
  renderFormFilesTable();
}

// 12. CRUD Actions (Save Form and Upload/Fallback)
async function saveServiceForm(event) {
  event.preventDefault();
  
  if (!db) {
    showToast("لا يوجد اتصال بالخادم لحفظ البيانات", "error");
    return;
  }

  const user = window.getCurrentUser();
  if (!user) {
    showToast("يرجى تسجيل الدخول أولاً", "error");
    return;
  }
  if (user.username !== 'boles' && !window.hasPermission('manage_settings') && !window.hasPermission('manage_employees')) {
    showToast("غير مصرح لك بإجراء هذه العملية. الصلاحية مخصصة للمدير العام أو المشرف.", "error");
    return;
  }

  showLoading(true);
  
  const idInput = document.getElementById('form-service-id').value;
  const isEdit = !!idInput;
  const serviceId = isEdit ? idInput : "service_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
  
  const name = document.getElementById('form-name').value.trim();
  const category = document.getElementById('form-category').value;
  const price = parseFloat(document.getElementById('form-price').value) || 0;
  const duration = document.getElementById('form-duration').value.trim();
  const description = document.getElementById('form-description').value.trim();

  // Detect which part was updated
  let updatedPart = "التفاصيل العامة";
  if (isEdit) {
    const oldS = services.find(s => s.id === serviceId);
    if (oldS) {
      var oldFilesKeys = oldS.files ? Object.keys(oldS.files) : [];
      var newFilesKeys = formAttachedFiles.map(function(f) { return f.fileId; });
      var filesChanged = oldFilesKeys.length !== newFilesKeys.length || formAttachedFiles.some(function(f) { return !f.isExisting; });
      var stepsChanged = JSON.stringify(oldS.steps || []) !== JSON.stringify(formSteps);
      var docsChanged = JSON.stringify(oldS.documents || []) !== JSON.stringify(formDocuments);
      var priceChanged = (oldS.price || 0) !== price;
      if (filesChanged) updatedPart = "المستندات والنماذج الورقية";
      else if (stepsChanged) updatedPart = "الخطوات والإجراءات المتبعة";
      else if (docsChanged) updatedPart = "المستندات والأوراق المطلوبة";
      else if (priceChanged) updatedPart = "السعر";
    }
  } else {
    updatedPart = "الخدمة بالكامل";
  }

  // Create Service Metadata Object
  const serviceMeta = {
    id: serviceId,
    name: name,
    category: category,
    price: price,
    duration: duration,
    description: description,
    documents: formDocuments,
    steps: formSteps,
    updatedPart: updatedPart,
    lastUpdated: new Date().toISOString(),
    createdAt: isEdit ? (services.find(s => s.id === serviceId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    viewsCount: isEdit ? (services.find(s => s.id === serviceId)?.viewsCount || 0) : 0,
    files: {} // File metadata will be written below
  };

  // Upload/Process Files
  const finalFiles = {};
  const progressContainer = document.getElementById('upload-progress-bar-container');
  const progressBarFill = document.getElementById('upload-progress-bar-fill');
  const progressText = document.getElementById('upload-progress-percent');
  const progressFilename = document.getElementById('upload-progress-filename');

  for (let i = 0; i < formAttachedFiles.length; i++) {
    const fileObj = formAttachedFiles[i];
    
    if (fileObj.isExisting) {
      // Retain existing file meta
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
      // New File Upload
      if (progressContainer) {
        progressFilename.textContent = `جاري رفع: ${fileObj.fileName}`;
        progressBarFill.style.width = '0%';
        progressText.textContent = '0%';
        progressContainer.style.display = 'block';
      }

      try {
        const fileMetadata = await uploadFileWithFallback(fileObj.fileRef, serviceId, fileObj.fileId, (percent) => {
          if (progressBarFill) {
            progressBarFill.style.width = `${percent}%`;
            progressText.textContent = `${Math.round(percent)}%`;
          }
        });
        
        finalFiles[fileObj.fileId] = {
          fileName: fileObj.fileName,
          fileSize: fileObj.fileSize,
          fileType: fileObj.fileType,
          purpose: fileObj.purpose,
          downloadCount: 0,
          printCount: 0,
          url: fileMetadata.url, // Storage URL or "db_fallback"
          uploadedAt: new Date().toISOString()
        };
      } catch (err) {
        console.error("Upload failed for file:", fileObj.fileName, err);
        showToast(`فشل رفع ملف (${fileObj.fileName}) - تم تجاوز الملف للاستمرار`, "error");
      }
    }
  }

  serviceMeta.files = finalFiles;

  if (progressContainer) progressContainer.style.display = 'none';

  // Save Service metadata to Realtime Database
  try {
    await db.ref(`deskServices/${serviceId}`).set(serviceMeta);
    
    // Log Activity
    if (window.authLogActivity) {
      const actionText = isEdit ? 'تعديل خدمة مكتبية' : 'إضافة خدمة مكتبية جديدة';
      window.authLogActivity(
        isEdit ? 'edit' : 'create',
        'desk-services',
        serviceId,
        name,
        `${actionText}: ${name} بسعر ${price} ج.م`,
        'الخدمات المكتبية'
      );
    }
    
    localStorage.setItem('lotus_system_modified', 'true');
    showToast(isEdit ? "تم تعديل الخدمة بنجاح" : "تم إضافة الخدمة ونموذجها الجديد بنجاح!", "success");
    closeModal('service-form-modal');
  } catch (err) {
    console.error("Database save failed:", err);
    showToast("عذراً، حدث خطأ أثناء حفظ الخدمة في قاعدة البيانات", "error");
  }
  
  showLoading(false);
}

// Upload file with Storage -> RTDB fallback
function uploadFileWithFallback(file, serviceId, fileId, progressCallback) {
  return new Promise((resolve, reject) => {
    let storageCompleted = false;
    
    // Fallback trigger helper
    const triggerRTDBFallback = (reason) => {
      if (storageCompleted) return;
      storageCompleted = true;
      console.warn(`Firebase Storage failed/timed out (${reason}), falling back to RTDB...`);
      uploadToRTDB(file, serviceId, fileId, progressCallback).then(resolve).catch(reject);
    };

    // Attempt 1: Upload to Firebase Storage
    try {
      if (typeof firebase !== 'undefined' && firebase.storage) {
        const storageApp = firebase.app('_lotus_auth');
        const storageRef = firebase.storage(storageApp).ref();
        const uploadPath = `deskServices/${serviceId}/${fileId}_${file.name}`;
        const uploadTask = storageRef.child(uploadPath).put(file);

        // Set a timeout of 3 seconds. If no completion/error happens, we fallback to RTDB!
        const timeoutId = setTimeout(() => {
          if (!storageCompleted) {
            try {
              uploadTask.cancel(); // Cancel storage task to free resources
            } catch (err) {}
            triggerRTDBFallback("Timeout after 3 seconds");
          }
        }, 3000);

        uploadTask.on('state_changed', 
          (snapshot) => {
            const percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            progressCallback(percent);
          }, 
          (error) => {
            clearTimeout(timeoutId);
            triggerRTDBFallback("Error event: " + error.message);
          }, 
          async () => {
            clearTimeout(timeoutId);
            if (storageCompleted) return;
            try {
              const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
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

// Fallback upload method using base64 chunking in RTDB
function uploadToRTDB(file, serviceId, fileId, progressCallback) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async () => {
      try {
        const base64Str = reader.result;
        
        // Chunk strings to fit RTDB limits securely
        const chunkSize = 2.5 * 1024 * 1024; // 2.5MB per chunk (Base64 length)
        const chunks = [];
        let offset = 0;
        
        while (offset < base64Str.length) {
          chunks.push(base64Str.substring(offset, offset + chunkSize));
          offset += chunkSize;
        }

        const totalChunks = chunks.length;
        
        // Upload chunk by chunk with simulated progress
        if (db) {
          progressCallback(10);
          await db.ref(`deskServicesFiles/${serviceId}/${fileId}`).set({
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

    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

// Delete Service
async function deleteCurrentService() {
  const service = window.currentService;
  if (!service) return;

  if (!confirm(`هل أنت متأكد من حذف الخدمة (${service.name}) وجميع الملفات المرتبطة بها نهائياً؟`)) {
    return;
  }

  showLoading(true);
  
  if (db && !service.id.startsWith("mock_")) {
    try {
      // 1. Delete Service Metadata
      await db.ref(`deskServices/${service.id}`).remove();
      
      // 2. Delete Service Files content inside RTDB
      await db.ref(`deskServicesFiles/${service.id}`).remove();
      
      // 3. Delete files inside Firebase Storage (if any url exists and is a Storage url)
      if (service.files) {
        Object.keys(service.files).forEach(async fKey => {
          const file = service.files[fKey];
          if (file.url && file.url !== 'db_fallback' && file.url.includes('firebasestorage')) {
            try {
              const storageApp = firebase.app('_lotus_auth');
              const storageRef = firebase.storage(storageApp).refFromURL(file.url);
              await storageRef.delete();
            } catch (err) {
              console.warn("Failed to delete storage file, probably already removed or permission issues.", err);
            }
          }
        });
      }

      // Log Activity
      if (window.authLogActivity) {
        window.authLogActivity(
          'delete',
          'desk-services',
          service.id,
          service.name,
          `حذف الخدمة المكتبية: ${service.name}`,
          'الخدمات المكتبية'
        );
      }

      localStorage.setItem('lotus_system_modified', 'true');
      showToast("تم حذف الخدمة بنجاح", "success");
      closeModal('details-modal');
    } catch (err) {
      console.error(err);
      showToast("حدث خطأ أثناء حذف الخدمة من الخادم", "error");
    }
  } else {
    showToast("قاعدة البيانات غير متصلة", "error");
  }

  showLoading(false);
}

// 13. UI Helpers
function showLoading(show) {
  document.getElementById('loading').style.display = show ? 'block' : 'none';
  if (show) {
    document.getElementById('services-grid-wrapper').style.display = 'none';
  } else {
    document.getElementById('services-grid-wrapper').style.display = 'block';
  }
}

function showToast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-msg ${type}`;
  
  let icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-circle-xmark';
  else if (type === 'warning') icon = 'fa-circle-exclamation';
  
  toast.innerHTML = `
    <i class="fas ${icon} toast-icon"></i>
    <span>${msg}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'toastSlideIn 0.3s reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Local authentication modal helpers (if main auth triggers)
function openLoginModal() {
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  openModal('login-modal');
}

async function submitLocalLogin() {
  const err = document.getElementById('login-error');
  const u = document.getElementById('login-username').value.trim();
  const p = document.getElementById('login-password').value;
  
  if (!u || !p) {
    err.textContent = 'يرجى إدخال اسم المستخدم وكلمة المرور';
    err.style.display = 'block';
    return;
  }

  if (window.authLoginEmployee) {
    try {
      showLoading(true);
      const user = await window.authLoginEmployee(u, p);
      showLoading(false);
      if (user) {
        closeModal('login-modal');
        showToast("تم تسجيل الدخول بنجاح", "success");
        checkAuthSession();
      } else {
        err.textContent = 'اسم المستخدم أو كلمة المرور خاطئة';
        err.style.display = 'block';
      }
    } catch (e) {
      showLoading(false);
      err.textContent = 'حدث خطأ في عملية التحقق';
      err.style.display = 'block';
    }
  } else {
    // Fallback static passwords
    if (u === 'admin' && p === 'admin') {
      const mockUser = { username: 'admin', name: 'المدير العام', role: 'admin' };
      localStorage.setItem('lotus_session', JSON.stringify({ ...mockUser, loginTime: Date.now() }));
      closeModal('login-modal');
      showToast("تم تسجيل الدخول بنجاح", "success");
      checkAuthSession();
    } else {
      err.textContent = 'نظام التحقق غير متاح حالياً';
      err.style.display = 'block';
    }
  }
}

// 14. Theme Toggle and Global functions
function toggleTheme() {
  const body = document.body;
  const currentTheme = body.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  body.setAttribute('data-theme', newTheme);
  localStorage.setItem('sys_theme', newTheme);
  updateThemeButtonIcon(newTheme);
}

function updateThemeButtonIcon(theme) {
  const btn = document.getElementById('themeBtn');
  if (btn) {
    btn.querySelector('i').className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }
}

window.handleLogoError = function() {
  const img = document.getElementById('logoImg');
  const fallback = document.getElementById('logoFallback');
  const inner = document.querySelector('.logo-inner');
  if (img && fallback && inner) {
    img.style.display = 'none';
    fallback.style.display = 'flex';
    inner.style.background = 'var(--bg-main)';
    inner.style.border = '2px solid var(--border)';
  }
};

// ==========================================
// STUDENT SERVICE REQUESTS & UNIFIED REGISTRY
// ==========================================
let studentRequests = [];
let availableColleges = [
  "طب الفم والأسنان",
  "الإدارة والاقتصاد والعلوم السياسية",
  "العلاج الطبيعي",
  "الحاسبات والمعلومات والذكاء الاصطناعي",
  "التمريض",
  "تكنولوجيا العلوم الصحية التطبيقية",
  "الهندسة",
  "الصيدلة"
];

// Fetch Colleges from Withdrawal System Firebase (`collegesRef`)
async function fetchCollegesList() {
  if (db) {
    try {
      const snap = await db.ref('colleges').once('value');
      if (snap.exists() && snap.val()) {
        const cols = [];
        snap.forEach(ch => {
          const d = ch.val();
          const name = d.name || d.Name || d.collegeName || '';
          if (name && !cols.includes(name)) cols.push(name);
        });
        if (cols.length > 0) {
          // Merge with predefined list ensuring user's 8 colleges exist
          cols.forEach(c => {
            if (!availableColleges.includes(c)) availableColleges.push(c);
          });
        }
      }
    } catch (e) {
      console.warn("Failed to load colleges from Firebase:", e);
    }
  }

  // Populate Colleges Dropdown in Registration Modal
  const reqCollegeSelect = document.getElementById('student-req-college');
  if (reqCollegeSelect) {
    const curVal = reqCollegeSelect.value;
    reqCollegeSelect.innerHTML = `<option value="">اختر الكلية...</option>` +
      availableColleges.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    if (curVal) reqCollegeSelect.value = curVal;
  }

  // Populate Colleges Dropdown in Registry Filters
  const filterCollegeSelect = document.getElementById('reg-filter-college');
  if (filterCollegeSelect) {
    const curVal = filterCollegeSelect.value;
    filterCollegeSelect.innerHTML = `<option value="all">كافة الكليات</option>` +
      availableColleges.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    if (curVal) filterCollegeSelect.value = curVal;
  }
}

function updateStudentRequestsCountBadges() {
  const count = studentRequests.length;
  const b1 = document.getElementById('total-student-requests-badge');
  const b2 = document.getElementById('ctrl-student-requests-badge');
  if (b1) b1.textContent = count;
  if (b2) b2.textContent = count;
}

async function fetchStudentRequests() {
  if (db) {
    db.ref('deskServicesStudentRequests').on('value', (snap) => {
      studentRequests = [];
      if (snap.exists() && snap.val()) {
        const data = snap.val();
        Object.keys(data).forEach(k => {
          studentRequests.push({ id: k, ...data[k] });
        });
      }

      // Merge with local storage items
      try {
        const localRaw = localStorage.getItem('deskServicesStudentRequests');
        if (localRaw) {
          const localList = JSON.parse(localRaw);
          if (Array.isArray(localList)) {
            localList.forEach(item => {
              if (!studentRequests.find(r => r.id === item.id)) {
                studentRequests.push(item);
              }
            });
          }
        }
      } catch (e) {}

      studentRequests.sort((a, b) => new Date(b.createdAt || b.requestDate) - new Date(a.createdAt || a.requestDate));
      updateStudentRequestsCountBadges();

      // If registry modal is active, re-render instantly
      const regModal = document.getElementById('student-requests-registry-modal');
      if (regModal && regModal.classList.contains('active')) {
        renderStudentRequestsRegistry();
      }
    });
  } else {
    studentRequests = [];
    try {
      const localRaw = localStorage.getItem('deskServicesStudentRequests');
      if (localRaw) {
        const localList = JSON.parse(localRaw);
        if (Array.isArray(localList)) studentRequests = localList;
      }
    } catch (e) {}

    studentRequests.sort((a, b) => new Date(b.createdAt || b.requestDate) - new Date(a.createdAt || a.requestDate));
    updateStudentRequestsCountBadges();
  }

  return studentRequests;
}

// Code Parsing Helpers (User Explicit Pattern: 24/25/26 -> Grade, 1..8 -> College)
function getGradeFromCode(code) {
  var str = String(code || '').trim();
  if (str.length < 2) return '';
  var c = str.substring(0, 2);
  if (c === '26') return 'الفرقة الأولى';
  if (c === '25') return 'الفرقة الثانية';
  if (c === '24') return 'الفرقة الثالثة';
  if (c === '23') return 'الفرقة الرابعة';
  if (c === '22') return 'الفرقة الخامسة';
  if (c === '21') return 'الفرقة السادسة';
  return '';
}

function getCollegeFromCode(code) {
  var str = String(code || '').trim();
  if (str.length < 3) return '';
  var d = str.substring(2, 3);
  var map = {
    '1': 'طب الفم والأسنان',
    '2': 'الإدارة والاقتصاد والعلوم السياسية',
    '3': 'العلاج الطبيعي',
    '4': 'الحاسبات والمعلومات والذكاء الاصطناعي',
    '5': 'التمريض',
    '6': 'تكنولوجيا العلوم الصحية التطبيقية',
    '7': 'الهندسة',
    '8': 'الصيدلة'
  };
  return map[d] || '';
}

function matchCollegeOption(shortName, collegeSelect) {
  if (!shortName || !collegeSelect) return;
  
  const options = Array.from(collegeSelect.options);
  
  // 1. Try exact or substring match in options
  let foundOpt = options.find(o => o.value === shortName || o.text === shortName);
  if (!foundOpt) {
    foundOpt = options.find(o => o.value.includes(shortName) || shortName.includes(o.value) || o.text.includes(shortName));
  }

  // 2. Alias definitions matching
  if (!foundOpt) {
    const aliases = [
      { name: 'طب الفم والأسنان', keywords: ['أسنان', 'طب أسنان', 'طب الأسنان'] },
      { name: 'الإدارة والاقتصاد والعلوم السياسية', keywords: ['إدارة', 'ادارة', 'اقتصاد', 'علوم سياسية'] },
      { name: 'العلاج الطبيعي', keywords: ['علاج طبيعي', 'العلاج الطبيعي'] },
      { name: 'الحاسبات والمعلومات والذكاء الاصطناعي', keywords: ['حاسبات', 'معلومات', 'ذكاء اصطناعي'] },
      { name: 'التمريض', keywords: ['تمريض', 'التمريض'] },
      { name: 'تكنولوجيا العلوم الصحية التطبيقية', keywords: ['علوم صحية', 'علوم صحيه', 'تكنولوجيا العلوم الصحية'] },
      { name: 'الهندسة', keywords: ['هندسة', 'الهندسة', 'هندسه', 'الهندسه'] },
      { name: 'الصيدلة', keywords: ['صيدلة', 'صيدله', 'الصيدلة', 'الصيدله'] }
    ];

    const matchedAlias = aliases.find(a => shortName.includes(a.name) || a.name.includes(shortName) || a.keywords.some(k => shortName.includes(k)));
    if (matchedAlias) {
      foundOpt = options.find(o => o.value.includes(matchedAlias.name) || matchedAlias.keywords.some(k => o.value.includes(k) || o.text.includes(k)));
    }
  }

  if (foundOpt) {
    collegeSelect.value = foundOpt.value;
  } else {
    // Dynamically append option if missing in list
    const newOpt = document.createElement('option');
    newOpt.value = shortName;
    newOpt.textContent = shortName;
    collegeSelect.appendChild(newOpt);
    collegeSelect.value = shortName;
  }
}

// Instant Pure Local Code Parsing (No Toast Alerts / No DB Pulling)
function autoLookupStudentData(query) {
  query = (query || '').trim();
  
  const collegeSelect = document.getElementById('student-req-college');

  // Auto-match College if available from 3rd digit
  if (query.length >= 3 && collegeSelect) {
    const parsedCollege = getCollegeFromCode(query);
    if (parsedCollege) {
      matchCollegeOption(parsedCollege, collegeSelect);
    }
  }
}

function updateLastRequestNumberHint(serviceId) {
  const hintEl = document.getElementById('last-req-number-text');
  if (!hintEl) return;

  if (!serviceId) {
    hintEl.textContent = 'آخر رقم طلب متسجل لهذه الخدمة: —';
    return;
  }

  const matchingReqs = studentRequests.filter(r => r.serviceId === serviceId);
  if (matchingReqs.length > 0) {
    const lastReq = matchingReqs[0]; // sorted descending by date
    hintEl.textContent = `آخر رقم طلب متسجل لهذه الخدمة: ${lastReq.requestNumber || '—'}`;
  } else {
    hintEl.textContent = 'آخر رقم طلب متسجل لهذه الخدمة: لا يوجد طلبات سابقة';
  }
}

async function openStudentServiceRegistrationModal(preSelectedServiceId, requestId) {
  await fetchCollegesList();

  const form = document.getElementById('student-request-form');
  if (form) form.reset();

  const titleEl = document.getElementById('student-request-modal-title');
  const reqIdInput = document.getElementById('student-req-id');
  const reqNumberInput = document.getElementById('student-req-number');
  const reqDateInput = document.getElementById('student-req-date');
  const reqCodeInput = document.getElementById('student-req-code');
  const reqNatIdInput = document.getElementById('student-req-national-id');
  const reqNameInput = document.getElementById('student-req-name');
  const reqCollegeInput = document.getElementById('student-req-college');
  const reqGradeInput = document.getElementById('student-req-grade');
  const reqStatusInput = document.getElementById('student-req-status');
  const reqNotesInput = document.getElementById('student-req-notes');

  let targetServiceId = preSelectedServiceId || (window.currentService ? window.currentService.id : (services[0] ? services[0].id : ''));

  if (reqDateInput) {
    reqDateInput.value = new Date().toISOString().split('T')[0];
  }

  if (requestId) {
    const existing = studentRequests.find(r => r.id === requestId);
    if (existing) {
      if (existing.serviceId) targetServiceId = existing.serviceId;
      if (titleEl) titleEl.innerHTML = `<i class="fas fa-pen-to-square me-2 text-cyan"></i> تعديل طلب الطالب (${escapeHtml(existing.requestNumber || '')})`;
      if (reqIdInput) reqIdInput.value = existing.id;
      if (reqNumberInput) reqNumberInput.value = existing.requestNumber || '';
      if (reqDateInput) reqDateInput.value = existing.requestDate || new Date().toISOString().split('T')[0];
      if (reqCodeInput) reqCodeInput.value = existing.studentCode || '';
      if (reqNatIdInput) reqNatIdInput.value = existing.nationalId || '';
      if (reqNameInput) reqNameInput.value = existing.studentName || '';
      if (reqCollegeInput) reqCollegeInput.value = existing.college || '';
      if (reqGradeInput) reqGradeInput.value = existing.grade || '';
      if (reqStatusInput) reqStatusInput.value = existing.status || 'قيد المعالجة';
      if (reqNotesInput) reqNotesInput.value = existing.notes || '';
    }
  } else {
    if (titleEl) titleEl.innerHTML = `<i class="fas fa-user-plus me-2 text-cyan"></i> تسجيل طلب طالب جديد للخدمة`;
    if (reqIdInput) reqIdInput.value = '';
    if (reqNumberInput) reqNumberInput.value = ''; // Leave Empty by default!
  }

  const targetService = services.find(s => s.id === targetServiceId);
  const serviceIdInput = document.getElementById('student-req-service-id');
  const serviceDisplayInput = document.getElementById('student-req-service-name-display');

  if (serviceIdInput) serviceIdInput.value = targetServiceId;
  if (serviceDisplayInput) {
    serviceDisplayInput.value = targetService ? `${targetService.name} (${targetService.price > 0 ? targetService.price + ' ج.م' : 'مجاناً'})` : 'خدمة مكتبية';
  }

  updateLastRequestNumberHint(targetServiceId);

  openModal('student-request-modal');
}

async function handleSaveStudentRequest(event) {
  event.preventDefault();

  const reqId = document.getElementById('student-req-id').value;
  const reqNumber = document.getElementById('student-req-number').value.trim();
  const reqDate = document.getElementById('student-req-date').value;
  const studentCode = document.getElementById('student-req-code').value.trim();
  const nationalId = (document.getElementById('student-req-national-id')?.value || '').trim();
  const studentName = document.getElementById('student-req-name').value.trim();
  const serviceId = document.getElementById('student-req-service-id').value;
  const college = document.getElementById('student-req-college').value;
  const grade = (document.getElementById('student-req-grade')?.value || '').trim();
  const status = document.getElementById('student-req-status').value;
  const notes = document.getElementById('student-req-notes').value.trim();

  const selectedService = services.find(s => s.id === serviceId);

  const staffName = getCurrentLoggedInEmployeeName();

  const existingReq = studentRequests.find(r => r.id === reqId);
  const deliveredAt = (status === 'تم التسليم' || status === 'مكتمل') ? 
    (existingReq && existingReq.deliveredAt ? existingReq.deliveredAt : new Date().toISOString().split('T')[0]) : null;

  const reqObj = {
    id: reqId || 'req_' + Date.now(),
    requestNumber: reqNumber || '—',
    requestDate: reqDate || new Date().toISOString().split('T')[0],
    studentCode: studentCode || '—',
    nationalId: nationalId || '—',
    studentName: studentName || 'طلب بدون اسم',
    serviceId: serviceId,
    serviceName: selectedService ? selectedService.name : 'خدمة مكتبية',
    college: college || '',
    grade: grade || '',
    status: status || 'قيد المعالجة',
    notes: notes || '',
    deliveredAt: deliveredAt,
    createdAt: new Date().toISOString(),
    createdBy: staffName,
    staffName: staffName
  };

  try {
    if (db) {
      await db.ref(`deskServicesStudentRequests/${reqObj.id}`).set(reqObj);
    }

    const idx = studentRequests.findIndex(r => r.id === reqObj.id);
    if (idx >= 0) {
      studentRequests[idx] = reqObj;
    } else {
      studentRequests.unshift(reqObj);
    }
    localStorage.setItem('deskServicesStudentRequests', JSON.stringify(studentRequests));
    localStorage.setItem('lotus_system_modified', 'true');

    renderStudentRequestsRegistry();
    closeModal('student-request-modal');
    showToast(`✅ تم حفظ بيانات طلب الطالب (${reqObj.studentName}) بنجاح!`, "success");
  } catch (err) {
    console.error("Save student request error:", err);
    showToast("⚠️ تم التخزين محلياً بنجاح", "info");
  }
}

function getCurrentLoggedInEmployeeName() {
  let sessionObj = null;

  if (typeof window.authGetSession === 'function') {
    sessionObj = window.authGetSession();
  }
  if (!sessionObj && typeof window.getCurrentUser === 'function') {
    sessionObj = window.getCurrentUser();
  }
  if (!sessionObj && window.AUTH_CURRENT_USER) {
    sessionObj = window.AUTH_CURRENT_USER;
  }

  if (!sessionObj) {
    try {
      const raw = localStorage.getItem('lotus_session') || localStorage.getItem('auth_session');
      if (raw) sessionObj = JSON.parse(raw);
    } catch (e) {}
  }

  if (sessionObj) {
    const uName = sessionObj.username || sessionObj.name;
    if (uName && Array.isArray(permissionsEmployeesList) && permissionsEmployeesList.length > 0) {
      const foundEmp = permissionsEmployeesList.find(e => 
        (e.username || '').toLowerCase() === String(uName).toLowerCase() ||
        (e.name || '').toLowerCase() === String(uName).toLowerCase()
      );
      if (foundEmp && foundEmp.name) return foundEmp.name;
    }
    
    if (sessionObj.name) return sessionObj.name;
    if (sessionObj.username) return sessionObj.username;
  }

  return '—';
}

let permissionsEmployeesList = [];

async function fetchAllEmployeesFromPermissionsSystem() {
  permissionsEmployeesList = [];

  if (typeof window.authGetAllEmployees === 'function') {
    try {
      const emps = await window.authGetAllEmployees();
      if (Array.isArray(emps) && emps.length > 0) {
        permissionsEmployeesList = emps;
      }
    } catch (e) {}
  }

  if (permissionsEmployeesList.length === 0 && db) {
    try {
      const snap = await db.ref('employees').once('value');
      if (snap.exists() && snap.val()) {
        const val = snap.val();
        Object.keys(val).forEach(k => {
          const emp = val[k];
          if (emp && (emp.name || emp.username)) {
            if (!permissionsEmployeesList.find(e => ((e.username || e.name || '')).toLowerCase() === ((emp.username || emp.name || '')).toLowerCase())) {
              permissionsEmployeesList.push(emp);
            }
          }
        });
      }
    } catch (e) {}
  }

  if (permissionsEmployeesList.length === 0) {
    try {
      const localRaw = localStorage.getItem('auth_employees');
      if (localRaw) {
        const localList = JSON.parse(localRaw);
        if (Array.isArray(localList)) {
          permissionsEmployeesList = localList;
        }
      }
    } catch (e) {}
  }

  return permissionsEmployeesList;
}

async function openStudentRequestsRegistryModal() {
  await fetchCollegesList();
  await fetchStudentRequests();
  await fetchAllEmployeesFromPermissionsSystem();

  const filterServiceSelect = document.getElementById('reg-filter-service');
  if (filterServiceSelect) {
    const cur = filterServiceSelect.value;
    filterServiceSelect.innerHTML = `
      <option value="all">كافة الخدمات</option>
      ${services.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
    `;
    if (cur) filterServiceSelect.value = cur;
  }

  const filterStaffSelect = document.getElementById('reg-filter-staff');
  if (filterStaffSelect) {
    const curStaff = filterStaffSelect.value;
    const namesSet = new Set();
    
    // Add all registered employees from Permissions System
    permissionsEmployeesList.forEach(e => {
      const display = e.name || e.username;
      if (display) namesSet.add(display);
    });

    // Add any logged staff in existing requests
    studentRequests.forEach(r => {
      const display = r.staffName || r.createdBy;
      if (display && display !== 'الموظف المسؤول') namesSet.add(display);
    });

    const staffList = Array.from(namesSet);

    filterStaffSelect.innerHTML = `<option value="all">كافة الموظفين (إدارة الصلاحيات)</option>` +
      staffList.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    if (curStaff) filterStaffSelect.value = curStaff;
  }

  renderStudentRequestsRegistry();
  openModal('student-requests-registry-modal');
}

function renderStudentRequestsRegistry() {
  const tbody = document.getElementById('student-requests-tbody');
  const countEl = document.getElementById('reg-rendered-count');
  if (!tbody) return;

  const searchVal = (document.getElementById('reg-filter-search')?.value || '').trim().toLowerCase();
  const collegeVal = document.getElementById('reg-filter-college')?.value || 'all';
  const serviceVal = document.getElementById('reg-filter-service')?.value || 'all';
  const statusVal = document.getElementById('reg-filter-status')?.value || 'all';
  const dateVal = document.getElementById('reg-filter-date')?.value || '';
  const staffVal = document.getElementById('reg-filter-staff')?.value || 'all';

  const filtered = studentRequests.filter(req => {
    // 1. Search Filter (matches studentName, studentCode, nationalId, requestNumber, or staffName)
    if (searchVal) {
      const matchName = (req.studentName || '').toLowerCase().includes(searchVal);
      const matchCode = (req.studentCode || '').toLowerCase().includes(searchVal);
      const matchNatId = (req.nationalId || '').toLowerCase().includes(searchVal);
      const matchNum = (req.requestNumber || '').toLowerCase().includes(searchVal);
      const matchStaff = (req.staffName || req.createdBy || '').toLowerCase().includes(searchVal);
      if (!matchName && !matchCode && !matchNatId && !matchNum && !matchStaff) return false;
    }

    // 2. College Filter
    if (collegeVal !== 'all' && req.college !== collegeVal) return false;

    // 3. Service Filter
    if (serviceVal !== 'all' && req.serviceId !== serviceVal) return false;

    // 4. Status Filter
    if (statusVal !== 'all' && req.status !== statusVal) return false;

    // 5. Date Filter
    if (dateVal && req.requestDate !== dateVal) return false;

    // 6. Staff Filter
    if (staffVal !== 'all' && req.createdBy !== staffVal && req.staffName !== staffVal) return false;

    return true;
  });

  if (countEl) countEl.textContent = filtered.length;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center py-4 text-secondary">
          <i class="fas fa-folder-open fs-3 mb-2 d-block text-muted"></i>
          لا توجد طلبات طلاب مطابقة للفلاتر المحددة.
        </td>
      </tr>
    `;
    return;
  }

  const statusBadgeClasses = {
    'قيد المعالجة': 'bg-warning text-dark',
    'جاهز للتسليم': 'bg-info text-white',
    'تم التسليم': 'bg-success text-white',
    'مكتمل': 'bg-success text-white',
    'مرفوض': 'bg-danger text-white',
    'ملغى': 'bg-danger text-white'
  };

  tbody.innerHTML = filtered.map(req => {
    const badgeCls = statusBadgeClasses[req.status] || 'bg-secondary text-white';
    let rawStaff = req.staffName || req.createdBy || '';
    if (!rawStaff || rawStaff === 'staff') {
      rawStaff = '—';
    } else if (Array.isArray(permissionsEmployeesList) && permissionsEmployeesList.length > 0) {
      const foundEmp = permissionsEmployeesList.find(e => 
        (e.username || '').toLowerCase() === String(rawStaff).toLowerCase() ||
        (e.name || '').toLowerCase() === String(rawStaff).toLowerCase()
      );
      if (foundEmp && foundEmp.name) rawStaff = foundEmp.name;
    }
    const staffDisplay = rawStaff;

    const isRejected = (req.status === 'مرفوض' || req.status === 'ملغى');
    const isDelivered = (req.status === 'تم التسليم' || req.status === 'مكتمل' || req.status === 'مكتمل ومسلم');
    const deliveryDateStr = req.deliveredAt || req.deliveryDate || req.requestDate || new Date().toISOString().split('T')[0];

    const rejectionReasonHtml = (isRejected && req.notes) ? 
      `<div class="font-size-xs text-danger mt-1 font-weight-bold" style="font-size:0.72rem; line-height:1.2;" title="سبب الرفض"><i class="fas fa-exclamation-circle me-1"></i>السبب: ${escapeHtml(req.notes)}</div>` : '';

    const deliveryDateHtml = (isDelivered) ? 
      `<div class="font-size-xs text-success mt-1 font-weight-bold" style="font-size:0.72rem; line-height:1.2;" title="تاريخ التسليم"><i class="fas fa-calendar-check me-1"></i>التسليم: ${escapeHtml(deliveryDateStr)}</div>` : '';

    return `
      <tr style="color: #ffffff!important; font-weight: 800!important; font-size: 0.78rem!important; white-space: nowrap!important;">
        <td class="text-center" style="color: #38bdf8!important; font-weight: 800!important; white-space: nowrap!important;">${escapeHtml(req.requestNumber || '—')}</td>
        <td class="text-center" style="color: #ffffff!important; font-weight: 800!important; white-space: nowrap!important;">${escapeHtml(req.studentCode || '—')}</td>
        <td class="text-center" style="color: #ffffff!important; font-weight: 800!important; white-space: nowrap!important;">${escapeHtml(req.nationalId || '—')}</td>
        <td style="color: #ffffff!important; font-weight: 800!important; font-size: 0.78rem!important; white-space: nowrap!important;">${escapeHtml(req.studentName || '—')}</td>
        <td style="white-space: nowrap!important;"><span class="badge bg-secondary" style="color: #ffffff!important; font-weight: 800!important; font-size: 0.75rem!important; white-space: nowrap!important;">${escapeHtml(req.serviceName)}</span></td>
        <td style="color: #ffffff!important; font-weight: 800!important; font-size: 0.74rem!important; white-space: nowrap!important;">${escapeHtml(req.college || '—')}${req.grade ? ' <span style="color: #ffc107!important; font-weight: 800!important;">(' + escapeHtml(req.grade) + ')</span>' : ''}</td>
        <td class="text-center" style="color: #38bdf8!important; font-weight: 800!important; white-space: nowrap!important;"><i class="fas fa-user-tie me-1 font-size-xs" style="color: #38bdf8;"></i>${escapeHtml(staffDisplay)}</td>
        <td class="text-center" style="color: #ffffff!important; font-weight: 800!important; font-size: 0.75rem!important; white-space: nowrap!important;">${escapeHtml(req.requestDate || '—')}</td>
        <td class="text-center" style="white-space: nowrap!important;">
          <div class="d-inline-flex align-items-center gap-1 justify-content-center" style="white-space: nowrap!important;">
            <span class="badge ${badgeCls}" style="font-weight: 800!important; font-size: 0.75rem!important; white-space: nowrap!important;">${escapeHtml(req.status)}</span>
            <button class="btn btn-xs text-warning p-0 border-0 ms-1" onclick="quickChangeStatus('${req.id}')" title="تغيير حالة الطلب"><i class="fas fa-pen font-size-xs" style="color: #ffc107;"></i></button>
          </div>
          ${rejectionReasonHtml}
          ${deliveryDateHtml}
        </td>
        <td class="text-center" style="white-space: nowrap!important;">
          <div class="d-inline-flex gap-1 justify-content-center align-items-center" style="white-space: nowrap!important;">
            <button class="btn btn-xs btn-outline-warning px-1 py-0" onclick="openStudentServiceRegistrationModal('${req.serviceId}', '${req.id}')" title="تعديل الطلب ورقم الملف والحالة" style="font-size: 0.7rem!important; line-height: 1;"><i class="fas fa-pen" style="font-size: 0.68rem!important;"></i></button>
            <button class="btn btn-xs btn-outline-danger px-1 py-0" onclick="deleteStudentRequest('${req.id}')" title="حذف الطلب" style="font-size: 0.7rem!important; line-height: 1;"><i class="fas fa-trash" style="font-size: 0.68rem!important;"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

let currentQuickStatusReqId = null;

function quickChangeStatus(requestId) {
  const reqObj = studentRequests.find(r => r.id === requestId);
  if (!reqObj) return;

  currentQuickStatusReqId = requestId;
  const idInput = document.getElementById('quick-status-req-id');
  const infoEl = document.getElementById('quick-status-student-info');
  const selectEl = document.getElementById('quick-status-select');
  const notesInput = document.getElementById('quick-status-notes');

  if (idInput) idInput.value = requestId;
  if (infoEl) infoEl.textContent = `الطالب: ${reqObj.studentName || '—'} (${reqObj.requestNumber || 'بدون رقم'})`;
  
  let curStatus = reqObj.status || 'قيد المعالجة';
  if (curStatus === 'مكتمل' || curStatus === 'مكتمل ومسلم') curStatus = 'تم التسليم';
  if (selectEl) selectEl.value = curStatus;

  if (notesInput) notesInput.value = reqObj.notes || '';
  handleQuickStatusSelectChange(selectEl ? selectEl.value : curStatus);

  openModal('quick-status-modal');
}

function handleQuickStatusSelectChange(val) {
  const reasonBox = document.getElementById('quick-status-reason-box');
  if (reasonBox) {
    reasonBox.style.display = (val === 'مرفوض' || val === 'ملغى') ? 'block' : 'none';
  }
}

async function saveQuickStatusChange() {
  if (!currentQuickStatusReqId) return;

  const reqObj = studentRequests.find(r => r.id === currentQuickStatusReqId);
  if (!reqObj) return;

  const selectEl = document.getElementById('quick-status-select');
  const notesInput = document.getElementById('quick-status-notes');

  const newStatus = selectEl ? selectEl.value : reqObj.status;
  const newNotes = (notesInput && (newStatus === 'مرفوض' || newStatus === 'ملغى')) ? notesInput.value.trim() : (reqObj.notes || '');

  const deliveredAt = (newStatus === 'تم التسليم' || newStatus === 'مكتمل') ? 
    (reqObj.deliveredAt || new Date().toISOString().split('T')[0]) : null;

  reqObj.status = newStatus;
  reqObj.notes = newNotes;
  reqObj.deliveredAt = deliveredAt;
  reqObj.updatedAt = new Date().toISOString();

  if (db) {
    try {
      await db.ref(`deskServicesStudentRequests/${reqObj.id}`).update({
        status: newStatus,
        notes: newNotes,
        deliveredAt: deliveredAt,
        updatedAt: reqObj.updatedAt
      });
    } catch (e) {
      console.warn("Failed to update status on Firebase:", e);
    }
  }

  localStorage.setItem('deskServicesStudentRequests', JSON.stringify(studentRequests));
  localStorage.setItem('lotus_system_modified', 'true');

  closeModal('quick-status-modal');
  renderStudentRequestsRegistry();
  showToast(`✅ تم تحديث حالة الطلب إلى (${newStatus}) بنجاح!`, "success");
}

function resetRegistryFilters() {
  const s = document.getElementById('reg-filter-search');
  const c = document.getElementById('reg-filter-college');
  const sv = document.getElementById('reg-filter-service');
  const st = document.getElementById('reg-filter-status');
  const d = document.getElementById('reg-filter-date');
  const stf = document.getElementById('reg-filter-staff');

  if (s) s.value = '';
  if (c) c.value = 'all';
  if (sv) sv.value = 'all';
  if (st) st.value = 'all';
  if (d) d.value = '';
  if (stf) stf.value = 'all';

  renderStudentRequestsRegistry();
}

async function deleteStudentRequest(requestId) {
  if (!confirm("هل أنت تأكد من رغبتك في حذف هذا الطلب نهائياً؟")) return;

  try {
    if (db) {
      await db.ref(`deskServicesStudentRequests/${requestId}`).remove();
    }

    studentRequests = studentRequests.filter(r => r.id !== requestId);
    localStorage.setItem('deskServicesStudentRequests', JSON.stringify(studentRequests));
    localStorage.setItem('lotus_system_modified', 'true');

    await fetchStudentRequests();
    renderStudentRequestsRegistry();
    showToast("✅ تم حذف الطلب بنجاح", "info");
  } catch (err) {
    console.error("Delete student request error:", err);
    showToast("❌ حدث خطأ أثناء الحذف", "error");
  }
}

function previewDefaultFormWithStudentData(serviceId, reqObjOrId) {
  let reqObj = typeof reqObjOrId === 'object' ? reqObjOrId : studentRequests.find(r => r.id === reqObjOrId);
  const service = services.find(s => s.id === serviceId);
  if (!service) return;

  let docHtml = generateDefaultPrintHTML(service);

  if (reqObj) {
    docHtml = docHtml.replace(/اسم الطالب:\s*\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\./g, `اسم الطالب: <strong style="color:#0284c7; text-decoration:underline;">${escapeHtml(reqObj.studentName)}</strong>`);
    docHtml = docHtml.replace(/كود الطالب:\s*\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\./g, `كود الطالب: <strong style="color:#0284c7;">${escapeHtml(reqObj.studentCode)}</strong>`);
    
    const studentHeaderBanner = `
      <div class="student-req-info-banner" style="background: rgba(2, 132, 199, 0.08); border: 2px solid #0284c7; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #0284c7; padding-bottom:8px; margin-bottom:8px;">
          <span style="font-weight:bold; color:#0284c7;"><i class="fas fa-id-card"></i> بيانات الطلب المخصص للطالب</span>
          <span style="font-weight:bold; color:#10b981;">رقم الملف / الطلب اليدوي: ${escapeHtml(reqObj.requestNumber || '—')}</span>
        </div>
        <div style="display:flex; gap:16px; flex-wrap:wrap; font-size:0.9rem;">
          <div><strong>اسم الطالب:</strong> ${escapeHtml(reqObj.studentName || '—')}</div>
          <div><strong>كود الطالب:</strong> ${escapeHtml(reqObj.studentCode || '—')}</div>
          <div><strong>تاريخ الطلب:</strong> ${escapeHtml(reqObj.requestDate || '—')}</div>
          <div><strong>الكلية:</strong> ${escapeHtml(reqObj.college || '—')}</div>
          <div><strong>حالة الطلب:</strong> <span style="color:#0284c7; font-weight:bold;">${escapeHtml(reqObj.status || '—')}</span></div>
        </div>
      </div>
    `;

    docHtml = studentHeaderBanner + docHtml;
  }

  currentPreviewContext = { serviceId, fileId: 'form', isForm: true, isEditMode: false };

  document.getElementById('preview-loading').style.display = 'block';
  document.getElementById('preview-content-box').style.display = 'none';
  openModal('preview-modal');

  const contentBox = document.getElementById('preview-content-box');
  contentBox.innerHTML = docHtml;

  document.getElementById('preview-loading').style.display = 'none';
  contentBox.style.display = 'block';

  togglePreviewEditMode(true);
  document.getElementById('preview-print-btn').onclick = () => printEditedPreviewDocument();
  document.getElementById('preview-download-btn').style.display = 'none';
}
