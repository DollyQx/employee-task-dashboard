const DAY_MS = 24 * 60 * 60 * 1000;

export function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

export function dateOrdinal(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

export function eventDateKey(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return parseDateKey(value) ? value : null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : dateKey(date);
}

export function getEventDate(task, fieldNames) {
  for (const field of fieldNames) {
    const key = eventDateKey(task[field]);
    if (key) return key;
  }
  return null;
}

export function getDateRange(preset, customStart = '', customEnd = '', now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === 'all') return { start: null, end: null, valid: true, label: 'All time' };
  if (preset === 'custom') {
    const start = parseDateKey(customStart);
    const end = parseDateKey(customEnd);
    if (!start || !end) return { start: null, end: null, valid: false, label: 'Choose both dates' };
    if (end < start) return { start: null, end: null, valid: false, label: 'Invalid date range' };
    return { start: dateKey(start), end: dateKey(end), valid: true, label: `${customStart} to ${customEnd}` };
  }

  const days = Number.parseInt(preset, 10);
  if (![7, 30, 90].includes(days)) return { start: null, end: null, valid: false, label: 'Invalid date range' };
  const start = new Date(today.getTime());
  start.setDate(start.getDate() - days + 1);
  return { start: dateKey(start), end: dateKey(today), valid: true, label: `Last ${days} days` };
}

export function buildTrend(events, dateRange) {
  if (!dateRange.valid || events.length === 0) return [];

  const earliest = events.reduce((current, event) => event.date < current ? event.date : current, events[0].date);
  const latest = events.reduce((current, event) => event.date > current ? event.date : current, events[0].date);
  const start = dateRange.start ? parseDateKey(dateRange.start) : parseDateKey(earliest);
  const end = dateRange.end ? parseDateKey(dateRange.end) : parseDateKey(latest);
  if (!start || !end || end < start) return [];

  const dayCount = dateOrdinal(dateKey(end)) - dateOrdinal(dateKey(start)) + 1;
  const step = dayCount <= 31 ? 1 : dayCount <= 180 ? 7 : dayCount <= 540 ? 30 : Math.ceil(dayCount / 60);
  const buckets = [];
  for (let offset = 0; offset < dayCount; offset += step) {
    const bucketStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
    const bucketEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() + Math.min(offset + step - 1, dayCount - 1));
    buckets.push({
      start: dateKey(bucketStart),
      end: dateKey(bucketEnd),
      label: step === 1
        ? bucketStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : `${bucketStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–${bucketEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      count: 0,
    });
  }

  events.forEach((event) => {
    if (event.date < dateKey(start) || event.date > dateKey(end)) return;
    const index = Math.floor((dateOrdinal(event.date) - dateOrdinal(dateKey(start))) / step);
    if (buckets[index]) buckets[index].count += 1;
  });
  return buckets;
}

export function getPreviousDateRange(dateRange) {
  if (!dateRange.valid || !dateRange.start || !dateRange.end) return null;
  const duration = dateOrdinal(dateRange.end) - dateOrdinal(dateRange.start) + 1;
  const start = parseDateKey(dateRange.start);
  const previousEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1);
  const previousStart = new Date(previousEnd.getFullYear(), previousEnd.getMonth(), previousEnd.getDate() - duration + 1);
  return { start: dateKey(previousStart), end: dateKey(previousEnd) };
}
