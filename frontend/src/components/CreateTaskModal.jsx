import React, { useState } from 'react';
import { draftTaskWithAiApi } from '../api/crm';

export default function CreateTaskModal({
  isOpen,
  onClose,
  onSubmit,
  projects = [],
  departments = [],
  employees = [],
  initialData = null,
  currentUser = null,
}) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [crmStatus, setCrmStatus] = useState(initialData?.crm_status || initialData?.status || 'todo');
  const [crmPriority, setCrmPriority] = useState(initialData?.crm_priority || initialData?.urgency || 'medium');
  const [projectId, setProjectId] = useState(initialData?.project_id || '');
  const [departmentId, setDepartmentId] = useState(initialData?.department_id || '');
  const [dueDate, setDueDate] = useState(initialData?.due_date ? String(initialData.due_date).split('T')[0] : (initialData?.deadline ? String(initialData.deadline).split('T')[0] : ''));
  const [startDate, setStartDate] = useState(initialData?.start_date ? String(initialData.start_date).split('T')[0] : '');
  const [estimatedHours, setEstimatedHours] = useState(initialData?.estimated_hours || '');
  const [tags, setTags] = useState(initialData?.tags || '');
  const [source, setSource] = useState(initialData?.source || 'Internal');
  const [sourceLink, setSourceLink] = useState(initialData?.source_url || initialData?.sourceUrl || initialData?.source_link || '');
  const [internalNotes, setInternalNotes] = useState(initialData?.internal_notes || '');
  const [selectedAssignees, setSelectedAssignees] = useState(
    initialData?.assignees ? initialData.assignees.map((a) => a.id) : []
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [aiDrafting, setAiDrafting] = useState(false);

  if (!isOpen) return null;

  const canSeeInternalNotes = currentUser?.crm_role !== 'employee';

  const handleAiDraft = async () => {
    if (!title.trim()) {
      setError('Please enter a Task Title first so the AI assistant can understand your objective.');
      return;
    }
    setAiDrafting(true);
    setError('');
    try {
      const selectedDept = departments.find((d) => d.id === departmentId)?.name || 'Engineering';
      const res = await draftTaskWithAiApi(title.trim(), 'Development', selectedDept);
      if (res?.result) {
        const d = res.result;
        const formatted = `${d.description || ''}\n\n### Acceptance Criteria\n${(d.acceptanceCriteria || []).map((c) => `- [ ] ${c}`).join('\n')}`;
        setDescription(formatted.trim());
        if (d.estimatedHours && !estimatedHours) {
          setEstimatedHours(String(d.estimatedHours));
        }
        if (d.suggestedTags && !tags) {
          setTags(d.suggestedTags.join(', '));
        }
      }
    } catch (err) {
      setError('AI Draft failed: ' + err.message);
    } finally {
      setAiDrafting(false);
    }
  };

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
        source,
        source_url: sourceLink.trim() || null,
        source_link: sourceLink.trim() || null,
        internal_notes: canSeeInternalNotes ? internalNotes.trim() : null,
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
            <h3>{initialData ? 'Edit Task' : 'Create / Assign Task'}</h3>
            <p>Startiz Labs • Role-Based Task Management System</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
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
                placeholder="e.g. Implement OAuth 2.0 PKCE authentication flow"
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
                  className="form-input"
                  value={crmStatus}
                  onChange={(e) => setCrmStatus(e.target.value)}
                >
                  <option value="backlog">Backlog</option>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Completed</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="task-priority">Priority Level</label>
                <select
                  id="task-priority"
                  className="form-input"
                  value={crmPriority}
                  onChange={(e) => setCrmPriority(e.target.value)}
                >
                  <option value="urgent">🔴 Urgent</option>
                  <option value="high">🟠 High Priority</option>
                  <option value="medium">🟡 Medium Priority</option>
                  <option value="low">🟢 Low Priority</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="task-source">Task Source</label>
                <select
                  id="task-source"
                  className="form-input"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                >
                  <option value="Internal">Internal (TaskFlow)</option>
                  <option value="CRM">CRM</option>
                  <option value="Helpdesk">Helpdesk</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="task-source-link">Related Source Link (Optional)</label>
                <input
                  id="task-source-link"
                  type="url"
                  className="form-input"
                  placeholder="https://example-crm.com/tasks/crm-101"
                  value={sourceLink}
                  onChange={(e) => setSourceLink(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="task-dept">Department</label>
                <select
                  id="task-dept"
                  className="form-input"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                >
                  <option value="">Select Department...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="task-project">Project</label>
                <select
                  id="task-project"
                  className="form-input"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value="">Select Project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
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
                <label htmlFor="task-due">Deadline (Due Date)</label>
                <input
                  id="task-due"
                  type="date"
                  className="form-input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="task-hours">Estimated Effort (Hours)</label>
                <input
                  id="task-hours"
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
              <label htmlFor="task-tags">Tags (comma separated)</label>
              <input
                id="task-tags"
                type="text"
                className="form-input"
                placeholder="e.g. Backend, API, Security, Auth"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label htmlFor="task-desc" style={{ marginBottom: 0 }}>Description &amp; Acceptance Criteria</label>
                <button
                  type="button"
                  className="button button--secondary button--xs"
                  onClick={handleAiDraft}
                  disabled={aiDrafting}
                  style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  {aiDrafting ? 'Drafting...' : '✨ Draft with AI (Free)'}
                </button>
              </div>
              <textarea
                id="task-desc"
                className="form-input form-textarea"
                rows="4"
                placeholder="Enter detailed description, acceptance criteria, or click 'Draft with AI' to auto-generate..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {canSeeInternalNotes && (
              <div className="form-group">
                <label htmlFor="task-internal-notes" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🔒 Internal Notes</span>
                  <small style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
                    (Staff only • Hidden from team members / employees)
                  </small>
                </label>
                <textarea
                  id="task-internal-notes"
                  className="form-input form-textarea"
                  rows="2"
                  placeholder="Private coordination notes, customer SLA constraints, or reviewer observations..."
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                />
              </div>
            )}

            <div className="form-group">
              <label>Assign Team Members</label>
              <div className="assignees-picker">
                {employees.map((emp) => {
                  const isSelected = selectedAssignees.includes(emp.id);
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      className={`assignee-pill${isSelected ? ' is-selected' : ''}`}
                      onClick={() => toggleAssignee(emp.id)}
                    >
                      <span className="mini-avatar">{emp.avatar || emp.full_name?.substring(0, 2).toUpperCase()}</span>
                      <span>{emp.full_name}</span>
                      <small style={{ opacity: 0.7 }}>({emp.crm_role})</small>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="button button--secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="button button--primary" disabled={submitting}>
              {submitting ? 'Saving...' : (initialData ? 'Save Changes' : 'Create & Assign Task')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
