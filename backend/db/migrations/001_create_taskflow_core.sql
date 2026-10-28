CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  slug TEXT NOT NULL UNIQUE CHECK (
    slug = lower(slug)
    AND length(btrim(slug)) > 0
    AND slug NOT LIKE '% %'
    AND slug NOT LIKE '-%'
    AND slug NOT LIKE '%-'
    AND slug NOT LIKE '%--%'
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (length(btrim(full_name)) > 0),
  email TEXT NOT NULL CHECK (email = lower(email) AND length(btrim(email)) > 0),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, email)
);

CREATE INDEX users_organization_role_idx ON users (organization_id, role);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, created_by)
    REFERENCES users (organization_id, id) ON DELETE RESTRICT
);

CREATE INDEX tasks_organization_status_idx ON tasks (organization_id, status);
CREATE INDEX tasks_organization_due_date_idx ON tasks (organization_id, due_date);
CREATE INDEX tasks_organization_created_at_idx ON tasks (organization_id, created_at);

CREATE TABLE task_assignments (
  organization_id UUID NOT NULL,
  task_id UUID NOT NULL,
  user_id UUID NOT NULL,
  assigned_by UUID,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, task_id, user_id),
  FOREIGN KEY (organization_id, task_id)
    REFERENCES tasks (organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, user_id)
    REFERENCES users (organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, assigned_by)
    REFERENCES users (organization_id, id) ON DELETE RESTRICT
);

CREATE INDEX task_assignments_user_idx ON task_assignments (organization_id, user_id);
