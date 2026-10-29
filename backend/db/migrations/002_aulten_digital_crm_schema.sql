-- ============================================================================
-- Aulten Digital TaskFlow CRM Schema (Phase 2 Migration)
-- Extends Core Schema (001) with Departments, Authentication, Clients CRM,
-- Projects, Task Enhancements, Comments, Notifications, and Audit Logging.
-- ============================================================================

-- 1. Extend Users table for Authentication and Employee Profiles
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS crm_role TEXT NOT NULL DEFAULT 'employee';
ALTER TABLE users ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS employment_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS joining_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;

-- 2. Departments table
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  code TEXT NOT NULL,
  description TEXT,
  head_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS departments_org_idx ON departments (organization_id);

-- Link users to department and reporting manager
ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments (id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS users_org_crm_role_idx ON users (organization_id, crm_role);
CREATE INDEX IF NOT EXISTS users_org_dept_idx ON users (organization_id, department_id);
CREATE INDEX IF NOT EXISTS users_employee_id_idx ON users (organization_id, employee_id);

-- 3. Clients (CRM) table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  company_name TEXT NOT NULL CHECK (length(btrim(company_name)) > 0),
  contact_person TEXT NOT NULL CHECK (length(btrim(contact_person)) > 0),
  email TEXT NOT NULL CHECK (email = lower(email) AND length(btrim(email)) > 0),
  phone TEXT,
  lead_source TEXT DEFAULT 'Direct',
  lead_owner_id UUID REFERENCES users (id) ON DELETE SET NULL,
  pipeline_stage TEXT NOT NULL DEFAULT 'New',
  follow_up_date DATE,
  next_action TEXT,
  deal_value NUMERIC(12, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clients_org_stage_idx ON clients (organization_id, pipeline_stage);
CREATE INDEX IF NOT EXISTS clients_org_owner_idx ON clients (organization_id, lead_owner_id);

-- 4. Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  description TEXT,
  client_id UUID REFERENCES clients (id) ON DELETE SET NULL,
  owner_id UUID REFERENCES users (id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  health TEXT NOT NULL DEFAULT 'good',
  start_date DATE,
  end_date DATE,
  budget NUMERIC(12, 2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_org_status_idx ON projects (organization_id, status);
CREATE INDEX IF NOT EXISTS projects_org_client_idx ON projects (organization_id, client_id);

-- Project Members
CREATE TABLE IF NOT EXISTS project_members (
  project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

-- 5. Extend Tasks table for Enterprise CRM
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_code TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects (id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments (id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS crm_status TEXT DEFAULT 'todo';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS crm_priority TEXT DEFAULT 'medium';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Development';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(6, 2) DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_hours NUMERIC(6, 2) DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completion_percentage INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT '';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'TaskFlow';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_link TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS internal_notes TEXT;

CREATE INDEX IF NOT EXISTS tasks_org_crm_status_idx ON tasks (organization_id, crm_status);
CREATE INDEX IF NOT EXISTS tasks_org_crm_priority_idx ON tasks (organization_id, crm_priority);
CREATE INDEX IF NOT EXISTS tasks_org_project_idx ON tasks (organization_id, project_id);
CREATE INDEX IF NOT EXISTS tasks_org_code_idx ON tasks (organization_id, task_code);

-- 6. Task Comments table
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  comment TEXT NOT NULL CHECK (length(btrim(comment)) > 0),
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_comments_task_idx ON task_comments (task_id, created_at);
CREATE INDEX IF NOT EXISTS task_comments_internal_idx ON task_comments (task_id, is_internal);

-- 7. Task Attachments Metadata table
CREATE TABLE IF NOT EXISTS task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_attachments_task_idx ON task_attachments (task_id);

-- 8. Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  entity_type TEXT,
  entity_id TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications (organization_id, user_id, is_read);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications (created_at);

-- 9. Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_org_created_idx ON audit_logs (organization_id, created_at);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs (entity_type, entity_id);

-- 10. User Sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_sessions_token_idx ON user_sessions (session_token);
CREATE INDEX IF NOT EXISTS user_sessions_expires_idx ON user_sessions (expires_at);

-- 11. User password change flag
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- 12. Task Progress Updates table
CREATE TABLE IF NOT EXISTS task_progress_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  previous_progress INTEGER NOT NULL DEFAULT 0,
  current_progress INTEGER NOT NULL CHECK (current_progress >= 0 AND current_progress <= 100),
  status TEXT,
  notes TEXT,
  blockers TEXT,
  pending_work TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_progress_updates_task_idx ON task_progress_updates (task_id, created_at);
CREATE INDEX IF NOT EXISTS task_progress_updates_user_idx ON task_progress_updates (user_id);

-- 13. Attendance Records table
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_out_at TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'present',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attendance_records_org_user_date_idx ON attendance_records (organization_id, user_id, date);
CREATE INDEX IF NOT EXISTS attendance_records_org_date_idx ON attendance_records (organization_id, date);
CREATE INDEX IF NOT EXISTS attendance_records_user_active_idx ON attendance_records (user_id, check_out_at);

-- 14. Attendance Corrections table
CREATE TABLE IF NOT EXISTS attendance_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES attendance_records (id) ON DELETE CASCADE,
  editor_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  previous_check_in TIMESTAMPTZ,
  previous_check_out TIMESTAMPTZ,
  new_check_in TIMESTAMPTZ,
  new_check_out TIMESTAMPTZ,
  reason TEXT NOT NULL CHECK (length(btrim(reason)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attendance_corrections_att_idx ON attendance_corrections (attendance_id);

-- 15. Notification Enhancements for Automation
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dedup_key TEXT;
CREATE INDEX IF NOT EXISTS notifications_org_dedup_idx ON notifications (organization_id, dedup_key);

-- 16. Leave Requests table
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL DEFAULT 'casual',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count NUMERIC(4, 1) NOT NULL DEFAULT 1,
  reason TEXT NOT NULL CHECK (length(btrim(reason)) > 0),
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES users (id) ON DELETE SET NULL,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leave_requests_org_user_idx ON leave_requests (organization_id, user_id);
CREATE INDEX IF NOT EXISTS leave_requests_org_status_idx ON leave_requests (organization_id, status);

-- 17. Recurring Task Templates table
CREATE TABLE IF NOT EXISTS recurring_task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  description TEXT,
  department_id UUID REFERENCES departments (id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects (id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  recurrence_pattern TEXT NOT NULL DEFAULT 'weekly',
  day_of_week INTEGER DEFAULT 1,
  day_of_month INTEGER DEFAULT 1,
  estimated_hours NUMERIC(6, 2) DEFAULT 0,
  assignee_id UUID REFERENCES users (id) ON DELETE SET NULL,
  creator_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_generated_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recurring_templates_org_active_idx ON recurring_task_templates (organization_id, is_active);

-- 18. Automation Rules Configuration table
CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  rule_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  schedule_cron TEXT DEFAULT '*/15 * * * *',
  config_json TEXT DEFAULT '{}',
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT DEFAULT 'pending',
  last_run_duration_ms INTEGER DEFAULT 0,
  last_run_details TEXT,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, rule_key)
);

CREATE INDEX IF NOT EXISTS automation_rules_org_key_idx ON automation_rules (organization_id, rule_key);

-- 19. Automation Execution & Audit Logs table
CREATE TABLE IF NOT EXISTS automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  rule_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  actions_taken INTEGER DEFAULT 0,
  details TEXT,
  duration_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automation_logs_org_created_idx ON automation_logs (organization_id, created_at);

