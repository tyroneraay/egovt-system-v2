// ============================================================
// SUPABASE CLIENT (Frontend)
// Handles auth state, API calls, and real-time subscriptions
// ============================================================

const SUPABASE_URL = 'https://rkthfsjhnpfvfpepvbyf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrdGhmc2pobnBmdmZwZXB2YnlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDU3MjMsImV4cCI6MjA5MTQyMTcyM30.YuZP-aeXRWPraTA-3s6ErOhUbJ3myqUKRdSofbBvVYk';
const API_BASE = 'http://localhost:3000/api'; // Backend URL

// ── Supabase Client Init ──
let supabaseClient = null;

function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

// ── Auth State ──
let currentUser = null;
let currentSession = null;

function getToken() {
  return currentSession?.access_token || localStorage.getItem('sb_token');
}

function getUser() {
  return currentUser;
}

function setAuth(session, user) {
  currentSession = session;
  currentUser = user;
  if (session?.access_token) {
    localStorage.setItem('sb_token', session.access_token);
    localStorage.setItem('sb_refresh', session.refresh_token);
    localStorage.setItem('sb_user', JSON.stringify(user));
  }
}

function clearAuth() {
  currentSession = null;
  currentUser = null;
  localStorage.removeItem('sb_token');
  localStorage.removeItem('sb_refresh');
  localStorage.removeItem('sb_user');
}

// Try restore session on load
function restoreSession() {
  const token = localStorage.getItem('sb_token');
  const userStr = localStorage.getItem('sb_user');
  if (token && userStr) {
    try {
      currentUser = JSON.parse(userStr);
      currentSession = { access_token: token };
      return true;
    } catch { clearAuth(); }
  }
  return false;
}

// ── API Helper ──
async function api(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || data.details?.join(', ') || 'Request failed');
  }

  return data;
}

// File upload helper
async function apiUpload(method, path, formData) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: formData,
  });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Upload failed');
  }

  return data;
}

// ── Auth API ──
async function login(email, password) {
  const result = await api('POST', '/auth/login', { email, password });
  setAuth(result.data.session, result.data.user);
  return result.data;
}

async function register(formData) {
  // formData is already a FormData object with file
  const headers = {};
  // Don't set Content-Type — let browser set multipart boundary
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers,
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.details?.join(', ') || 'Registration failed');
  }
  return data;
}

async function logout() {
  try { await api('POST', '/auth/logout'); } catch {}
  clearAuth();
}

async function getProfile() {
  return await api('GET', '/auth/me');
}

async function changePassword(currentPassword, newPassword) {
  return await api('PUT', '/auth/password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

async function updateProfile(updates) {
  return await api('PUT', '/auth/profile', updates);
}

// ── Requests API ──
async function getRequests(params = {}) {
  const cleaned = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
  const qs = new URLSearchParams(cleaned).toString();
  return await api('GET', `/requests${qs ? '?' + qs : ''}`);
}

async function getRequest(id) {
  return await api('GET', `/requests/${id}`);
}

async function createRequest(data) {
  return await api('POST', '/requests', data);
}

async function updateRequestStatus(id, status, extras = {}) {
  return await api('PUT', `/requests/${id}/status`, { status, ...extras });
}

async function editRequest(id, updates) {
  return await api('PUT', `/requests/${id}/edit`, updates);
}

async function uploadRequestDocument(id, file) {
  const fd = new FormData();
  fd.append('document', file);
  return await apiUpload('POST', `/requests/${id}/document`, fd);
}

// ── Payments API ──
async function submitPayment(requestId, method, proofFile = null) {
  if (proofFile) {
    const fd = new FormData();
    fd.append('method', method);
    fd.append('proof', proofFile);
    return await apiUpload('POST', `/payments/${requestId}`, fd);
  }
  return await api('POST', `/payments/${requestId}`, { method });
}

async function verifyPayment(paymentId, status) {
  return await api('PUT', `/payments/${paymentId}/verify`, { status });
}

// ── Verification API ──
async function getPendingVerifications() {
  return await api('GET', '/verification/pending');
}

async function getVerifiedResidents() {
  return await api('GET', '/verification/verified');
}

async function getRejectedResidents() {
  return await api('GET', '/verification/rejected');
}

async function getResidentDetail(userId) {
  return await api('GET', `/verification/${userId}`);
}

async function verifyAccount(userId, status, rejectionReason = null) {
  return await api('PUT', `/verification/${userId}`, {
    status,
    rejection_reason: rejectionReason,
  });
}

async function resubmitVerification(validIdFile) {
  const fd = new FormData();
  fd.append('valid_id', validIdFile);
  return await apiUpload('POST', '/verification/resubmit', fd);
}

// ── Admin API ──
async function getDashboardStats() {
  return await api('GET', '/admin/dashboard');
}

async function getStaffList() {
  return await api('GET', '/admin/staff');
}

async function createStaff(data) {
  return await api('POST', '/admin/staff', data);
}

async function updateStaff(userId, updates) {
  return await api('PUT', `/admin/staff/${userId}`, updates);
}

async function deleteStaff(userId) {
  return await api('DELETE', `/admin/staff/${userId}`);
}

async function getAuditLogs(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return await api('GET', `/admin/audit-logs${qs ? '?' + qs : ''}`);
}

function getAuditExportUrl({ groupBy = 'daily', from = '', to = '' } = {}) {
  const token = getToken();
  const params = new URLSearchParams({ groupBy, token });
  if (from) params.append('from', from);
  if (to) params.append('to', to);
  return `${API_BASE}/admin/audit-logs/export?${params.toString()}`;
}

async function getDocumentTypes() {
  return await api('GET', '/admin/document-types');
}

// ── Notifications API ──
async function getNotifications(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return await api('GET', `/notifications${qs ? '?' + qs : ''}`);
}

async function markNotificationRead(id) {
  return await api('PUT', `/notifications/${id}/read`);
}

async function markAllNotificationsRead() {
  return await api('PUT', '/notifications/read-all');
}

// ── Real-time Subscriptions ──
let subscriptions = [];

function subscribeToRequests(callback) {
  const sb = getSupabase();
  const channel = sb
    .channel('requests-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'requests',
    }, (payload) => {
      console.log('[RT] Request change:', payload);
      callback(payload);
    })
    .subscribe();

  subscriptions.push(channel);
  return channel;
}

function subscribeToNotifications(userId, callback) {
  const sb = getSupabase();
  const channel = sb
    .channel('notifications-changes')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      console.log('[RT] New notification:', payload);
      callback(payload);
    })
    .subscribe();

  subscriptions.push(channel);
  return channel;
}

function subscribeToPayments(callback) {
  const sb = getSupabase();
  const channel = sb
    .channel('payments-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'payments',
    }, (payload) => {
      console.log('[RT] Payment change:', payload);
      callback(payload);
    })
    .subscribe();

  subscriptions.push(channel);
  return channel;
}

function unsubscribeAll() {
  const sb = getSupabase();
  subscriptions.forEach((ch) => sb.removeChannel(ch));
  subscriptions = [];
}

// ── Export ──
window.AppAPI = {
  // Auth
  login, register, logout, getProfile, changePassword, updateProfile,
  getUser, getToken, restoreSession, clearAuth,
  // Requests
  getRequests, getRequest, createRequest, updateRequestStatus, editRequest, uploadRequestDocument,
  // Payments
  submitPayment, verifyPayment,
  // Verification
  getPendingVerifications, getVerifiedResidents, getRejectedResidents,
  getResidentDetail, verifyAccount, resubmitVerification,
  // Admin
  getDashboardStats, getStaffList, createStaff, updateStaff, deleteStaff,
  getAuditLogs, getAuditExportUrl, getDocumentTypes,
  // Notifications
  getNotifications, markNotificationRead, markAllNotificationsRead,
  // Realtime
  subscribeToRequests, subscribeToNotifications, subscribeToPayments, unsubscribeAll,
};
