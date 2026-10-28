const express = require('express');
const router = express.Router();

/**
 * MOCK CRM INTEGRATION
 * Returns sample CRM tasks for the Employee Task Dashboard technical assessment.
 * Data is intentionally generic and does not represent any real organization,
 * customers, or employees.
 */

// Dates relative to 2026-10-28 so deadline/urgency sorting is always meaningful.
const CRM_TASKS = [
  {
    id: 'crm-001',
    title: 'Follow up with Client A on Q4 software proposal',
    employee: 'Employee 01',
    status: 'in-progress',
    deadline: '2026-10-26', // 2 days overdue
    urgency: 'high',
    source: 'CRM',
    sourceUrl: 'https://example-crm.com/tasks/crm-001',
  },
  {
    id: 'crm-002',
    title: 'Send updated pricing sheet to Client B',
    employee: 'Employee 02',
    status: 'pending',
    deadline: '2026-10-28', // due today
    urgency: 'high',
    source: 'CRM',
    sourceUrl: 'https://example-crm.com/tasks/crm-002',
  },
  {
    id: 'crm-003',
    title: 'Schedule onboarding call for new Client C account',
    employee: 'Employee 03',
    status: 'pending',
    deadline: '2026-10-30', // due in 2 days
    urgency: 'medium',
    source: 'CRM',
    sourceUrl: 'https://example-crm.com/tasks/crm-003',
  },
  {
    id: 'crm-004',
    title: 'Prepare quarterly account review presentation for Client A',
    employee: 'Employee 04',
    status: 'completed',
    deadline: '2026-10-27', // overdue but completed
    urgency: 'low',
    source: 'CRM',
    sourceUrl: 'https://example-crm.com/tasks/crm-004',
  },
  {
    id: 'crm-005',
    title: 'Draft renewal contract terms for Client B',
    employee: 'Employee 01',
    status: 'in-progress',
    deadline: '2026-11-05',
    urgency: 'medium',
    source: 'CRM',
    sourceUrl: 'https://example-crm.com/tasks/crm-005',
  },
  {
    id: 'crm-006',
    title: 'Resolve billing discrepancy raised by Client C',
    employee: 'Employee 02',
    status: 'pending',
    deadline: '2026-10-25', // 3 days overdue
    urgency: 'high',
    source: 'CRM',
    sourceUrl: 'https://example-crm.com/tasks/crm-006',
  },
  {
    id: 'crm-007',
    title: 'Log meeting notes from Client A discovery session',
    employee: 'Employee 03',
    status: 'pending',
    deadline: '2026-11-10',
    urgency: 'low',
    source: 'CRM',
    sourceUrl: 'https://example-crm.com/tasks/crm-007',
  },
  {
    id: 'crm-008',
    title: 'Update CRM pipeline stages for Q4 accounts',
    employee: 'Employee 05',
    status: 'pending',
    deadline: '2026-10-29', // due tomorrow
    urgency: 'medium',
    source: 'CRM',
    sourceUrl: 'https://example-crm.com/tasks/crm-008',
  },
];

// GET /api/crm/tasks
router.get('/tasks', (req, res) => {
  setTimeout(() => {
    res.json({
      source: 'CRM (Mock)',
      count: CRM_TASKS.length,
      tasks: CRM_TASKS,
    });
  }, 200);
});

module.exports = router;
