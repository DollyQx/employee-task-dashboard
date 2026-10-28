import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { fetchAllTasks } from './api/tasks';
import FilterBar from './components/FilterBar';
import TaskList from './components/TaskList';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activePage, setActivePage] = useState('overview');
  const [search, setSearch] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [view, setView] = useState('list');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const searchInputRef = useRef(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllTasks();
      setTasks(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

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

  const overdueTasks = useMemo(
    () => tasks.filter((task) => task.daysFromToday < 0 && task.status !== 'completed'),
    [tasks]
  );
  const inProgressCount = tasks.filter((task) => task.status === 'in-progress').length;
  const completedCount = tasks.filter((task) => task.status === 'completed').length;

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesEmployee = employeeFilter === 'all' || task.employee === employeeFilter;
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || task.urgency === priorityFilter;
      const matchesSource = sourceFilter === 'all' || task.source.toLowerCase() === sourceFilter;
      const matchesPage = !['crm', 'helpdesk'].includes(activePage)
        || task.source.toLowerCase() === activePage;
      const matchesOverdue = !overdueOnly || (task.daysFromToday < 0 && task.status !== 'completed');
      const matchesSearch = !query || [task.title, task.employee, task.id, task.source]
        .some((value) => value.toLowerCase().includes(query));
      return matchesEmployee && matchesStatus && matchesPriority && matchesSource
        && matchesPage && matchesOverdue && matchesSearch;
    });
  }, [tasks, activePage, employeeFilter, statusFilter, priorityFilter, sourceFilter, overdueOnly, search]);

  const clearFilters = useCallback(() => {
    setEmployeeFilter('all');
    setStatusFilter('all');
    setPriorityFilter('all');
    setSourceFilter('all');
    setSearch('');
    setOverdueOnly(false);
  }, []);
  const navigate = (page) => {
    setActivePage(page);
    setMobileNavOpen(false);
    setNotificationsOpen(false);
    clearFilters();
  };

  const chooseStat = (stat) => {
    clearFilters();
    if (stat === 'overdue') setOverdueOnly(true);
    if (stat === 'in-progress') setStatusFilter('in-progress');
    if (stat === 'completed') setStatusFilter('completed');
    setActivePage('all');
  };

  const pageTitles = {
    overview: ['Overview', 'Your team’s work at a glance'],
    all: ['All tasks', 'Every task across your connected workspaces'],
    crm: ['CRM tasks', 'Follow-ups and client work from your CRM'],
    helpdesk: ['Helpdesk tasks', 'Tickets and support work from Helpdesk'],
    settings: ['Settings', 'Connection details for your task sources'],
  };
  const currentTitle = pageTitles[activePage] || pageTitles.overview;
  const todayLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  }).format(new Date());
  const filterActive = employeeFilter !== 'all' || statusFilter !== 'all'
    || priorityFilter !== 'all' || sourceFilter !== 'all' || overdueOnly || Boolean(search)
    || activePage === 'crm' || activePage === 'helpdesk';
  return (
    <div className="app-shell">
      {mobileNavOpen && <button className="nav-scrim" type="button" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`sidebar${mobileNavOpen ? ' sidebar--open' : ''}`} aria-label="Main navigation">
        <button className="brand" type="button" onClick={() => navigate('overview')} aria-label="TaskFlow overview">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span>task<span className="brand-accent">flow</span></span>
        </button>

        <div className="workspace-switcher">
          <span className="workspace-avatar">T</span>
          <span className="workspace-copy"><strong>Team workspace</strong><small>Shared tasks</small></span>
          <span className="workspace-chevron" aria-hidden="true">⌄</span>
        </div>

        <nav className="sidebar-nav">
          <p className="nav-label">Workspace</p>
          <button className={`nav-item${activePage === 'overview' ? ' is-active' : ''}`} onClick={() => navigate('overview')}><span className="nav-icon">◫</span>Overview</button>
          <button className={`nav-item${activePage === 'all' ? ' is-active' : ''}`} onClick={() => navigate('all')}><span className="nav-icon">☷</span>All tasks<span className="nav-count">{tasks.length}</span></button>
          <button className={`nav-item${activePage === 'crm' ? ' is-active' : ''}`} onClick={() => navigate('crm')}><span className="source-dot source-dot--crm" />CRM tasks</button>
          <button className={`nav-item${activePage === 'helpdesk' ? ' is-active' : ''}`} onClick={() => navigate('helpdesk')}><span className="source-dot source-dot--helpdesk" />Helpdesk tasks</button>
        </nav>

        <div className="sidebar-bottom">
          <div className="sync-card">
            <div className="sync-card__top"><span className={`sync-indicator${error ? ' sync-indicator--error' : ''}`} />{error ? 'Connection issue' : loading ? 'Syncing sources' : 'All sources synced'}</div>
            <p>{error ? 'Task sources need attention.' : 'CRM and Helpdesk are connected.'}</p>
            <button type="button" className="sync-refresh" onClick={loadTasks} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh sources'} <span aria-hidden="true">↻</span></button>
          </div>
          <button className={`nav-item settings-link${activePage === 'settings' ? ' is-active' : ''}`} onClick={() => navigate('settings')}><span className="nav-icon">⚙</span>Settings</button>
          <div className="sidebar-profile"><span className="profile-avatar">TF</span><span className="profile-copy"><strong>TaskFlow</strong><small>Workspace</small></span></div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">☰</button>
          <div className="breadcrumbs"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{currentTitle[0]}</strong></div>
          <label className="global-search"><span aria-hidden="true">⌕</span><input ref={searchInputRef} aria-label="Search tasks" placeholder="Search tasks..." value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>Ctrl K</kbd></label>
          <div className="topbar-actions">
            <div className="notification-wrap">
              <button className="icon-button notification-button" aria-label={`${overdueTasks.length} overdue task notifications`} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><span aria-hidden="true">♧</span>{overdueTasks.length > 0 && <i />}</button>
              {notificationsOpen && <div className="notification-popover"><div className="popover-heading"><strong>Needs attention</strong><span>{overdueTasks.length}</span></div>{overdueTasks.length ? overdueTasks.slice(0, 4).map((task) => <a key={task.id} href={task.sourceUrl} target="_blank" rel="noreferrer" className="notification-item"><span className="overdue-mark" /><span><strong>{task.title}</strong><small>{task.employee} · {task.source}</small></span></a>) : <p className="notification-empty">You’re all caught up.</p>}</div>}
            </div>
            <span className="topbar-divider" />
            <div className="topbar-user"><span className="profile-avatar">TF</span><span>Workspace</span></div>
          </div>
        </header>

        <main className="content" id="main-content">
          {activePage === 'settings' ? (
            <section className="settings-page">
              <div className="page-heading"><div><p className="eyebrow">PREFERENCES</p><h1>{currentTitle[0]}</h1><p>{currentTitle[1]}</p></div></div>
              <section className="settings-section"><div className="section-heading"><div><h2>Connected sources</h2><p>TaskFlow reads tasks from these configured API sources.</p></div><button className="button button--secondary" onClick={loadTasks} disabled={loading}>{loading ? 'Refreshing…' : '↻ Refresh connections'}</button></div>
                <div className="connection-row"><span className="connection-icon connection-icon--crm">C</span><span className="connection-info"><strong>CRM</strong><small>/api/crm/tasks</small></span><span className={`connection-status${error ? ' connection-status--error' : ''}`}><i />{error ? 'Check connection' : loading ? 'Checking…' : 'Connected'}</span></div>
                <div className="connection-row"><span className="connection-icon connection-icon--helpdesk">H</span><span className="connection-info"><strong>Helpdesk</strong><small>/api/helpdesk/tasks</small></span><span className={`connection-status${error ? ' connection-status--error' : ''}`}><i />{error ? 'Check connection' : loading ? 'Checking…' : 'Connected'}</span></div>
                {error && <ErrorMessage error={error} onRetry={loadTasks} />}
              </section>
              <p className="settings-footnote">Connection URLs are managed by the deployment environment.</p>
            </section>
          ) : (
            <>
              <section className="welcome-row"><div><p className="eyebrow">{todayLabel}</p><h1>{activePage === 'overview' ? 'Good morning' : currentTitle[0]}<span className="heading-period">.</span></h1><p>{activePage === 'overview' ? 'Here’s what’s happening across your team today.' : currentTitle[1]}</p></div><button className="button button--secondary refresh-button" onClick={loadTasks} disabled={loading}><span aria-hidden="true">↻</span>{loading ? 'Refreshing' : 'Refresh'}</button></section>

              <section className="kpi-grid" aria-label="Task metrics">
                <button className="kpi-card" onClick={() => chooseStat('total')}><span className="kpi-top"><span>Total tasks</span><span className="kpi-icon kpi-icon--blue">☷</span></span><strong>{tasks.length}</strong><span className="kpi-note">Across all sources</span></button>
                <button className="kpi-card" onClick={() => chooseStat('overdue')}><span className="kpi-top"><span>Overdue</span><span className="kpi-icon kpi-icon--red">!</span></span><strong>{overdueTasks.length}</strong><span className="kpi-note">Needs your attention</span></button>
                <button className="kpi-card" onClick={() => chooseStat('in-progress')}><span className="kpi-top"><span>In progress</span><span className="kpi-icon kpi-icon--violet">◷</span></span><strong>{inProgressCount}</strong><span className="kpi-note">Currently being worked on</span></button>
                <button className="kpi-card" onClick={() => chooseStat('completed')}><span className="kpi-top"><span>Completed</span><span className="kpi-icon kpi-icon--green">✓</span></span><strong>{completedCount}</strong><span className="kpi-note">Tasks closed</span></button>
              </section>

              <section className="task-section">
                <div className="section-heading task-section-heading"><div><h2>{activePage === 'overview' ? 'Priority tasks' : currentTitle[0]}</h2><p>{filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'} {filterActive ? 'matching your filters' : 'sorted by priority'}</p></div><div className="view-toggle" role="group" aria-label="Task view"><button className={view === 'list' ? 'is-selected' : ''} onClick={() => setView('list')} aria-pressed={view === 'list'}><span aria-hidden="true">☷</span>List</button><button className={view === 'board' ? 'is-selected' : ''} onClick={() => setView('board')} aria-pressed={view === 'board'}><span aria-hidden="true">▦</span>Board</button></div></div>
                <FilterBar tasks={tasks} search={search} employeeFilter={employeeFilter} statusFilter={statusFilter} priorityFilter={priorityFilter} sourceFilter={sourceFilter} onSearchChange={setSearch} onEmployeeChange={setEmployeeFilter} onStatusChange={setStatusFilter} onPriorityChange={setPriorityFilter} onSourceChange={setSourceFilter} onReset={clearFilters} />
                {loading ? <LoadingSpinner /> : error ? <ErrorMessage error={error} onRetry={loadTasks} /> : <TaskList tasks={filteredTasks} view={view} hasFilters={filterActive} onReset={clearFilters} />}
              </section>
            </>
          )}
        </main>
        <footer className="app-footer"><span>TaskFlow</span><span>One clear view of your team’s work</span><span>CRM + Helpdesk</span></footer>
      </div>
    </div>
  );
}
