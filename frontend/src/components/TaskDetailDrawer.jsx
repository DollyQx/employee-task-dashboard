import React, { useEffect, useRef, useState } from 'react';
import { daysFromToday, isTaskOverdue } from '../utils/taskMetrics';
import { safeExternalUrl } from '../utils/safeUrl';
import {
  fetchTaskCommentsApi,
  addTaskCommentApi,
  patchTaskStatusApi,
  fetchTaskHistoryApi,
  updateTaskProgressApi,
  getTaskProgressHistoryApi,
  suggestNextStepsWithAiApi,
  summarizeProgressWithAiApi,
} from '../api/crm';

function formatDeadline(deadline) {
  if (!deadline) return 'No due date';
  const parsed = daysFromToday(deadline);
  if (parsed === null) return 'Invalid due date';
  const dateStr = String(deadline).split('T')[0];
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function TaskDetailDrawer({
  task,
  currentUser,
  onClose,
  onEditTask,
  onDeleteTask,
  onTaskUpdated,
}) {
  const closeButtonRef = useRef(null);
  const drawerRef = useRef(null);
  const [comments, setComments] = useState(task?.comments || []);
  const [history, setHistory] = useState(task?.history || []);
  const [newComment, setNewComment] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [statusVal, setStatusVal] = useState(task?.crm_status || task?.status || 'todo');
  const [activeTab, setActiveTab] = useState('discussion'); // 'discussion' | 'history' | 'progress_history'

  const [progressVal, setProgressVal] = useState(task?.completion_percentage || 0);
  const [progressNotes, setProgressNotes] = useState('');
  const [progressBlockers, setProgressBlockers] = useState('');
  const [progressPending, setProgressPending] = useState('');
  const [savingProgress, setSavingProgress] = useState(false);
  const [progressHistory, setProgressHistory] = useState([]);
  const [progressSuccessMsg, setProgressSuccessMsg] = useState('');

  // ─── AI Assistance States ──────────────────────────────────────────────────
  const [aiNextSteps, setAiNextSteps] = useState(null);
  const [aiLoadingSteps, setAiLoadingSteps] = useState(false);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoadingSummary, setAiLoadingSummary] = useState(false);

  const handleFetchAiNextSteps = async () => {
    setAiLoadingSteps(true);
    try {
      const res = await suggestNextStepsWithAiApi({
        taskTitle: task.title,
        status: statusVal,
        progress: progressVal,
        blockers: progressBlockers,
      });
      setAiNextSteps(res?.result?.nextSteps || []);
    } catch (err) {
      alert('Could not generate next steps: ' + err.message);
    } finally {
      setAiLoadingSteps(false);
    }
  };

  const handleFetchAiSummary = async () => {
    setAiLoadingSummary(true);
    try {
      const res = await summarizeProgressWithAiApi({
        taskTitle: task.title,
        status: statusVal,
        progress: progressVal,
        blockers: progressBlockers,
        updates: progressHistory,
      });
      setAiSummary(res?.result || null);
    } catch (err) {
      alert('Could not summarize progress: ' + err.message);
    } finally {
      setAiLoadingSummary(false);
    }
  };

  const userRole = currentUser?.crm_role || 'employee';
  const isEmployee = userRole === 'employee';
  const isAssigned =
    task?.assignees?.some((a) => a.id === currentUser?.id || a.email === currentUser?.email) ||
    task?.employee?.toLowerCase() === currentUser?.full_name?.toLowerCase();
  const canUpdateProgress = !isEmployee || isAssigned;
  const canPostInternalNotes = !isEmployee;
  const canEdit = !isEmployee;
  const canDelete = userRole === 'super_admin' || userRole === 'admin';

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !drawerRef.current) return;
      const focusable = [...drawerRef.current.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input, textarea, select'
      )];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    if (task?.id) {
      setLoadingComments(true);
      fetchTaskCommentsApi(task.id)
        .then((res) => {
          if (res?.comments) setComments(res.comments);
        })
        .catch(() => {})
        .finally(() => setLoadingComments(false));

      setLoadingHistory(true);
      fetchTaskHistoryApi(task.id)
        .then((res) => {
          if (res?.history) setHistory(res.history);
        })
        .catch(() => {})
        .finally(() => setLoadingHistory(false));

      getTaskProgressHistoryApi(task.id)
        .then((res) => {
          if (res?.history) setProgressHistory(res.history);
        })
        .catch(() => {});

      if (task.completion_percentage !== undefined) {
        setProgressVal(task.completion_percentage);
      }
    }
  }, [task?.id, task?.completion_percentage]);

  const handleStatusChange = async (e) => {
    const nextStatus = e.target.value;
    setStatusVal(nextStatus);
    if (task?.id) {
      try {
        const res = await patchTaskStatusApi(task.id, nextStatus);
        if (onTaskUpdated && res?.task) {
          onTaskUpdated(res.task);
        }
      } catch (err) {
        alert('Failed to update status: ' + err.message);
      }
    }
  };

  const handleSaveProgress = async (e) => {
    e.preventDefault();
    if (!task?.id) return;
    setSavingProgress(true);
    setProgressSuccessMsg('');
    try {
      const res = await updateTaskProgressApi(task.id, {
        progress: progressVal,
        status: statusVal,
        notes: progressNotes,
        blockers: progressBlockers,
        pending_work: progressPending,
      });
      if (res?.task) {
        setProgressSuccessMsg('Progress updated successfully!');
        setProgressNotes('');
        setProgressBlockers('');
        setProgressPending('');
        if (onTaskUpdated) onTaskUpdated(res.task);
        const histRes = await getTaskProgressHistoryApi(task.id);
        if (histRes?.history) setProgressHistory(histRes.history);
        const comRes = await fetchTaskCommentsApi(task.id);
        if (comRes?.comments) setComments(comRes.comments);
      }
    } catch (err) {
      alert('Failed to update progress: ' + err.message);
    } finally {
      setSavingProgress(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !task?.id) return;
    setSubmittingComment(true);
    try {
      const res = await addTaskCommentApi(task.id, newComment.trim(), isInternalNote);
      if (res?.comment) {
        setComments((prev) => [...prev, res.comment]);
        setNewComment('');
        setIsInternalNote(false);
      }
    } catch (err) {
      alert('Failed to post comment: ' + err.message);
    } finally {
      setSubmittingComment(false);
    }
  };

  const deadlineField = task.due_date || task.deadline;
  const overdue = task.is_overdue !== undefined ? task.is_overdue : isTaskOverdue(task);
  const daysUntilDeadline = deadlineField ? daysFromToday(String(deadlineField).split('T')[0]) : null;
  const originalTaskUrl = safeExternalUrl(task.sourceUrl || task.source_url || task.source_link);
  const creatorDisplay = task.creator_name || task.created_by_name || 'System';

  // Filter public comments vs internal notes
  const publicComments = comments.filter((c) => !c.is_internal);
  const internalNotesList = comments.filter((c) => c.is_internal);

  return (
    <div className="task-drawer-layer">
      <button className="task-drawer-backdrop" type="button" aria-label="Close task details" onClick={onClose} tabIndex={-1} />
      <aside
        className="task-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-drawer-title"
        ref={drawerRef}
      >
        <header className="task-drawer__header">
          <div>
            <p className="task-drawer__eyebrow">
              {task.task_code || 'TASK'} • {task.department_name || 'Engineering'}
            </p>
            <h2 id="task-drawer-title">{task.title || 'Untitled Task'}</h2>
          </div>
          <div className="drawer-header-actions">
            {canEdit && onEditTask && (
              <button
                type="button"
                className="button button--secondary button--sm"
                onClick={() => onEditTask(task)}
              >
                ✏️ Edit
              </button>
            )}
            {canDelete && onDeleteTask && (
              <button
                type="button"
                className="button button--secondary button--sm text-red"
                onClick={() => onDeleteTask(task.id)}
                title="Delete task"
              >
                🗑️
              </button>
            )}
            <button
              ref={closeButtonRef}
              className="task-drawer__close"
              type="button"
              onClick={onClose}
              aria-label="Close task details"
            >
              ✕
            </button>
          </div>
        </header>

        <div className="task-drawer__content">
          {task.description && (
            <div className="task-drawer__desc-box">
              <h4>Description &amp; Specifications</h4>
              <p>{task.description}</p>
            </div>
          )}

          {canPostInternalNotes && task.internal_notes && (
            <div className="task-drawer__internal-notes-banner">
              <div className="internal-notes-header">
                <strong>🔒 Staff Internal Notes</strong>
                <span className="badge badge--internal">Confidential</span>
              </div>
              <p>{task.internal_notes}</p>
            </div>
          )}

          <dl className="task-detail-list">
            <div className="task-detail-row">
              <dt>Status</dt>
              <dd>
                <select
                  className="drawer-status-select"
                  value={statusVal}
                  onChange={handleStatusChange}
                >
                  <option value="backlog">Backlog</option>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Completed</option>
                </select>
              </dd>
            </div>

            <div className="task-detail-row">
              <dt>Priority</dt>
              <dd>
                <span className={`priority-pill priority-pill--${task.crm_priority || task.urgency || 'medium'}`}>
                  {(task.crm_priority || task.urgency || 'medium').toUpperCase()}
                </span>
              </dd>
            </div>

            <div className="task-detail-row">
              <dt>Department</dt>
              <dd>{task.department_name || 'Engineering'}</dd>
            </div>

            {task.project_name && (
              <div className="task-detail-row">
                <dt>Project</dt>
                <dd>📁 {task.project_name}</dd>
              </div>
            )}

            <div className="task-detail-row">
              <dt>Assigned To</dt>
              <dd>
                <strong>{task.employee || task.assignees?.[0]?.full_name || 'Unassigned'}</strong>
              </dd>
            </div>

            <div className="task-detail-row">
              <dt>Created By</dt>
              <dd>👤 {creatorDisplay}</dd>
            </div>

            <div className="task-detail-row">
              <dt>Target Deadline</dt>
              <dd>
                <span className={overdue ? 'text-red' : ''}>
                  {formatDeadline(deadlineField)}
                  {overdue && daysUntilDeadline !== null && (
                    <strong> ({Math.abs(daysUntilDeadline)} days overdue)</strong>
                  )}
                </span>
              </dd>
            </div>

            {task.estimated_hours > 0 && (
              <div className="task-detail-row">
                <dt>Estimated Effort</dt>
                <dd>{task.estimated_hours} Hours</dd>
              </div>
            )}

            <div className="task-detail-row">
              <dt>Task Source</dt>
              <dd>
                <span className={`source-tag source-tag--${(task.source || 'Internal').toLowerCase()}`}>
                  {task.source || 'Internal'}
                </span>
              </dd>
            </div>

            {originalTaskUrl && (
              <div className="task-detail-row">
                <dt>External Reference</dt>
                <dd>
                  <a href={originalTaskUrl} target="_blank" rel="noopener noreferrer">
                    Open Source Link ↗
                  </a>
                </dd>
              </div>
            )}

            {task.tags && (
              <div className="task-detail-row">
                <dt>Tags</dt>
                <dd className="drawer-tags">
                  {task.tags.split(',').map((t, idx) => (
                    <span key={idx} className="drawer-tag">#{t.trim()}</span>
                  ))}
                </dd>
              </div>
            )}
          </dl>

          {/* ── Task Progress Tracking Module (0% to 100%, Presets, Notes & Blockers) ── */}
          <div className="task-progress-card">
            <div className="progress-card-header">
              <div>
                <h4>Task Progress &amp; Completion</h4>
                <p className="subtle-note">Update percentage completed, report blockers, and note pending items.</p>
              </div>
              <div className="progress-value-badge">
                <strong>{progressVal}%</strong>
              </div>
            </div>

            <div className="progress-track-wrap">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${progressVal}%`,
                  background: progressVal === 100 ? '#15803D' : (progressVal >= 60 ? '#2563EB' : (progressVal >= 30 ? '#D97706' : '#94A3B8')),
                }}
              />
            </div>

            {canUpdateProgress ? (
              <form onSubmit={handleSaveProgress} className="progress-update-form">
                <div className="form-group">
                  <label htmlFor="progress-slider">Completion Percentage: <strong>{progressVal}%</strong></label>
                  <input
                    id="progress-slider"
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={progressVal}
                    onChange={(e) => setProgressVal(Number(e.target.value))}
                    className="progress-range-slider"
                  />
                  <div className="progress-presets">
                    {[0, 20, 40, 60, 80, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`preset-btn${progressVal === preset ? ' is-active' : ''}`}
                        onClick={() => setProgressVal(preset)}
                      >
                        {preset}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="progress-notes">What has been completed:</label>
                    <textarea
                      id="progress-notes"
                      rows="2"
                      className="form-input"
                      placeholder="e.g. Implemented API routes and unit test suite..."
                      value={progressNotes}
                      onChange={(e) => setProgressNotes(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="progress-blockers">Blockers / Impediments:</label>
                    <textarea
                      id="progress-blockers"
                      rows="2"
                      className="form-input"
                      placeholder="e.g. Waiting on API credentials or cloud access..."
                      value={progressBlockers}
                      onChange={(e) => setProgressBlockers(e.target.value)}
                    />
                  </div>
                </div>

                <div className="progress-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="button button--secondary button--xs"
                    onClick={handleFetchAiNextSteps}
                    disabled={aiLoadingSteps}
                    style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                  >
                    {aiLoadingSteps ? 'Analyzing...' : '✨ Suggest Next Steps (Free AI)'}
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {progressSuccessMsg && <span className="text-green font-bold text-sm">✓ {progressSuccessMsg}</span>}
                    <button
                      type="submit"
                      className="button button--primary button--sm"
                      disabled={savingProgress}
                    >
                      {savingProgress ? 'Saving...' : '💾 Save Progress Update'}
                    </button>
                  </div>
                </div>

                {aiNextSteps && (
                  <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '6px', background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: '0.85rem' }}>
                    <div style={{ fontWeight: 600, color: '#1e40af', marginBottom: '6px' }}>✨ AI Recommended Next Actions (Free &amp; Offline Supported):</div>
                    <ul style={{ margin: 0, paddingLeft: '18px', color: '#1e3a8a' }}>
                      {aiNextSteps.map((step, idx) => (
                        <li key={idx} style={{ marginBottom: '4px' }}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </form>
            ) : (
              <p className="subtle-note" style={{ marginTop: '8px' }}>
                Only the assigned employee ({task.employee || 'Assignee'}) or managers can update task progress.
              </p>
            )}
          </div>

          {/* ── Tabs: Discussion vs Progress History vs Activity History ── */}
          <div className="drawer-tabs">
            <button
              type="button"
              className={`drawer-tab-btn${activeTab === 'discussion' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('discussion')}
            >
              💬 Comments ({comments.length})
            </button>
            <button
              type="button"
              className={`drawer-tab-btn${activeTab === 'progress_history' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('progress_history')}
            >
              📈 Progress Log ({progressHistory.length})
            </button>
            <button
              type="button"
              className={`drawer-tab-btn${activeTab === 'history' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              📜 Activity History ({history.length})
            </button>
          </div>

          {activeTab === 'discussion' ? (
            <div className="drawer-comments-section">
              {canPostInternalNotes && internalNotesList.length > 0 && (
                <div className="internal-notes-subgroup">
                  <h5>🔒 Internal Staff Notes ({internalNotesList.length})</h5>
                  <div className="comments-list">
                    {internalNotesList.map((c) => (
                      <div key={c.id} className="comment-item comment-item--internal">
                        <div className="comment-header">
                          <span className="mini-avatar">{c.avatar || (c.full_name ? c.full_name.substring(0, 2).toUpperCase() : 'ST')}</span>
                          <strong>{c.full_name || 'Staff Member'}</strong>
                          <span className="badge badge--internal">Staff Only</span>
                          <span className="comment-time">
                            {c.created_at ? new Date(c.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <p className="comment-body">{c.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <h5 style={{ marginTop: '12px' }}>Public Comments &amp; Updates</h5>
              <div className="comments-list">
                {loadingComments ? (
                  <p className="subtle-note">Loading comments...</p>
                ) : publicComments.length === 0 ? (
                  <p className="subtle-note">No public comments posted yet.</p>
                ) : (
                  publicComments.map((c) => (
                    <div key={c.id} className="comment-item">
                      <div className="comment-header">
                        <span className="mini-avatar">{c.avatar || (c.full_name ? c.full_name.substring(0, 2).toUpperCase() : 'EM')}</span>
                        <strong>{c.full_name || 'Team Member'}</strong>
                        <span className="comment-time">
                          {c.created_at ? new Date(c.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <p className="comment-body">{c.comment}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleAddComment} className="add-comment-form">
                <input
                  type="text"
                  placeholder={isInternalNote ? 'Add internal staff note (hidden from employees)...' : 'Add a public comment or progress update...'}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  disabled={submittingComment}
                />
                {canPostInternalNotes && (
                  <label className="internal-note-toggle" title="Mark as internal staff note">
                    <input
                      type="checkbox"
                      checked={isInternalNote}
                      onChange={(e) => setIsInternalNote(e.target.checked)}
                    />
                    <span>🔒 Staff Only</span>
                  </label>
                )}
                <button
                  type="submit"
                  className="button button--primary button--sm"
                  disabled={submittingComment || !newComment.trim()}
                >
                  {submittingComment ? 'Posting...' : (isInternalNote ? 'Post Internal Note' : 'Post Comment')}
                </button>
              </form>
            </div>
          ) : activeTab === 'progress_history' ? (
            /* ── Progress History Log View ── */
            <div className="drawer-history-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span className="subtle-note" style={{ margin: 0 }}>Chronological updates (0-100%)</span>
                <button
                  type="button"
                  className="button button--secondary button--xs"
                  onClick={handleFetchAiSummary}
                  disabled={aiLoadingSummary}
                  style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                >
                  {aiLoadingSummary ? 'Generating Briefing...' : '✨ AI Progress Briefing (Free)'}
                </button>
              </div>

              {aiSummary && (
                <div style={{ marginBottom: '16px', padding: '12px 14px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>📊 Executive Briefing:</div>
                  <p style={{ margin: '0 0 6px 0', color: '#334155' }}>{aiSummary.executiveSummary}</p>
                  {aiSummary.recommendedAction && (
                    <div style={{ fontSize: '0.8rem', color: '#1d4ed8', fontWeight: 500 }}>
                      👉 <strong>Action:</strong> {aiSummary.recommendedAction}
                    </div>
                  )}
                </div>
              )}

              {progressHistory.length === 0 ? (
                <p className="subtle-note">No progress updates submitted for this task yet.</p>
              ) : (
                <div className="timeline-list">
                  {progressHistory.map((ph) => {
                    const timeStr = ph.created_at ? new Date(ph.created_at).toLocaleString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }) : '';
                    return (
                      <div key={ph.id} className="timeline-item">
                        <div className="timeline-marker" style={{ background: ph.current_progress === 100 ? '#15803D' : '#2563EB' }} />
                        <div className="timeline-content">
                          <div className="timeline-header">
                            <strong>{ph.author_name || 'Team Member'}</strong>
                            <span className="badge badge--sm" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                              {ph.previous_progress}% → {ph.current_progress}%
                            </span>
                            <span className="timeline-time">{timeStr}</span>
                          </div>
                          {ph.status && (
                            <p className="timeline-detail">
                              Status: <strong>{ph.status.toUpperCase()}</strong>
                            </p>
                          )}
                          {ph.notes && (
                            <p className="timeline-detail">
                              <strong>Completed:</strong> {ph.notes}
                            </p>
                          )}
                          {ph.blockers && (
                            <p className="timeline-detail text-red">
                              <strong>Blocker:</strong> {ph.blockers}
                            </p>
                          )}
                          {ph.pending_work && (
                            <p className="timeline-detail">
                              <strong>Pending:</strong> {ph.pending_work}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* ── Activity History View ── */
            <div className="drawer-history-section">
              {loadingHistory ? (
                <p className="subtle-note">Loading task history...</p>
              ) : history.length === 0 ? (
                <p className="subtle-note">No historical activity logged for this task.</p>
              ) : (
                <div className="timeline-list">
                  {history.map((h) => {
                    const timeStr = h.created_at ? new Date(h.created_at).toLocaleString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }) : '';
                    let detailsText = '';
                    if (h.details) {
                      if (h.details.oldStatus && h.details.newStatus) {
                        detailsText = `Status changed from "${h.details.oldStatus}" to "${h.details.newStatus}"`;
                      } else if (h.details.title) {
                        detailsText = `Task "${h.details.title}" was created`;
                      } else if (h.details.message) {
                        detailsText = h.details.message;
                      } else if (typeof h.details === 'string') {
                        detailsText = h.details;
                      }
                    }

                    return (
                      <div key={h.id} className="timeline-item">
                        <div className="timeline-marker" />
                        <div className="timeline-content">
                          <div className="timeline-header">
                            <strong>{h.actor_name || 'System User'}</strong>
                            <span className="timeline-action">{h.action?.replace('_', ' ')}</span>
                            <span className="timeline-time">{timeStr}</span>
                          </div>
                          {detailsText && <p className="timeline-detail">{detailsText}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
