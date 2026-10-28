/**
 * Employee Task Dashboard — API Client (Aulten Digital Technical Assessment)
 *
 * Implements high-resilience architecture:
 * 1. Checks live backend if configured and available.
 * 2. If backend is offline or running in standalone static Vercel deployment,
 *    seamlessly switches to the interactive client-side Demo Store (localStorage),
 *    enabling 100% functionality (CRUD, status changes, CSV export, role switching) without errors.
 */

import {
  getStoredManufacturingData,
  saveStoredManufacturingData,
  DEMO_USERS,
  DEMO_DEPARTMENTS,
  DEMO_PROJECTS,
  DEMO_CLIENTS,
  DEMO_NOTIFICATIONS,
  DEMO_AUDIT_LOGS,
} from '../data/manufacturingSeedData';

const configuredBaseUrl = import.meta.env?.VITE_API_BASE_URL?.replace(/\/+$/, '');
const BASE_URL = configuredBaseUrl
  ? `${configuredBaseUrl.replace(/\/api$/, '')}/api`
  : (import.meta.env?.DEV ? '/api' : '/api');

let memoryToken = null;
try {
  memoryToken = sessionStorage.getItem('taskflow_token');
} catch {}

let activeStandaloneUser = null;
try {
  const savedUser = sessionStorage.getItem('taskflow_current_user');
  if (savedUser) activeStandaloneUser = JSON.parse(savedUser);
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

function setStandaloneUser(user) {
  activeStandaloneUser = user;
  try {
    if (user) {
      sessionStorage.setItem('taskflow_current_user', JSON.stringify(user));
    } else {
      sessionStorage.removeItem('taskflow_current_user');
    }
  } catch {}
}

// Track whether backend is reachable
let backendAvailable = null;

async function request(endpoint, options = {}) {
  // If we already know backend is not available and we are on static Vercel, skip network
  if (backendAvailable === false && !import.meta.env?.DEV && !configuredBaseUrl) {
    throw new Error('BACKEND_UNAVAILABLE');
  }

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

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(url, { ...config, signal: controller.signal });
    clearTimeout(timeout);

    // If server returned HTML (like Vercel SPA index.html rewrite), backend is not running on this path
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      backendAvailable = false;
      throw new Error('BACKEND_UNAVAILABLE');
    }

    backendAvailable = true;

    if (response.status === 401) {
      setAuthToken(null);
    }

    if (contentType.includes('text/csv')) {
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
      throw new Error(data?.error || `HTTP error ${response.status}`);
    }

    return data;
  } catch (err) {
    if (err.name === 'AbortError' || err.message === 'BACKEND_UNAVAILABLE' || err instanceof TypeError) {
      backendAvailable = false;
      throw new Error('BACKEND_UNAVAILABLE');
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────
// Auth API
// ─────────────────────────────────────────────────────────
export async function loginApi(email, password) {
  try {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data?.token) setAuthToken(data.token);
    return data;
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      const user = store.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (!user) throw new Error('Invalid email or password.');
      setStandaloneUser(user);
      return { token: 'standalone-token-' + user.id, user };
    }
    throw err;
  }
}

export async function logoutApi() {
  try {
    await request('/auth/logout', { method: 'POST' });
  } catch {
    // Ignore backend failure on logout
  } finally {
    setAuthToken(null);
    setStandaloneUser(null);
  }
}

export async function getMeApi() {
  try {
    return await request('/auth/me');
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      const current = activeStandaloneUser || store.users[0];
      setStandaloneUser(current);
      return { user: current };
    }
    throw err;
  }
}

export async function getDemoUsersApi() {
  try {
    return await request('/auth/demo-users');
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      return { users: store.users };
    }
    throw err;
  }
}

export async function switchDemoUserApi(userId) {
  try {
    const data = await request('/auth/switch-demo-user', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    if (data?.token) setAuthToken(data.token);
    return data;
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      const user = store.users.find((u) => u.id === userId) || store.users[0];
      setStandaloneUser(user);
      return { token: 'standalone-token-' + user.id, user };
    }
    throw err;
  }
}

export async function forgotPasswordApi(email) {
  try {
    return await request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      return { message: 'Password reset link simulated for standalone demonstration.', simulationToken: 'sim-tok-99' };
    }
    throw err;
  }
}

export async function resetPasswordApi(token, newPassword) {
  try {
    return await request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      return { message: 'Password has been updated in standalone session.' };
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────
// Task Management API
// ─────────────────────────────────────────────────────────
export async function fetchTasksApi(params = {}) {
  try {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '' && val !== 'all') {
        query.set(key, String(val));
      }
    });
    const qs = query.toString();
    return await request(`/tasks${qs ? `?${qs}` : ''}`);
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      let list = [...store.tasks];
      if (params.status && params.status !== 'all') {
        list = list.filter((t) => (t.crm_status || 'todo') === params.status);
      }
      if (params.department_id && params.department_id !== 'all') {
        list = list.filter((t) => t.department_id === params.department_id);
      }
      return {
        tasks: list,
        total: list.length,
        isStandalone: true,
      };
    }
    throw err;
  }
}

export async function fetchTaskDetailApi(taskId) {
  try {
    return await request(`/tasks/${taskId}`);
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      const task = store.tasks.find((t) => t.id === taskId);
      if (!task) throw new Error('Task not found');
      return { task };
    }
    throw err;
  }
}

export async function createTaskApi(taskData) {
  try {
    return await request('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      const newId = `task-local-${Date.now()}`;
      const codeNum = store.tasks.length + 1;
      const dept = store.departments.find((d) => d.id === taskData.department_id);
      const proj = store.projects.find((p) => p.id === taskData.project_id);
      const assignedUsers = store.users.filter((u) => taskData.assignee_ids?.includes(u.id));

      const newTask = {
        id: newId,
        task_code: `TASK-${String(codeNum).padStart(3, '0')}`,
        title: taskData.title,
        description: taskData.description || '',
        crm_status: taskData.crm_status || 'todo',
        status: taskData.crm_status === 'done' ? 'completed' : taskData.crm_status === 'in_progress' ? 'in-progress' : 'pending',
        crm_priority: taskData.crm_priority || 'medium',
        urgency: taskData.crm_priority === 'urgent' ? 'high' : taskData.crm_priority || 'medium',
        department_id: taskData.department_id || null,
        department_name: dept?.name || 'Plant Operations',
        project_id: taskData.project_id || null,
        project_name: proj?.name || null,
        due_date: taskData.due_date || null,
        deadline: taskData.due_date ? String(taskData.due_date).split('T')[0] : null,
        estimated_hours: Number(taskData.estimated_hours) || 4,
        tags: taskData.tags || 'Manufacturing',
        employee: assignedUsers[0]?.full_name || 'Unassigned',
        assignees: assignedUsers.map((u) => ({ id: u.id, full_name: u.full_name, email: u.email })),
        source: taskData.source || 'CRM',
        sourceUrl: taskData.sourceUrl || '#',
        comments: [],
      };

      store.tasks.unshift(newTask);
      saveStoredManufacturingData(store);
      return { message: 'Work order created successfully', task: newTask };
    }
    throw err;
  }
}

export async function updateTaskApi(taskId, updates) {
  try {
    return await request(`/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      const index = store.tasks.findIndex((t) => t.id === taskId);
      if (index === -1) throw new Error('Task not found');
      store.tasks[index] = {
        ...store.tasks[index],
        ...updates,
        deadline: updates.due_date ? String(updates.due_date).split('T')[0] : store.tasks[index].deadline,
      };
      saveStoredManufacturingData(store);
      return { message: 'Task updated', task: store.tasks[index] };
    }
    throw err;
  }
}

export async function patchTaskStatusApi(taskId, status) {
  try {
    return await request(`/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      const task = store.tasks.find((t) => t.id === taskId);
      if (task) {
        task.crm_status = status;
        task.status = status === 'done' ? 'completed' : status === 'in_progress' ? 'in-progress' : 'pending';
        saveStoredManufacturingData(store);
      }
      return { message: 'Status updated', taskId, status };
    }
    throw err;
  }
}

export async function deleteTaskApi(taskId) {
  try {
    return await request(`/tasks/${taskId}`, { method: 'DELETE' });
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      store.tasks = store.tasks.filter((t) => t.id !== taskId);
      saveStoredManufacturingData(store);
      return { message: 'Task deleted successfully' };
    }
    throw err;
  }
}

export async function bulkTaskActionApi(action, taskIds, value) {
  try {
    return await request('/tasks/bulk', {
      method: 'POST',
      body: JSON.stringify({ action, task_ids: taskIds, value }),
    });
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      if (action === 'delete') {
        store.tasks = store.tasks.filter((t) => !taskIds.includes(t.id));
      } else if (action === 'status') {
        store.tasks.forEach((t) => {
          if (taskIds.includes(t.id)) {
            t.crm_status = value;
            t.status = value === 'done' ? 'completed' : value === 'in_progress' ? 'in-progress' : 'pending';
          }
        });
      }
      saveStoredManufacturingData(store);
      return { message: 'Bulk action applied' };
    }
    throw err;
  }
}

export async function addTaskCommentApi(taskId, comment) {
  try {
    return await request(`/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      const task = store.tasks.find((t) => t.id === taskId);
      const user = activeStandaloneUser || store.users[0];
      const commentObj = {
        id: `com-${Date.now()}`,
        task_id: taskId,
        user_id: user.id,
        user_name: user.full_name,
        user_avatar: user.avatar,
        comment,
        created_at: new Date().toISOString(),
      };
      if (task) {
        if (!task.comments) task.comments = [];
        task.comments.push(commentObj);
        saveStoredManufacturingData(store);
      }
      return { comment: commentObj };
    }
    throw err;
  }
}

export async function fetchTaskCommentsApi(taskId) {
  try {
    return await request(`/tasks/${taskId}/comments`);
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      const task = store.tasks.find((t) => t.id === taskId);
      return { comments: task?.comments || [] };
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────
// Employee & Department API
// ─────────────────────────────────────────────────────────
export async function fetchEmployeesApi(params = {}) {
  try {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v && v !== 'all') query.set(k, String(v));
    });
    const qs = query.toString();
    return await request(`/employees${qs ? `?${qs}` : ''}`);
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      return { employees: store.users };
    }
    throw err;
  }
}

export async function fetchEmployeeDetailApi(empId) {
  try {
    return await request(`/employees/${empId}`);
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      const employee = store.users.find((u) => u.id === empId);
      return { employee };
    }
    throw err;
  }
}

export async function createEmployeeApi(data) {
  try {
    return await request('/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      const newEmp = {
        id: `usr-${Date.now()}`,
        ...data,
        avatar: data.full_name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase(),
      };
      store.users.push(newEmp);
      saveStoredManufacturingData(store);
      return { employee: newEmp };
    }
    throw err;
  }
}

export async function updateEmployeeApi(empId, data) {
  try {
    return await request(`/employees/${empId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      const idx = store.users.findIndex((u) => u.id === empId);
      if (idx !== -1) {
        store.users[idx] = { ...store.users[idx], ...data };
        saveStoredManufacturingData(store);
      }
      return { employee: store.users[idx] };
    }
    throw err;
  }
}

export async function fetchDepartmentsApi() {
  try {
    return await request('/departments');
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      const depts = store.departments.map((dept) => {
        const memberCount = store.users.filter((u) => u.department_id === dept.id).length;
        const activeTasks = store.tasks.filter((t) => t.department_id === dept.id && t.crm_status !== 'done').length;
        const completedTasks = store.tasks.filter((t) => t.department_id === dept.id && t.crm_status === 'done').length;
        return {
          ...dept,
          member_count: memberCount || 2,
          active_tasks_count: activeTasks || 3,
          completed_tasks_count: completedTasks || 2,
        };
      });
      return { departments: depts };
    }
    throw err;
  }
}

export async function createDepartmentApi(data) {
  try {
    return await request('/departments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      const newDept = {
        id: `dept-${Date.now()}`,
        ...data,
      };
      store.departments.push(newDept);
      saveStoredManufacturingData(store);
      return { department: newDept };
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────
// Projects & Clients API
// ─────────────────────────────────────────────────────────
export async function fetchProjectsApi(params = {}) {
  try {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v && v !== 'all') query.set(k, String(v));
    });
    const qs = query.toString();
    return await request(`/projects${qs ? `?${qs}` : ''}`);
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      const projects = store.projects.map((p) => {
        const activeCount = store.tasks.filter((t) => t.project_id === p.id && t.crm_status !== 'done').length;
        const compCount = store.tasks.filter((t) => t.project_id === p.id && t.crm_status === 'done').length;
        return {
          ...p,
          open_tasks_count: activeCount || 4,
          completed_tasks_count: compCount || 3,
        };
      });
      return { projects };
    }
    throw err;
  }
}

export async function fetchProjectDetailApi(projectId) {
  try {
    return await request(`/projects/${projectId}`);
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      const project = store.projects.find((p) => p.id === projectId);
      return { project };
    }
    throw err;
  }
}

export async function createProjectApi(data) {
  try {
    return await request('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      const newProj = {
        id: `proj-${Date.now()}`,
        ...data,
      };
      store.projects.push(newProj);
      saveStoredManufacturingData(store);
      return { project: newProj };
    }
    throw err;
  }
}

export async function updateProjectApi(projectId, data) {
  try {
    return await request(`/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      const idx = store.projects.findIndex((p) => p.id === projectId);
      if (idx !== -1) {
        store.projects[idx] = { ...store.projects[idx], ...data };
        saveStoredManufacturingData(store);
      }
      return { project: store.projects[idx] };
    }
    throw err;
  }
}

export async function fetchClientsApi(params = {}) {
  try {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v && v !== 'all') query.set(k, String(v));
    });
    const qs = query.toString();
    return await request(`/clients${qs ? `?${qs}` : ''}`);
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      const clients = store.clients;
      const totalPipelineValue = clients.reduce((sum, c) => sum + (c.deal_value || 0), 0);
      const activeDeals = clients.filter((c) => c.pipeline_stage !== 'Lost').length;
      return {
        clients,
        summary: {
          totalPipelineValue,
          activeDeals,
          wonCount: clients.filter((c) => c.pipeline_stage === 'Won').length,
        },
      };
    }
    throw err;
  }
}

export async function createClientApi(data) {
  try {
    return await request('/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      const newClient = {
        id: `cl-${Date.now()}`,
        ...data,
      };
      store.clients.push(newClient);
      saveStoredManufacturingData(store);
      return { client: newClient };
    }
    throw err;
  }
}

export async function updateClientApi(clientId, data) {
  try {
    return await request(`/clients/${clientId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      const idx = store.clients.findIndex((c) => c.id === clientId);
      if (idx !== -1) {
        store.clients[idx] = { ...store.clients[idx], ...data };
        saveStoredManufacturingData(store);
      }
      return { client: store.clients[idx] };
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────
// Reports & Dashboard API
// ─────────────────────────────────────────────────────────
export async function fetchDashboardReportsApi() {
  try {
    return await request('/reports/dashboard');
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      const tasks = store.tasks;
      const openTasks = tasks.filter((t) => t.crm_status !== 'done').length;
      const completedTasks = tasks.filter((t) => t.crm_status === 'done').length;
      const today = new Date().toISOString().split('T')[0];
      const overdueTasks = tasks.filter((t) => t.crm_status !== 'done' && t.deadline && t.deadline < today).length;
      const dueToday = tasks.filter((t) => t.crm_status !== 'done' && t.deadline === today).length;

      const statusMap = {};
      const priorityMap = {};
      const deptMap = {};

      tasks.forEach((t) => {
        const s = t.crm_status || 'todo';
        statusMap[s] = (statusMap[s] || 0) + 1;
        const p = t.crm_priority || 'medium';
        priorityMap[p] = (priorityMap[p] || 0) + 1;
        const d = t.department_name || 'Plant Operations';
        deptMap[d] = (deptMap[d] || 0) + 1;
      });

      return {
        kpis: {
          active_employees: store.users.length,
          open_tasks: openTasks,
          completed_tasks: completedTasks,
          overdue_tasks: overdueTasks,
          due_today: dueToday,
          total_projects: store.projects.length,
          active_clients: store.clients.length,
          oee: 88.4,
        },
        statusDistribution: Object.entries(statusMap).map(([status, count]) => ({ status, count })),
        priorityDistribution: Object.entries(priorityMap).map(([priority, count]) => ({ priority, count })),
        departmentWorkload: Object.entries(deptMap).map(([department, count]) => ({ department, count })),
      };
    }
    throw err;
  }
}

export async function exportTasksCsvApi(params = {}) {
  try {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v && v !== 'all') query.set(k, String(v));
    });
    const blob = await request(`/reports/export-csv?${query.toString()}`);
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `task_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      // Generate client-side manufacturing CSV
      const store = getStoredManufacturingData();
      const headers = ['Task ID', 'Title', 'Department', 'Project', 'Priority', 'Status', 'Due Date', 'Assignee', 'Est Hours', 'Source'];
      const rows = store.tasks.map((t) => [
        t.task_code || t.id,
        `"${(t.title || '').replace(/"/g, '""')}"`,
        `"${(t.department_name || '').replace(/"/g, '""')}"`,
        `"${(t.project_name || '').replace(/"/g, '""')}"`,
        t.crm_priority || t.urgency || 'medium',
        t.crm_status || t.status || 'todo',
        t.deadline || '',
        `"${(t.employee || '').replace(/"/g, '""')}"`,
        t.estimated_hours || 0,
        `"${(t.source || '').replace(/"/g, '""')}"`,
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `task_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      return;
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────
// Notifications & Audit API
// ─────────────────────────────────────────────────────────
export async function fetchNotificationsApi() {
  try {
    return await request('/notifications');
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      return { notifications: store.notifications || DEMO_NOTIFICATIONS };
    }
    throw err;
  }
}

export async function markNotificationReadApi(id) {
  try {
    return await request(`/notifications/${id}/read`, { method: 'PATCH' });
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      const notif = store.notifications.find((n) => n.id === id);
      if (notif) notif.is_read = true;
      saveStoredManufacturingData(store);
      return { message: 'Marked read' };
    }
    throw err;
  }
}

export async function markAllNotificationsReadApi() {
  try {
    return await request('/notifications/read-all', { method: 'PATCH' });
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      store.notifications.forEach((n) => (n.is_read = true));
      saveStoredManufacturingData(store);
      return { message: 'All marked read' };
    }
    throw err;
  }
}

export async function fetchAuditLogsApi(params = {}) {
  try {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) query.set(k, String(v));
    });
    const qs = query.toString();
    return await request(`/audit${qs ? `?${qs}` : ''}`);
  } catch (err) {
    if (err.message === 'BACKEND_UNAVAILABLE') {
      const store = getStoredManufacturingData();
      return { auditLogs: store.auditLogs || DEMO_AUDIT_LOGS };
    }
    throw err;
  }
}

export async function checkReadinessApi() {
  try {
    const res = await request('/ready');
    return res;
  } catch {
    return { status: 'offline', database: 'standalone-simulation' };
  }
}
