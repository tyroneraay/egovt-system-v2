// ============================================================
// BARANGAY DOC SYSTEM — Main App Controller
// ============================================================

let currentPage = 'dashboard';
let cachedDocTypes = [];
let currentFilter = 'all';

// ── Status Config ──
const STATUS_CONFIG = {
  pending:          { label: 'Pending',           color: 'amber',   icon: 'lucide-clock' },
  under_review:     { label: 'Under Review',      color: 'blue',    icon: 'lucide-eye' },
  awaiting_payment: { label: 'Awaiting Payment',  color: 'violet',  icon: 'lucide-credit-card' },
  paid:             { label: 'Paid',              color: 'cyan',    icon: 'lucide-check' },
  processing:       { label: 'Processing',        color: 'orange',  icon: 'lucide-refresh-cw' },
  ready:            { label: 'Ready for Release',  color: 'emerald', icon: 'lucide-check-circle' },
  released:         { label: 'Released',           color: 'green',   icon: 'lucide-download' },
  rejected:         { label: 'Rejected',           color: 'red',     icon: 'lucide-x-circle' },
};

const STATUS_TRANSITIONS = {
  pending: ['under_review', 'rejected'],
  under_review: ['awaiting_payment', 'paid', 'rejected'],
  awaiting_payment: ['paid', 'rejected'],
  paid: ['processing'],
  processing: ['ready'],
  ready: ['released'],
  released: [],
  rejected: [],
};

const EDITABLE_STATUSES = ['under_review', 'processing'];

// ── Toast ──
function showToast(message, type = 'info') {
  const colors = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };
  const icons = { success: 'lucide-check-circle', error: 'lucide-x-circle', info: 'lucide-bell' };
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast flex items-center gap-2.5 px-5 py-3.5 rounded-xl border shadow-lg ${colors[type]} max-w-sm`;
  toast.innerHTML = `<i class="${icons[type]} w-[18px] h-[18px]"></i><span class="text-sm font-medium">${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4000);
}

// ── Modal ──
function showModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

// ── Status Badge ──
function statusBadge(status) {
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return '';
  const colorMap = {
    amber: 'bg-amber-100 text-amber-700', blue: 'bg-blue-100 text-blue-700',
    violet: 'bg-violet-100 text-violet-700', cyan: 'bg-cyan-100 text-cyan-700',
    orange: 'bg-orange-100 text-orange-700', emerald: 'bg-emerald-100 text-emerald-700',
    green: 'bg-green-100 text-green-700', red: 'bg-red-100 text-red-700',
  };
  return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold ${colorMap[cfg.color]}"><i class="${cfg.icon} w-3 h-3"></i>${cfg.label}</span>`;
}

// ── Helpers ──
function peso(n) { return `₱${Number(n).toLocaleString('en-PH')}`; }
function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function fmtDate(d) { return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }); }

// ── Navigation ──
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}

const NAV_CONFIG = {
  admin: [
    { key: 'dashboard', icon: 'lucide-home', label: 'Dashboard' },
    { key: 'requests', icon: 'lucide-file-text', label: 'All Requests' },
    { key: 'released', icon: 'lucide-folder-check', label: 'Released Documents' },
    { key: 'staff', icon: 'lucide-users', label: 'Staff' },
    { key: 'verification', icon: 'lucide-user-check', label: 'Verification' },
    { key: 'audit', icon: 'lucide-activity', label: 'Audit Logs' },
    { key: 'notifications', icon: 'lucide-bell', label: 'Notifications' },
    { key: 'profile', icon: 'lucide-settings', label: 'Profile' },
  ],
  staff: [
    { key: 'dashboard', icon: 'lucide-home', label: 'Dashboard' },
    { key: 'requests', icon: 'lucide-file-text', label: 'Requests' },
    { key: 'verification', icon: 'lucide-user-check', label: 'Verification' },
    { key: 'notifications', icon: 'lucide-bell', label: 'Notifications' },
    { key: 'profile', icon: 'lucide-settings', label: 'Profile' },
  ],
  resident: [
    { key: 'dashboard', icon: 'lucide-home', label: 'Dashboard' },
    { key: 'requests', icon: 'lucide-file-text', label: 'My Requests' },
    { key: 'new-request', icon: 'lucide-plus', label: 'New Request' },
    { key: 'notifications', icon: 'lucide-bell', label: 'Notifications' },
    { key: 'profile', icon: 'lucide-settings', label: 'Profile' },
  ],
};

function buildNav() {
  const user = AppAPI.getUser();
  if (!user) return;
  const items = NAV_CONFIG[user.role] || [];
  const nav = document.getElementById('nav-links');
  nav.innerHTML = items.map((item) => `
    <button onclick="navigateTo('${item.key}')" 
      class="sidebar-link ${currentPage === item.key ? 'active' : ''} relative w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition">
      <i class="${item.icon} w-[18px] h-[18px]"></i>
      <span>${item.label}</span>
      ${item.key === 'notifications' ? '<span id="nav-notif-count" class="ml-auto"></span>' : ''}
    </button>
  `).join('');
}

function navigateTo(page) {
  currentPage = page;
  buildNav();
  renderPage();
  // Close mobile sidebar
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('open');
}

// ── Page Renderer ──
async function renderPage() {
  const user = AppAPI.getUser();
  const content = document.getElementById('page-content');
  const items = NAV_CONFIG[user.role] || [];
  const pageItem = items.find((i) => i.key === currentPage) || items[0];

  document.getElementById('page-title').textContent = pageItem?.label || 'Dashboard';
  document.getElementById('page-icon').className = `${pageItem?.icon || 'lucide-home'} w-[18px] h-[18px] text-gray-500`;

  content.innerHTML = '<div class="flex items-center justify-center py-20"><div class="w-6 h-6 border-2 border-brgy-500 border-t-transparent rounded-full animate-spin"></div></div>';

  try {
    switch (currentPage) {
      case 'dashboard': await renderDashboard(content, user); break;
      case 'requests': await renderRequests(content, user); break;
      case 'new-request': await renderNewRequest(content, user); break;
      case 'verification': await renderVerification(content, user); break;
      case 'staff': await renderStaffMgmt(content, user); break;
      case 'released': await renderReleasedDocuments(content, user); break;
      case 'audit': await renderAuditLogs(content, user); break;
      case 'notifications': await renderNotifications(content, user); break;
      case 'profile': await renderProfile(content, user); break;
      default: await renderDashboard(content, user);
    }
  } catch (err) {
    content.innerHTML = `<div class="text-center py-20"><p class="text-red-500 font-medium">${err.message}</p><button onclick="renderPage()" class="mt-4 text-sm text-brgy-500 hover:underline">Retry</button></div>`;
  }
}

// ── Dashboard ──
async function renderDashboard(el, user) {

  // ── RESIDENT DASHBOARD (no admin API call) ──
  if (user.role === 'resident') {
    const profile = user.profile || {};
    const isRejected = profile.verification_status === 'rejected';
    const isPending = !user.is_verified && !isRejected;

    // Show verification banner for unverified/rejected residents
    if (!user.is_verified) {
      el.innerHTML = `
        <div class="animate-fade">
          <h2 class="text-2xl font-extrabold text-gray-900 mb-1">Good day, ${profile.first_name || 'there'}!</h2>
          <p class="text-sm text-gray-500 mb-7">Welcome to Barangay Maharlika Document System</p>
          ${isRejected ? `
            <div class="bg-white rounded-2xl border-[1.5px] border-red-200 p-6 mb-6">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center"><i class="lucide-x-circle w-5 h-5 text-red-500"></i></div>
                <div>
                  <h3 class="text-base font-bold text-red-700">Account Verification Rejected</h3>
                  <p class="text-xs text-red-500 mt-0.5">Your ID verification was not approved</p>
                </div>
              </div>
              <div class="p-3 bg-red-50 rounded-lg mb-4">
                <p class="text-xs font-semibold text-red-600 mb-1">Reason:</p>
                <p class="text-sm text-red-700">${profile.rejection_reason || 'No reason provided'}</p>
              </div>
              <p class="text-xs text-gray-500 mb-3">Please go to your <strong>Profile</strong> page to re-upload a valid ID.</p>
              <button onclick="navigateTo('profile')" class="px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-red-700 transition">
                <i class="lucide-upload w-4 h-4"></i> Go to Profile & Re-upload ID
              </button>
            </div>
          ` : `
            <div class="bg-white rounded-2xl border-[1.5px] border-amber-200 p-6 mb-6">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center"><i class="lucide-clock w-5 h-5 text-amber-500"></i></div>
                <div>
                  <h3 class="text-base font-bold text-amber-700">Account Pending Verification</h3>
                  <p class="text-xs text-amber-500 mt-0.5">Staff is reviewing your submitted ID</p>
                </div>
              </div>
              <p class="text-sm text-gray-600">Your account is being verified by barangay staff. You'll be notified once approved and can then start submitting document requests.</p>
            </div>
          `}
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            ${statCard('lucide-file-text', 'Requests', 0, 'brgy')}
            ${statCard('lucide-clock', 'Active', 0, 'amber')}
            ${statCard('lucide-check-circle', 'Completed', 0, 'emerald')}
          </div>
        </div>
      `;
      return;
    }

    // Verified resident — show normal dashboard
    const reqs = await AppAPI.getRequests();
    const mine = reqs.data?.data || [];
    const active = mine.filter((r) => !['released', 'rejected'].includes(r.status));
    el.innerHTML = `
      <div class="animate-fade">
        <h2 class="text-xl sm:text-2xl font-extrabold text-gray-900 mb-1">Good day, ${profile.first_name || 'there'}!</h2>
        <p class="text-sm text-gray-500 mb-7">Here's an overview of your requests</p>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 mb-7">
          ${statCard('lucide-file-text', 'Total', mine.length, 'brgy')}
          ${statCard('lucide-clock', 'Active', active.length, 'amber')}
          ${statCard('lucide-check-circle', 'Completed', mine.filter((r) => r.status === 'released').length, 'emerald')}
          ${statCard('lucide-credit-card', 'To Pay', mine.filter((r) => r.status === 'awaiting_payment').length, 'violet')}
        </div>
        ${active.length > 0 ? `
          <h3 class="text-sm font-bold text-gray-900 mb-3">Active Requests</h3>
          <div class="space-y-2 mb-7">${active.map((r) => requestRow(r, user)).join('')}</div>
        ` : ''}
        <button onclick="navigateTo('new-request')" class="w-full py-3.5 bg-brgy-500 text-white rounded-xl font-semibold text-sm hover:bg-brgy-600 transition flex items-center justify-center gap-2">
          <i class="lucide-plus w-4 h-4"></i> Submit New Request
        </button>
      </div>
    `;
    return;
  }

  // ── STAFF/ADMIN DASHBOARD ──
  const stats = await AppAPI.getDashboardStats();
  const d = stats.data;
  const actionable = (d.statusCounts.pending || 0) + (d.statusCounts.under_review || 0);
  el.innerHTML = `
    <div class="animate-fade">
      <div class="flex items-start justify-between mb-7 flex-wrap gap-3">
        <div>
          <h2 class="text-xl sm:text-2xl font-extrabold text-gray-900">${user.role === 'admin' ? 'Admin' : 'Staff'} Dashboard</h2>
          <p class="text-sm text-gray-500 mt-1">Overview of all document requests</p>
        </div>
      </div>
      <div class="grid grid-cols-2 ${user.role === 'admin' ? 'xl:grid-cols-5 lg:grid-cols-3' : 'lg:grid-cols-4'} gap-2.5 sm:gap-3.5 mb-7">
        ${statCard('lucide-file-text', 'Total', d.totalRequests, 'brgy')}
        ${statCard('lucide-alert-circle', 'Needs Action', actionable, 'amber')}
        ${statCard('lucide-trending-up', 'Revenue', peso(d.revenue), 'violet')}
        ${statCard('lucide-check-circle', 'Released', d.statusCounts.released || 0, 'emerald')}
        ${user.role === 'admin' ? statCard('lucide-users', 'Staff', d.activeStaff, 'blue') : ''}
      </div>
      <!-- Pipeline -->
      <div class="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xs font-bold text-gray-900 uppercase tracking-wider">Pipeline</h3>
          <button onclick="navigateTo('requests')" class="text-xs text-gray-500 hover:text-brgy-500 font-medium flex items-center gap-1">View all <i class="lucide-arrow-right w-3 h-3"></i></button>
        </div>
        <div class="flex gap-1.5 overflow-x-auto pb-1">
          ${['pending', 'under_review', 'awaiting_payment', 'paid', 'processing', 'ready'].map((s) => {
            const c = STATUS_CONFIG[s];
            const count = d.statusCounts[s] || 0;
            const colorMap = { amber: 'bg-amber-50 text-amber-600 border-amber-200', blue: 'bg-blue-50 text-blue-600 border-blue-200', violet: 'bg-violet-50 text-violet-600 border-violet-200', cyan: 'bg-cyan-50 text-cyan-600 border-cyan-200', orange: 'bg-orange-50 text-orange-600 border-orange-200', emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200' };
            return `<div onclick="currentFilter='${s}';navigateTo('requests')" class="flex-1 min-w-[80px] p-3.5 rounded-xl text-center cursor-pointer border transition hover:shadow-sm ${count > 0 ? colorMap[c.color] : 'bg-gray-50 text-gray-300 border-gray-100'}">
              <div class="text-xl font-extrabold">${count}</div>
              <div class="text-[9px] font-bold uppercase tracking-wide mt-1">${c.label}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

// ── Requests Page ──
async function renderRequests(el, user) {
  const result = await AppAPI.getRequests({ status: currentFilter !== 'all' ? currentFilter : undefined });
  const requests = result.data?.data || [];

  el.innerHTML = `
    <div class="animate-fade">
      <div class="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 class="text-xl font-bold text-gray-900">${user.role === 'resident' ? 'My Requests' : 'All Requests'}</h2>
        ${user.role === 'resident' ? '<button onclick="navigateTo(\'new-request\')" class="px-4 py-2 bg-brgy-500 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5"><i class="lucide-plus w-3.5 h-3.5"></i> New</button>' : ''}
      </div>
      <div class="flex gap-1.5 mb-5 overflow-x-auto pb-1">
        ${['all', ...Object.keys(STATUS_CONFIG)].map((s) => `
          <button onclick="currentFilter='${s}';renderPage()" 
            class="px-3.5 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition ${currentFilter === s ? 'bg-brgy-500 text-white border-brgy-500' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}">
            ${s === 'all' ? 'All' : STATUS_CONFIG[s]?.label}
          </button>
        `).join('')}
      </div>
      <div class="space-y-2">
        ${requests.length > 0 ? requests.map((r) => requestRow(r, user)).join('') : emptyState('lucide-file-text', 'No requests found', 'Try a different filter')}
      </div>
    </div>
  `;
}

// ── Request Row ──
function requestRow(r, user) {
  const docName = r.document_types?.name || 'Document';
  const resName = r.resident_name || '';
  return `
    <div onclick="openRequestDetail('${r.id}')" class="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between cursor-pointer hover:shadow-sm transition gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
          <i class="lucide-file-text w-4 h-4 text-gray-400"></i>
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-bold text-sm text-gray-900">${docName}</span>
            ${statusBadge(r.status)}
          </div>
          <p class="text-xs text-gray-500 mt-0.5 truncate">
            ${user.role !== 'resident' && resName ? resName + ' • ' : ''}${r.purpose} • ${peso(r.fee)} • ${timeAgo(r.updated_at)}
          </p>
        </div>
      </div>
      <i class="lucide-chevron-right w-4 h-4 text-gray-300 flex-shrink-0"></i>
    </div>
  `;
}

// ── Request Detail Modal ──
async function openRequestDetail(id) {
  const user = AppAPI.getUser();
  const result = await AppAPI.getRequest(id);
  const r = result.data;
  const docName = r.document_types?.name || 'Document';
  const isFree = parseFloat(r.fee) === 0;
  const isStaff = user.role === 'staff' || user.role === 'admin';
  const canEdit = isStaff && EDITABLE_STATUSES.includes(r.status);
  const transitions = STATUS_TRANSITIONS[r.status] || [];
  const payment = r.payments?.[0];
  const finalDoc = (r.request_documents || []).filter((d) => !d.is_draft)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const documentUrl = finalDoc?.file_url || null;

  let actionsHtml = '';

  // Staff status actions
  if (isStaff && transitions.length > 0) {
    const submittedGcash = payment?.status === 'submitted' && payment.method === 'gcash';
    actionsHtml += '<div class="flex gap-2 flex-wrap mb-4">';
    transitions.filter((s) => s !== 'rejected').forEach((ns) => {
      // When awaiting_payment with a submitted GCash proof, force staff to use the Verify flow below
      if (ns === 'paid' && submittedGcash) return;
      // Block Release if no finished document is attached
      if (ns === 'released' && !documentUrl) {
        actionsHtml += `<button disabled title="Upload the finished document first" class="px-4 py-2 bg-gray-200 text-gray-400 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-not-allowed"><i class="lucide-lock w-3 h-3"></i> Release (upload doc first)</button>`;
        return;
      }
      let label;
      if (ns === 'awaiting_payment' && isFree) label = 'Approve (Free → Paid)';
      else if (ns === 'paid' && r.status === 'awaiting_payment') label = 'Mark as Paid (Walk-in)';
      else label = `Move to ${STATUS_CONFIG[ns]?.label}`;
      actionsHtml += `<button onclick="doStatusChange('${id}','${ns}')" class="px-4 py-2 bg-brgy-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-brgy-600 transition"><i class="lucide-chevron-right w-3 h-3"></i> ${label}</button>`;
    });
    if (transitions.includes('rejected')) {
      actionsHtml += `<button onclick="showRejectForm('${id}')" class="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-red-100 transition"><i class="lucide-x-circle w-3 h-3"></i> Reject</button>`;
    }
    actionsHtml += '</div>';
  }

  // Edit button
  if (canEdit) {
    actionsHtml += `<button onclick="showEditForm('${id}')" class="mb-4 px-4 py-2 bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-gray-100 transition"><i class="lucide-edit w-3 h-3"></i> Edit Request Details</button>`;
  }

  // Payment verification for staff
  if (isStaff && payment?.status === 'submitted') {
    actionsHtml += `
      <div class="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4">
        <div class="flex items-center gap-2 mb-2.5"><i class="lucide-credit-card w-4 h-4 text-amber-600"></i><span class="text-sm font-semibold text-amber-800">Payment proof submitted (${payment.method === 'gcash' ? 'GCash' : 'Walk-in'})</span></div>
        <div class="flex gap-2">
          <button onclick="doVerifyPayment('${payment.id}','verified')" class="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-semibold">Verify</button>
          <button onclick="doVerifyPayment('${payment.id}','rejected')" class="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold">Reject</button>
        </div>
      </div>
    `;
  }

  // Resident payment action
  if (user.role === 'resident' && r.status === 'awaiting_payment' && !payment) {
    actionsHtml += `<button onclick="showPaymentForm('${id}',${r.fee})" class="w-full py-3 bg-violet-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2"><i class="lucide-credit-card w-4 h-4"></i> Submit Payment — ${peso(r.fee)}</button>`;
  }

  // Staff: upload finished document during processing/ready
  if (isStaff && (r.status === 'processing' || r.status === 'ready')) {
    actionsHtml += `
      <div class="p-4 bg-blue-50 border border-blue-200 rounded-xl mb-4">
        <div class="flex items-center gap-2 mb-2.5"><i class="lucide-file-up w-4 h-4 text-blue-600"></i><span class="text-sm font-semibold text-blue-800">${documentUrl ? 'Document attached' : 'Upload finished document (PDF or image)'}</span></div>
        ${documentUrl ? `<a href="${documentUrl}" target="_blank" class="inline-flex items-center gap-1 text-xs text-blue-700 underline mb-2"><i class="lucide-external-link w-3 h-3"></i> View current file</a><br/>` : ''}
        <input type="file" id="doc-upload-input" accept="application/pdf,image/*" class="text-xs mb-2 block" />
        <button onclick="doUploadDocument('${id}')" class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold">Upload Document</button>
      </div>
    `;
  }

  // Released download
  if (r.status === 'released') {
    const dlBtn = documentUrl
      ? `<a href="${documentUrl}" target="_blank" class="px-3 py-1.5 bg-green-100 text-green-700 border border-green-200 rounded-lg text-xs font-semibold flex items-center gap-1"><i class="lucide-download w-3 h-3"></i> Download</a>`
      : `<span class="text-xs text-green-700">Pickup at Barangay Hall</span>`;
    actionsHtml += `<div class="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between"><div class="flex items-center gap-2"><i class="lucide-check-circle w-5 h-5 text-green-600"></i><span class="text-sm font-semibold text-green-800">Document Released</span></div>${dlBtn}</div>`;
  }

  showModal(`
    <div class="p-7">
      <div class="flex items-start justify-between mb-6">
        <div>
          <h3 class="text-lg font-bold text-gray-900">${docName}</h3>
          <p class="text-sm text-gray-500 mt-0.5">Request #${r.id.substring(0, 8).toUpperCase()}</p>
        </div>
        <button onclick="closeModal()" class="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200"><i class="lucide-x w-4 h-4 text-gray-500"></i></button>
      </div>
      <div class="grid grid-cols-2 gap-3 mb-6 text-sm">
        <div><div class="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Status</div>${statusBadge(r.status)}</div>
        <div><div class="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Fee</div><span class="font-medium text-gray-900">${isFree ? 'FREE' : peso(r.fee)}</span></div>
        <div class="col-span-2"><div class="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Purpose</div><span class="font-medium text-gray-900">${r.purpose}</span></div>
        <div><div class="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Submitted</div><span class="text-gray-700">${fmtDate(r.created_at)}</span></div>
        <div><div class="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Updated</div><span class="text-gray-700">${timeAgo(r.updated_at)}</span></div>
        ${r.rejection_reason ? `<div class="col-span-2"><div class="text-[11px] text-red-400 font-semibold uppercase tracking-wide mb-0.5">Rejection Reason</div><span class="text-red-700">${r.rejection_reason}</span></div>` : ''}
        ${payment ? `<div><div class="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Payment</div><span class="text-gray-700">${payment.method === 'gcash' ? 'GCash' : payment.method === 'free' ? 'Free' : 'Walk-in'} (${payment.status})</span></div>` : ''}
      </div>
      <div id="reject-form-area"></div>
      ${actionsHtml}
    </div>
  `);
}

// ── Document Upload (staff) ──
async function doUploadDocument(id) {
  const input = document.getElementById('doc-upload-input');
  const file = input?.files?.[0];
  if (!file) return showToast('Please choose a file first', 'error');
  try {
    await AppAPI.uploadRequestDocument(id, file);
    showToast('Document uploaded', 'success');
    closeModal();
    openRequestDetail(id);
  } catch (err) { showToast(err.message, 'error'); }
}

// ── Status Change ──
async function doStatusChange(id, newStatus) {
  try {
    await AppAPI.updateRequestStatus(id, newStatus);
    closeModal();
    showToast(`Request moved to ${STATUS_CONFIG[newStatus]?.label}`, 'success');
    renderPage();
  } catch (err) { showToast(err.message, 'error'); }
}

function showRejectForm(id) {
  document.getElementById('reject-form-area').innerHTML = `
    <div class="p-4 bg-red-50 border border-red-200 rounded-xl mb-4">
      <label class="block text-xs font-semibold text-red-700 mb-1.5">Reason for Rejection *</label>
      <textarea id="reject-reason" rows="3" class="w-full px-3 py-2 rounded-lg border border-red-200 text-sm" placeholder="Provide a reason..."></textarea>
      <div class="flex gap-2 mt-2">
        <button onclick="doReject('${id}')" class="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold">Confirm Reject</button>
        <button onclick="document.getElementById('reject-form-area').innerHTML=''" class="px-4 py-2 text-gray-500 text-xs font-semibold">Cancel</button>
      </div>
    </div>
  `;
}

async function doReject(id) {
  const reason = document.getElementById('reject-reason').value.trim();
  if (!reason) return showToast('Reason is required', 'error');
  try {
    await AppAPI.updateRequestStatus(id, 'rejected', { rejection_reason: reason });
    closeModal();
    showToast('Request rejected', 'info');
    renderPage();
  } catch (err) { showToast(err.message, 'error'); }
}

// ── Edit Request ──
async function showEditForm(id) {
  if (cachedDocTypes.length === 0) {
    const dt = await AppAPI.getDocumentTypes();
    cachedDocTypes = dt.data;
  }
  const result = await AppAPI.getRequest(id);
  const r = result.data;
  const options = cachedDocTypes.map((d) => `<option value="${d.id}" ${d.id === r.document_type_id ? 'selected' : ''}>${d.name} — ${d.fee > 0 ? peso(d.fee) : 'FREE'}</option>`).join('');

  showModal(`
    <div class="p-7">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-gray-900">Edit Request</h3>
        <button onclick="closeModal()" class="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center"><i class="lucide-x w-4 h-4 text-gray-500"></i></button>
      </div>
      <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-5 flex items-center gap-2 text-xs text-blue-700 font-medium"><i class="lucide-edit w-3.5 h-3.5"></i> Changes will be logged and the resident notified</div>
      <div class="space-y-4">
        <div><label class="block text-xs font-semibold text-gray-600 mb-1">Document Type</label><select id="edit-doc-type" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm">${options}</select></div>
        <div><label class="block text-xs font-semibold text-gray-600 mb-1">Purpose</label><textarea id="edit-purpose" rows="3" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm">${r.purpose}</textarea></div>
        <div><label class="block text-xs font-semibold text-gray-600 mb-1">Staff Remarks</label><textarea id="edit-remarks" rows="2" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" placeholder="Optional notes...">${r.remarks || ''}</textarea></div>
      </div>
      <div class="flex gap-2 mt-5">
        <button onclick="doEdit('${id}')" class="px-5 py-2.5 bg-brgy-500 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5"><i class="lucide-save w-3.5 h-3.5"></i> Save Changes</button>
        <button onclick="closeModal()" class="px-5 py-2.5 text-gray-500 text-sm font-semibold">Cancel</button>
      </div>
    </div>
  `);
}

async function doEdit(id) {
  const updates = {};
  const docType = parseInt(document.getElementById('edit-doc-type').value);
  const purpose = document.getElementById('edit-purpose').value.trim();
  const remarks = document.getElementById('edit-remarks').value.trim();
  if (docType) updates.document_type_id = docType;
  if (purpose) updates.purpose = purpose;
  if (remarks !== undefined) updates.remarks = remarks;
  try {
    await AppAPI.editRequest(id, updates);
    closeModal();
    showToast('Request updated!', 'success');
    renderPage();
  } catch (err) { showToast(err.message, 'error'); }
}

// ── Payment Form ──
function showPaymentForm(reqId, fee) {
  showModal(`
    <div class="p-7">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-gray-900">Submit Payment</h3>
        <button onclick="closeModal()" class="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center"><i class="lucide-x w-4 h-4 text-gray-500"></i></button>
      </div>
      <div class="space-y-4">
        <div><label class="block text-xs font-semibold text-gray-600 mb-1">Payment Method *</label>
          <select id="pay-method" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" onchange="document.getElementById('gcash-proof').classList.toggle('hidden', this.value !== 'gcash')">
            <option value="">Select...</option><option value="gcash">GCash (upload proof)</option><option value="walk_in">Walk-in</option>
          </select>
        </div>
        <div id="gcash-proof" class="hidden">
          <label class="block text-xs font-semibold text-gray-600 mb-1">GCash Proof Screenshot</label>
          <input type="file" id="proof-file" accept="image/*" class="w-full text-sm">
        </div>
      </div>
      <button onclick="doPayment('${reqId}')" class="mt-5 w-full py-3 bg-violet-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2"><i class="lucide-send w-4 h-4"></i> Submit Payment — ${peso(fee)}</button>
    </div>
  `);
}

async function doPayment(reqId) {
  const method = document.getElementById('pay-method').value;
  if (!method) return showToast('Select a method', 'error');
  const fileInput = document.getElementById('proof-file');
  const file = method === 'gcash' ? fileInput?.files?.[0] : null;
  try {
    await AppAPI.submitPayment(reqId, method, file);
    closeModal();
    showToast('Payment submitted!', 'success');
    renderPage();
  } catch (err) { showToast(err.message, 'error'); }
}

async function doVerifyPayment(paymentId, status) {
  try {
    await AppAPI.verifyPayment(paymentId, status);
    closeModal();
    showToast(`Payment ${status}`, 'success');
    renderPage();
  } catch (err) { showToast(err.message, 'error'); }
}

// ── New Request ──
async function renderNewRequest(el, user) {
  if (cachedDocTypes.length === 0) {
    const dt = await AppAPI.getDocumentTypes();
    cachedDocTypes = dt.data;
  }
  const options = cachedDocTypes.map((d) => `<option value="${d.id}">${d.name} — ${d.fee > 0 ? peso(d.fee) : 'FREE'}</option>`).join('');
  el.innerHTML = `
    <div class="max-w-lg animate-fade">
      <h2 class="text-xl font-bold text-gray-900 mb-1">New Request</h2>
      <p class="text-sm text-gray-500 mb-7">Submit a document request to the barangay</p>
      <div class="bg-white rounded-2xl border border-gray-200 p-7">
        <div class="mb-5"><label class="block text-xs font-semibold text-gray-600 mb-1.5">Document Type *</label><select id="new-doc-type" class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm"><option value="">Select...</option>${options}</select></div>
        <div class="mb-5"><label class="block text-xs font-semibold text-gray-600 mb-1.5">Purpose *</label><textarea id="new-purpose" rows="3" class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm" placeholder="e.g., Employment at ABC Corp..."></textarea></div>
        ${!user.is_verified ? '<div class="p-3 bg-red-50 border border-red-200 rounded-lg mb-5 text-xs text-red-700 font-medium flex items-center gap-2"><i class="lucide-alert-circle w-3.5 h-3.5"></i> Account not yet verified. Wait for staff approval.</div>' : ''}
        <button onclick="doCreateRequest()" ${!user.is_verified ? 'disabled class="w-full py-3 bg-gray-300 text-gray-500 rounded-xl font-semibold text-sm cursor-not-allowed"' : 'class="w-full py-3 bg-brgy-500 text-white rounded-xl font-semibold text-sm hover:bg-brgy-600 transition flex items-center justify-center gap-2"'}>
          <i class="lucide-send w-4 h-4"></i> Submit Request
        </button>
      </div>
    </div>
  `;
}

async function doCreateRequest() {
  const docTypeId = parseInt(document.getElementById('new-doc-type').value);
  const purpose = document.getElementById('new-purpose').value.trim();
  if (!docTypeId || !purpose) return showToast('Fill all required fields', 'error');
  try {
    await AppAPI.createRequest({ document_type_id: docTypeId, purpose });
    showToast('Request submitted!', 'success');
    navigateTo('requests');
  } catch (err) { showToast(err.message, 'error'); }
}

// ── Verification ──
async function renderVerification(el, user) {
  const pending = await AppAPI.getPendingVerifications();
  const verified = await AppAPI.getVerifiedResidents();
  el.innerHTML = `
    <div class="animate-fade">
      <h2 class="text-xl font-bold text-gray-900 mb-6">Account Verification</h2>
      ${(pending.data || []).length > 0 ? `
        <h3 class="text-xs font-bold text-amber-600 uppercase tracking-wider mb-3">Pending (${pending.data.length})</h3>
        <div class="space-y-3 mb-8">${pending.data.map((p) => `
          <div class="bg-white rounded-xl border-[1.5px] border-amber-200 p-5">
            <div class="flex items-start justify-between flex-wrap gap-3 mb-3">
              <div class="flex items-center gap-3">
                <div class="w-11 h-11 rounded-lg bg-amber-100 flex items-center justify-center text-sm font-bold text-amber-700">${(p.first_name || '')[0]}${(p.last_name || '')[0]}</div>
                <div>
                  <p class="font-semibold text-gray-900 text-sm">${p.first_name} ${p.middle_name ? p.middle_name + ' ' : ''}${p.last_name}${p.suffix ? ' ' + p.suffix : ''}</p>
                  <p class="text-xs text-gray-500">${p.users?.email || ''} • ${p.phone || 'No phone'}</p>
                </div>
              </div>
              <div class="flex gap-2">
                <button onclick="doVerifyAccount('${p.user_id}','verified')" class="px-3.5 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-semibold hover:bg-green-100 transition flex items-center gap-1"><i class="lucide-check-circle w-3.5 h-3.5"></i> Approve</button>
                <button onclick="showRejectVerification('${p.user_id}','${p.first_name} ${p.last_name}')" class="px-3.5 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100 transition flex items-center gap-1"><i class="lucide-x-circle w-3.5 h-3.5"></i> Reject</button>
              </div>
            </div>
            <!-- Details grid -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3 p-3 bg-gray-50 rounded-lg">
              <div><span class="text-gray-400 font-medium">Address</span><p class="text-gray-700 mt-0.5">${p.address || '—'}</p></div>
              <div><span class="text-gray-400 font-medium">Civil Status</span><p class="text-gray-700 mt-0.5">${p.civil_status || '—'}</p></div>
              <div><span class="text-gray-400 font-medium">Birth Date</span><p class="text-gray-700 mt-0.5">${p.date_of_birth ? fmtDate(p.date_of_birth) : '—'}</p></div>
              <div><span class="text-gray-400 font-medium">Phone</span><p class="text-gray-700 mt-0.5">${p.phone || '—'}</p></div>
            </div>
            <!-- Valid ID -->
            ${p.valid_id_url ? `
              <div class="border border-gray-200 rounded-lg overflow-hidden">
                <div class="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                  <i class="lucide-image w-3.5 h-3.5 text-gray-400"></i>
                  <span class="text-xs font-semibold text-gray-600">Uploaded Valid ID</span>
                  <a href="${p.valid_id_url}" target="_blank" class="ml-auto text-xs text-brgy-500 font-medium hover:underline flex items-center gap-1">View full <i class="lucide-external-link w-3 h-3"></i></a>
                </div>
                <div class="p-3 flex justify-center bg-white">
                  <img src="${p.valid_id_url}" alt="Valid ID" class="max-h-48 rounded-lg object-contain" onerror="this.parentElement.innerHTML='<p class=\\'text-xs text-gray-400 py-4\\'>Could not load image (might be a PDF)</p>'">
                </div>
              </div>
            ` : `
              <div class="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-600">
                <i class="lucide-alert-circle w-3.5 h-3.5"></i> No valid ID uploaded
              </div>
            `}
          </div>
        `).join('')}</div>
      ` : '<div class="p-5 bg-green-50 border border-green-200 rounded-xl mb-8 flex items-center gap-2 text-sm text-green-700 font-medium"><i class="lucide-check-circle w-4 h-4"></i> All accounts verified. No pending requests.</div>'}
      <h3 class="text-xs font-bold text-green-600 uppercase tracking-wider mb-3">Verified (${(verified.data || []).length})</h3>
      <div class="space-y-1.5">${(verified.data || []).map((v) => `
        <div class="flex items-center gap-2.5 px-4 py-2.5 bg-white rounded-lg border border-gray-200 text-sm">
          <i class="lucide-check-circle w-3.5 h-3.5 text-green-500"></i>
          <span class="font-medium">${v.first_name} ${v.last_name}</span>
          <span class="text-xs text-gray-400">${v.users?.email}</span>
          ${v.verified_at ? `<span class="ml-auto text-[11px] text-gray-400">${fmtDate(v.verified_at)}</span>` : ''}
        </div>
      `).join('')}</div>
    </div>
  `;
}

function showRejectVerification(userId, name) {
  showModal(`
    <div class="p-7">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-gray-900">Reject Verification</h3>
        <button onclick="closeModal()" class="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center"><i class="lucide-x w-4 h-4 text-gray-500"></i></button>
      </div>
      <p class="text-sm text-gray-500 mb-4">Rejecting verification for <strong>${name}</strong></p>
      <div class="mb-4">
        <label class="block text-xs font-semibold text-red-600 mb-1.5">Reason for Rejection <span class="text-red-500">*</span></label>
        <textarea id="reject-verif-reason" rows="3" class="w-full px-3 py-2.5 rounded-lg border border-red-200 text-sm focus:border-red-400 outline-none" placeholder="e.g., ID is blurry, expired ID, name mismatch..."></textarea>
      </div>
      <div class="flex gap-2 justify-end">
        <button onclick="closeModal()" class="px-4 py-2 text-gray-500 text-sm font-semibold">Cancel</button>
        <button onclick="doRejectVerification('${userId}')" class="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5"><i class="lucide-x-circle w-3.5 h-3.5"></i> Reject</button>
      </div>
    </div>
  `);
}

async function doRejectVerification(userId) {
  const reason = document.getElementById('reject-verif-reason').value.trim();
  if (!reason) return showToast('Reason is required', 'error');
  try {
    await AppAPI.verifyAccount(userId, 'rejected', reason);
    closeModal();
    showToast('Verification rejected', 'info');
    renderPage();
  } catch (err) { showToast(err.message, 'error'); }
}

// ── Staff Management ──
async function renderStaffMgmt(el, user) {
  const result = await AppAPI.getStaffList();
  const staff = result.data || [];
  el.innerHTML = `
    <div class="animate-fade">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-bold text-gray-900">Staff Management</h2>
        <button onclick="showAddStaffForm()" class="px-4 py-2 bg-brgy-500 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5"><i class="lucide-plus w-3.5 h-3.5"></i> Add Staff</button>
      </div>
      <div class="space-y-2.5">${staff.map((s) => `
        <div class="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between flex-wrap gap-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg ${s.is_active ? 'bg-blue-100' : 'bg-gray-100'} flex items-center justify-center text-xs font-bold ${s.is_active ? 'text-blue-600' : 'text-gray-400'}">${s.first_name[0]}${s.last_name[0]}</div>
            <div><p class="font-semibold text-gray-900 text-sm">${s.first_name} ${s.last_name}</p><p class="text-xs text-gray-500">${s.users?.email} • ${s.position}</p></div>
          </div>
          <div class="flex items-center gap-2.5">
            <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-md ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}">${s.is_active ? 'ACTIVE' : 'INACTIVE'}</span>
            <button onclick="doToggleStaff('${s.user_id}', ${!s.is_active})" class="px-3 py-1 text-xs font-semibold rounded-lg border ${s.is_active ? 'border-red-200 text-red-600 bg-red-50' : 'border-green-200 text-green-700 bg-green-50'}">${s.is_active ? 'Deactivate' : 'Activate'}</button>
            <button onclick="doDeleteStaff('${s.user_id}','${s.first_name} ${s.last_name}')" class="px-3 py-1 text-xs font-semibold rounded-lg border border-red-300 text-red-700 bg-red-50 hover:bg-red-100"><i class="lucide-trash-2 w-3 h-3 inline"></i> Delete</button>
          </div>
        </div>
      `).join('')}</div>
    </div>
  `;
}

function showAddStaffForm() {
  showModal(`
    <div class="p-7">
      <h3 class="text-lg font-bold text-gray-900 mb-5">Add Staff Member</h3>
      <div class="space-y-4">
        <div><label class="block text-xs font-semibold text-gray-600 mb-1">First Name *</label><input id="staff-fname" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm"></div>
        <div><label class="block text-xs font-semibold text-gray-600 mb-1">Last Name *</label><input id="staff-lname" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm"></div>
        <div><label class="block text-xs font-semibold text-gray-600 mb-1">Email *</label><input id="staff-email" type="email" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm"></div>
        <div><label class="block text-xs font-semibold text-gray-600 mb-1">Password *</label><input id="staff-pass" type="password" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" value="staff123"></div>
        <div><label class="block text-xs font-semibold text-gray-600 mb-1">Position</label><input id="staff-position" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" placeholder="e.g., Clerk"></div>
      </div>
      <div class="flex gap-2 mt-5 justify-end">
        <button onclick="closeModal()" class="px-4 py-2 text-gray-500 text-sm font-semibold">Cancel</button>
        <button onclick="doAddStaff()" class="px-5 py-2 bg-brgy-500 text-white rounded-lg text-sm font-semibold">Add Staff</button>
      </div>
    </div>
  `);
}

async function doAddStaff() {
  try {
    await AppAPI.createStaff({
      first_name: document.getElementById('staff-fname').value,
      last_name: document.getElementById('staff-lname').value,
      email: document.getElementById('staff-email').value,
      password: document.getElementById('staff-pass').value,
      position: document.getElementById('staff-position').value,
    });
    closeModal();
    showToast('Staff added!', 'success');
    renderPage();
  } catch (err) { showToast(err.message, 'error'); }
}

async function doToggleStaff(userId, activate) {
  try {
    await AppAPI.updateStaff(userId, { is_active: activate });
    showToast(`Staff ${activate ? 'activated' : 'deactivated'}`, 'success');
    renderPage();
  } catch (err) { showToast(err.message, 'error'); }
}

async function doDeleteStaff(userId, name) {
  if (!confirm(`Permanently delete staff "${name}"? This cannot be undone.`)) return;
  try {
    await AppAPI.deleteStaff(userId);
    showToast('Staff deleted', 'success');
    renderPage();
  } catch (err) { showToast(err.message, 'error'); }
}

// ── Released Documents (admin) ──
async function renderReleasedDocuments(el) {
  const result = await AppAPI.getRequests({ status: 'released' });
  const requests = result.data?.data || [];
  el.innerHTML = `
    <div class="animate-fade">
      <div class="flex items-center justify-between mb-6"><h2 class="text-xl font-bold text-gray-900">Released Documents</h2></div>
      ${requests.length === 0 ? emptyState('lucide-folder-open', 'No released documents yet', 'Released documents will appear here.') : `
        <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table class="w-full text-sm">
            <thead><tr class="bg-gray-50 border-b border-gray-200">
              ${['Resident', 'Document', 'Released', 'Action'].map((h) => `<th class="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">${h}</th>`).join('')}
            </tr></thead>
            <tbody>${requests.map((r) => `<tr class="border-b border-gray-100">
              <td class="px-4 py-3 font-semibold text-gray-900">${r.resident_name || 'Unknown'}</td>
              <td class="px-4 py-3 text-gray-700">${r.document_types?.name || '—'}</td>
              <td class="px-4 py-3 text-xs text-gray-500">${fmtDate(r.updated_at)}</td>
              <td class="px-4 py-3"><button onclick="openRequestDetail('${r.id}')" class="px-3 py-1.5 bg-brgy-50 text-brgy-700 border border-brgy-200 rounded-lg text-xs font-semibold">View</button></td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

// ── Audit Logs ──
async function renderAuditLogs(el) {
  const result = await AppAPI.getAuditLogs();
  const logs = result.data?.data || [];
  el.innerHTML = `
    <div class="animate-fade">
      <div class="flex items-center justify-between mb-6"><h2 class="text-xl font-bold text-gray-900">Audit Logs</h2></div>
      <div class="bg-white rounded-2xl border border-gray-200 p-4 mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label class="block text-[11px] font-semibold text-gray-500 uppercase mb-1">From</label>
          <input type="date" id="audit-from" class="px-3 py-2 rounded-lg border border-gray-200 text-sm" />
        </div>
        <div>
          <label class="block text-[11px] font-semibold text-gray-500 uppercase mb-1">To</label>
          <input type="date" id="audit-to" class="px-3 py-2 rounded-lg border border-gray-200 text-sm" />
        </div>
        <div>
          <label class="block text-[11px] font-semibold text-gray-500 uppercase mb-1">Group By</label>
          <select id="audit-group" class="px-3 py-2 rounded-lg border border-gray-200 text-sm">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <button onclick="doExportAuditLogs()" class="px-4 py-2 bg-brgy-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-brgy-600 transition"><i class="lucide-download w-3 h-3"></i> Export to Excel</button>
      </div>
      <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="bg-gray-50 border-b border-gray-200">
              ${['Timestamp', 'Actor', 'Action', 'Details'].map((h) => `<th class="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">${h}</th>`).join('')}
            </tr></thead>
            <tbody>${logs.map((l) => `<tr class="border-b border-gray-100">
              <td class="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">${fmtDate(l.created_at)}</td>
              <td class="px-4 py-3 font-semibold text-gray-900">${l.actor_name || 'System'}</td>
              <td class="px-4 py-3"><span class="px-2 py-0.5 bg-gray-100 rounded text-[11px] font-semibold text-gray-600">${l.action}</span></td>
              <td class="px-4 py-3 text-gray-500 max-w-[280px] truncate">${l.detail || ''}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function doExportAuditLogs() {
  const from = document.getElementById('audit-from')?.value || '';
  const to = document.getElementById('audit-to')?.value || '';
  const groupBy = document.getElementById('audit-group')?.value || 'daily';
  const url = AppAPI.getAuditExportUrl({ groupBy, from, to });
  window.location.assign(url);
}

// ── Notifications ──
async function renderNotifications(el) {
  const result = await AppAPI.getNotifications();
  const notifs = result.data || [];
  el.innerHTML = `
    <div class="animate-fade">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-bold text-gray-900">Notifications</h2>
        ${notifs.some((n) => !n.is_read) ? '<button onclick="doMarkAllRead()" class="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600">Mark all read</button>' : ''}
      </div>
      ${notifs.length === 0 ? emptyState('lucide-bell', 'No notifications', "You're all caught up!") : `
        <div class="space-y-1.5">${notifs.map((n) => `
          <div onclick="doMarkRead('${n.id}')" class="px-5 py-3.5 rounded-xl cursor-pointer transition ${n.is_read ? 'bg-white border border-gray-200' : 'bg-green-50 border border-green-200'}">
            <div class="flex justify-between items-start">
              <div>
                <div class="flex items-center gap-1.5">${!n.is_read ? '<div class="w-1.5 h-1.5 rounded-full bg-green-500"></div>' : ''}<p class="text-sm font-semibold text-gray-900">${n.title}</p></div>
                <p class="text-xs text-gray-500 mt-1">${n.message}</p>
              </div>
              <span class="text-[11px] text-gray-400 whitespace-nowrap ml-3">${timeAgo(n.created_at)}</span>
            </div>
          </div>
        `).join('')}</div>
      `}
    </div>
  `;
}

async function doMarkRead(id) {
  try { await AppAPI.markNotificationRead(id); renderPage(); } catch {}
}
async function doMarkAllRead() {
  try { await AppAPI.markAllNotificationsRead(); showToast('All read', 'success'); renderPage(); } catch {}
}

// ── Profile ──
async function renderProfile(el, user) {
  if (user.role === 'admin') {
    el.innerHTML = `
      <div class="max-w-lg animate-fade">
        <h2 class="text-xl font-bold text-gray-900 mb-6">Admin Profile</h2>
        <div class="bg-white rounded-2xl border border-gray-200 p-7 mb-5">
          <div class="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100">
            <div class="w-14 h-14 rounded-xl bg-red-100 flex items-center justify-center text-lg font-bold text-red-600">${user.email[0].toUpperCase()}</div>
            <div><p class="text-lg font-bold text-gray-900">${user.email}</p><span class="text-[11px] font-bold text-red-600 bg-red-50 px-2.5 py-0.5 rounded-md uppercase">Administrator</span></div>
          </div>
          <div class="mb-4"><label class="block text-xs font-semibold text-gray-600 mb-1">Email</label><input id="admin-email" value="${user.email}" class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm"></div>
          <button onclick="doUpdateAdminProfile()" class="px-5 py-2.5 bg-brgy-500 text-white rounded-lg text-sm font-semibold">Save Profile</button>
        </div>
        ${passwordSection()}
      </div>`;
  } else if (user.role === 'staff') {
    el.innerHTML = `
      <div class="max-w-lg animate-fade">
        <h2 class="text-xl font-bold text-gray-900 mb-6">Staff Profile</h2>
        <div class="bg-white rounded-2xl border border-gray-200 p-7 mb-5">
          <div class="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100">
            <div class="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center text-lg font-bold text-blue-600">${user.profile?.first_name?.[0] || ''}${user.profile?.last_name?.[0] || ''}</div>
            <div><p class="text-lg font-bold text-gray-900">${user.profile?.first_name || ''} ${user.profile?.last_name || ''}</p><span class="text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md uppercase">Staff</span> <span class="text-xs text-gray-400 ml-1">${user.profile?.position || ''}</span></div>
          </div>
          <div class="mb-4"><label class="block text-xs font-semibold text-gray-600 mb-1">Name</label><input value="${user.profile?.first_name || ''} ${user.profile?.last_name || ''}" disabled class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm bg-gray-50"></div>
          <div class="mb-4"><label class="block text-xs font-semibold text-gray-600 mb-1">Email</label><input value="${user.email}" disabled class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm bg-gray-50"></div>
          <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 font-medium flex items-center gap-2"><i class="lucide-alert-circle w-3.5 h-3.5"></i> Name and email can only be changed by admin.</div>
        </div>
        ${passwordSection()}
      </div>`;
  } else {
    const p = user.profile || {};
    const isRejected = p.verification_status === 'rejected';
    const isPending = p.verification_status === 'pending';
    el.innerHTML = `
      <div class="max-w-lg animate-fade">
        <h2 class="text-xl font-bold text-gray-900 mb-6">My Profile</h2>
        <div class="bg-white rounded-2xl border border-gray-200 p-7 mb-5">
          <div class="mb-4"><label class="block text-xs font-semibold text-gray-600 mb-1">Full Name</label><input value="${p.first_name || ''} ${p.last_name || ''}" disabled class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm bg-gray-50"><p class="text-[11px] text-gray-400 mt-1">Name cannot be changed</p></div>
          <div class="mb-4"><label class="block text-xs font-semibold text-gray-600 mb-1">Email</label><input id="res-email" type="email" value="${user.email || ''}" class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm"></div>
          <div class="mb-4"><label class="block text-xs font-semibold text-gray-600 mb-1">Phone</label><input id="res-phone" value="${p.phone || ''}" class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm"></div>
          <div class="mb-4"><label class="block text-xs font-semibold text-gray-600 mb-1">Address</label><textarea id="res-address" rows="2" class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm">${p.address || ''}</textarea></div>
          <div class="mb-4"><label class="block text-xs font-semibold text-gray-600 mb-1">Civil Status</label><select id="res-civil" class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm">${['Single','Married','Widowed','Separated'].map((s) => `<option ${p.civil_status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
          <div class="p-3 rounded-lg mb-5 flex items-center gap-2 text-xs font-semibold ${user.is_verified ? 'bg-green-50 border border-green-200 text-green-700' : isRejected ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-amber-50 border border-amber-200 text-amber-700'}"><i class="${user.is_verified ? 'lucide-check-circle' : isRejected ? 'lucide-x-circle' : 'lucide-clock'} w-4 h-4"></i> ${user.is_verified ? 'Account Verified' : isRejected ? 'Verification Rejected' : 'Pending Verification'}</div>
          ${isRejected ? `
            <div class="p-4 bg-red-50 border border-red-200 rounded-xl mb-5">
              <p class="text-xs font-semibold text-red-700 mb-1">Rejection Reason:</p>
              <p class="text-sm text-red-600">${p.rejection_reason || 'No reason provided'}</p>
              <div class="mt-3 pt-3 border-t border-red-200">
                <p class="text-xs text-red-600 mb-2">Upload a new valid ID to re-submit:</p>
                <input type="file" id="reupload-id" accept="image/*,.pdf" class="text-sm mb-2">
                <button onclick="doResubmitVerification()" class="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"><i class="lucide-upload w-3.5 h-3.5"></i> Re-submit for Verification</button>
              </div>
            </div>
          ` : ''}
          <button onclick="doUpdateResidentProfile()" class="w-full py-3 bg-brgy-500 text-white rounded-xl font-semibold text-sm">Save Changes</button>
        </div>
      </div>`;
  }
}

function passwordSection() {
  return `
    <div class="bg-white rounded-2xl border border-gray-200 p-7">
      <div class="flex items-center justify-between mb-0" id="pw-header">
        <div class="flex items-center gap-2.5"><i class="lucide-lock w-[18px] h-[18px] text-gray-500"></i><div><p class="text-sm font-semibold text-gray-900">Password</p><p class="text-xs text-gray-400">Change your account password</p></div></div>
        <button onclick="document.getElementById('pw-form').classList.toggle('hidden')" class="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600">Change</button>
      </div>
      <div id="pw-form" class="hidden mt-5 space-y-4">
        <div><label class="block text-xs font-semibold text-gray-600 mb-1">Current Password *</label><input id="pw-current" type="password" class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm"></div>
        <div><label class="block text-xs font-semibold text-gray-600 mb-1">New Password * <span class="font-normal text-gray-400">(min 6 chars)</span></label><input id="pw-new" type="password" class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm"></div>
        <div><label class="block text-xs font-semibold text-gray-600 mb-1">Confirm Password *</label><input id="pw-confirm" type="password" class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm"></div>
        <button onclick="doChangePassword()" class="px-5 py-2.5 bg-brgy-500 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5"><i class="lucide-lock w-3.5 h-3.5"></i> Update Password</button>
      </div>
    </div>`;
}

async function doChangePassword() {
  const cur = document.getElementById('pw-current').value;
  const nw = document.getElementById('pw-new').value;
  const cf = document.getElementById('pw-confirm').value;
  if (!cur || !nw) return showToast('Fill all fields', 'error');
  if (nw.length < 6) return showToast('Min 6 characters', 'error');
  if (nw !== cf) return showToast('Passwords do not match', 'error');
  try {
    await AppAPI.changePassword(cur, nw);
    showToast('Password changed!', 'success');
    document.getElementById('pw-form').classList.add('hidden');
  } catch (err) { showToast(err.message, 'error'); }
}

async function doUpdateResidentProfile() {
  try {
    await AppAPI.updateProfile({
      email: document.getElementById('res-email').value,
      phone: document.getElementById('res-phone').value,
      address: document.getElementById('res-address').value,
      civil_status: document.getElementById('res-civil').value,
    });
    showToast('Profile updated!', 'success');
  } catch (err) { showToast(err.message, 'error'); }
}

async function doUpdateAdminProfile() {
  try {
    await AppAPI.updateProfile({ email: document.getElementById('admin-email').value });
    showToast('Profile updated!', 'success');
  } catch (err) { showToast(err.message, 'error'); }
}

async function doResubmitVerification() {
  const fileInput = document.getElementById('reupload-id');
  const file = fileInput?.files?.[0];
  if (!file) return showToast('Please select a valid ID file', 'error');
  if (file.size > 5 * 1024 * 1024) return showToast('File must be under 5MB', 'error');
  try {
    await AppAPI.resubmitVerification(file);
    showToast('ID re-submitted! Awaiting staff review.', 'success');
    // Refresh profile data
    const profileResult = await AppAPI.getProfile();
    if (profileResult.data) {
      // Update cached user with new profile
      const updated = { ...AppAPI.getUser(), profile: profileResult.data.profile, is_verified: profileResult.data.is_verified };
      localStorage.setItem('sb_user', JSON.stringify(updated));
    }
    renderPage();
  } catch (err) { showToast(err.message, 'error'); }
}

// ── Helpers ──
function statCard(icon, label, value, color) {
  const colors = { brgy: 'bg-brgy-500/10 text-brgy-500', amber: 'bg-amber-100 text-amber-600', emerald: 'bg-emerald-100 text-emerald-600', violet: 'bg-violet-100 text-violet-600', blue: 'bg-blue-100 text-blue-600' };
  return `<div class="bg-white rounded-xl sm:rounded-2xl border border-gray-200 p-3.5 sm:p-5">
    <div class="flex items-center justify-between mb-2 sm:mb-3.5"><span class="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase tracking-wider">${label}</span><div class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${colors[color]} flex items-center justify-center"><i class="${icon} w-3.5 h-3.5 sm:w-4 sm:h-4"></i></div></div>
    <div class="text-lg sm:text-2xl font-extrabold text-gray-900 tracking-tight">${value}</div>
  </div>`;
}

function emptyState(icon, title, desc) {
  return `<div class="text-center py-16"><div class="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4"><i class="${icon} w-6 h-6 text-gray-300"></i></div><p class="text-sm font-semibold text-gray-600">${title}</p><p class="text-xs text-gray-400 mt-1">${desc}</p></div>`;
}

// ── Auth Handlers ──
async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');

  if (!email || !password) {
    errEl.textContent = 'Please enter email and password';
    errEl.classList.remove('hidden');
    return;
  }

  try {
    document.getElementById('login-btn').disabled = true;
    document.getElementById('login-btn').textContent = 'Signing in...';
    await AppAPI.login(email, password);
    initApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
    document.getElementById('login-btn').disabled = false;
    document.getElementById('login-btn').innerHTML = 'Sign In <i class="lucide-arrow-right w-4 h-4"></i>';
  }
}

async function handleLogout() {
  AppAPI.unsubscribeAll();
  await AppAPI.logout();
  document.getElementById('app-shell').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
}

function showRegister() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('register-screen').classList.remove('hidden');
}

function showLogin() {
  document.getElementById('register-screen').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
}

async function handleRegister() {
  const btn = document.getElementById('register-btn');
  const errEl = document.getElementById('register-error');
  errEl.classList.add('hidden');

  // Gather form values
  const firstName = document.getElementById('reg-fname').value.trim();
  const middleName = document.getElementById('reg-mname').value.trim();
  const lastName = document.getElementById('reg-lname').value.trim();
  const suffix = document.getElementById('reg-suffix').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirmPw = document.getElementById('reg-confirm-password').value;
  const phone = document.getElementById('reg-phone').value.trim();
  const address = document.getElementById('reg-address').value.trim();
  const civilStatus = document.getElementById('reg-civil').value;
  const dob = document.getElementById('reg-dob').value;
  const validIdFile = document.getElementById('reg-valid-id').files[0];

  // Validate
  const errors = [];
  if (!firstName) errors.push('First name is required');
  if (!lastName) errors.push('Last name is required');
  if (!email) errors.push('Email is required');
  if (!password || password.length < 6) errors.push('Password must be at least 6 characters');
  if (password !== confirmPw) errors.push('Passwords do not match');
  if (!validIdFile) errors.push('Valid ID upload is required for verification');

  if (errors.length > 0) {
    errEl.innerHTML = errors.map(e => `<p>• ${e}</p>`).join('');
    errEl.classList.remove('hidden');
    return;
  }

  // Validate file size
  if (validIdFile && validIdFile.size > 5 * 1024 * 1024) {
    errEl.textContent = 'Valid ID file must be under 5MB';
    errEl.classList.remove('hidden');
    return;
  }

  // Build FormData
  const fd = new FormData();
  fd.append('first_name', firstName);
  fd.append('middle_name', middleName);
  fd.append('last_name', lastName);
  fd.append('suffix', suffix);
  fd.append('email', email);
  fd.append('password', password);
  fd.append('phone', phone);
  fd.append('address', address);
  if (civilStatus) fd.append('civil_status', civilStatus);
  if (dob) fd.append('date_of_birth', dob);
  fd.append('valid_id', validIdFile);

  try {
    btn.disabled = true;
    btn.textContent = 'Creating account...';
    const result = await AppAPI.register(fd);
    showToast(result.message || 'Registration successful!', 'success');
    showLogin();
    // Pre-fill login email
    document.getElementById('login-email').value = email;
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="lucide-user-plus w-4 h-4"></i> Create Account';
  }
}

// ── Initialize App ──
function initApp() {
  const user = AppAPI.getUser();
  if (!user) return;

  // Show app, hide login
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');

  // Set user info
  const name = user.profile?.first_name
    ? `${user.profile.first_name} ${user.profile.last_name}`
    : user.email;
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  document.getElementById('user-name').textContent = name;
  document.getElementById('user-role-label').textContent = user.role;
  document.getElementById('user-avatar').textContent = initials;

  const roleColors = { admin: 'bg-red-500', staff: 'bg-blue-500', resident: 'bg-emerald-500' };
  document.getElementById('user-avatar').className = `w-8 h-8 rounded-lg ${roleColors[user.role]} flex items-center justify-center text-xs font-bold text-white`;

  // Build nav & render
  currentPage = 'dashboard';
  currentFilter = 'all';
  buildNav();
  renderPage();

  // Setup real-time
  setupRealtime(user);
}

// ── Real-time Setup ──
function setupRealtime(user) {
  // Subscribe to request changes
  AppAPI.subscribeToRequests((payload) => {
    const indicator = document.getElementById('live-indicator');
    indicator.classList.add('bg-green-50', 'border-green-200');
    setTimeout(() => indicator.classList.remove('bg-green-50', 'border-green-200'), 1500);

    // Auto-refresh current page if relevant
    if (currentPage === 'dashboard' || currentPage === 'requests') {
      renderPage();
    }
  });

  // Subscribe to own notifications
  AppAPI.subscribeToNotifications(user.id, (payload) => {
    const notif = payload.new;
    if (notif) {
      showToast(notif.title || 'New notification', 'info');
      updateNotifBadge();
    }
  });

  // Subscribe to payments
  AppAPI.subscribeToPayments((payload) => {
    if (currentPage === 'requests') renderPage();
  });

  // Initial badge update
  updateNotifBadge();
}

async function updateNotifBadge() {
  try {
    const result = await AppAPI.getNotifications({ unread_only: 'true', limit: '50' });
    const count = (result.data || []).length;
    const badge = document.getElementById('notif-badge');
    const navBadge = document.getElementById('nav-notif-count');

    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove('hidden');
      if (navBadge) {
        navBadge.innerHTML = `<span class="ml-auto bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">${count}</span>`;
      }
    } else {
      badge.classList.add('hidden');
      if (navBadge) navBadge.innerHTML = '';
    }
  } catch {}
}

// ── ID Upload Preview ──
function handleIdPreview(input) {
  const file = input.files[0];
  const placeholder = document.getElementById('id-placeholder');
  const preview = document.getElementById('id-preview');
  const previewImg = document.getElementById('id-preview-img');
  const previewName = document.getElementById('id-preview-name');

  if (!file) {
    placeholder.classList.remove('hidden');
    preview.classList.add('hidden');
    return;
  }

  // Show file name
  previewName.textContent = file.name;

  // Preview image files
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewImg.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  } else {
    // PDF — show icon instead
    previewImg.classList.add('hidden');
    previewName.textContent = `📄 ${file.name}`;
  }

  placeholder.classList.add('hidden');
  preview.classList.remove('hidden');

  // Validate size
  if (file.size > 5 * 1024 * 1024) {
    showToast('File too large — max 5MB', 'error');
    input.value = '';
    placeholder.classList.remove('hidden');
    preview.classList.add('hidden');
  }
}

// ── Boot ──
document.addEventListener('DOMContentLoaded', () => {
  // Try restore session
  if (AppAPI.restoreSession()) {
    initApp();
  }

  // Enter key on login
  document.getElementById('login-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
});