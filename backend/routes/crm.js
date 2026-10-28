const express = require('express');
const router = express.Router();

/**
 * MOCK CRM / INDUSTRIAL ERP INTEGRATION
 * Data is structured for Bharat Precision Dynamics / Aulten Precision Manufacturing.
 * Returns active OEM and plant production work orders.
 */

// Dates relative to 2026-10-28 (today) so sorting is always meaningful
const CRM_TASKS = [
  {
    id: 'crm-001',
    title: 'Tata Motors: Follow up on 500 EV Powertrain Casing delivery schedule',
    employee: 'Rajesh Kumar',
    status: 'in-progress',
    deadline: '2026-10-26', // 2 days overdue
    urgency: 'high',
    source: 'CRM',
    sourceUrl: 'https://example-crm.com/tasks/crm-001',
  },
  {
    id: 'crm-002',
    title: 'Mahindra Heavy Industries: Dispatch tractor driveline spec sheet',
    employee: 'Vikram Malhotra',
    status: 'pending',
    deadline: '2026-10-28', // due today
    urgency: 'high',
    source: 'CRM',
    sourceUrl: 'https://example-crm.com/tasks/crm-002',
  },
  {
    id: 'crm-003',
    title: 'BHEL Trichy: Schedule technical review on steam turbine blade coatings',
    employee: 'Priya Verma',
    status: 'pending',
    deadline: '2026-10-30', // due in 2 days
    urgency: 'medium',
    source: 'CRM',
    sourceUrl: 'https://example-crm.com/tasks/crm-003',
  },
  {
    id: 'crm-004',
    title: 'L&T Heavy Engineering: Finalize nuclear nozzle ultrasonic test protocols',
    employee: 'Sneha Gupta',
    status: 'completed',
    deadline: '2026-10-27', // overdue but completed
    urgency: 'low',
    source: 'CRM',
    sourceUrl: 'https://example-crm.com/tasks/crm-004',
  },
  {
    id: 'crm-005',
    title: 'Godrej Aerospace: Prepare CMM dimensional report for injector heads',
    employee: 'Rahul Kumar',
    status: 'in-progress',
    deadline: '2026-11-05',
    urgency: 'medium',
    source: 'CRM',
    sourceUrl: 'https://example-crm.com/tasks/crm-005',
  },
  {
    id: 'crm-006',
    title: 'Maruti Suzuki: Resolve surface micro-porosity inquiry on camshaft batch',
    employee: 'Vikram Malhotra',
    status: 'pending',
    deadline: '2026-10-25', // 3 days overdue
    urgency: 'high',
    source: 'CRM',
    sourceUrl: 'https://example-crm.com/tasks/crm-006',
  },
  {
    id: 'crm-007',
    title: 'Ashok Leyland Defense: Onboard contract for forged armored wheel hubs',
    employee: 'Rajesh Kumar',
    status: 'pending',
    deadline: '2026-11-10',
    urgency: 'low',
    source: 'CRM',
    sourceUrl: 'https://example-crm.com/tasks/crm-007',
  },
  {
    id: 'crm-008',
    title: 'Reconcile Q4 raw steel coil supplier delivery scorecards',
    employee: 'Ananya Iyer',
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
