const express = require('express');
const router = express.Router();

/**
 * MOCK HELPDESK INTEGRATION
 * ⚠️  This is NOT a real Helpdesk system. Data is hardcoded for demonstration purposes.
 *
 * In a real integration this route would:
 *   - Authenticate with the Helpdesk API (e.g. Zendesk, Freshdesk)
 *   - Fetch open tickets assigned to employees
 *   - Normalise the response into the common task schema
 */

// Dates relative to 2026-10-28 (today)
const HELPDESK_TASKS = [
  {
    id: 'hd-001',
    title: 'Critical: Production server down for Client A',
    employee: 'David Kim',
    status: 'in-progress',
    deadline: '2026-10-27', // overdue by 1 day
    urgency: 'high',
    source: 'Helpdesk',
    sourceUrl: 'https://example-helpdesk.com/tickets/hd-001',
  },
  {
    id: 'hd-002',
    title: 'Resolve login failure for VIP user @ceo_acme',
    employee: 'Sarah Johnson',
    status: 'pending',
    deadline: '2026-10-28', // due today
    urgency: 'high',
    source: 'Helpdesk',
    sourceUrl: 'https://example-helpdesk.com/tickets/hd-002',
  },
  {
    id: 'hd-003',
    title: 'Investigate slow response times on reporting module',
    employee: 'David Kim',
    status: 'in-progress',
    deadline: '2026-10-31',
    urgency: 'medium',
    source: 'Helpdesk',
    sourceUrl: 'https://example-helpdesk.com/tickets/hd-003',
  },
  {
    id: 'hd-004',
    title: 'Update SSL certificate before expiry',
    employee: 'Priya Patel',
    status: 'pending',
    deadline: '2026-10-29', // due tomorrow
    urgency: 'high',
    source: 'Helpdesk',
    sourceUrl: 'https://example-helpdesk.com/tickets/hd-004',
  },
  {
    id: 'hd-005',
    title: 'Reset MFA tokens for finance department',
    employee: 'Marcus Chen',
    status: 'completed',
    deadline: '2026-10-26',
    urgency: 'medium',
    source: 'Helpdesk',
    sourceUrl: 'https://example-helpdesk.com/tickets/hd-005',
  },
  {
    id: 'hd-006',
    title: 'Configure email routing for new department',
    employee: 'James Miller',
    status: 'pending',
    deadline: '2026-11-04',
    urgency: 'low',
    source: 'Helpdesk',
    sourceUrl: 'https://example-helpdesk.com/tickets/hd-006',
  },
  {
    id: 'hd-007',
    title: 'Escalate: Data export bug blocking month-end close',
    employee: 'David Kim',
    status: 'pending',
    deadline: '2026-10-24', // 4 days overdue
    urgency: 'high',
    source: 'Helpdesk',
    sourceUrl: 'https://example-helpdesk.com/tickets/hd-007',
  },
  {
    id: 'hd-008',
    title: 'Asset inventory audit for remote employees',
    employee: 'Sarah Johnson',
    status: 'pending',
    deadline: '2026-11-15',
    urgency: 'low',
    source: 'Helpdesk',
    sourceUrl: 'https://example-helpdesk.com/tickets/hd-008',
  },
];

// GET /api/helpdesk/tasks
router.get('/tasks', (req, res) => {
  // Simulate a small network delay
  setTimeout(() => {
    res.json({
      source: 'Helpdesk (Mock)',
      count: HELPDESK_TASKS.length,
      tasks: HELPDESK_TASKS,
    });
  }, 400);
});

module.exports = router;
