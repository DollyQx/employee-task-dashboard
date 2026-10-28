const express = require('express');
const router = express.Router();

/**
 * MOCK HELPDESK / PLANT MAINTENANCE DISPATCH
 * Factory equipment maintenance, calibration requests, and safety tickets.
 */

// Dates relative to 2026-10-28 (today)
const HELPDESK_TASKS = [
  {
    id: 'hd-001',
    title: 'Critical: Hydraulic pressure drop on 1200T Stamping Press #2',
    employee: 'Suresh Nair',
    status: 'in-progress',
    deadline: '2026-10-27', // overdue by 1 day
    urgency: 'high',
    source: 'Helpdesk',
    sourceUrl: 'https://example-helpdesk.com/tickets/hd-001',
  },
  {
    id: 'hd-002',
    title: 'Recalibrate digital optical pyrometer on Induction Furnace Bay 1',
    employee: 'Sneha Gupta',
    status: 'pending',
    deadline: '2026-10-28', // due today
    urgency: 'high',
    source: 'Helpdesk',
    sourceUrl: 'https://example-helpdesk.com/tickets/hd-002',
  },
  {
    id: 'hd-003',
    title: 'Investigate spindle vibration harmonic spike on 5-Axis Mill #4',
    employee: 'Rahul Kumar',
    status: 'in-progress',
    deadline: '2026-10-31',
    urgency: 'medium',
    source: 'Helpdesk',
    sourceUrl: 'https://example-helpdesk.com/tickets/hd-003',
  },
  {
    id: 'hd-004',
    title: 'Replace depleted argon/CO2 shielding gas manifold in Welding Cell 3',
    employee: 'Amit Patel',
    status: 'pending',
    deadline: '2026-10-29', // due tomorrow
    urgency: 'high',
    source: 'Helpdesk',
    sourceUrl: 'https://example-helpdesk.com/tickets/hd-004',
  },
  {
    id: 'hd-005',
    title: 'Annual metrology recalibration for 250kN Zwick Tensile Tester',
    employee: 'Deepak Chauhan',
    status: 'completed',
    deadline: '2026-10-26',
    urgency: 'medium',
    source: 'Helpdesk',
    sourceUrl: 'https://example-helpdesk.com/tickets/hd-005',
  },
  {
    id: 'hd-006',
    title: 'Reset SCADA edge gateway IP routing on Stamping Line 4',
    employee: 'Arjun Singh',
    status: 'pending',
    deadline: '2026-11-04',
    urgency: 'low',
    source: 'Helpdesk',
    sourceUrl: 'https://example-helpdesk.com/tickets/hd-006',
  },
  {
    id: 'hd-007',
    title: 'Emergency: Laser curtain interlock fault on Automated Blanking Cell',
    employee: 'Pooja Mehta',
    status: 'pending',
    deadline: '2026-10-24', // 4 days overdue
    urgency: 'high',
    source: 'Helpdesk',
    sourceUrl: 'https://example-helpdesk.com/tickets/hd-007',
  },
  {
    id: 'hd-008',
    title: 'Quarterly shopfloor PPE and air-fed respirator mask audit',
    employee: 'Pooja Mehta',
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
