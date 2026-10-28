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
import { fetchAllTasks } from './api/tasks';
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

  // Loading & Error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dbReady, setDbReady] = useState(true);

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
      // Fetch available demo users
      const demoRes = await getDemoUsersApi();
      if (demoRes?.users) {
        setDemoUsers(demoRes.users);
      }

      // Check current session
      const meRes = await getMeApi();
      if (meRes?.user) {
        setCurrentUser(meRes.user);
        return meRes.user;
      } else if (demoRes?.users && demoRes.users.length > 0) {
        // Auto-initialize demo session with Super Admin (Aarav Sharma)
        const autoUser = demoRes.users[0];
        const switchRes = await switchDemoUserApi(autoUser.id);
        setCurrentUser(switchRes.user);
        return switchRes.user;
      }
    } catch {
      // In standalone mode or offline
    }
    return null;
  }, []);

  // Load all CRM datasets
  const loadCrmData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Check readiness
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
            deadline: t.due_date ? String(t.due_date).split('T')[0] : null,
            urgency: t.crm_priority === 'urgent' ? 'high' : (t.crm_priority || 'medium'),
            status: t.crm_status === 'done' ? 'completed' : (t.crm_status === 'in_progress' ? 'in-progress' : 'pending'),
            employee: t.assignees?.[0]?.full_name || 'Unassigned',
            source: t.source || 'TaskFlow',
          }));
        }
      } catch {
        // Fallback to mock feed if tasks endpoint is unavailable
      }

      if (loadedTasks.length === 0) {
        // Fallback to legacy mock feeds
        loadedTasks = await fetchAllTasks();
      }
      setTasks(loadedTasks);

      // 3. Load supplementary CRM datasets concurrently
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
      setError(err.message || 'Failed to load TaskFlow CRM records.');
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
      setError('Failed to switch role: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutApi();
    setCurrentUser(null);
    setAuthModalOpen(true);
  };

  // Task Actions
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
        prev.map((t) => (t.id === taskId ? { ...t, crm_status: newStatus } : t))
      );
      await patchTaskStatusApi(taskId, newStatus);
    } catch (err) {
      alert('Failed to update task status: ' + err.message);
      await loadCrmData();
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await deleteTaskApi(taskId);
      if (selectedTask?.id === taskId) setSelectedTask(null);
      await loadCrmData();
    } catch (err) {
      alert('Failed to delete task: ' + err.message);
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
    overview: ['Overview', 'Aulten Digital enterprise operations and active priorities'],
    my_tasks: ['My Tasks', `Assigned tasks for ${currentUser?.full_name || 'you'}`],
    all_tasks: ['All Tasks', 'Centralized task repository across departments and projects'],
    kanban: ['Kanban Board', 'Interactive visual workflow across Backlog to Done'],
    calendar: ['Calendar', 'Schedule, upcoming deadlines, and due date tracking'],
    employees: ['Employees Directory', 'Aulten Digital staff profiles and workloads'],
    departments: ['Teams & Departments', 'Organizational divisions and department heads'],
    projects: ['Projects Management', 'Client project deliverables and milestone health'],
    clients: ['Clients & CRM', 'Indian and global client accounts and deal pipeline'],
    reports: ['Reports & Analytics', 'Productivity, department workloads, and CSV exports'],
    notifications: ['Notification Center', 'Assignments, mentions, and system alerts'],
    activity: ['Activity Log', 'Organization audit trail and modification events'],
    settings: ['Settings', 'Preferences, appearance, and backend connectivity'],
    analytics: ['Legacy Analytics', 'Read-only mock API analytics archive'],
    crm: ['CRM Legacy Tasks', 'Mock CRM demonstration records'],
    helpdesk: ['Helpdesk Legacy Tasks', 'Mock Helpdesk demonstration records'],
  };

  const currentTitle = pageTitles[activePage] || pageTitles.overview;
  const todayLabel = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(new Date());

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

      {/* ─── Sidebar Navigation ────────────────────────────────────────────── */}
      <aside className={`sidebar${mobileNavOpen ? ' sidebar--open' : ''}`} aria-label="Main navigation">
        <button className="brand" type="button" onClick={() => navigate('overview')} aria-label="Aulten Digital TaskFlow">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span>aulten<span className="brand-accent">taskflow</span></span>
        </button>

        {/* Workspace Switcher / Org Badge */}
        <div className="workspace-switcher">
          <span className="workspace-avatar">AD</span>
          <div className="workspace-copy">
            <strong>Aulten Digital</strong>
            <small>TaskFlow Enterprise CRM</small>
          </div>
          <span className={`sync-indicator${dbReady ? '' : ' sync-indicator--error'}`} title={dbReady ? 'Database Connected' : 'Database Offline'} />
        </div>

        <nav className="sidebar-nav">
          <p className="nav-label">Core Workspace</p>
          <button className={`nav-item${activePage === 'overview' ? ' is-active' : ''}`} onClick={() => navigate('overview')}>
            <span className="nav-icon">◫</span>Overview
          </button>
          <button className={`nav-item${activePage === 'my_tasks' ? ' is-active' : ''}`} onClick={() => navigate('my_tasks')}>
            <span className="nav-icon">👤</span>My Tasks
          </button>
          <button className={`nav-item${activePage === 'all_tasks' ? ' is-active' : ''}`} onClick={() => navigate('all_tasks')}>
            <span className="nav-icon">☷</span>All Tasks<span className="nav-count">{tasks.length}</span>
          </button>
          <button className={`nav-item${activePage === 'kanban' ? ' is-active' : ''}`} onClick={() => navigate('kanban')}>
            <span className="nav-icon">▦</span>Kanban Board
          </button>
          <button className={`nav-item${activePage === 'calendar' ? ' is-active' : ''}`} onClick={() => navigate('calendar')}>
            <span className="nav-icon">📅</span>Calendar
          </button>

          <p className="nav-label" style={{ marginTop: '12px' }}>Organization</p>
          <button className={`nav-item${activePage === 'employees' ? ' is-active' : ''}`} onClick={() => navigate('employees')}>
            <span className="nav-icon">👥</span>Employees<span className="nav-count">{employees.length || '18'}</span>
          </button>
          <button className={`nav-item${activePage === 'departments' ? ' is-active' : ''}`} onClick={() => navigate('departments')}>
            <span className="nav-icon">🏢</span>Departments<span className="nav-count">{departments.length || '12'}</span>
          </button>
          <button className={`nav-item${activePage === 'projects' ? ' is-active' : ''}`} onClick={() => navigate('projects')}>
            <span className="nav-icon">📁</span>Projects<span className="nav-count">{projects.length || '7'}</span>
          </button>

          {/* Role-gated Navigation: Clients CRM (Manager+) */}
          {isManager && (
            <button className={`nav-item${activePage === 'clients' ? ' is-active' : ''}`} onClick={() => navigate('clients')}>
              <span className="nav-icon">💼</span>Clients & CRM<span className="nav-count">{clients.length || '7'}</span>
            </button>
          )}

          <button className={`nav-item${activePage === 'reports' ? ' is-active' : ''}`} onClick={() => navigate('reports')}>
            <span className="nav-icon">📊</span>Reports & Analytics
          </button>

          <button className={`nav-item${activePage === 'notifications' ? ' is-active' : ''}`} onClick={() => navigate('notifications')}>
            <span className="nav-icon">🔔</span>Notifications
            {unreadCount > 0 && <span className="nav-count text-red">{unreadCount}</span>}
          </button>

          {/* Role-gated Navigation: Activity & Audit Log (Admin+) */}
          {isAdmin && (
            <button className={`nav-item${activePage === 'activity' ? ' is-active' : ''}`} onClick={() => navigate('activity')}>
              <span className="nav-icon">📜</span>Activity Log
            </button>
          )}

          <p className="nav-label" style={{ marginTop: '12px' }}>Legacy Feeds</p>
          <button className={`nav-item${activePage === 'crm' ? ' is-active' : ''}`} onClick={() => navigate('crm')}>
            <span className="source-dot source-dot--crm" />CRM Tasks (Mock)
          </button>
          <button className={`nav-item${activePage === 'helpdesk' ? ' is-active' : ''}`} onClick={() => navigate('helpdesk')}>
            <span className="source-dot source-dot--helpdesk" />Helpdesk (Mock)
          </button>
        </nav>

        <div className="sidebar-bottom">
          <button className={`nav-item settings-link${activePage === 'settings' ? ' is-active' : ''}`} onClick={() => navigate('settings')}>
            <span className="nav-icon">⚙</span>Settings
          </button>
          <div className="sidebar-profile" onClick={() => setAuthModalOpen(true)} style={{ cursor: 'pointer' }}>
            <span className="profile-avatar">
              {currentUser?.avatar || currentUser?.full_name?.substring(0, 2).toUpperCase() || 'AD'}
            </span>
            <div className="profile-copy">
              <strong>{currentUser?.full_name || 'Guest User'}</strong>
              <small>{currentUser ? `${currentUser.crm_role} · Switch` : 'Click to Sign In'}</small>
            </div>
          </div>
        </div>
      </aside>

      {/* ─── Main Content Shell ────────────────────────────────────────────── */}
      <div className="main-shell">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">
            ☰
          </button>

          <div className="breadcrumbs">
            <span>Aulten Digital</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{currentTitle[0]}</strong>
          </div>

          <label className="global-search">
            <span aria-hidden="true">⌕</span>
            <input
              ref={searchInputRef}
              aria-label="Search tasks"
              placeholder="Search tasks, IDs, team..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd>Ctrl K</kbd>
          </label>

          <div className="topbar-actions">
            {/* Quick Demo Persona Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="topbar-persona-btn"
                onClick={() => setRoleSwitcherOpen((prev) => !prev)}
                title="Switch test role persona"
              >
                <span>⚡ {currentUser?.crm_role ? currentUser.crm_role.replace('_', ' ') : 'Demo'}</span>
                <span className="workspace-chevron" aria-hidden="true">⌄</span>
              </button>

              {roleSwitcherOpen && (
                <div className="notification-popover" style={{ width: '260px' }}>
                  <div className="popover-heading">
                    <strong>Switch Demo Persona</strong>
                    <span>RBAC</span>
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
                          <small>{u.crm_role} · {u.department_name}</small>
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
                aria-label={`${unreadCount} notifications`}
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <span aria-hidden="true">🔔</span>
                {unreadCount > 0 && <i />}
              </button>

              {notificationsOpen && (
                <div className="notification-popover">
                  <div className="popover-heading">
                    <strong>Notifications</strong>
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
                    <p className="notification-empty">You’re all caught up.</p>
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
                      View All Notifications →
                    </button>
                  )}
                </div>
              )}
            </div>

            <span className="topbar-divider" />

            {/* New Task Button */}
            <button
              type="button"
              className="button button--primary button--sm"
              onClick={() => {
                setEditingTask(null);
                setCreateTaskModalOpen(true);
              }}
            >
              + New Task
            </button>
          </div>
        </header>

        {/* ─── Main Page Content Router ────────────────────────────────────── */}
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
                  <p className="eyebrow">AULTEN DIGITAL CRM</p>
                  <h1>{currentTitle[0]}</h1>
                  <p>{currentTitle[1]}</p>
                </div>
              </div>

              <section className="settings-section">
                <div className="section-heading">
                  <div>
                    <h2>Authentication & Profile</h2>
                    <p>Current logged in user session and organizational role.</p>
                  </div>
                  <button type="button" className="button button--secondary" onClick={() => setAuthModalOpen(true)}>
                    Switch User / Login
                  </button>
                </div>

                <div className="connection-row">
                  <span className="employee-avatar mini-avatar">
                    {currentUser?.avatar || 'AD'}
                  </span>
                  <div className="connection-info">
                    <strong>{currentUser?.full_name || 'Guest User'}</strong>
                    <small>{currentUser?.email} · Role: {currentUser?.crm_role}</small>
                  </div>
                  <button type="button" className="button button--secondary button--sm" onClick={handleLogout}>
                    Sign Out
                  </button>
                </div>
              </section>

              <section className="settings-section">
                <div className="section-heading">
                  <div>
                    <h2>Database Connectivity & Readiness</h2>
                    <p>PostgreSQL readiness probe `/api/ready`.</p>
                  </div>
                  <button className="button button--secondary" onClick={loadCrmData} disabled={loading}>
                    {loading ? 'Checking…' : '↻ Probe Database'}
                  </button>
                </div>
                <div className="connection-row">
                  <span className="connection-icon connection-icon--crm">DB</span>
                  <span className="connection-info">
                    <strong>PostgreSQL Connection</strong>
                    <small>/api/ready · Aulten Digital TaskFlow Schema</small>
                  </span>
                  <span className={`connection-status${!dbReady ? ' connection-status--error' : ''}`}>
                    <i />{dbReady ? 'Available (Ready)' : 'Not Configured / Unavailable'}
                  </span>
                </div>
              </section>

              <section className="settings-section">
                <div className="section-heading">
                  <div>
                    <h2>Legacy Read-only Task Sources</h2>
                    <p>Pre-configured mock demonstration endpoints.</p>
                  </div>
                </div>
                <div className="connection-row">
                  <span className="connection-icon connection-icon--crm">C</span>
                  <span className="connection-info">
                    <strong>CRM Mock Feed</strong>
                    <small>/api/crm/tasks · read-only</small>
                  </span>
                  <span className="connection-status"><i />Read-only Feed</span>
                </div>
                <div className="connection-row">
                  <span className="connection-icon connection-icon--helpdesk">H</span>
                  <span className="connection-info">
                    <strong>Helpdesk Mock Feed</strong>
                    <small>/api/helpdesk/tasks · read-only</small>
                  </span>
                  <span className="connection-status"><i />Read-only Feed</span>
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
                  <p>{activePage === 'overview' ? 'Aulten Digital task velocity and department workload overview.' : currentTitle[1]}</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="button button--secondary refresh-button" onClick={loadCrmData} disabled={loading}>
                    <span aria-hidden="true">↻</span>{loading ? 'Refreshing…' : 'Refresh'}
                  </button>
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={() => {
                      setEditingTask(null);
                      setCreateTaskModalOpen(true);
                    }}
                  >
                    + Create Task
                  </button>
                </div>
              </section>

              {/* KPI Cards Grid */}
              <section className="kpi-grid" aria-label="Task metrics">
                <button type="button" className="kpi-card" onClick={() => clearFilters()}>
                  <span className="kpi-top"><span>Total Tasks</span><span className="kpi-icon kpi-icon--blue">☷</span></span>
                  <strong>{taskMetrics.total}</strong>
                  <span className="kpi-note">Active repository</span>
                </button>
                <button type="button" className="kpi-card" onClick={() => { clearFilters(); setOverdueOnly(true); }}>
                  <span className="kpi-top"><span>Overdue Work</span><span className="kpi-icon kpi-icon--red">!</span></span>
                  <strong className={taskMetrics.overdue > 0 ? 'text-red' : ''}>{taskMetrics.overdue}</strong>
                  <span className="kpi-note">Requires immediate attention</span>
                </button>
                <button type="button" className="kpi-card" onClick={() => { clearFilters(); setStatusFilter('in-progress'); }}>
                  <span className="kpi-top"><span>In Progress</span><span className="kpi-icon kpi-icon--violet">◷</span></span>
                  <strong>{inProgressCount}</strong>
                  <span className="kpi-note">Currently being worked on</span>
                </button>
                <button type="button" className="kpi-card" onClick={() => { clearFilters(); setStatusFilter('completed'); }}>
                  <span className="kpi-top"><span>Completed</span><span className="kpi-icon kpi-icon--green">✓</span></span>
                  <strong>{completedCount}</strong>
                  <span className="kpi-note">Tasks closed</span>
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
                <div className="section-heading task-section-heading">
                  <div>
                    <h2>{activePage === 'overview' ? 'High Priority Work' : currentTitle[0]}</h2>
                    <p>{filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'} matching filters</p>
                  </div>
                  <div className="view-toggle" role="group" aria-label="Task view">
                    <button className={view === 'list' ? 'is-selected' : ''} onClick={() => setView('list')} aria-pressed={view === 'list'}>
                      <span aria-hidden="true">☷</span>List
                    </button>
                    <button className={view === 'board' ? 'is-selected' : ''} onClick={() => setView('board')} aria-pressed={view === 'board'}>
                      <span aria-hidden="true">▦</span>Board
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
          <span>Aulten Digital · TaskFlow CRM</span>
          <span>Enterprise Employee Task Management</span>
          <span>PostgreSQL + React 19</span>
        </footer>
      </div>

      {/* ─── Task Detail Drawer ────────────────────────────────────────────── */}
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

      {/* ─── Create / Edit Task Modal ──────────────────────────────────────── */}
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

      {/* ─── Authentication / Demo Persona Modal ───────────────────────────── */}
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
