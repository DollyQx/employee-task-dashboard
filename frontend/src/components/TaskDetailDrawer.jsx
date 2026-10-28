import React, { useEffect, useRef, useState } from 'react';
import StatusBadge from './StatusBadge';
import UrgencyBadge from './UrgencyBadge';
import { daysFromToday, isTaskOverdue } from '../utils/taskMetrics';
import { safeExternalUrl } from '../utils/safeUrl';
import { fetchTaskCommentsApi, addTaskCommentApi, patchTaskStatusApi } from '../api/crm';

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
  onClose,
  onEditTask,
  onDeleteTask,
  onTaskUpdated,
}) {
  const closeButtonRef = useRef(null);
  const drawerRef = useRef(null);
  const [comments, setComments] = useState(task?.comments || []);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [statusVal, setStatusVal] = useState(task?.crm_status || task?.status || 'todo');

  const isDatabaseTask = Boolean(task?.task_code || task?.crm_status || task?.organization_id || task?.id);

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
    }
  }, [task?.id]);

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

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !task?.id) return;
    setSubmittingComment(true);
    try {
      const res = await addTaskCommentApi(task.id, newComment.trim());
      if (res?.comment) {
        setComments((prev) => [...prev, res.comment]);
        setNewComment('');
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
  const originalTaskUrl = safeExternalUrl(task.sourceUrl || task.source_url);

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
              {task.task_code || 'WORK ORDER'} • {task.department_name || 'Plant Operations'}
            </p>
            <h2 id="task-drawer-title">{task.title || 'Untitled Work Order'}</h2>
          </div>
          <div className="drawer-header-actions">
            {onEditTask && (
              <button
                type="button"
                className="button button--secondary button--sm"
                onClick={() => onEditTask(task)}
              >
                ✏️ Edit
              </button>
            )}
            {onDeleteTask && (
              <button
                type="button"
                className="button button--secondary button--sm text-red"
                onClick={() => onDeleteTask(task.id)}
                title="Delete work order"
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
              <h4>Technical Specifications & Acceptance Criteria</h4>
              <p>{task.description}</p>
            </div>
          )}

          <dl className="task-detail-list">
            <div className="task-detail-row">
              <dt>Floor Status</dt>
              <dd>
                <select
                  className="drawer-status-select"
                  value={statusVal}
                  onChange={handleStatusChange}
                >
                  <option value="backlog">Backlog / Planned</option>
                  <option value="todo">Shift Queue</option>
                  <option value="in_progress">In Machining</option>
                  <option value="in_review">QA & Metrology Review</option>
                  <option value="blocked">Maintenance Hold</option>
                  <option value="done">Completed & Dispatched</option>
                </select>
              </dd>
            </div>

            <div className="task-detail-row">
              <dt>Criticality / Urgency</dt>
              <dd>
                <span className={`priority-pill priority-pill--${task.crm_priority || task.urgency || 'medium'}`}>
                  {(task.crm_priority || task.urgency || 'medium').toUpperCase()}
                </span>
              </dd>
            </div>

            {task.asset && (
              <div className="task-detail-row">
                <dt>Machinery / Asset</dt>
                <dd><strong>🔧 {task.asset}</strong></dd>
              </div>
            )}

            {task.batch_no && (
              <div className="task-detail-row">
                <dt>Material Heat / Batch</dt>
                <dd><code>{task.batch_no}</code></dd>
              </div>
            )}

            <div className="task-detail-row">
              <dt>Shopfloor Division</dt>
              <dd>{task.department_name || 'Plant Operations & Production'}</dd>
            </div>

            {task.project_name && (
              <div className="task-detail-row">
                <dt>OEM Project</dt>
                <dd>📁 {task.project_name}</dd>
              </div>
            )}

            <div className="task-detail-row">
              <dt>Lead Specialist</dt>
              <dd>
                <strong>{task.employee || task.assignees?.[0]?.full_name || 'Unassigned'}</strong>
              </dd>
            </div>

            <div className="task-detail-row">
              <dt>Target Completion</dt>
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
                <dt>Standard Cycle Time</dt>
                <dd>{task.estimated_hours} Hours</dd>
              </div>
            )}

            {task.tags && (
              <div className="task-detail-row">
                <dt>Process Tags</dt>
                <dd className="drawer-tags">
                  {task.tags.split(',').map((t, idx) => (
                    <span key={idx} className="drawer-tag">#{t.trim()}</span>
                  ))}
                </dd>
              </div>
            )}

            {originalTaskUrl && (
              <div className="task-detail-row">
                <dt>External Work Order</dt>
                <dd>
                  <a href={originalTaskUrl} target="_blank" rel="noopener noreferrer">
                    Open SCADA Reference ↗
                  </a>
                </dd>
              </div>
            )}
          </dl>

          {/* Comments and Engineering Notes Section */}
          <div className="drawer-comments-section">
            <h4>Engineering Shift Notes & QA Comments ({comments.length})</h4>
            <div className="comments-list">
              {loadingComments ? (
                <p className="subtle-note">Loading comments...</p>
              ) : comments.length === 0 ? (
                <p className="subtle-note">No comments logged for this work order yet.</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="comment-item">
                    <div className="comment-header">
                      <span className="mini-avatar">{c.user_avatar || (c.user_name ? c.user_name.substring(0, 2).toUpperCase() : 'AS')}</span>
                      <strong>{c.user_name || 'Floor Specialist'}</strong>
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
                placeholder="Log shift observation or metrology update..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                disabled={submittingComment}
              />
              <button
                type="submit"
                className="button button--primary button--sm"
                disabled={submittingComment || !newComment.trim()}
              >
                {submittingComment ? 'Logging...' : 'Post Note'}
              </button>
            </form>
          </div>
        </div>
      </aside>
    </div>
  );
}
