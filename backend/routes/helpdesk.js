const express = require('express');
const router = express.Router();

/**
 * MOCK HELPDESK INTEGRATION
 * Returns sample Helpdesk tickets for the Employee Task Dashboard technical assessment.
 * Data is intentionally generic and does not represent any real organization,
 * customers, or employees.
 */

// Dates relative to 2026-10-28 so deadline/urgency sorting is always meaningful.
const HELPDESK_TASKS = [
  {
    id: 'hd-001',
    title: 'Critical: Employee 04 cannot access the project management portal',
    employee: 'Employee 04',
    status: 'in-progress',
    deadline: '2026-10-27', // overdue by 1 day
    urgency: 'high',
    source: 'Helpdesk',
    sourceUrl: 'https://example-helpdesk.com/tickets/hd-001',
  },
  {
    id: 'hd-002',
    title: 'Set up laptop and development environment for new hire',
    employee: 'Employee 05',
    status: 'pending',
    deadline: '2026-10-28', // due today
    urgency: 'high',
    source: 'Helpdesk',
    sourceUrl: 'https://example-helpdesk.com/tickets/hd-002',
  },
  {
    id: 'hd-003',
    title: 'Investigate slow response times reported in the internal dashboard',
    employee: 'Employee 01',
    status: 'in-progress',
    deadline: '2026-10-31',
    urgency: 'medium',
    source: 'Helpdesk',
    sourceUrl: 'https://example-helpdesk.com/tickets/hd-003',
  },
  {
    id: 'hd-004',
    title: 'Reset 2FA for Employee 02 after device change',
    employee: 'Employee 02',
    status: 'pending',
    deadline: '2026-10-29', // due tomorrow
    urgency: 'high',
    source: 'Helpdesk',
    sourceUrl: 'https://example-helpdesk.com/tickets/hd-004',
  },
  {
    id: 'hd-005',
    title: 'Export last quarter data report for finance team review',
    employee: 'Employee 03',
    status: 'completed',
    deadline: '2026-10-26',
    urgency: 'medium',
    source: 'Helpdesk',
    sourceUrl: 'https://example-helpdesk.com/tickets/hd-005',
  },
  {
    id: 'hd-006',
    title: 'Configure VPN access for remote employee request',
    employee: 'Employee 04',
    status: 'pending',
    deadline: '2026-11-04',
    urgency: 'low',
    source: 'Helpdesk',
    sourceUrl: 'https://example-helpdesk.com/tickets/hd-006',
  },
  {
    id: 'hd-007',
    title: 'Critical: Team shared drive permissions broken after migration',
    employee: 'Employee 05',
    status: 'pending',
    deadline: '2026-10-24', // 4 days overdue
    urgency: 'high',
    source: 'Helpdesk',
    sourceUrl: 'https://example-helpdesk.com/tickets/hd-007',
  },
  {
    id: 'hd-008',
    title: 'Update software licences before end-of-year renewal deadline',
    employee: 'Employee 01',
    status: 'pending',
    deadline: '2026-11-15',
    urgency: 'low',
    source: 'Helpdesk',
    sourceUrl: 'https://example-helpdesk.com/tickets/hd-008',
  },
];

// GET /api/helpdesk/tasks
router.get('/tasks', (req, res) => {
  setTimeout(() => {
    res.json({
      source: 'Helpdesk (Mock)',
      count: HELPDESK_TASKS.length,
      tasks: HELPDESK_TASKS,
    });
  }, 200);
});

module.exports = router;
