import React, { useState } from 'react';

export default function ActivityLogView({ auditLogs = [], onRefresh, loading = false }) {
  const [filterAction, setFilterAction] = useState('all');
  const [search, setSearch] = useState('');

  const filteredLogs = auditLogs.filter((log) => {
    const matchAction = filterAction === 'all' || log.action === filterAction;
    const matchSearch =
      !search ||
      log.actor_name?.toLowerCase().includes(search.toLowerCase()) ||
      log.action?.toLowerCase().includes(search.toLowerCase()) ||
      log.entity_type?.toLowerCase().includes(search.toLowerCase());
    return matchAction && matchSearch;
  });

  return (
    <div className="activity-view">
      <div className="view-header">
        <div>
          <h2>Organization Activity & Audit Log</h2>
          <p>Security-relevant events, access history, and task modifications across Aulten Digital</p>
        </div>
        <button type="button" className="button button--secondary" onClick={onRefresh} disabled={loading}>
          {loading ? 'Refreshing…' : '↻ Refresh Log'}
        </button>
      </div>

      <div className="activity-controls">
        <label className="filter-search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            placeholder="Search by actor, action, or entity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
          <option value="all">All Actions</option>
          <option value="CREATE_TASK">CREATE_TASK</option>
          <option value="UPDATE_TASK">UPDATE_TASK</option>
          <option value="UPDATE_STATUS">UPDATE_STATUS</option>
          <option value="DELETE_TASK">DELETE_TASK</option>
          <option value="LOGIN">LOGIN</option>
          <option value="CREATE_CLIENT">CREATE_CLIENT</option>
          <option value="CREATE_PROJECT">CREATE_PROJECT</option>
          <option value="CREATE_EMPLOYEE">CREATE_EMPLOYEE</option>
        </select>
      </div>

      <div className="table-responsive">
        <table className="enterprise-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Details</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '32px' }}>
                  No audit log entries matching your criteria.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const date = new Date(log.created_at).toLocaleString();
                const actionClass = log.action.includes('DELETE') ? 'action-badge--red' :
                                    log.action.includes('CREATE') ? 'action-badge--green' :
                                    log.action.includes('LOGIN') ? 'action-badge--blue' : 'action-badge--violet';

                return (
                  <tr key={log.id}>
                    <td className="log-time">{date}</td>
                    <td><strong>{log.actor_name || 'System'}</strong></td>
                    <td><span className={`action-badge ${actionClass}`}>{log.action}</span></td>
                    <td><span className="entity-tag">{log.entity_type}</span></td>
                    <td className="log-details">
                      <code>{typeof log.details === 'object' ? JSON.stringify(log.details) : (log.details || '—')}</code>
                    </td>
                    <td className="log-ip">{log.ip_address || '—'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
