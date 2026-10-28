import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  getMeApi,
  logoutApi,
  getDemoUsersApi,
  switchDemoUserApi,
  fetchTasksApi,
  createTaskApi,
  updateTaskApi,
  patchTaskStatusApi,
  deleteTaskApi,
  fetchEmployeesApi,
  fetchDepartmentsApi,
  fetchProjectsApi,
  fetchClientsApi,
  fetchDashboardReportsApi,
  fetchNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
  fetchAuditLogsApi,
  checkReadinessApi,
} from './api/crm';
import FilterBar from './components/FilterBar';
import TaskList from './components/TaskList';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';
import TaskDetailDrawer from './components/TaskDetailDrawer';
import TeamAnalytics from './components/TeamAnalytics';
import OverviewInsights from './components/OverviewInsights';
import KanbanBoard from './components/KanbanBoard';
import CalendarView from './components/CalendarView';
import EmployeesView from './components/EmployeesView';
import DepartmentsView from './components/DepartmentsView';
import ProjectsView from './components/ProjectsView';
import ClientsCrmView from './components/ClientsCrmView';
import ReportsView from './components/ReportsView';
import ActivityLogView from './components/ActivityLogView';
import NotificationsView from './components/NotificationsView';
import CreateTaskModal from './components/CreateTaskModal';
import AuthModal from './components/AuthModal';
import { getTaskMetrics, matchesTaskFilters } from './utils/taskMetrics';
import { getStoredManufacturingData } from './data/manufacturingSeedData';

export default function App() {
  // Current user & Auth state
  const [currentUser, setCurrentUser] = useState(null);
  const [demoUsers, setDemoUsers] = useState([]);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  // App Theme
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('taskflow_theme') || 'dark';
    } catch {
      return 'dark';
    }
  });

  // Navigation
  const [activePage, setActivePage] = useState('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);

  // Data collections
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [clientSummary, setClientSummary] = useState({});
  const [reportData, setReportData] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [view, setView] = useState('list'); // 'list' | 'board'

  // Loading & Connection state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dbReady, setDbReady] = useState(false);

  const searchInputRef = useRef(null);

  // Sync theme to DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('taskflow_theme', theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const focusSearch = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  // Initial Auth & Demo Data bootstrap
  const initAuth = useCallback(async () => {
    try {
      const demoRes = await getDemoUsersApi();
      if (demoRes?.users) {
        setDemoUsers(demoRes.users);
      }

      const meRes = await getMeApi();
      if (meRes?.user) {
        setCurrentUser(meRes.user);
        return meRes.user;
      } else if (demoRes?.users && demoRes.users.length > 0) {
        const autoUser = demoRes.users[0];
        const switchRes = await switchDemoUserApi(autoUser.id);
        setCurrentUser(switchRes.user);
        return switchRes.user;
      }
    } catch {
      // In standalone fallback mode
      const defaultStore = getStoredManufacturingData();
      setCurrentUser(defaultStore.users[0]);
      setDemoUsers(defaultStore.users);
    }
    return null;
  }, []);

  // Load all manufacturing datasets
  const loadCrmData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Probe readiness
      try {
        const readyRes = await checkReadinessApi();
        setDbReady(readyRes?.status === 'ready');
      } catch {
        setDbReady(false);
      }

      // 2. Fetch Tasks
      let loadedTasks = [];
      try {
        const tasksRes = await fetchTasksApi({ limit: 100 });
        if (tasksRes?.tasks && tasksRes.tasks.length > 0) {
          loadedTasks = tasksRes.tasks.map((t) => ({
            ...t,
            id: t.id,
            task_code: t.task_code || 'WO-501',
            deadline: t.deadline || (t.due_date ? String(t.due_date).split('T')[0] : null),
            urgency: t.urgency || (t.crm_priority === 'urgent' ? 'high' : (t.crm_priority || 'medium')),
            status: t.status || (t.crm_status === 'done' ? 'completed' : (t.crm_status === 'in_progress' ? 'in-progress' : 'pending')),
            employee: t.employee || t.assignees?.[0]?.full_name || 'Unassigned',
            source: t.source || 'Plant Work Order',
          }));
        }
      } catch (err) {
        console.warn('Could not load live tasks, using local manufacturing store:', err);
      }

      // If empty, load directly from local manufacturing store
      if (loadedTasks.length === 0) {
        const store = getStoredManufacturingData();
        loadedTasks = store.tasks;
      }
      setTasks(loadedTasks);

      // 3. Load supplementary datasets
      await Promise.allSettled([
        fetchEmployeesApi().then((r) => r?.employees && setEmployees(r.employees)),
        fetchDepartmentsApi().then((r) => r?.departments && setDepartments(r.departments)),
        fetchProjectsApi().then((r) => r?.projects && setProjects(r.projects)),
        fetchClientsApi().then((r) => {
          if (r?.clients) setClients(r.clients);
          if (r?.summary) setClientSummary(r.summary);
        }),
        fetchDashboardReportsApi().then((r) => r && setReportData(r)),
        fetchNotificationsApi().then((r) => r?.notifications && setNotifications(r.notifications)),
        fetchAuditLogsApi().then((r) => r?.auditLogs && setAuditLogs(r.auditLogs)),
      ]);
    } catch (err) {
      console.error('Data load error:', err);
      // Fallback guarantees zero blank screens
      const store = getStoredManufacturingData();
      setTasks(store.tasks);
      setEmployees(store.users);
      setDepartments(store.departments);
      setProjects(store.projects);
      setClients(store.clients);
      setNotifications(store.notifications);
      setAuditLogs(store.auditLogs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth().then(() => {
      loadCrmData();
    });
  }, [initAuth, loadCrmData]);

  // Role Switcher Handler
  const handleSwitchDemoRole = async (userId) => {
    setRoleSwitcherOpen(false);
    setLoading(true);
    try {
      const res = await switchDemoUserApi(userId);
      setCurrentUser(res.user);
      await loadCrmData();
    } catch (err) {
      alert('Failed to switch role: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutApi();
    setCurrentUser(null);
    setAuthModalOpen(true);
  };

  // Work Order Actions
  const handleCreateOrUpdateTask = async (taskPayload) => {
    if (editingTask?.id) {
      await updateTaskApi(editingTask.id, taskPayload);
    } else {
      await createTaskApi(taskPayload);
    }
    setEditingTask(null);
    setCreateTaskModalOpen(false);
    await loadCrmData();
  };

  const handlePatchStatus = async (taskId, newStatus) => {
    try {
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? {
          ...t,
          crm_status: newStatus,
          status: newStatus === 'done' ? 'completed' : newStatus === 'in_progress' ? 'in-progress' : 'pending',
        } : t))
      );
      await patchTaskStatusApi(taskId, newStatus);
    } catch (err) {
      alert('Failed to update status: ' + err.message);
      await loadCrmData();
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this work order?')) return;
    try {
      await deleteTaskApi(taskId);
      if (selectedTask?.id === taskId) setSelectedTask(null);
      await loadCrmData();
    } catch (err) {
      alert('Failed to delete work order: ' + err.message);
    }
  };

  // Notification actions
  const handleMarkNotificationRead = async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    await markNotificationReadApi(id);
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await markAllNotificationsReadApi();
  };

  // Metrics & Filtering
  const taskMetrics = useMemo(() => getTaskMetrics(tasks), [tasks]);
  const inProgressCount = tasks.filter((task) => task.crm_status === 'in_progress' || task.status === 'in-progress').length;
  const completedCount = taskMetrics.completed;

  // Filtered task set
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Page-specific filter
      if (activePage === 'my_tasks') {
        const isAssigned =
          task.assignees?.some((a) => a.id === currentUser?.id || a.email === currentUser?.email) ||
          task.employee?.toLowerCase() === currentUser?.full_name?.toLowerCase();
        if (!isAssigned) return false;
      }
      if (activePage === 'crm' && task.source !== 'CRM') return false;
      if (activePage === 'helpdesk' && task.source !== 'Helpdesk') return false;

      // Project filter
      if (projectFilter !== 'all' && task.project_id !== projectFilter) return false;

      // Department filter
      if (deptFilter !== 'all' && task.department_id !== deptFilter) return false;

      return matchesTaskFilters(task, {
        employee: employeeFilter,
        status: statusFilter,
        priority: priorityFilter,
        source: 'all',
        page: activePage,
        overdueOnly,
        search,
      });
    });
  }, [tasks, activePage, currentUser, projectFilter, deptFilter, employeeFilter, statusFilter, priorityFilter, overdueOnly, search]);

  const clearFilters = useCallback(() => {
    setEmployeeFilter('all');
    setStatusFilter('all');
    setPriorityFilter('all');
    setProjectFilter('all');
    setDeptFilter('all');
    setSearch('');
    setOverdueOnly(false);
  }, []);

  const navigate = (page) => {
    setActivePage(page);
    setMobileNavOpen(false);
    setNotificationsOpen(false);
  };

  const openEmployeeTasks = useCallback((employeeName) => {
    clearFilters();
    setEmployeeFilter(employeeName);
    setActivePage('all_tasks');
  }, [clearFilters]);

  const filterByProject = useCallback((projId) => {
    clearFilters();
    setProjectFilter(projId);
    setActivePage('all_tasks');
  }, [clearFilters]);

  const filterByDepartment = useCallback((deptId) => {
    clearFilters();
    setDeptFilter(deptId);
    setActivePage('all_tasks');
  }, [clearFilters]);

  // Role permissions
  const role = currentUser?.crm_role || 'employee';
  const isSuperAdmin = role === 'super_admin';
  const isAdmin = role === 'admin' || isSuperAdmin;
  const isManager = role === 'manager' || isAdmin;

  // Page titles
  const pageTitles = {
    overview: ['Plant Operations Overview', 'Bharat Precision Dynamics • Real-time shopfloor telemetry & throughput'],
    my_tasks: ['My Assigned Work Orders', `Active machine operations and QA tasks for ${currentUser?.full_name || 'you'}`],
    all_tasks: ['All Plant Work Orders', 'Centralized manufacturing operations across machining cells and stamping bays'],
    kanban: ['Shopfloor Kanban Board', 'Interactive visual lean manufacturing workflow from Shift Queue to Dispatched'],
    calendar: ['Production Schedule & Deliveries', 'Shift calendar, preventive machine maintenance, and OEM target dates'],
    employees: ['Plant Workforce Directory', 'Precision engineering specialists, CNC machinists, and qualifications'],
    departments: ['Manufacturing Divisions', 'High-precision machining cells, Metallurgy laboratory, and QA divisions'],
    projects: ['Heavy Engineering Projects', 'Aerospace defense manifolds, EV powertrain casings, and turbine deliverables'],
    clients: ['OEM Clients & Contracts', 'Tata Motors, Mahindra, BHEL, L&T, and Godrej Aerospace client accounts'],
    reports: ['Plant Performance & OEE Reports', 'Overall Equipment Effectiveness (88.4%), shift yields, and CSV exports'],
    notifications: ['Plant Dispatch & Alerts', 'Machine alarms, metrology sign-offs, and critical safety notifications'],
    activity: ['Shopfloor Traceability Log', 'ISO 9001 quality audit trail, work order modifications, and calibrations'],
    settings: ['Plant Settings & System', 'Work order preferences, database connectivity, and telemetry configuration'],
    analytics: ['Legacy Throughput Analytics', 'Historical plant throughput analytics archive'],
    crm: ['OEM Client Dispatch Orders', 'Customer delivery records and logistics pipeline'],
    helpdesk: ['Equipment Maintenance Dispatch', 'Preventive and breakdown maintenance dispatch log'],
  };

  const currentTitle = pageTitles[activePage] || pageTitles.overview;
  const todayLabel = 'Wednesday, October 28, 2026';

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="app-shell">
      {mobileNavOpen && (
        <button
          className="nav-scrim"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* ── Sidebar Navigation ─────────────────────────────────── */}
      <aside className={`sidebar${mobileNavOpen ? ' sidebar--open' : ''}`} aria-label="Main navigation">
        <button className="brand" type="button" onClick={() => navigate('overview')} aria-label="Bharat Precision Dynamics">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span>bharat<span className="brand-accent">precision</span></span>
        </button>

        {/* Workspace Switcher / Org Badge */}
        <div className="workspace-switcher">
          <span className="workspace-avatar">BPD</span>
          <div className="workspace-copy">
            <strong>Bharat Precision Dynamics</strong>
            <small>Plant 1 • Heavy Engineering OS</small>
          </div>
          <span
            className={`sync-indicator${dbReady ? '' : ' sync-indicator--demo'}`}
            title={dbReady ? 'Database Connected (PostgreSQL)' : 'Interactive Manufacturing Simulation'}
          />
        </div>

        <nav className="sidebar-nav">
          <p className="nav-label">Shopfloor Operations</p>
          <button className={`nav-item${activePage === 'overview' ? ' is-active' : ''}`} onClick={() => navigate('overview')}>
            <span className="nav-icon">📊</span>Overview
          </button>
          <button className={`nav-item${activePage === 'my_tasks' ? ' is-active' : ''}`} onClick={() => navigate('my_tasks')}>
            <span className="nav-icon">👷</span>My Work Orders
          </button>
          <button className={`nav-item${activePage === 'all_tasks' ? ' is-active' : ''}`} onClick={() => navigate('all_tasks')}>
            <span className="nav-icon">📋</span>All Work Orders<span className="nav-count">{tasks.length}</span>
          </button>
          <button className={`nav-item${activePage === 'kanban' ? ' is-active' : ''}`} onClick={() => navigate('kanban')}>
            <span className="nav-icon">🗂️</span>Kanban Board
          </button>
          <button className={`nav-item${activePage === 'calendar' ? ' is-active' : ''}`} onClick={() => navigate('calendar')}>
            <span className="nav-icon">📅</span>Shift Schedule
          </button>

          <p className="nav-label" style={{ marginTop: '12px' }}>Organization & Plant</p>
          <button className={`nav-item${activePage === 'employees' ? ' is-active' : ''}`} onClick={() => navigate('employees')}>
            <span className="nav-icon">👥</span>Workforce<span className="nav-count">{employees.length || '18'}</span>
          </button>
          <button className={`nav-item${activePage === 'departments' ? ' is-active' : ''}`} onClick={() => navigate('departments')}>
            <span className="nav-icon">🏭</span>Divisions<span className="nav-count">{departments.length || '12'}</span>
          </button>
          <button className={`nav-item${activePage === 'projects' ? ' is-active' : ''}`} onClick={() => navigate('projects')}>
            <span className="nav-icon">📁</span>OEM Projects<span className="nav-count">{projects.length || '7'}</span>
          </button>

          {isManager && (
            <button className={`nav-item${activePage === 'clients' ? ' is-active' : ''}`} onClick={() => navigate('clients')}>
              <span className="nav-icon">🏢</span>OEM Clients<span className="nav-count">{clients.length || '7'}</span>
            </button>
          )}

          <button className={`nav-item${activePage === 'reports' ? ' is-active' : ''}`} onClick={() => navigate('reports')}>
            <span className="nav-icon">📈</span>OEE & Reports
          </button>

          <button className={`nav-item${activePage === 'notifications' ? ' is-active' : ''}`} onClick={() => navigate('notifications')}>
            <span className="nav-icon">🔔</span>Plant Alerts
            {unreadCount > 0 && <span className="nav-count text-red">{unreadCount}</span>}
          </button>

          {isAdmin && (
            <button className={`nav-item${activePage === 'activity' ? ' is-active' : ''}`} onClick={() => navigate('activity')}>
              <span className="nav-icon">📜</span>Traceability Log
            </button>
          )}

          <p className="nav-label" style={{ marginTop: '12px' }}>Integration Feeds</p>
          <button className={`nav-item${activePage === 'crm' ? ' is-active' : ''}`} onClick={() => navigate('crm')}>
            <span className="source-dot source-dot--crm" />OEM Logistics
          </button>
          <button className={`nav-item${activePage === 'helpdesk' ? ' is-active' : ''}`} onClick={() => navigate('helpdesk')}>
            <span className="source-dot source-dot--helpdesk" />Maintenance Tickets
          </button>
        </nav>

        <div className="sidebar-bottom">
          <button className={`nav-item settings-link${activePage === 'settings' ? ' is-active' : ''}`} onClick={() => navigate('settings')}>
            <span className="nav-icon">⚙️</span>Plant Settings
          </button>
          <div className="sidebar-profile" onClick={() => setAuthModalOpen(true)} style={{ cursor: 'pointer' }}>
            <span className="profile-avatar">
              {currentUser?.avatar || currentUser?.full_name?.substring(0, 2).toUpperCase() || 'AS'}
            </span>
            <div className="profile-copy">
              <strong>{currentUser?.full_name || 'Aarav Sharma'}</strong>
              <small>{currentUser?.crm_role ? currentUser.crm_role.replace('_', ' ') : 'Plant Operations'} • Switch</small>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content Shell ─────────────────────────────────── */}
      <div className="main-shell">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">
            ☰
          </button>

          <div className="breadcrumbs">
            <span>Bharat Precision</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{currentTitle[0]}</strong>
          </div>

          <div className="plant-status-pill" title="Current Shopfloor Telemetry">
            <span className="plant-status-dot" />
            <span>Shift 1 Active • OEE 88.4%</span>
          </div>

          {/* Global Search Bar */}
          <div className="global-search" role="search">
            <span aria-hidden="true">🔍</span>
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Search work orders, assets, specialists... (Ctrl+K)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Global work order search"
            />
            <kbd>Ctrl+K</kbd>
          </div>

          <div className="topbar-actions">
            {/* Quick Demo Role Switcher */}
            <div className="role-switcher-wrap" style={{ position: 'relative' }}>
              <button
                type="button"
                className="role-switcher-button"
                onClick={() => setRoleSwitcherOpen((prev) => !prev)}
                title="Switch specialist role persona"
              >
                <span>👤 {currentUser?.full_name?.split(' ')[0] || 'Aarav'} ({currentUser?.crm_role ? currentUser.crm_role.replace('_', ' ') : 'Super Admin'})</span>
                <span className="workspace-chevron" aria-hidden="true">▾</span>
              </button>

              {roleSwitcherOpen && (
                <div className="notification-popover" style={{ width: '280px' }}>
                  <div className="popover-heading">
                    <strong>Switch Specialist Persona</strong>
                    <span>Indian Workforce</span>
                  </div>
                  {demoUsers.length > 0 ? (
                    demoUsers.slice(0, 6).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        className="notification-item"
                        style={{ width: '100%', background: 'transparent', border: 0, cursor: 'pointer', textAlign: 'left' }}
                        onClick={() => handleSwitchDemoRole(u.id)}
                      >
                        <span className="mini-avatar">{u.avatar || u.full_name?.substring(0, 2).toUpperCase()}</span>
                        <span>
                          <strong>{u.full_name}</strong>
                          <small>{u.designation || u.crm_role}</small>
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="notification-empty">No demo accounts loaded.</p>
                  )}
                </div>
              )}
            </div>

            {/* Light / Dark Mode Toggle */}
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {/* Notifications Popover */}
            <div className="notification-wrap">
              <button
                className="icon-button notification-button"
                aria-label={`${unreadCount} alerts`}
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <span aria-hidden="true">🔔</span>
                {unreadCount > 0 && <i />}
              </button>

              {notificationsOpen && (
                <div className="notification-popover">
                  <div className="popover-heading">
                    <strong>Plant Dispatch & Safety Alerts</strong>
                    <span>{unreadCount} unread</span>
                  </div>
                  {notifications.length ? (
                    notifications.slice(0, 4).map((n) => (
                      <div
                        key={n.id}
                        className="notification-item"
                        onClick={() => {
                          handleMarkNotificationRead(n.id);
                          setNotificationsOpen(false);
                          navigate('notifications');
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <span className="overdue-mark" />
                        <span>
                          <strong>{n.title}</strong>
                          <small>{n.message}</small>
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="notification-empty">You're all caught up! Zero alarms.</p>
                  )}
                  {notifications.length > 4 && (
                    <button
                      type="button"
                      className="button button--secondary button--sm button--full"
                      style={{ marginTop: '8px' }}
                      onClick={() => {
                        setNotificationsOpen(false);
                        navigate('notifications');
                      }}
                    >
                      View All Alerts →
                    </button>
                  )}
                </div>
              )}
            </div>

            <span className="topbar-divider" />

            {/* New Work Order Action */}
            <button
              type="button"
              className="button button--primary button--sm"
              onClick={() => {
                setEditingTask(null);
                setCreateTaskModalOpen(true);
              }}
            >
              + Issue Work Order
            </button>
          </div>
        </header>

        {/* ── Main Page Content Router ───────────────────────────── */}
        <main className="content" id="main-content">
          {loading && tasks.length === 0 ? (
            <LoadingSpinner />
          ) : error && tasks.length === 0 ? (
            <ErrorMessage error={error} onRetry={loadCrmData} />
          ) : activePage === 'kanban' ? (
            <KanbanBoard
              tasks={filteredTasks}
              onStatusChange={handlePatchStatus}
              onSelectTask={setSelectedTask}
              onNewTask={() => {
                setEditingTask(null);
                setCreateTaskModalOpen(true);
              }}
            />
          ) : activePage === 'calendar' ? (
            <CalendarView
              tasks={tasks}
              onSelectTask={setSelectedTask}
              onNewTask={() => {
                setEditingTask(null);
                setCreateTaskModalOpen(true);
              }}
            />
          ) : activePage === 'employees' ? (
            <EmployeesView
              employees={employees}
              departments={departments}
              currentUser={currentUser}
              onSelectEmployeeTasks={openEmployeeTasks}
            />
          ) : activePage === 'departments' ? (
            <DepartmentsView
              departments={departments}
              currentUser={currentUser}
              onFilterByDepartment={filterByDepartment}
            />
          ) : activePage === 'projects' ? (
            <ProjectsView
              projects={projects}
              clients={clients}
              currentUser={currentUser}
              onFilterByProject={filterByProject}
            />
          ) : activePage === 'clients' ? (
            <ClientsCrmView
              clients={clients}
              summary={clientSummary}
              currentUser={currentUser}
            />
          ) : activePage === 'reports' ? (
            <ReportsView
              reportData={reportData}
              loading={loading}
              onRefresh={loadCrmData}
            />
          ) : activePage === 'activity' ? (
            <ActivityLogView
              auditLogs={auditLogs}
              loading={loading}
              onRefresh={loadCrmData}
            />
          ) : activePage === 'notifications' ? (
            <NotificationsView
              notifications={notifications}
              onMarkRead={handleMarkNotificationRead}
              onMarkAllRead={handleMarkAllNotificationsRead}
            />
          ) : activePage === 'analytics' ? (
            <TeamAnalytics tasks={tasks} onSelectEmployee={openEmployeeTasks} />
          ) : activePage === 'settings' ? (
            <section className="settings-page">
              <div className="page-heading">
                <div>
                  <p className="eyebrow">BHARAT PRECISION DYNAMICS LTD.</p>
                  <h1>{currentTitle[0]}</h1>
                  <p>{currentTitle[1]}</p>
                </div>
              </div>

              <section className="settings-section">
                <div className="section-heading">
                  <div>
                    <h2>Authentication & Profile</h2>
                    <p>Current logged in plant personnel session and security role.</p>
                  </div>
                  <button type="button" className="button button--secondary" onClick={() => setAuthModalOpen(true)}>
                    Switch Specialist Persona
                  </button>
                </div>

                <div className="connection-row">
                  <span className="employee-avatar mini-avatar">
                    {currentUser?.avatar || 'AS'}
                  </span>
                  <div className="connection-info">
                    <strong>{currentUser?.full_name || 'Aarav Sharma'}</strong>
                    <small>{currentUser?.email} • Role: {currentUser?.crm_role} ({currentUser?.designation})</small>
                  </div>
                  <button type="button" className="button button--secondary button--sm" onClick={handleLogout}>
                    Sign Out
                  </button>
                </div>
              </section>

              <section className="settings-section">
                <div className="section-heading">
                  <div>
                    <h2>Plant SCADA & Database Connectivity</h2>
                    <p>PostgreSQL cluster readiness check (`/api/ready`).</p>
                  </div>
                  <button className="button button--secondary" onClick={loadCrmData} disabled={loading}>
                    {loading ? 'Probing...' : '🔄 Probe Connection'}
                  </button>
                </div>
                <div className="connection-row">
                  <span className="connection-icon connection-icon--crm">DB</span>
                  <span className="connection-info">
                    <strong>PostgreSQL Production Pool</strong>
                    <small>/api/ready • Multi-tenant Industrial Schema</small>
                  </span>
                  <span className={`connection-status${!dbReady ? ' connection-status--demo' : ''}`}>
                    <i />{dbReady ? 'Connected (PostgreSQL Active)' : 'Interactive Plant Simulation (Full CRUD)'}
                  </span>
                </div>
              </section>

              <section className="settings-section">
                <div className="section-heading">
                  <div>
                    <h2>OEM & Plant Integration Feeds</h2>
                    <p>Manufacturing CRM and Plant Maintenance endpoints.</p>
                  </div>
                </div>
                <div className="connection-row">
                  <span className="connection-icon connection-icon--crm">C</span>
                  <span className="connection-info">
                    <strong>OEM CRM Feed</strong>
                    <small>/api/crm/tasks • Active customer delivery orders</small>
                  </span>
                  <span className="connection-status"><i />Live Industrial Feed</span>
                </div>
                <div className="connection-row">
                  <span className="connection-icon connection-icon--helpdesk">H</span>
                  <span className="connection-info">
                    <strong>Equipment Maintenance Dispatch</strong>
                    <small>/api/helpdesk/tasks • Preventive maintenance tickets</small>
                  </span>
                  <span className="connection-status"><i />Live Industrial Feed</span>
                </div>
              </section>
            </section>
          ) : (
            /* Default: Overview & Task List Views */
            <>
              <section className="welcome-row">
                <div>
                  <p className="eyebrow">{todayLabel}</p>
                  <h1>
                    {activePage === 'overview' ? `Good day, ${currentUser?.full_name?.split(' ')[0] || 'Team'}` : currentTitle[0]}
                    <span className="heading-period">.</span>
                  </h1>
                  <p>{activePage === 'overview' ? 'Bharat Precision Dynamics real-time plant throughput and floor workloads.' : currentTitle[1]}</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="button button--secondary refresh-button" onClick={loadCrmData} disabled={loading}>
                    <span aria-hidden="true">🔄</span>{loading ? 'Refreshing...' : 'Refresh'}
                  </button>
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={() => {
                      setEditingTask(null);
                      setCreateTaskModalOpen(true);
                    }}
                  >
                    + Issue Work Order
                  </button>
                </div>
              </section>

              {/* KPI Cards Grid */}
              <section className="kpi-grid" aria-label="Plant performance metrics">
                <button type="button" className="kpi-card" onClick={() => clearFilters()}>
                  <span className="kpi-top">
                    <span>Total Active Orders</span>
                    <span className="kpi-icon kpi-icon--blue">⚙️</span>
                  </span>
                  <strong>{taskMetrics.total}</strong>
                  <span className="kpi-note">Active manufacturing orders</span>
                </button>
                <button type="button" className="kpi-card" onClick={() => { clearFilters(); setOverdueOnly(true); }}>
                  <span className="kpi-top">
                    <span>Critical Overdue</span>
                    <span className="kpi-icon kpi-icon--red">⚠️</span>
                  </span>
                  <strong className={taskMetrics.overdue > 0 ? 'text-red' : ''}>{taskMetrics.overdue}</strong>
                  <span className="kpi-note">Requires immediate sign-off</span>
                </button>
                <button type="button" className="kpi-card" onClick={() => { clearFilters(); setStatusFilter('in-progress'); }}>
                  <span className="kpi-top">
                    <span>In Machining / Progress</span>
                    <span className="kpi-icon kpi-icon--violet">🔧</span>
                  </span>
                  <strong>{inProgressCount}</strong>
                  <span className="kpi-note">Active on machine cells</span>
                </button>
                <button type="button" className="kpi-card" onClick={() => { clearFilters(); setStatusFilter('completed'); }}>
                  <span className="kpi-top">
                    <span>Dispatched / Done</span>
                    <span className="kpi-icon kpi-icon--green">✓</span>
                  </span>
                  <strong>{completedCount}</strong>
                  <span className="kpi-note">Passed QA inspection</span>
                </button>
              </section>

              {activePage === 'overview' && !loading && (
                <OverviewInsights
                  tasks={tasks}
                  onApplyFilters={(filters) => {
                    clearFilters();
                    if (filters.statusFilter) setStatusFilter(filters.statusFilter);
                    if (filters.priorityFilter) setPriorityFilter(filters.priorityFilter);
                    if (filters.employeeFilter) setEmployeeFilter(filters.employeeFilter);
                    setActivePage('all_tasks');
                  }}
                />
              )}

              {/* Task Section */}
              <section className="task-section">
                <div className="task-section__header">
                  <div>
                    <h2>{activePage === 'overview' ? 'Active Floor Work Orders' : currentTitle[0]}</h2>
                    <p className="task-section__meta">
                      Showing <strong>{filteredTasks.length}</strong> of {tasks.length} operations • Shift 1 Active
                    </p>
                  </div>
                  <div className="view-mode-toggle">
                    <button
                      type="button"
                      className={`view-btn${view === 'list' ? ' is-active' : ''}`}
                      onClick={() => setView('list')}
                      title="Table List view"
                    >
                      <span aria-hidden="true">☰</span> List
                    </button>
                    <button
                      type="button"
                      className={`view-btn${view === 'board' ? ' is-active' : ''}`}
                      onClick={() => setView('board')}
                      title="Kanban Board view"
                    >
                      <span aria-hidden="true">🗂️</span> Board
                    </button>
                  </div>
                </div>

                <FilterBar
                  tasks={tasks}
                  search={search}
                  employeeFilter={employeeFilter}
                  statusFilter={statusFilter}
                  priorityFilter={priorityFilter}
                  sourceFilter="all"
                  overdueOnly={overdueOnly}
                  onSearchChange={setSearch}
                  onEmployeeChange={setEmployeeFilter}
                  onStatusChange={setStatusFilter}
                  onPriorityChange={setPriorityFilter}
                  onSourceChange={() => {}}
                  onOverdueChange={setOverdueOnly}
                  onReset={clearFilters}
                />

                <TaskList
                  tasks={filteredTasks}
                  view={view}
                  hasFilters={employeeFilter !== 'all' || statusFilter !== 'all' || priorityFilter !== 'all' || overdueOnly || Boolean(search)}
                  onReset={clearFilters}
                  onSelectTask={setSelectedTask}
                />
              </section>
            </>
          )}
        </main>

        <footer className="app-footer">
          <span>Bharat Precision Dynamics Ltd. • Industrial Plant Operating System</span>
          <span>Pune Plant 1 • Heavy Engineering, CNC Machining & SCADA Telemetry</span>
          <span>PostgreSQL + React 19 • ISO 9001:2015 & AS9100D Certified</span>
        </footer>
      </div>

      {/* ── Task Detail Drawer ─────────────────────────────────── */}
      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onEditTask={(t) => {
            setEditingTask(t);
            setCreateTaskModalOpen(true);
          }}
          onDeleteTask={handleDeleteTask}
          onTaskUpdated={(updated) => {
            setTasks((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
            setSelectedTask((prev) => ({ ...prev, ...updated }));
          }}
        />
      )}

      {/* ── Create / Edit Task Modal ───────────────────────────── */}
      <CreateTaskModal
        isOpen={createTaskModalOpen}
        onClose={() => {
          setCreateTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSubmit={handleCreateOrUpdateTask}
        projects={projects}
        departments={departments}
        employees={employees}
        initialData={editingTask}
      />

      {/* ── Authentication / Persona Switcher Modal ────────────── */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        demoUsers={demoUsers}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          loadCrmData();
        }}
      />
    </div>
  );
}
