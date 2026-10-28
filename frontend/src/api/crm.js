/**
 * Aulten Digital TaskFlow CRM — API Client
 */

const configuredBaseUrl = import.meta.env?.VITE_API_BASE_URL?.replace(/\/+$/, '');
const BASE_URL = configuredBaseUrl
  ? `${configuredBaseUrl.replace(/\/api$/, '')}/api`
  : (import.meta.env?.DEV ? '/api' : '/api');

let memoryToken = null;
try {
  memoryToken = sessionStorage.getItem('taskflow_token');
} catch {}

export function setAuthToken(token) {
  memoryToken = token;
  try {
    if (token) {
      sessionStorage.setItem('taskflow_token', token);
    } else {
      sessionStorage.removeItem('taskflow_token');
    }
  } catch {}
}

export function getAuthToken() {
  return memoryToken;
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (memoryToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${memoryToken}`;
  }

  const config = {
    ...options,
    headers,
    credentials: 'include',
  };

  const response = await fetch(url, config);

  if (response.status === 401) {
    // Session expired or unauthenticated
    setAuthToken(null);
  }

  if (response.headers.get('content-type')?.includes('text/csv')) {
    if (!response.ok) throw new Error('Failed to download report.');
    return response.blob();
  }

  let data;
  try {
    data = await response.json();
  } catch {
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return null;
  }

  if (!response.ok) {
    throw new Error(data.error || `HTTP error ${response.status}`);
  }

  return data;
}

// ─── Auth API ───────────────────────────────────────────────────────────────
export async function loginApi(email, password) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data?.token) setAuthToken(data.token);
  return data;
}

export async function logoutApi() {
  try {
    await request('/auth/logout', { method: 'POST' });
  } finally {
    setAuthToken(null);
  }
}

export async function getMeApi() {
  return request('/auth/me');
}

export async function getDemoUsersApi() {
  return request('/auth/demo-users');
}

export async function switchDemoUserApi(userId) {
  const data = await request('/auth/switch-demo-user', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
  if (data?.token) setAuthToken(data.token);
  return data;
}

export async function forgotPasswordApi(email) {
  return request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPasswordApi(token, newPassword) {
  return request('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

// ─── Task Management API ───────────────────────────────────────────────────
export async function fetchTasksApi(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '' && val !== 'all') {
      query.set(key, String(val));
    }
  });
  const qs = query.toString();
  return request(`/tasks${qs ? `?${qs}` : ''}`);
}

export async function fetchTaskDetailApi(taskId) {
  return request(`/tasks/${taskId}`);
}

export async function createTaskApi(taskData) {
  return request('/tasks', {
    method: 'POST',
    body: JSON.stringify(taskData),
  });
}

export async function updateTaskApi(taskId, updates) {
  return request(`/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function patchTaskStatusApi(taskId, status) {
  return request(`/tasks/${taskId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function deleteTaskApi(taskId) {
  return request(`/tasks/${taskId}`, { method: 'DELETE' });
}

export async function bulkTaskActionApi(action, taskIds, value) {
  return request('/tasks/bulk', {
    method: 'POST',
    body: JSON.stringify({ action, task_ids: taskIds, value }),
  });
}

export async function addTaskCommentApi(taskId, comment) {
  return request(`/tasks/${taskId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
}

export async function fetchTaskCommentsApi(taskId) {
  return request(`/tasks/${taskId}/comments`);
}

// ─── Employee & Department API ─────────────────────────────────────────────
export async function fetchEmployeesApi(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v && v !== 'all') query.set(k, String(v));
  });
  const qs = query.toString();
  return request(`/employees${qs ? `?${qs}` : ''}`);
}

export async function fetchEmployeeDetailApi(empId) {
  return request(`/employees/${empId}`);
}

export async function createEmployeeApi(data) {
  return request('/employees', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateEmployeeApi(empId, data) {
  return request(`/employees/${empId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function fetchDepartmentsApi() {
  return request('/departments');
}

export async function createDepartmentApi(data) {
  return request('/departments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ─── Projects & Clients API ────────────────────────────────────────────────
export async function fetchProjectsApi(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v && v !== 'all') query.set(k, String(v));
  });
  const qs = query.toString();
  return request(`/projects${qs ? `?${qs}` : ''}`);
}

export async function fetchProjectDetailApi(projectId) {
  return request(`/projects/${projectId}`);
}

export async function createProjectApi(data) {
  return request('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProjectApi(projectId, data) {
  return request(`/projects/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function fetchClientsApi(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v && v !== 'all') query.set(k, String(v));
  });
  const qs = query.toString();
  return request(`/clients${qs ? `?${qs}` : ''}`);
}

export async function createClientApi(data) {
  return request('/clients', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateClientApi(clientId, data) {
  return request(`/clients/${clientId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ─── Reports & Dashboard API ───────────────────────────────────────────────
export async function fetchDashboardReportsApi() {
  return request('/reports/dashboard');
}

export async function exportTasksCsvApi(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v && v !== 'all') query.set(k, String(v));
  });
  const blob = await request(`/reports/export-csv?${query.toString()}`);
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `taskflow_report_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

// ─── Notifications & Audit API ─────────────────────────────────────────────
export async function fetchNotificationsApi() {
  return request('/notifications');
}

export async function markNotificationReadApi(id) {
  return request(`/notifications/${id}/read`, { method: 'PATCH' });
}

export async function markAllNotificationsReadApi() {
  return request('/notifications/mark-all-read', { method: 'POST' });
}

export async function fetchAuditLogsApi(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v && v !== 'all') query.set(k, String(v));
  });
  return request(`/audit-logs?${query.toString()}`);
}

export async function checkReadinessApi() {
  return request('/ready');
}
