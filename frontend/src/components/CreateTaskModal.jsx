import React, { useState } from 'react';

export default function CreateTaskModal({
  isOpen,
  onClose,
  onSubmit,
  projects = [],
  departments = [],
  employees = [],
  initialData = null,
}) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [crmStatus, setCrmStatus] = useState(initialData?.crm_status || 'todo');
  const [crmPriority, setCrmPriority] = useState(initialData?.crm_priority || 'medium');
  const [projectId, setProjectId] = useState(initialData?.project_id || '');
  const [departmentId, setDepartmentId] = useState(initialData?.department_id || '');
  const [dueDate, setDueDate] = useState(initialData?.due_date ? String(initialData.due_date).split('T')[0] : '');
  const [startDate, setStartDate] = useState(initialData?.start_date ? String(initialData.start_date).split('T')[0] : '');
  const [estimatedHours, setEstimatedHours] = useState(initialData?.estimated_hours || '');
  const [tags, setTags] = useState(initialData?.tags || '');
  const [selectedAssignees, setSelectedAssignees] = useState(
    initialData?.assignees ? initialData.assignees.map((a) => a.id) : []
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        crm_status: crmStatus,
        crm_priority: crmPriority,
        project_id: projectId || null,
        department_id: departmentId || null,
        due_date: dueDate || null,
        start_date: startDate || null,
        estimated_hours: Number(estimatedHours) || 0,
        tags: tags.trim(),
        assignee_ids: selectedAssignees,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save task.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAssignee = (empId) => {
    setSelectedAssignees((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-dialog--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{initialData ? 'Edit Task' : 'Create New Task'}</h3>
            <p>Aulten Digital TaskFlow CRM</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close dialog">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="form-error-banner">{error}</div>}

            <div className="form-group">
              <label htmlFor="task-title">Task Title *</label>
              <input
                id="task-title"
                type="text"
                className="form-input"
                placeholder="e.g. Optimize PostgreSQL database queries"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="task-status">Status</label>
                <select
                  id="task-status"
                  className="form-select"
                  value={crmStatus}
                  onChange={(e) => setCrmStatus(e.target.value)}
                >
                  <option value="backlog">Backlog</option>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Done</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="task-priority">Priority</label>
                <select
                  id="task-priority"
                  className="form-select"
                  value={crmPriority}
                  onChange={(e) => setCrmPriority(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="task-project">Project</label>
                <select
                  id="task-project"
                  className="form-select"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value="">No Project (General)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="task-department">Department</label>
                <select
                  id="task-department"
                  className="form-select"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                >
                  <option value="">General Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="task-start">Start Date</label>
                <input
                  id="task-start"
                  type="date"
                  className="form-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="task-due">Due Date</label>
                <input
                  id="task-due"
                  type="date"
                  className="form-input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="task-est">Estimated Hours</label>
                <input
                  id="task-est"
                  type="number"
                  min="0"
                  step="0.5"
                  className="form-input"
                  placeholder="e.g. 8"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="task-desc">Description</label>
              <textarea
                id="task-desc"
                className="form-textarea"
                rows="3"
                placeholder="Detailed task specifications and acceptance criteria..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Assign Team Members</label>
              <div className="assignees-picker">
                {employees.map((emp) => {
                  const isChecked = selectedAssignees.includes(emp.id);
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      className={`assignee-pill${isChecked ? ' is-selected' : ''}`}
                      onClick={() => toggleAssignee(emp.id)}
                    >
                      <span className="mini-avatar">{emp.avatar || emp.full_name?.substring(0, 2).toUpperCase()}</span>
                      <span>{emp.full_name}</span>
                      {isChecked && <span className="check-mark">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="task-tags">Tags (comma separated)</label>
              <input
                id="task-tags"
                type="text"
                className="form-input"
                placeholder="e.g. database, security, api"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="button button--secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="button button--primary" disabled={submitting}>
              {submitting ? 'Saving…' : initialData ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
