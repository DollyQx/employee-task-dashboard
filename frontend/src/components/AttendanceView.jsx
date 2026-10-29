import React, { useEffect, useState, useMemo } from 'react';
import {
  checkInAttendanceApi,
  checkOutAttendanceApi,
  getTodayAttendanceApi,
  getMyAttendanceHistoryApi,
  getAttendanceRecordsApi,
  getAttendanceSummaryApi,
  correctAttendanceApi,
  submitLeaveRequestApi,
  getMyLeavesApi,
  getAllLeavesApi,
  reviewLeaveRequestApi,
} from '../api/crm';

function formatTime(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function formatDate(dateString) {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '0h 0m';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs}h ${mins}m`;
}

export default function AttendanceView({ currentUser }) {
  const userRole = currentUser?.crm_role || 'employee';
  const isEmployee = userRole === 'employee';
  const canManageAttendance = userRole === 'super_admin' || userRole === 'admin';

  // Employee personal state
  const [todayStatus, setTodayStatus] = useState(null);
  const [myHistory, setMyHistory] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Admin / Manager state
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [periodFilter, setPeriodFilter] = useState('today'); // 'today' | 'week' | 'month' | 'all'
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Correction Modal State
  const [editingRecord, setEditingRecord] = useState(null);
  const [corrCheckIn, setCorrCheckIn] = useState('');
  const [corrCheckOut, setCorrCheckOut] = useState('');
  const [corrStatus, setCorrStatus] = useState('checked_out');
  const [corrReason, setCorrReason] = useState('');
  const [savingCorrection, setSavingCorrection] = useState(false);

  // ─── Leave Management State ───────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState('clock'); // 'clock' | 'leaves'
  const [myLeaves, setMyLeaves] = useState([]);
  const [teamLeaves, setTeamLeaves] = useState([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveType, setLeaveType] = useState('casual');
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [_reviewingLeaveId, setReviewingLeaveId] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');

  // Load employee today status & history
  const loadEmployeeData = async () => {
    try {
      const todayRes = await getTodayAttendanceApi();
      setTodayStatus(todayRes);
      const histRes = await getMyAttendanceHistoryApi({ limit: 50 });
      if (histRes?.records) setMyHistory(histRes.records);
      const leavesRes = await getMyLeavesApi().catch(() => ({ leaves: [] }));
      if (leavesRes?.leaves) setMyLeaves(leavesRes.leaves);
    } catch (err) {
      console.error('Failed to load employee attendance data:', err);
    }
  };

  // Load admin/manager records & summary
  const loadAdminData = async () => {
    if (isEmployee) return;
    setLoadingRecords(true);
    try {
      const [sumRes, recRes, allLeavesRes] = await Promise.all([
        getAttendanceSummaryApi().catch(() => null),
        getAttendanceRecordsApi({
          range: periodFilter !== 'all' ? periodFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        }).catch(() => ({ records: [] })),
        getAllLeavesApi().catch(() => ({ leaves: [] })),
      ]);
      if (sumRes) setSummary(sumRes);
      if (recRes?.records) setRecords(recRes.records);
      if (allLeavesRes?.leaves) setTeamLeaves(allLeavesRes.leaves);
    } catch (err) {
      console.error('Failed to load admin attendance data:', err);
    } finally {
      setLoadingRecords(false);
    }
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    if (!leaveStart || !leaveEnd || !leaveReason.trim()) {
      setErrorMsg('Start date, end date, and reason are required.');
      return;
    }
    setSubmittingLeave(true);
    setErrorMsg('');
    setMsg('');
    try {
      const res = await submitLeaveRequestApi({
        leave_type: leaveType,
        start_date: leaveStart,
        end_date: leaveEnd,
        reason: leaveReason.trim(),
      });
      setMsg(res.message || 'Leave request submitted successfully.');
      setShowLeaveModal(false);
      setLeaveReason('');
      setLeaveStart('');
      setLeaveEnd('');
      await loadEmployeeData();
      if (!isEmployee) await loadAdminData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit leave request.');
    } finally {
      setSubmittingLeave(false);
    }
  };

  const handleReviewLeave = async (leaveId, status) => {
    setErrorMsg('');
    setMsg('');
    try {
      const res = await reviewLeaveRequestApi(leaveId, status, reviewNotes);
      setMsg(res.message || `Leave request has been ${status}.`);
      setReviewingLeaveId(null);
      setReviewNotes('');
      await loadAdminData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to review leave request.');
    }
  };

  useEffect(() => {
    loadEmployeeData();
    if (!isEmployee) {
      loadAdminData();
    }
  }, [isEmployee, periodFilter, statusFilter]);

  // Employee Check-In handler
  const handleCheckIn = async () => {
    setActionLoading(true);
    setMsg('');
    setErrorMsg('');
    try {
      const res = await checkInAttendanceApi();
      setMsg(res.message || 'Checked in successfully!');
      await loadEmployeeData();
      if (!isEmployee) await loadAdminData();
    } catch (err) {
      setErrorMsg(err.message || 'Check-in failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Employee Check-Out handler
  const handleCheckOut = async () => {
    setActionLoading(true);
    setMsg('');
    setErrorMsg('');
    try {
      const res = await checkOutAttendanceApi();
      setMsg(res.message || 'Checked out successfully!');
      await loadEmployeeData();
      if (!isEmployee) await loadAdminData();
    } catch (err) {
      setErrorMsg(err.message || 'Check-out failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Open correction modal
  const handleOpenCorrection = (record) => {
    setEditingRecord(record);
    setCorrCheckIn(record.check_in_at ? record.check_in_at.substring(0, 16) : '');
    setCorrCheckOut(record.check_out_at ? record.check_out_at.substring(0, 16) : '');
    setCorrStatus(record.status || 'checked_out');
    setCorrReason('');
  };

  // Save correction
  const handleSaveCorrection = async (e) => {
    e.preventDefault();
    if (!corrReason.trim()) {
      alert('A valid reason is required for administrative corrections.');
      return;
    }
    setSavingCorrection(true);
    try {
      await correctAttendanceApi(editingRecord.id, {
        check_in_at: corrCheckIn ? new Date(corrCheckIn).toISOString() : undefined,
        check_out_at: corrCheckOut ? new Date(corrCheckOut).toISOString() : null,
        status: corrStatus,
        reason: corrReason.trim(),
      });
      setEditingRecord(null);
      await loadAdminData();
    } catch (err) {
      alert('Correction failed: ' + err.message);
    } finally {
      setSavingCorrection(false);
    }
  };

  // Filtered records for admin view
  const filteredRecords = useMemo(() => {
    if (!records) return [];
    return records.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = r.employee_name?.toLowerCase().includes(q);
        const empIdMatch = r.employee_id?.toLowerCase().includes(q);
        const deptMatch = r.department_name?.toLowerCase().includes(q);
        if (!nameMatch && !empIdMatch && !deptMatch) return false;
      }
      return true;
    });
  }, [records, searchQuery]);

  return (
    <div className="attendance-view">
      {/* ── Header ── */}
      <div className="view-header">
        <div>
          <h2>Employee Attendance &amp; Hours Tracking</h2>
          <p className="subtle-note">
            Startiz Labs official time &amp; attendance management system • Timezone: Asia/Kolkata (IST)
          </p>
        </div>
      </div>

      {msg && <div className="banner banner--success mb-4">✓ {msg}</div>}
      {errorMsg && <div className="banner banner--error mb-4">⚠️ {errorMsg}</div>}

      {/* ── Sub Navigation: Attendance vs Leaves ── */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <button
          type="button"
          onClick={() => setActiveSection('clock')}
          className={`button ${activeSection === 'clock' ? 'button--primary' : 'button--secondary'}`}
        >
          🕒 Time Clock &amp; Logs
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('leaves')}
          className={`button ${activeSection === 'leaves' ? 'button--primary' : 'button--secondary'}`}
        >
          🏖️ Leaves &amp; Time Off {teamLeaves.filter((l) => l.status === 'pending').length > 0 && `(${teamLeaves.filter((l) => l.status === 'pending').length} pending)`}
        </button>
      </div>

      {activeSection === 'clock' && (
        <>
          {/* ── Employee Self Check-In / Check-Out Widget ── */}
      <div className="attendance-checkin-card">
        <div className="checkin-card-main">
          <div className="checkin-status-info">
            <span className="subtle-label">Today's Attendance Status</span>
            <div className="status-display-row">
              <span
                className={`attendance-badge ${
                  todayStatus?.active_session
                    ? 'attendance-badge--active'
                    : todayStatus?.checked_in
                    ? 'attendance-badge--present'
                    : 'attendance-badge--not-in'
                }`}
              >
                <span className="pulsing-dot" />
                {todayStatus?.active_session
                  ? 'Currently Checked In (Active)'
                  : todayStatus?.checked_in
                  ? 'Checked Out (Day Completed)'
                  : 'Not Checked In Today'}
              </span>
              {todayStatus?.record?.check_in_at && (
                <span className="checkin-timestamp">
                  Checked In at: <strong>{formatTime(todayStatus.record.check_in_at)}</strong>
                </span>
              )}
              {todayStatus?.record?.check_out_at && (
                <span className="checkin-timestamp">
                  Checked Out at: <strong>{formatTime(todayStatus.record.check_out_at)}</strong> (
                  {formatDuration(todayStatus.record.duration_minutes)})
                </span>
              )}
            </div>
          </div>

          <div className="checkin-card-actions">
            {!todayStatus?.active_session ? (
              <button
                type="button"
                className="button button--primary button--lg"
                onClick={handleCheckIn}
                disabled={actionLoading}
              >
                {actionLoading ? 'Recording...' : '▶ Check In'}
              </button>
            ) : (
              <button
                type="button"
                className="button button--secondary button--lg button--checkout"
                onClick={handleCheckOut}
                disabled={actionLoading}
              >
                {actionLoading ? 'Recording...' : '⏹ Check Out'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Admin / Manager Attendance Summary & Directory ── */}
      {!isEmployee && (
        <div className="admin-attendance-section">
          {summary && (
            <div className="kpi-grid attendance-kpi-grid">
              <div className="kpi-card">
                <span className="kpi-label">Active Employees</span>
                <span className="kpi-value">{summary.total_active_employees}</span>
                <span className="kpi-sub">Total enrolled staff</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Present Today</span>
                <span className="kpi-value text-green">{summary.total_present_today}</span>
                <span className="kpi-sub">Logged in today</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Currently Active</span>
                <span className="kpi-value text-blue">{summary.currently_active}</span>
                <span className="kpi-sub">Active sessions open</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Checked Out Today</span>
                <span className="kpi-value">{summary.checked_out_today}</span>
                <span className="kpi-sub">Day shift completed</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Not Checked In</span>
                <span className="kpi-value text-red">{summary.not_checked_in_today}</span>
                <span className="kpi-sub">Awaiting check-in</span>
              </div>
            </div>
          )}

          {/* Controls & Filter Bar */}
          <div className="attendance-controls-bar">
            <div className="filter-search">
              <input
                type="text"
                placeholder="Search employee, ID, department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="filter-dropdowns">
              <div className="segmented-control">
                {['today', 'week', 'month', 'all'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`segmented-btn${periodFilter === p ? ' is-active' : ''}`}
                    onClick={() => setPeriodFilter(p)}
                  >
                    {p === 'today' ? 'Today' : p === 'week' ? 'Past 7 Days' : p === 'month' ? 'Past 30 Days' : 'All Time'}
                  </button>
                ))}
              </div>

              <select
                className="form-input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="present">Active / Present</option>
                <option value="checked_out">Checked Out</option>
              </select>
            </div>
          </div>

          {/* Attendance Table */}
          <div className="workload-table-wrapper card">
            <table className="workload-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Employee ID</th>
                  <th>Department</th>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Worked Duration</th>
                  <th>Status</th>
                  {canManageAttendance && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {loadingRecords ? (
                  <tr>
                    <td colSpan={canManageAttendance ? 9 : 8} style={{ textAlign: 'center', padding: '24px' }}>
                      Loading attendance records...
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={canManageAttendance ? 9 : 8} style={{ textAlign: 'center', padding: '24px', color: '#64748B' }}>
                      No attendance records found matching filters.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => {
                    const isMissingCheckout = !r.check_out_at && r.status === 'present';
                    return (
                      <tr key={r.id}>
                        <td>
                          <div className="employee-cell">
                            <span className="mini-avatar">{r.avatar || r.employee_name?.substring(0, 2).toUpperCase()}</span>
                            <strong>{r.employee_name}</strong>
                          </div>
                        </td>
                        <td><code>{r.employee_id}</code></td>
                        <td>{r.department_name || 'General'}</td>
                        <td>{formatDate(r.date)}</td>
                        <td>{formatTime(r.check_in_at)}</td>
                        <td>
                          {r.check_out_at ? (
                            formatTime(r.check_out_at)
                          ) : (
                            <span className="badge badge--sm" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                              In Progress
                            </span>
                          )}
                        </td>
                        <td>
                          <strong>{formatDuration(r.duration_minutes)}</strong>
                        </td>
                        <td>
                          <span
                            className={`badge badge--sm ${
                              r.status === 'checked_out'
                                ? 'badge--employee'
                                : isMissingCheckout
                                ? 'badge--manager'
                                : 'badge--admin'
                            }`}
                          >
                            {r.status === 'checked_out' ? 'Checked Out' : (isMissingCheckout ? 'Session Active' : r.status)}
                          </span>
                        </td>
                        {canManageAttendance && (
                          <td>
                            <button
                              type="button"
                              className="button button--secondary button--sm"
                              onClick={() => handleOpenCorrection(r)}
                              title="Correct attendance record"
                            >
                              ✏️ Correct
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Employee Personal History Table ── */}
      <div className="personal-attendance-history card mt-6">
        <div className="card-header">
          <h3>My Attendance Log &amp; Work Hours</h3>
          <p className="subtle-note">Chronological history of your daily check-in and checkout timestamps.</p>
        </div>
        <div className="workload-table-wrapper">
          <table className="workload-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Total Worked</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {myHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#64748B' }}>
                    No personal attendance records logged yet. Check in above to start your shift.
                  </td>
                </tr>
              ) : (
                myHistory.map((h) => (
                  <tr key={h.id}>
                    <td><strong>{formatDate(h.date)}</strong></td>
                    <td>{formatTime(h.check_in_at)}</td>
                    <td>{h.check_out_at ? formatTime(h.check_out_at) : <span className="text-blue">Active Session</span>}</td>
                    <td><strong>{formatDuration(h.duration_minutes)}</strong></td>
                    <td>
                      <span className={`badge badge--sm ${h.status === 'checked_out' ? 'badge--employee' : 'badge--admin'}`}>
                        {h.status === 'checked_out' ? 'Completed' : 'Active'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* ── Leaves & Time Off Section ── */}
      {activeSection === 'leaves' && (
        <div className="leaves-management-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Employee Leave Management</h3>
              <p className="subtle-note" style={{ margin: '0.2rem 0 0 0' }}>
                Track vacation, sick leave, casual leaves, and approvals.
              </p>
            </div>
            <button
              type="button"
              className="button button--primary"
              onClick={() => setShowLeaveModal(true)}
            >
              + Request Time Off
            </button>
          </div>

          {/* Pending Approval Queue for Managers & Admins */}
          {!isEmployee && (
            <div className="card mb-4" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📋</span> Team Leave Requests Approval Queue ({teamLeaves.filter((l) => l.status === 'pending').length} pending)
              </h4>

              {teamLeaves.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No team leave requests submitted yet.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table attendance-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Department</th>
                        <th>Type</th>
                        <th>Dates</th>
                        <th>Days</th>
                        <th>Reason</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamLeaves.map((l) => (
                        <tr key={l.id}>
                          <td>
                            <strong>{l.employee_name || 'Team Member'}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{l.employee_id}</div>
                          </td>
                          <td>{l.department_name || 'General'}</td>
                          <td>
                            <span className="badge badge--sm badge--info" style={{ textTransform: 'capitalize' }}>
                              {l.leave_type}
                            </span>
                          </td>
                          <td>
                            {String(l.start_date).substring(0, 10)} to {String(l.end_date).substring(0, 10)}
                          </td>
                          <td><strong>{l.days_count}</strong></td>
                          <td style={{ maxWidth: '200px' }} title={l.reason}>{l.reason}</td>
                          <td>
                            <span className={`badge badge--sm ${
                              l.status === 'approved' ? 'badge--success' : (l.status === 'rejected' ? 'badge--danger' : 'badge--warning')
                            }`}>
                              {l.status}
                            </span>
                          </td>
                          <td>
                            {l.status === 'pending' ? (
                              <div style={{ display: 'flex', gap: '0.35rem' }}>
                                <button
                                  type="button"
                                  className="button button--xs button--primary"
                                  onClick={() => handleReviewLeave(l.id, 'approved')}
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  className="button button--xs button--secondary"
                                  onClick={() => handleReviewLeave(l.id, 'rejected')}
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                {l.reviewer_name ? `By ${l.reviewer_name}` : 'Reviewed'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* My Leave Requests Table */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1.05rem' }}>My Leave Request History</h4>
            {myLeaves.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                You have not submitted any leave requests. Click "+ Request Time Off" above to submit one.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table attendance-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Dates</th>
                      <th>Duration</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th>Reviewer Notes</th>
                      <th>Submitted On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myLeaves.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <span className="badge badge--sm badge--info" style={{ textTransform: 'capitalize' }}>
                            {l.leave_type}
                          </span>
                        </td>
                        <td>
                          <strong>{String(l.start_date).substring(0, 10)}</strong> to <strong>{String(l.end_date).substring(0, 10)}</strong>
                        </td>
                        <td>{l.days_count} day(s)</td>
                        <td>{l.reason}</td>
                        <td>
                          <span className={`badge badge--sm ${
                            l.status === 'approved' ? 'badge--success' : (l.status === 'rejected' ? 'badge--danger' : 'badge--warning')
                          }`}>
                            {l.status}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          {l.review_notes || '—'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          {new Date(l.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Request Leave Modal ── */}
      {showLeaveModal && (
        <div className="modal-backdrop" onClick={() => setShowLeaveModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>Request Time Off</h3>
              <button type="button" className="close-button" onClick={() => setShowLeaveModal(false)}>✕</button>
            </div>
            <form onSubmit={handleApplyLeave}>
              <div className="modal-body">
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem' }}>Leave Type</label>
                  <select
                    className="form-input"
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value)}
                  >
                    <option value="casual">Casual Leave</option>
                    <option value="sick">Sick / Medical Leave</option>
                    <option value="earned">Earned / Annual Leave</option>
                    <option value="unpaid">Unpaid Leave</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem' }}>Start Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      required
                      value={leaveStart}
                      onChange={(e) => setLeaveStart(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem' }}>End Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      required
                      value={leaveEnd}
                      onChange={(e) => setLeaveEnd(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem' }}>Reason *</label>
                  <textarea
                    rows="3"
                    className="form-input"
                    required
                    placeholder="Provide a clear description of the reason for absence..."
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setShowLeaveModal(false)}
                  disabled={submittingLeave}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button--primary"
                  disabled={submittingLeave || !leaveReason.trim()}
                >
                  {submittingLeave ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Administrative Correction Modal ── */}
      {editingRecord && (
        <div className="modal-backdrop" onClick={() => setEditingRecord(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Correct Attendance Record</h3>
              <button type="button" className="close-button" onClick={() => setEditingRecord(null)}>✕</button>
            </div>
            <form onSubmit={handleSaveCorrection}>
              <div className="modal-body">
                <p className="subtle-note">
                  Modifying attendance for <strong>{editingRecord.employee_name}</strong> ({editingRecord.employee_id}) on{' '}
                  {formatDate(editingRecord.date)}. This action is audited.
                </p>

                <div className="form-group">
                  <label htmlFor="corr-in">Check-in Timestamp (Local)</label>
                  <input
                    id="corr-in"
                    type="datetime-local"
                    className="form-input"
                    value={corrCheckIn}
                    onChange={(e) => setCorrCheckIn(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="corr-out">Check-out Timestamp (Local)</label>
                  <input
                    id="corr-out"
                    type="datetime-local"
                    className="form-input"
                    value={corrCheckOut}
                    onChange={(e) => setCorrCheckOut(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="corr-status">Attendance Status</label>
                  <select
                    id="corr-status"
                    className="form-input"
                    value={corrStatus}
                    onChange={(e) => setCorrStatus(e.target.value)}
                  >
                    <option value="present">Present (Active Session)</option>
                    <option value="checked_out">Checked Out</option>
                    <option value="incomplete">Incomplete Record</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="corr-reason">Reason for Correction <span className="text-red">*</span></label>
                  <textarea
                    id="corr-reason"
                    rows="2"
                    className="form-input"
                    placeholder="e.g. Employee forgot to badge out; confirmed hours via project task log..."
                    value={corrReason}
                    onChange={(e) => setCorrReason(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setEditingRecord(null)}
                  disabled={savingCorrection}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button--primary"
                  disabled={savingCorrection || !corrReason.trim()}
                >
                  {savingCorrection ? 'Saving...' : 'Save Correction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
