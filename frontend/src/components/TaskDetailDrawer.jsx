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
  return date.toLocaleDateString('en-US', {
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

  const isDatabaseTask = Boolean(task?.task_code || task?.crm_status || task?.organization_id);

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
    if (isDatabaseTask && task?.id) {
      setLoadingComments(true);
      fetchTaskCommentsApi(task.id)
        .then((res) => {
          if (res?.comments) setComments(res.comments);
        })
        .catch(() => {})
        .finally(() => setLoadingComments(false));
    }
  }, [isDatabaseTask, task?.id]);

  const handleStatusChange = async (e) => {
    const nextStatus = e.target.value;
    setStatusVal(nextStatus);
    if (isDatabaseTask && task?.id) {
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
              {task.task_code || (task.source ? `${task.source} Task` : 'Task details')}
            </p>
            <h2 id="task-drawer-title">{task.title || 'Untitled task'}</h2>
          </div>
          <div className="drawer-header-actions">
            {isDatabaseTask && onEditTask && (
              <button
                type="button"
                className="button button--secondary button--sm"
                onClick={() => onEditTask(task)}
              >
                ✎ Edit
              </button>
            )}
            {isDatabaseTask && onDeleteTask && (
              <button
                type="button"
                className="button button--secondary button--sm text-red"
                onClick={() => onDeleteTask(task.id)}
                title="Delete task"
              >
                🗑
              </button>
            )}
            <button
              ref={closeButtonRef}
              className="task-drawer__close"
              type="button"
              onClick={onClose}
              aria-label="Close task details"
            >
              ×
            </button>
          </div>
        </header>

        <div className="task-drawer__content">
          {task.description && (
            <div className="task-drawer__desc-box">
              <h4>Description & Acceptance Criteria</h4>
              <p>{task.description}</p>
            </div>
          )}

          <dl className="task-detail-list">
            <div className="task-detail-row">
              <dt>Status</dt>
              <dd>
                {isDatabaseTask ? (
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
                    <option value="done">Done</option>
                  </select>
                ) : (
                  <StatusBadge status={task.status} />
                )}
              </dd>
            </div>

            <div className="task-detail-row">
              <dt>Priority</dt>
              <dd>
                {task.crm_priority ? (
                  <span className={`priority-pill priority-pill--${task.crm_priority}`}>
                    {task.crm_priority}
                  </span>
                ) : task.urgency ? (
                  <UrgencyBadge urgency={task.urgency} />
                ) : (
                  'Medium'
                )}
              </dd>
            </div>

            {task.project_name && (
              <div className="task-detail-row">
                <dt>Project</dt>
                <dd><strong>◫ {task.project_name}</strong></dd>
              </div>
            )}

            {task.department_name && (
              <div className="task-detail-row">
                <dt>Department</dt>
                <dd>🏢 {task.department_name}</dd>
              </div>
            )}

            <div className="task-detail-row">
              <dt>Assignees</dt>
              <dd>
                {task.assignees && task.assignees.length > 0 ? (
                  <div className="drawer-assignees-list">
                    {task.assignees.map((a, i) => (
                      <span key={a.id || i} className="drawer-assignee-tag">
                        <span className="mini-avatar">{a.avatar || a.full_name?.substring(0, 2).toUpperCase()}</span>
                        <span>{a.full_name || a.email}</span>
                      </span>
                    ))}
                  </div>
                ) : task.employee?.trim() ? (
                  <span className="drawer-assignee-tag">
                    <span className="mini-avatar">{task.employee.trim().split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</span>
                    <span>{task.employee.trim()}</span>
                  </span>
                ) : (
                  'Unassigned'
                )}
              </dd>
            </div>

            <div className="task-detail-row">
              <dt>Due date</dt>
              <dd className={overdue ? 'task-detail-row__overdue' : ''}>
                {deadlineField ? formatDeadline(deadlineField) : 'No due date'}
              </dd>
            </div>

            {deadlineField && (
              <div className="task-detail-row">
                <dt>Timeline State</dt>
                <dd className={overdue ? 'task-detail-row__overdue' : ''}>
                  {overdue ? `${Math.abs(daysUntilDeadline || 1)} day(s) overdue ⚠️` : daysUntilDeadline === 0 ? 'Due today' : 'On schedule'}
                </dd>
              </div>
            )}

            {task.estimated_hours > 0 && (
              <div className="task-detail-row">
                <dt>Work Effort</dt>
                <dd>{task.actual_hours || 0} / {task.estimated_hours} hrs logged ({task.completion_percentage || 0}%)</dd>
              </div>
            )}

            {task.tags && (
              <div className="task-detail-row">
                <dt>Tags</dt>
                <dd>
                  <div className="drawer-tags-wrap">
                    {task.tags.split(',').map((t, idx) => (
                      <span key={idx} className="tag-chip">#{t.trim()}</span>
                    ))}
                  </div>
                </dd>
              </div>
            )}
          </dl>

          {/* Database Task Comments Thread */}
          {isDatabaseTask && (
            <div className="task-comments-section">
              <h4>Activity & Discussion ({comments.length})</h4>
              <div className="comments-stream">
                {loadingComments ? (
                  <p className="loading-note">Loading conversation…</p>
                ) : comments.length === 0 ? (
                  <p className="no-comments-note">No comments yet. Start the conversation below.</p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="comment-bubble">
                      <div className="comment-header">
                        <span className="mini-avatar">{c.avatar || c.full_name?.substring(0, 2).toUpperCase() || 'U'}</span>
                        <strong>{c.full_name || 'Team Member'}</strong>
                        <small>{new Date(c.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>
                      </div>
                      <p className="comment-text">{c.comment}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleAddComment} className="comment-input-form">
                <textarea
                  className="form-textarea"
                  rows="2"
                  placeholder="Write a comment or update for the team..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  disabled={submittingComment}
                />
                <button
                  type="submit"
                  className="button button--secondary button--sm"
                  disabled={submittingComment || !newComment.trim()}
                >
                  {submittingComment ? 'Posting…' : 'Post Comment'}
                </button>
              </form>
            </div>
          )}

          {/* Legacy External Task Information */}
          {!isDatabaseTask && (
            <>
              <p className="task-drawer__readonly">
                {task.source || 'This'} tasks are read-only mock feeds in TaskFlow.
              </p>
              {originalTaskUrl ? (
                <a className="task-drawer__original-link" href={originalTaskUrl} target="_blank" rel="noopener noreferrer">
                  Open original task <span aria-hidden="true">↗</span>
                </a>
              ) : (
                <p className="task-drawer__readonly" role="status">Original task link unavailable.</p>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
