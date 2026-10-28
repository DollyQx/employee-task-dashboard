const express = require('express');
const router = express.Router();

/**
 * MOCK CRM INTEGRATION
 * ⚠️  This is NOT a real CRM system. Data is hardcoded for demonstration purposes.
 *
 * In a real integration this route would:
 *   - Authenticate with the CRM API (e.g. Salesforce, HubSpot)
 *   - Fetch tasks assigned to employees
 *   - Normalise the response into the common task schema
 */

// Dates relative to 2026-10-28 (today) so sorting is always meaningful
const CRM_TASKS = [
  {
    id: 'crm-001',
    title: 'Follow up with Acme Corp on Q4 proposal',
    employee: 'Sarah Johnson',
    status: 'in-progress',
    deadline: '2026-10-26', // 2 days overdue
    urgency: 'high',
    source: 'CRM',
    sourceUrl: 'https://example-crm.com/tasks/crm-001',
  },
  {
    id: 'crm-002',
    title: 'Send contract renewal documents to BrightStar Ltd',
    employee: 'James Miller',
    status: 'pending',
    deadline: '2026-10-28', // due today
    urgency: 'high',
    source: 'CRM',
    sourceUrl: 'https://example-crm.com/tasks/crm-002',
  },
  {
    id: 'crm-003',
    title: 'Schedule demo call with TechNova prospects',
    employee: 'Priya Patel',
    status: 'pending',
    deadline: '2026-10-30', // due in 2 days
    urgency: 'medium',
    source: 'CRM',
    sourceUrl: 'https://example-crm.com/tasks/crm-003',
  },
  {
    id: 'crm-004',
    title: 'Update CRM records after GlobalBridge meeting',
    employee: 'Sarah Johnson',
    status: 'completed',
    deadline: '2026-10-27', // overdue but completed
    urgency: 'low',
    source: 'CRM',
    sourceUrl: 'https://example-crm.com/tasks/crm-004',
  },
  {
    id: 'crm-005',
    title: 'Prepare quarterly sales report for team review',
    employee: 'Marcus Chen',
    status: 'in-progress',
    deadline: '2026-11-05',
    urgency: 'medium',
    source: 'CRM',
    sourceUrl: 'https://example-crm.com/tasks/crm-005',
  },
  {
    id: 'crm-006',
    title: 'Resolve billing dispute with Zenith Partners',
    employee: 'James Miller',
    status: 'pending',
    deadline: '2026-10-25', // 3 days overdue
    urgency: 'high',
    source: 'CRM',
    sourceUrl: 'https://example-crm.com/tasks/crm-006',
  },
  {
    id: 'crm-007',
    title: 'Onboard new client Orion Systems',
    employee: 'Priya Patel',
    status: 'pending',
    deadline: '2026-11-10',
    urgency: 'low',
    source: 'CRM',
    sourceUrl: 'https://example-crm.com/tasks/crm-007',
  },
  {
    id: 'crm-008',
    title: 'Send holiday promotion campaign to key accounts',
    employee: 'Marcus Chen',
    status: 'pending',
    deadline: '2026-10-29', // due tomorrow
    urgency: 'medium',
    source: 'CRM',
    sourceUrl: 'https://example-crm.com/tasks/crm-008',
  },
];

// GET /api/crm/tasks
router.get('/tasks', (req, res) => {
  // Simulate a small network delay (realistic for an external API call)
  setTimeout(() => {
    res.json({
      source: 'CRM (Mock)',
      count: CRM_TASKS.length,
      tasks: CRM_TASKS,
    });
  }, 300);
});

module.exports = router;
