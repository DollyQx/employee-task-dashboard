import React, { useState } from 'react';

export default function ActivityLogView({ auditLogs = [], onRefresh, loading = false }) {
  const [filterAction, setFilterAction] = useState('all');
  const [search, setSearch] = useState('');

  const filteredLogs = auditLogs.filter((log) => {
    const matchAction = filterAction === 'all' || log.action === filterAction;
    const actor = log.actor_name || log.user_name || '';
    const matchSearch =
      !search ||
      actor.toLowerCase().includes(search.toLowerCase()) ||
      log.action?.toLowerCase().includes(search.toLowerCase()) ||
      log.entity_type?.toLowerCase().includes(search.toLowerCase());
    return matchAction && matchSearch;
  });

  return (
    <div className="activity-view">
      <div className="view-header">
        <div>
          <h2>Activity Log & Audit Trail</h2>
          <p>System audit trail of task transitions, status changes, and user actions</p>
        </div>
        <button type="button" className="button button--secondary" onClick={onRefresh} disabled={loading}>
          {loading ? 'Refreshing...' : '🔄 Refresh Log'}
        </button>
      </div>

      <div className="activity-controls">
        <label className="filter-search">
          <span aria-hidden="true">🔍</span>
          <input
            type="search"
            placeholder="Search by specialist, action, or machine asset..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
          <option value="all">All Actions</option>
          <option value="CREATE_TASK">CREATE_TASK</option>
          <option value="UPDATE_TASK">UPDATE_TASK</option>
          <option value="UPDATE_STATUS">UPDATE_STATUS</option>
          <option value="VERIFY_QA_REPORT">VERIFY_QA_REPORT</option>
          <option value="SCHEDULE_TASKS">SCHEDULE_TASKS</option>
          <option value="APPROVE_MATERIAL_REQUISITION">APPROVE_MATERIAL_REQUISITION</option>
          <option value="LOG_PREVENTIVE_MAINTENANCE">LOG_PREVENTIVE_MAINTENANCE</option>
          <option value="EHS_SAFETY_INSPECTION_PASS">EHS_SAFETY_INSPECTION_PASS</option>
        </select>
      </div>

      <div className="table-responsive">
        <table className="enterprise-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action</th>
              <th>Target Entity</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '32px' }}>
                  No audit log entries matching your criteria.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const timeStr = log.timestamp || log.created_at;
                const date = timeStr ? new Date(timeStr).toLocaleString('en-IN') : 'Recent';
                const actionClass = log.action?.includes('DELETE') ? 'action-badge--red' :
                                    log.action?.includes('CREATE') || log.action?.includes('APPROVE') ? 'action-badge--green' :
                                    log.action?.includes('LOGIN') ? 'action-badge--blue' : 'action-badge--violet';

                return (
                  <tr key={log.id}>
                    <td className="log-time">{date}</td>
                    <td><strong>{log.user_name || log.actor_name || 'System User'}</strong></td>
                    <td><span className={`action-badge ${actionClass}`}>{log.action}</span></td>
                    <td><span className="entity-tag">{log.entity_id || log.entity_type || 'TASK'}</span></td>
                    <td className="log-details">
                      <code>{typeof log.details === 'object' ? JSON.stringify(log.details) : (log.details || '—')}</code>
                    </td>
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
