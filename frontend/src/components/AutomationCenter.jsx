import React, { useState, useEffect } from 'react';
import {
  getAutomationRulesApi,
  updateAutomationRuleApi,
  triggerAutomationRunNowApi,
  getAutomationLogsApi,
  getRecurringTemplatesApi,
  createRecurringTemplateApi,
  fetchEmployeesApi,
  fetchDepartmentsApi,
} from '../api/crm';

export default function AutomationCenter({ currentUser }) {
  const [activeTab, setActiveTab] = useState('rules'); // 'rules' | 'templates' | 'logs'
  const [rules, setRules] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [dispatchedNotifs, setDispatchedNotifs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [_departments, setDepartments] = useState([]);
  const [_loading, setLoading] = useState(true);
  const [runningNow, setRunningNow] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // New Template Modal state
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    title: '',
    description: '',
    recurrence_pattern: 'weekly',
    priority: 'medium',
    day_of_week: 1,
    day_of_month: 1,
    estimated_hours: 2,
    assignee_id: '',
    department_id: '',
  });

  // Rule configuration modal state
  const [configuringRule, setConfiguringRule] = useState(null);
  const [ruleConfigInput, setRuleConfigInput] = useState('');

  const isSuperAdmin = currentUser?.crm_role === 'super_admin';

  useEffect(() => {
    loadAutomationData();
  }, []);

  async function loadAutomationData() {
    setLoading(true);
    setErrorMsg('');
    try {
      const [rulesRes, logsRes, tmplRes, empRes, deptRes] = await Promise.all([
        getAutomationRulesApi().catch(() => ({ rules: [] })),
        getAutomationLogsApi().catch(() => ({ logs: [], dispatchedNotifications: [] })),
        getRecurringTemplatesApi().catch(() => ({ templates: [] })),
        fetchEmployeesApi().catch(() => ({ employees: [] })),
        fetchDepartmentsApi().catch(() => ({ departments: [] })),
      ]);

      setRules(rulesRes.rules || []);
      setLogs(logsRes.logs || []);
      setDispatchedNotifs(logsRes.dispatchedNotifications || []);
      setTemplates(tmplRes.templates || []);
      setEmployees(empRes.employees || []);
      setDepartments(deptRes.departments || []);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load automation data.');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleRule(rule) {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await updateAutomationRuleApi(rule.rule_key, {
        is_enabled: !rule.is_enabled,
      });
      setRules((prev) =>
        prev.map((r) => (r.rule_key === rule.rule_key ? { ...r, is_enabled: !r.is_enabled } : r))
      );
      setSuccessMsg(`Rule "${rule.name}" is now ${!rule.is_enabled ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update rule status.');
    }
  }

  async function handleRunNow() {
    setRunningNow(true);
    setErrorMsg('');
    setSuccessMsg('');
    setRunResult(null);

    try {
      const res = await triggerAutomationRunNowApi();
      setRunResult(res.result);
      setSuccessMsg(`Automation cycle complete! Processed ${res.result.actionsTaken || 0} automated actions in ${res.result.totalDurationMs || 0}ms.`);
      await loadAutomationData();
    } catch (err) {
      if (err.message && err.message.includes('already running')) {
        setErrorMsg('Concurrency Safeguard: An automation cycle is currently in progress. Please wait a moment.');
      } else {
        setErrorMsg(err.message || 'Failed to trigger automation cycle.');
      }
    } finally {
      setRunningNow(false);
    }
  }

  async function handleCreateTemplate(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!newTemplate.title.trim()) {
      setErrorMsg('Template title is required.');
      return;
    }

    try {
      const res = await createRecurringTemplateApi(newTemplate);
      setTemplates((prev) => [res.template, ...prev]);
      setShowTemplateModal(false);
      setSuccessMsg(`Recurring task template "${newTemplate.title}" created successfully.`);
      setNewTemplate({
        title: '',
        description: '',
        recurrence_pattern: 'weekly',
        priority: 'medium',
        day_of_week: 1,
        day_of_month: 1,
        estimated_hours: 2,
        assignee_id: '',
        department_id: '',
      });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create template.');
    }
  }

  async function handleSaveRuleConfig() {
    if (!configuringRule) return;
    try {
      let parsed = {};
      try {
        parsed = JSON.parse(ruleConfigInput);
      } catch {
        setErrorMsg('Config must be valid JSON.');
        return;
      }

      await updateAutomationRuleApi(configuringRule.rule_key, {
        config: parsed,
      });

      setSuccessMsg(`Configuration for "${configuringRule.name}" updated.`);
      setConfiguringRule(null);
      await loadAutomationData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save configuration.');
    }
  }

  if (!isSuperAdmin) {
    return (
      <div className="empty-state card" style={{ padding: '3rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h2>Access Restricted</h2>
        <p>The Automation Center is restricted exclusively to Super Administrator <strong>Dolly</strong>.</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Your current role does not have authorization to view or configure organization-wide automations.
        </p>
      </div>
    );
  }

  const enabledCount = rules.filter((r) => r.is_enabled).length;

  return (
    <div className="automation-center-view" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div className="view-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>Startiz Labs Automation Center</h1>
            <span className="badge badge-primary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}>
              Super Admin Dolly Exclusive
            </span>
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Zero-cost, rule-based autonomous engine for SLA monitoring, recurring task generation, attendance auditing, and reporting.
          </p>
        </div>

        <button
          onClick={handleRunNow}
          disabled={runningNow}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', fontWeight: 600 }}
        >
          {runningNow ? (
            <>
              <span className="spinner" style={{ width: '16px', height: '16px' }}></span>
              Executing Automations...
            </>
          ) : (
            <>
              <span>⚡</span> Run All Automations Now
            </>
          )}
        </button>
      </div>

      {/* Alert Messages */}
      {errorMsg && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem', padding: '0.85rem 1.25rem', borderRadius: '8px', background: '#fee2e2', color: '#991b1b', border: '1px solid #f87171' }}>
          <strong>Error: </strong> {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: '1.5rem', padding: '0.85rem 1.25rem', borderRadius: '8px', background: '#dcfce7', color: '#166534', border: '1px solid #86efac' }}>
          <strong>Success: </strong> {successMsg}
        </div>
      )}

      {/* KPI Overview Cards */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Active Rules</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 700, marginTop: '0.25rem', color: 'var(--primary)' }}>
            {enabledCount} / {rules.length}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#16a34a', marginTop: '0.25rem' }}>Autonomous Schedulers Live</div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Recurring Templates</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 700, marginTop: '0.25rem' }}>
            {templates.filter((t) => t.is_active).length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Idempotent Generation Active</div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Zero-Cost Cost Guarantee</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 700, marginTop: '0.25rem', color: '#16a34a' }}>
            $0.00 / mo
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Zero Mandatory Paid APIs</div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Concurrency Guard</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.5rem', color: '#2563eb' }}>
            Mutex Lock Active
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Overlapping Runs Blocked</div>
        </div>
      </div>

      {/* Last Run Breakdown (if triggered) */}
      {runResult && (
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', background: '#f8fafc', border: '1px solid #cbd5e1' }}>
          <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📊</span> Latest Execution Breakdown ({runResult.totalDurationMs}ms)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
            {runResult.results?.map((r) => (
              <div key={r.rule_key} style={{ padding: '0.75rem', borderRadius: '6px', background: '#fff', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>{r.rule_key}</div>
                <div style={{ fontSize: '0.8rem', color: r.status === 'success' ? '#16a34a' : (r.status === 'disabled' ? '#64748b' : '#dc2626') }}>
                  Status: <strong>{r.status.toUpperCase()}</strong> | Actions: <strong>{r.actionsTaken}</strong>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{r.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Segmented Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveTab('rules')}
          className={`btn ${activeTab === 'rules' ? 'btn-primary' : 'btn-outline'}`}
          style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
        >
          ⚙️ Rules & Schedulers ({rules.length})
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`btn ${activeTab === 'templates' ? 'btn-primary' : 'btn-outline'}`}
          style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
        >
          🔄 Recurring Templates ({templates.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`btn ${activeTab === 'logs' ? 'btn-primary' : 'btn-outline'}`}
          style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
        >
          📜 Execution Audit Log ({logs.length})
        </button>
      </div>

      {/* TAB 1: Automation Rules */}
      {activeTab === 'rules' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
          {rules.map((rule) => (
            <div key={rule.rule_key} className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>{rule.name}</h3>
                  <span className={`badge ${rule.is_enabled ? 'badge-success' : 'badge-secondary'}`}>
                    {rule.is_enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', minHeight: '38px' }}>
                  {rule.description}
                </p>

                <div style={{ fontSize: '0.8rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem' }}>
                  <div><strong>Key:</strong> <code>{rule.rule_key}</code></div>
                  <div style={{ marginTop: '0.25rem' }}><strong>Schedule:</strong> <code>{rule.schedule_cron}</code></div>
                  <div style={{ marginTop: '0.25rem' }}>
                    <strong>Last Run:</strong> {rule.last_run_at ? new Date(rule.last_run_at).toLocaleTimeString() : 'Never'}
                    {rule.last_run_duration_ms > 0 && ` (${rule.last_run_duration_ms}ms)`}
                  </div>
                  {rule.last_run_details && (
                    <div style={{ marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                      <strong>Detail:</strong> {rule.last_run_details}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                <button
                  onClick={() => {
                    setConfiguringRule(rule);
                    setRuleConfigInput(JSON.stringify(rule.config || {}, null, 2));
                  }}
                  className="btn btn-outline btn-sm"
                >
                  Configure
                </button>
                <button
                  onClick={() => handleToggleRule(rule)}
                  className={`btn btn-sm ${rule.is_enabled ? 'btn-danger' : 'btn-success'}`}
                >
                  {rule.is_enabled ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: Recurring Task Templates */}
      {activeTab === 'templates' && (
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Automated Recurring Tasks</h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Tasks are generated idempotently on their schedule without duplicating on retries.
              </p>
            </div>
            <button onClick={() => setShowTemplateModal(true)} className="btn btn-primary btn-sm">
              + New Recurring Template
            </button>
          </div>

          {templates.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No recurring templates defined yet. Click "+ New Recurring Template" to add one.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: '0.9rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem' }}>Title</th>
                    <th style={{ padding: '0.75rem' }}>Pattern</th>
                    <th style={{ padding: '0.75rem' }}>Priority</th>
                    <th style={{ padding: '0.75rem' }}>Est. Hours</th>
                    <th style={{ padding: '0.75rem' }}>Assignee</th>
                    <th style={{ padding: '0.75rem' }}>Last Generated</th>
                    <th style={{ padding: '0.75rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((tmpl) => (
                    <tr key={tmpl.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>{tmpl.title}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
                          {tmpl.recurrence_pattern}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span className={`badge ${tmpl.priority === 'urgent' ? 'badge-danger' : (tmpl.priority === 'high' ? 'badge-warning' : 'badge-secondary')}`}>
                          {tmpl.priority}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>{tmpl.estimated_hours || 0} hrs</td>
                      <td style={{ padding: '0.75rem' }}>{tmpl.assignee_name || 'Unassigned'}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>
                        {tmpl.last_generated_date ? String(tmpl.last_generated_date).substring(0, 10) : 'Pending first run'}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span className={`badge ${tmpl.is_active ? 'badge-success' : 'badge-secondary'}`}>
                          {tmpl.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Execution Audit Logs */}
      {activeTab === 'logs' && (
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem' }}>Automation Execution Trail & Dispatched Alerts</h3>
          
          <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '0.65rem' }}>Timestamp</th>
                  <th style={{ padding: '0.65rem' }}>Rule Key</th>
                  <th style={{ padding: '0.65rem' }}>Status</th>
                  <th style={{ padding: '0.65rem' }}>Actions Taken</th>
                  <th style={{ padding: '0.65rem' }}>Duration</th>
                  <th style={{ padding: '0.65rem' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No automation cycles recorded yet. Click "Run All Automations Now" to execute.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.65rem' }}>{new Date(log.created_at).toLocaleString()}</td>
                      <td style={{ padding: '0.65rem', fontWeight: 600 }}><code>{log.rule_key}</code></td>
                      <td style={{ padding: '0.65rem' }}>
                        <span className={`badge ${log.status === 'success' ? 'badge-success' : 'badge-danger'}`}>
                          {log.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem' }}>{log.actions_taken}</td>
                      <td style={{ padding: '0.65rem' }}>{log.duration_ms} ms</td>
                      <td style={{ padding: '0.65rem', color: 'var(--text-secondary)' }}>{log.details}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {dispatchedNotifs.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem' }}>Recent Automated Notifications Dispatched</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {dispatchedNotifs.slice(0, 10).map((n) => (
                  <div key={n.id} style={{ padding: '0.65rem 0.85rem', borderRadius: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{n.title}</strong> → <em>{n.recipient_name}</em>: {n.message}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {new Date(n.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: New Recurring Task Template */}
      {showTemplateModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card modal-content" style={{ maxWidth: '520px', width: '90%', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Create Recurring Task Template</h3>
            <form onSubmit={handleCreateTemplate}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem' }}>Task Title *</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="e.g. Weekly Cloud Security Scan"
                  value={newTemplate.title}
                  onChange={(e) => setNewTemplate({ ...newTemplate, title: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem' }}>Recurrence Pattern</label>
                <select
                  className="form-control"
                  value={newTemplate.recurrence_pattern}
                  onChange={(e) => setNewTemplate({ ...newTemplate, recurrence_pattern: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                >
                  <option value="daily">Daily (Every Day)</option>
                  <option value="weekly">Weekly (Specific Day)</option>
                  <option value="monthly">Monthly (Day of Month)</option>
                </select>
              </div>

              {newTemplate.recurrence_pattern === 'weekly' && (
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem' }}>Day of Week</label>
                  <select
                    className="form-control"
                    value={newTemplate.day_of_week}
                    onChange={(e) => setNewTemplate({ ...newTemplate, day_of_week: Number(e.target.value) })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                  >
                    <option value={1}>Monday</option>
                    <option value={2}>Tuesday</option>
                    <option value={3}>Wednesday</option>
                    <option value={4}>Thursday</option>
                    <option value={5}>Friday</option>
                    <option value={6}>Saturday</option>
                    <option value={0}>Sunday</option>
                  </select>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem' }}>Assignee</label>
                <select
                  className="form-control"
                  value={newTemplate.assignee_id}
                  onChange={(e) => setNewTemplate({ ...newTemplate, assignee_id: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                >
                  <option value="">Unassigned</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.crm_role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem' }}>Priority</label>
                <select
                  className="form-control"
                  value={newTemplate.priority}
                  onChange={(e) => setNewTemplate({ ...newTemplate, priority: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
                <button type="button" onClick={() => setShowTemplateModal(false)} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Configure Rule */}
      {configuringRule && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card modal-content" style={{ maxWidth: '480px', width: '90%', padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>Configure: {configuringRule.name}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Adjust parameters (e.g. shift thresholds, SLA warning windows in JSON format):
            </p>

            <textarea
              rows={6}
              value={ruleConfigInput}
              onChange={(e) => setRuleConfigInput(e.target.value)}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '1rem' }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setConfiguringRule(null)} className="btn btn-outline">
                Cancel
              </button>
              <button onClick={handleSaveRuleConfig} className="btn btn-primary">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
