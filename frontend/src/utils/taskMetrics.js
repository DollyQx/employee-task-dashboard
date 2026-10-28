export const UNASSIGNED_EMPLOYEE = '__unassigned__';
const DAY_MS = 24 * 60 * 60 * 1000;

function normalizedText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseDeadline(deadline) {
  if (typeof deadline !== 'string' || !deadline) return null;

  const isoDate = deadline.match(/^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/i);
  if (!isoDate) return null;
  const [, yearText, monthText, dayText] = isoDate;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (utcDate.getUTCFullYear() !== year || utcDate.getUTCMonth() !== month - 1 || utcDate.getUTCDate() !== day) return null;

  if (deadline.length === 10) {
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
  }

  const date = new Date(deadline);
  return Number.isNaN(date.getTime()) ? null : date;
}

function localDateOrdinal(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

export function daysFromToday(deadline, now = new Date()) {
  const parsedDeadline = parseDeadline(deadline);
  if (!parsedDeadline) return null;
  return localDateOrdinal(parsedDeadline) - localDateOrdinal(now instanceof Date ? now : new Date(now));
}

export function isTaskOverdue(task, now = new Date()) {
  if (!task || task.status === 'completed') return false;
  const days = daysFromToday(task.deadline, now);
  return days !== null && days < 0;
}

export function completionRate(completed, total) {
  return total ? Math.round((completed / total) * 100) : 0;
}

export function getTaskMetrics(tasks, now = new Date()) {
  const completed = tasks.filter((task) => task.status === 'completed').length;
  const overdue = tasks.filter((task) => isTaskOverdue(task, now)).length;
  return {
    total: tasks.length,
    open: tasks.length - completed,
    completed,
    overdue,
    completionRate: completionRate(completed, tasks.length),
  };
}

export function matchesTaskFilters(task, filters = {}) {
  const {
    employee = 'all',
    status = 'all',
    priority = 'all',
    source = 'all',
    page = 'all',
    overdueOnly = false,
    search = '',
  } = filters;
  const normalizedEmployee = normalizedText(task.employee);
  const matchesEmployee = employee === 'all'
    || (employee === UNASSIGNED_EMPLOYEE ? !normalizedEmployee : normalizedEmployee === employee);
  const normalizedStatus = normalizedText(task.status).toLowerCase() || 'unknown';
  const normalizedPriority = normalizedText(task.urgency).toLowerCase() || 'unknown';
  const normalizedSource = normalizedText(task.source).toLowerCase() || 'unknown';
  const matchesStatus = status === 'all' || normalizedStatus === status;
  const matchesPriority = priority === 'all' || normalizedPriority === priority;
  const matchesSource = source === 'all' || normalizedSource === source;
  const matchesPage = !['crm', 'helpdesk'].includes(page) || normalizedSource === page;
  const matchesOverdue = !overdueOnly || isTaskOverdue(task);
  const query = search.trim().toLowerCase();
  const matchesSearch = !query || [task.title, task.employee, task.id, task.source]
    .some((value) => typeof value === 'string' && value.toLowerCase().includes(query));

  return matchesEmployee && matchesStatus && matchesPriority && matchesSource
    && matchesPage && matchesOverdue && matchesSearch;
}
