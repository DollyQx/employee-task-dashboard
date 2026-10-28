const { getPool, closeDatabasePool } = require('../db/pool');
const { hashPassword } = require('../utils/auth');

async function seedDatabase({ pool = getPool(), demoPassword = process.env.DEMO_PASSWORD || 'TaskFlowDemo@2026!' } = {}) {
  console.log('Seeding Aulten Digital / TaskFlow CRM demo data...');

  const passwordHash = await hashPassword(demoPassword);

  // 1. Ensure Organization
  const orgSlug = 'aulten-digital';
  let orgRes = await pool.query('SELECT id FROM organizations WHERE slug = $1', [orgSlug]);
  let orgId;
  if (orgRes.rows.length === 0) {
    const newOrg = await pool.query(
      `INSERT INTO organizations (name, slug)
       VALUES ('Aulten Digital Private Limited', $1)
       RETURNING id`,
      [orgSlug]
    );
    orgId = newOrg.rows[0].id;
  } else {
    orgId = orgRes.rows[0].id;
    await pool.query('UPDATE organizations SET name = $1 WHERE id = $2', ['Aulten Digital Private Limited', orgId]);
  }

  // 2. Manufacturing Departments
  const departmentsData = [
    { name: 'Plant Operations & Production', code: 'OPS', description: 'Factory floor production scheduling, cycle-time tracking, and shift throughput management.' },
    { name: 'CNC Machining & Tooling', code: 'CNC', description: 'High-precision 5-axis milling, wire EDM, carbide tooling, and micrometric tolerance machining.' },
    { name: 'Quality Assurance & ISO 9001', code: 'QA', description: 'Coordinate measuring machine (CMM) inspections, defect Pareto analysis, and ISO 9001 audits.' },
    { name: 'Assembly & Heavy Fabrication', code: 'ASM', description: 'Robotic welding cells, sub-assembly integration, torque-spec fastening, and transmission assembly.' },
    { name: 'Preventive Maintenance & Reliability', code: 'MNT', description: 'Vibration monitoring, hydraulic press overhauls, predictive maintenance, and machine uptime.' },
    { name: 'Metallurgy & Materials Testing Lab', code: 'MET', description: 'Optical emission spectrometry, tensile elongation, Charpy impact tests, and case hardness analysis.' },
    { name: 'Supply Chain & Steel Sourcing', code: 'SCM', description: 'Procurement of hot-rolled steel coils, aluminum billets, forging ingots, and vendor logistics.' },
    { name: 'Environment, Health & Safety (EHS)', code: 'EHS', description: 'Zero-harm shop floor enforcement, OSHA / ISO 45001 compliance, machine safety interlocks, and PPE.' },
    { name: 'Industrial Automation & SCADA', code: 'AUT', description: 'Siemens S7-1500 PLC programming, KUKA robotic welding kinematics, and IoT SCADA gateways.' },
    { name: 'Die Stamping & Forging', code: 'STP', description: '1,200-ton hydraulic stamping presses, progressive blanking dies, and hot forging operations.' },
    { name: 'Dispatch & Finished Goods Logistics', code: 'DSP', description: 'Anti-corrosion VCI barrier packaging, wooden crating, barcode tracking, and OEM deliveries.' },
    { name: 'Plant HR & Workforce Governance', code: 'HR', description: 'Worker shift rostering, technical apprenticeship training, industrial relations, and welfare.' },
  ];

  const deptMap = {};
  for (const dept of departmentsData) {
    const res = await pool.query(
      `INSERT INTO departments (organization_id, name, code, description)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (organization_id, name) DO UPDATE SET
         code = EXCLUDED.code,
         description = EXCLUDED.description
       RETURNING id, name`,
      [orgId, dept.name, dept.code, dept.description]
    );
    deptMap[dept.name] = res.rows[0].id;
  }

  // 3. Indian Manufacturing Personnel (18 employees)
  const employeesData = [
    {
      name: 'Aarav Sharma',
      email: 'aarav.sharma@example.com',
      empId: 'EMP-0101',
      crmRole: 'super_admin',
      coreRole: 'owner',
      dept: 'Plant Operations & Production',
      designation: 'VP of Engineering',
      phone: '+91 98101 23456',
    },
    {
      name: 'Priya Verma',
      email: 'priya.verma@example.com',
      empId: 'EMP-0102',
      crmRole: 'admin',
      coreRole: 'admin',
      dept: 'Quality Assurance & ISO 9001',
      designation: 'Head of Quality Assurance',
      phone: '+91 98102 34567',
    },
    {
      name: 'Sneha Gupta',
      email: 'sneha.gupta@example.com',
      empId: 'EMP-0103',
      crmRole: 'manager',
      coreRole: 'member',
      dept: 'Metallurgy & Materials Testing Lab',
      designation: 'DevOps & Cloud Architecture Lead',
      phone: '+91 98103 45678',
    },
    {
      name: 'Rajesh Kumar',
      email: 'rajesh.kumar@example.com',
      empId: 'EMP-0104',
      crmRole: 'manager',
      coreRole: 'member',
      dept: 'Plant Operations & Production',
      designation: 'Principal Product Manager',
      phone: '+91 98104 56789',
    },
    {
      name: 'Vikram Malhotra',
      email: 'vikram.malhotra@example.com',
      empId: 'EMP-0105',
      crmRole: 'manager',
      coreRole: 'member',
      dept: 'CNC Machining & Tooling',
      designation: 'Lead Solutions Architect',
      phone: '+91 98105 67890',
    },
    {
      name: 'Arjun Singh',
      email: 'arjun.singh@example.com',
      empId: 'MFG-0106',
      crmRole: 'manager',
      coreRole: 'member',
      dept: 'Industrial Automation & SCADA',
      designation: 'SCADA & Industrial Automation Lead',
      phone: '+91 98106 78901',
    },
    {
      name: 'Ananya Iyer',
      email: 'ananya.iyer@example.com',
      empId: 'MFG-0107',
      crmRole: 'manager',
      coreRole: 'member',
      dept: 'Supply Chain & Steel Sourcing',
      designation: 'Supply Chain & Raw Materials Head',
      phone: '+91 98107 89012',
    },
    {
      name: 'Rahul Kumar',
      email: 'rahul.kumar@example.com',
      empId: 'EMP-0108',
      crmRole: 'employee',
      coreRole: 'member',
      dept: 'CNC Machining & Tooling',
      designation: 'Senior Full Stack Developer',
      phone: '+91 98108 90123',
    },
    {
      name: 'Amit Patel',
      email: 'amit.patel@example.com',
      empId: 'MFG-0109',
      crmRole: 'employee',
      coreRole: 'member',
      dept: 'Assembly & Heavy Fabrication',
      designation: 'Robotic MIG & TIG Welding Specialist',
      phone: '+91 98109 01234',
    },
    {
      name: 'Pooja Mehta',
      email: 'pooja.mehta@example.com',
      empId: 'MFG-0110',
      crmRole: 'employee',
      coreRole: 'member',
      dept: 'Environment, Health & Safety (EHS)',
      designation: 'EHS & Plant Safety Compliance Auditor',
      phone: '+91 98110 12345',
    },
    {
      name: 'Suresh Nair',
      email: 'suresh.nair@example.com',
      empId: 'MFG-0111',
      crmRole: 'employee',
      coreRole: 'member',
      dept: 'Preventive Maintenance & Reliability',
      designation: 'Hydraulic Press & Mechanical Systems Technician',
      phone: '+91 98111 23456',
    },
    {
      name: 'Manoj Deshmukh',
      email: 'manoj.deshmukh@example.com',
      empId: 'MFG-0112',
      crmRole: 'employee',
      coreRole: 'member',
      dept: 'Die Stamping & Forging',
      designation: '1200T Hydraulic Stamping Supervisor',
      phone: '+91 98112 34567',
    },
    {
      name: 'Kavya Nair',
      email: 'kavya.nair@example.com',
      empId: 'MFG-0113',
      crmRole: 'employee',
      coreRole: 'member',
      dept: 'Assembly & Heavy Fabrication',
      designation: 'Sub-Assembly Integration Line Lead',
      phone: '+91 98113 45678',
    },
    {
      name: 'Deepak Chauhan',
      email: 'deepak.chauhan@example.com',
      empId: 'MFG-0114',
      crmRole: 'employee',
      coreRole: 'member',
      dept: 'Quality Assurance & ISO 9001',
      designation: 'CMM Metrology & Optical Inspection Specialist',
      phone: '+91 98114 56789',
    },
    {
      name: 'Sunita Rao',
      email: 'sunita.rao@example.com',
      empId: 'MFG-0115',
      crmRole: 'employee',
      coreRole: 'member',
      dept: 'Metallurgy & Materials Testing Lab',
      designation: 'Non-Destructive Testing (NDT) & Ultrasonic Inspector',
      phone: '+91 98115 67890',
    },
    {
      name: 'Rohan Joshi',
      email: 'rohan.joshi@example.com',
      empId: 'MFG-0116',
      crmRole: 'employee',
      coreRole: 'member',
      dept: 'Plant Operations & Production',
      designation: 'Lean Six Sigma & 5S Continuous Improvement Lead',
      phone: '+91 98116 78901',
    },
    {
      name: 'Meera Nambiar',
      email: 'meera.nambiar@example.com',
      empId: 'MFG-0117',
      crmRole: 'employee',
      coreRole: 'member',
      dept: 'Dispatch & Finished Goods Logistics',
      designation: 'Finished Goods Inspection & OEM Shipping Officer',
      phone: '+91 98117 89012',
    },
    {
      name: 'Ritu Agarwal',
      email: 'ritu.agarwal@example.com',
      empId: 'MFG-0118',
      crmRole: 'admin',
      coreRole: 'admin',
      dept: 'Plant HR & Workforce Governance',
      designation: 'Plant HR & Industrial Relations Lead',
      phone: '+91 98118 90123',
    },
  ];

  const userMap = {};
  for (const emp of employeesData) {
    const initials = emp.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
    const deptId = deptMap[emp.dept] || null;

    const res = await pool.query(
      `INSERT INTO users (
         organization_id, full_name, email, password_hash, role, crm_role,
         employee_id, department_id, designation, phone, avatar, employment_status, is_active
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', true)
       ON CONFLICT (organization_id, email) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         crm_role = EXCLUDED.crm_role,
         employee_id = EXCLUDED.employee_id,
         department_id = EXCLUDED.department_id,
         designation = EXCLUDED.designation,
         phone = EXCLUDED.phone,
         avatar = EXCLUDED.avatar
       RETURNING id, email, full_name`,
      [
        orgId,
        emp.name,
        emp.email.toLowerCase(),
        passwordHash,
        emp.coreRole,
        emp.crmRole,
        emp.empId,
        deptId,
        emp.designation,
        emp.phone,
        initials,
      ]
    );
    userMap[emp.name] = res.rows[0].id;
  }

  // Set Department Heads
  await pool.query('UPDATE departments SET head_id = $1 WHERE id = $2', [userMap['Rajesh Kumar'], deptMap['Plant Operations & Production']]);
  await pool.query('UPDATE departments SET head_id = $1 WHERE id = $2', [userMap['Vikram Malhotra'], deptMap['CNC Machining & Tooling']]);
  await pool.query('UPDATE departments SET head_id = $1 WHERE id = $2', [userMap['Priya Verma'], deptMap['Quality Assurance & ISO 9001']]);
  await pool.query('UPDATE departments SET head_id = $1 WHERE id = $2', [userMap['Sneha Gupta'], deptMap['Metallurgy & Materials Testing Lab']]);
  await pool.query('UPDATE departments SET head_id = $1 WHERE id = $2', [userMap['Arjun Singh'], deptMap['Industrial Automation & SCADA']]);
  await pool.query('UPDATE departments SET head_id = $1 WHERE id = $2', [userMap['Ananya Iyer'], deptMap['Supply Chain & Steel Sourcing']]);
  await pool.query('UPDATE departments SET head_id = $1 WHERE id = $2', [userMap['Ritu Agarwal'], deptMap['Plant HR & Workforce Governance']]);

  // 4. Industrial Clients (CRM)
  const clientsData = [
    {
      company: 'Tata Motors Commercial Vehicles',
      contact: 'Rajesh Sen',
      email: 'rajesh.sen@tatamotors-demo.in',
      phone: '+91 20 6613 4000',
      stage: 'Won',
      value: 14500000,
      source: 'OEM Contract',
      owner: userMap['Rajesh Kumar'],
      action: 'Deliver monthly consignment of 500 planetary gearbox casings.',
      date: '2026-11-12',
    },
    {
      company: 'Mahindra Heavy Industries',
      contact: 'Sunil Deshpande',
      email: 'deshpande.s@mahindra-demo.in',
      phone: '+91 2135 64 2000',
      stage: 'Proposal',
      value: 28000000,
      source: 'Tender RFP',
      owner: userMap['Rajesh Kumar'],
      action: 'Submit final technical quote for hydraulic tractor driveline shafts.',
      date: '2026-11-04',
    },
    {
      company: 'Bharat Heavy Electricals Ltd. (BHEL)',
      contact: 'K. S. Narayanan',
      email: 'ks.narayanan@bhel-demo.in',
      phone: '+91 431 257 4110',
      stage: 'Negotiation',
      value: 19500000,
      source: 'PSU Partnership',
      owner: userMap['Aarav Sharma'],
      action: 'Finalize ultrasonic NDT acceptance criteria for ASTM A182 forgings.',
      date: '2026-11-08',
    },
    {
      company: 'Larsen & Toubro Heavy Engineering',
      contact: 'Anirudh Roy',
      email: 'anirudh.roy@lnt-demo.in',
      phone: '+91 261 286 1000',
      stage: 'Won',
      value: 34000000,
      source: 'Strategic Alliance',
      owner: userMap['Aarav Sharma'],
      action: 'Release inspection report for 8 nuclear-spec nozzle flanges.',
      date: '2026-11-20',
    },
    {
      company: 'Maruti Suzuki Powertrain Division',
      contact: 'Vikram Bedi',
      email: 'v.bedi@marutisuzuki-demo.in',
      phone: '+91 124 234 0001',
      stage: 'Won',
      value: 21000000,
      source: 'OEM Annual Tender',
      owner: userMap['Rajesh Kumar'],
      action: 'Ship batch #404 of precision cam shafts with zero surface defect cert.',
      date: '2026-11-15',
    },
    {
      company: 'Ashok Leyland Defense Division',
      contact: 'Col. Ranjit Menon (Retd.)',
      email: 'ranjit.menon@ashokleyland-demo.in',
      phone: '+91 4344 40 4000',
      stage: 'Negotiation',
      value: 18500000,
      source: 'Defense Procurement',
      owner: userMap['Priya Verma'],
      action: 'Complete ballistic impact testing on forged armored wheel hubs.',
      date: '2026-11-07',
    },
    {
      company: 'Godrej Aerospace & Precision Systems',
      contact: 'Dr. Shilpa Kulkarni',
      email: 'shilpa.k@godrej-demo.in',
      phone: '+91 22 6796 5656',
      stage: 'Won',
      value: 39000000,
      source: 'Space & Defense RFP',
      owner: userMap['Vikram Malhotra'],
      action: 'Deliver 5-axis milled titanium fuel injector heads with CMM report.',
      date: '2026-11-18',
    },
  ];

  const clientMap = {};
  for (const c of clientsData) {
    const existingClient = await pool.query(
      'SELECT id FROM clients WHERE organization_id = $1 AND company_name = $2',
      [orgId, c.company]
    );
    if (existingClient.rows.length === 0) {
      const res = await pool.query(
        `INSERT INTO clients (
           organization_id, company_name, contact_person, email, phone, lead_source,
           lead_owner_id, pipeline_stage, deal_value, next_action, follow_up_date
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, company_name`,
        [
          orgId,
          c.company,
          c.contact,
          c.email,
          c.phone,
          c.source,
          c.owner,
          c.stage,
          c.value,
          c.action,
          c.date,
        ]
      );
      clientMap[c.company] = res.rows[0].id;
    } else {
      clientMap[c.company] = existingClient.rows[0].id;
    }
  }

  // 5. Manufacturing Projects
  const projectsData = [
    {
      name: 'Project Garuda: EV Powertrain Casings',
      desc: 'High-pressure die-cast aluminum transmission casings for commercial electric delivery vehicles.',
      client: clientMap['Tata Motors Commercial Vehicles'],
      owner: userMap['Rajesh Kumar'],
      status: 'active',
      health: 'good',
      budget: 14500000,
      start: '2026-08-01',
      end: '2027-03-31',
    },
    {
      name: 'Project Trishul: Defense Aerospace Hydraulic Manifolds',
      desc: '5-axis wire-EDM milled Grade 5 Titanium manifolds for defense hydraulic actuator controls.',
      client: clientMap['Godrej Aerospace & Precision Systems'],
      owner: userMap['Vikram Malhotra'],
      status: 'active',
      health: 'good',
      budget: 39000000,
      start: '2026-06-15',
      end: '2026-12-31',
    },
    {
      name: 'Project Vayu: High-Pressure Steam Turbine Blading',
      desc: 'Precision forged Inconel 718 aerofoil blades for supercritical 800MW thermal plant turbines.',
      client: clientMap['Bharat Heavy Electricals Ltd. (BHEL)'],
      owner: userMap['Priya Verma'],
      status: 'active',
      health: 'good',
      budget: 19500000,
      start: '2026-07-01',
      end: '2027-02-28',
    },
    {
      name: 'Project Surya: Solar Heavy Tracker Gearbox Assembly',
      desc: 'Heavy duty planetary reduction gearboxes engineered for 25-year desert solar tracker torque resistance.',
      client: clientMap['Mahindra Heavy Industries'],
      owner: userMap['Rajesh Kumar'],
      status: 'active',
      health: 'good',
      budget: 28000000,
      start: '2026-09-01',
      end: '2027-05-30',
    },
    {
      name: 'Project Chetna: Stamping Line 4 IoT SCADA Modernization',
      desc: 'Retrofitting Siemens S7-1500 PLCs and vibration accelerometers on 1200T stamping lines.',
      client: null,
      owner: userMap['Arjun Singh'],
      status: 'active',
      health: 'good',
      budget: 8500000,
      start: '2026-08-15',
      end: '2026-11-30',
    },
    {
      name: 'Project Raksha: ISO 45001 EHS Zero-Harm Shopfloor Program',
      desc: 'Installation of automated laser safety light curtains and dust exhaust scrubbers in cold-forge bays.',
      client: null,
      owner: userMap['Pooja Mehta'],
      status: 'active',
      health: 'good',
      budget: 4500000,
      start: '2026-05-01',
      end: '2026-11-15',
    },
    {
      name: 'Project Kaizen: Lean 5S & OEE 88% Throughput Target',
      desc: 'Standardized SMED quick die changeovers, tooling rack shadows, and scrap reduction program.',
      client: null,
      owner: userMap['Rohan Joshi'],
      status: 'active',
      health: 'good',
      budget: 3200000,
      start: '2026-07-01',
      end: '2026-12-15',
    },
  ];

  const projectMap = {};
  for (const p of projectsData) {
    const existingProj = await pool.query(
      'SELECT id FROM projects WHERE organization_id = $1 AND name = $2',
      [orgId, p.name]
    );
    if (existingProj.rows.length === 0) {
      const res = await pool.query(
        `INSERT INTO projects (
           organization_id, name, description, client_id, owner_id, status, health, budget, start_date, end_date
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, name`,
        [orgId, p.name, p.desc, p.client, p.owner, p.status, p.health, p.budget, p.start, p.end]
      );
      projectMap[p.name] = res.rows[0].id;
    } else {
      projectMap[p.name] = existingProj.rows[0].id;
    }
  }

  // 6. Check existing tasks to guarantee idempotency
  const existingTasksRes = await pool.query('SELECT COUNT(*) FROM tasks WHERE organization_id = $1', [orgId]);
  const taskCount = parseInt(existingTasksRes.rows[0].count, 10);

  if (taskCount === 0) {
    // 52 Realistic Manufacturing Work Orders
    const manufacturingTasks = [
      // Overdue tasks (relative to 2026-10-28)
      {
        code: 'TASK-2026-0001',
        title: 'Batch #849 Titanium Alloy Tensile Strength & Charpy Testing',
        desc: 'Sample 6 specimen test coupons from raw titanium billet heat #TI-904. Certify yield strength (>880 MPa) and Charpy impact energy.',
        project: 'Project Trishul: Defense Aerospace Hydraulic Manifolds',
        dept: 'Metallurgy & Materials Testing Lab',
        status: 'in_progress',
        priority: 'urgent',
        due: '2026-10-26', // 2 days overdue
        est: 8,
        act: 6,
        pct: 75,
        tags: 'metallurgy,tensile,testing,as9100d',
        creator: userMap['Aarav Sharma'],
        assignees: [userMap['Rahul Kumar'], userMap['Pooja Mehta']],
      },
      {
        code: 'TASK-2026-0002',
        title: 'Root-Cause Analysis of Micro-Porosity in Die Casting Batch #912',
        desc: 'Investigate molten aluminum degassing duration, mold vacuum evacuation pressure, and chill-vent blockages.',
        project: 'Project Garuda: EV Powertrain Casings',
        dept: 'Die Stamping & Forging',
        status: 'blocked',
        priority: 'high',
        due: '2026-10-27', // 1 day overdue
        est: 8,
        act: 4,
        pct: 40,
        tags: 'diecasting,porosity,metallurgy,automotive',
        blocked: 'Awaiting molten metal spectrometer gas analysis from Lab',
        creator: userMap['Rajesh Kumar'],
        assignees: [userMap['Pooja Mehta']],
      },
      {
        code: 'TASK-2026-0003',
        title: 'Emergency: Laser curtain interlock fault on Automated Blanking Cell',
        desc: 'Fix optical alignment sensor fault causing intermittent trips on Stamping Line 2 safety relay.',
        project: 'Project Raksha: ISO 45001 EHS Zero-Harm Shopfloor Program',
        dept: 'Environment, Health & Safety (EHS)',
        status: 'todo',
        priority: 'urgent',
        due: '2026-10-27', // 1 day overdue
        est: 6,
        act: 2,
        pct: 20,
        tags: 'safety,interlock,ehs,zero-harm',
        creator: userMap['Pooja Mehta'],
        assignees: [userMap['Pooja Mehta']],
      },
      // Due Today tasks (2026-10-28)
      {
        code: 'TASK-2026-0004',
        title: 'Calibrate 5-Axis CNC Milling Unit #4 (Tolerance < 0.005mm)',
        desc: 'Perform laser interferometer volumetric positioning calibration and spindle concentricity check on Mazak 5-axis center.',
        project: 'Project Trishul: Defense Aerospace Hydraulic Manifolds',
        dept: 'CNC Machining & Tooling',
        status: 'in_progress',
        priority: 'urgent',
        due: '2026-10-28', // due today
        est: 6,
        act: 4,
        pct: 60,
        tags: 'cnc,metrology,tolerance,defense',
        creator: userMap['Vikram Malhotra'],
        assignees: [userMap['Rahul Kumar']],
      },
      {
        code: 'TASK-2026-0005',
        title: 'Shop Floor Bay 3 Robotic MIG Welding Kinematic Recalibration',
        desc: 'Re-zero 6-axis KUKA welding robot tool center point. Verify wire feed speed and argon/CO2 shielding gas flow rate.',
        project: 'Project Garuda: EV Powertrain Casings',
        dept: 'Assembly & Heavy Fabrication',
        status: 'in_progress',
        priority: 'high',
        due: '2026-10-28', // due today
        est: 5,
        act: 3,
        pct: 50,
        tags: 'robotics,welding,automation,assembly',
        creator: userMap['Rajesh Kumar'],
        assignees: [userMap['Amit Patel']],
      },
      {
        code: 'TASK-2026-0006',
        title: 'Final Quality Release & VCI Packaging for Tata Motors Gearboxes',
        desc: 'Inspect 450 finished planetary gearbox housings, verify thread gauges, apply Cortec VCI film wrapping, and package in export skids.',
        project: 'Project Garuda: EV Powertrain Casings',
        dept: 'Dispatch & Finished Goods Logistics',
        status: 'todo',
        priority: 'urgent',
        due: '2026-10-28', // due today
        est: 6,
        act: 0,
        pct: 0,
        tags: 'dispatch,tatamotors,packaging,vci',
        creator: userMap['Rajesh Kumar'],
        assignees: [userMap['Meera Nambiar']],
      },
      {
        code: 'TASK-2026-0007',
        title: 'Pre-Delivery Inspection (PDI) for Mahindra High-Torque PTO Shafts',
        desc: 'Perform 100% torque endurance testing up to 2,400 Nm on dynamometer bench and inspect spline hardness across 120 tractor drive shafts.',
        project: 'Project Surya: Solar Heavy Tracker Gearbox Assembly',
        dept: 'Assembly & Heavy Fabrication',
        status: 'in_progress',
        priority: 'high',
        due: '2026-10-28', // due today
        est: 7,
        act: 5,
        pct: 70,
        tags: 'pdi,mahindra,torquetest,assembly',
        creator: userMap['Rajesh Kumar'],
        assignees: [userMap['Kavya Nair']],
      },
      {
        code: 'TASK-2026-0008',
        title: 'Coordinate CMM Scan for Godrej Aerospace Rocket Thrust Injector',
        desc: 'Measure 96 orifice nozzle concentricities and pitch angles using 0.5mm ruby probe on Zeiss CMM. Generate GD&T geometric report.',
        project: 'Project Trishul: Defense Aerospace Hydraulic Manifolds',
        dept: 'Quality Assurance & ISO 9001',
        status: 'in_progress',
        priority: 'urgent',
        due: '2026-10-28', // due today
        est: 8,
        act: 6,
        pct: 75,
        tags: 'aerospace,cmm,godrej,precision',
        creator: userMap['Priya Verma'],
        assignees: [userMap['Deepak Chauhan']],
      },
      // Due Tomorrow tasks (2026-10-29)
      {
        code: 'TASK-2026-0009',
        title: 'Overhaul 1,200-Ton Hydraulic Stamping Press Main Ram Seals',
        desc: 'Inspect hydraulic valve manifolds, replace dual polyurethane piston rod seals, bleed air, and conduct pressure holding test at 315 bar.',
        project: 'Project Chetna: Stamping Line 4 IoT SCADA Modernization',
        dept: 'Preventive Maintenance & Reliability',
        status: 'todo',
        priority: 'urgent',
        due: '2026-10-29', // due tomorrow
        est: 12,
        act: 0,
        pct: 0,
        tags: 'maintenance,hydraulic,highpressure,stamping',
        creator: userMap['Arjun Singh'],
        assignees: [userMap['Suresh Nair']],
      },
      {
        code: 'TASK-2026-0010',
        title: 'Calibrate Optical Coordinate Measuring Machine (CMM) Reference Spheres',
        desc: 'Verify Zeiss Accura CMM ceramic reference sphere diameters using certified UKAS ruby stylus probes in climate-controlled metrology lab.',
        project: 'Project Trishul: Defense Aerospace Hydraulic Manifolds',
        dept: 'Quality Assurance & ISO 9001',
        status: 'todo',
        priority: 'medium',
        due: '2026-10-29',
        est: 4,
        act: 0,
        pct: 0,
        tags: 'metrology,cmm,zeiss,calibration',
        creator: userMap['Priya Verma'],
        assignees: [userMap['Deepak Chauhan']],
      },
      {
        code: 'TASK-2026-0011',
        title: 'Replace Nitrogen Gas Accumulator Bladder on 800T Die Casting Machine',
        desc: 'Depressurize accumulator cylinder, replace nitrile synthetic rubber bladder, pre-charge with dry nitrogen to 120 bar, and check safety valve.',
        project: 'Project Garuda: EV Powertrain Casings',
        dept: 'Preventive Maintenance & Reliability',
        status: 'todo',
        priority: 'high',
        due: '2026-10-29',
        est: 6,
        act: 0,
        pct: 0,
        tags: 'maintenance,accumulator,nitrogen,diecasting',
        creator: userMap['Aarav Sharma'],
        assignees: [userMap['Suresh Nair']],
      },
      {
        code: 'TASK-2026-0012',
        title: 'Stage-4 Ultrasonic NDT Flaw Inspection on BHEL Flanges',
        desc: 'Conduct phased-array ultrasonic testing (PAUT) across weld preps and forged faces of 24-inch steam turbine nozzle flanges.',
        project: 'Project Vayu: High-Pressure Steam Turbine Blading',
        dept: 'Metallurgy & Materials Testing Lab',
        status: 'in_review',
        priority: 'high',
        due: '2026-10-30',
        est: 7,
        act: 6,
        pct: 85,
        tags: 'ndt,ultrasonic,bhel,quality',
        creator: userMap['Priya Verma'],
        assignees: [userMap['Sunita Rao']],
      },
      {
        code: 'TASK-2026-0013',
        title: 'ISO 9001:2015 Annual Surveillance Audit Documentation Closure',
        desc: 'Collate calibration records, non-conformance reports (NCRs), and customer feedback log for external Bureau Veritas audit team.',
        project: 'Project Raksha: ISO 45001 EHS Zero-Harm Shopfloor Program',
        dept: 'Quality Assurance & ISO 9001',
        status: 'in_review',
        priority: 'urgent',
        due: '2026-10-31',
        est: 10,
        act: 8,
        pct: 80,
        tags: 'iso9001,quality,audit,compliance',
        creator: userMap['Aarav Sharma'],
        assignees: [userMap['Priya Verma']],
      },
      {
        code: 'TASK-2026-0014',
        title: 'Wire-EDM Profiling of Inconel Turbine Aerofoil Serrated Root Blading',
        desc: 'Execute AgieCharmilles wire electrical discharge machining on fir-tree blade roots with spark gap stability monitoring in deionized water bath.',
        project: 'Project Vayu: High-Pressure Steam Turbine Blading',
        dept: 'CNC Machining & Tooling',
        status: 'in_progress',
        priority: 'high',
        due: '2026-10-31',
        est: 11,
        act: 5,
        pct: 45,
        tags: 'wireedm,inconel718,aerospace,firtree',
        creator: userMap['Vikram Malhotra'],
        assignees: [userMap['Rahul Kumar']],
      },
      {
        code: 'TASK-2026-0015',
        title: 'Replace Spindle Bearings on Makino Horizontal Machining Center #2',
        desc: 'Disassemble HMC-2 spindle cartridge, install matched hybrid ceramic angular contact bearing set, balance to ISO G0.4 spec at 18,000 RPM.',
        project: 'Project Trishul: Defense Aerospace Hydraulic Manifolds',
        dept: 'CNC Machining & Tooling',
        status: 'blocked',
        priority: 'high',
        due: '2026-11-02',
        est: 14,
        act: 3,
        pct: 20,
        tags: 'cnc,spindle,bearings,tooling',
        blocked: 'Awaiting SKF precision ceramic angular bearings shipment',
        creator: userMap['Vikram Malhotra'],
        assignees: [userMap['Vikram Malhotra']],
      },
      {
        code: 'TASK-2026-0016',
        title: 'Automate Tool Wear Warning System via Shopfloor Edge IoT Node',
        desc: 'Configure spindle load feedback algorithms on Edge IoT gateway to trigger automatic tool change when cutting torque rises by >18%.',
        project: 'Project Chetna: Stamping Line 4 IoT SCADA Modernization',
        dept: 'Industrial Automation & SCADA',
        status: 'in_progress',
        priority: 'medium',
        due: '2026-11-04',
        est: 9,
        act: 4,
        pct: 45,
        tags: 'automation,iot,scada,predictive',
        creator: userMap['Arjun Singh'],
        assignees: [userMap['Arjun Singh']],
      },
      {
        code: 'TASK-2026-0017',
        title: 'Procure Grade 316L Stainless Steel Sheet Stock for Cryogenic Vessels',
        desc: 'Issue purchase requisition for 45 metric tons of ASME SA-240 Type 316L cold-rolled coil with dual certification and ferrite test reports.',
        project: 'Project Vayu: High-Pressure Steam Turbine Blading',
        dept: 'Supply Chain & Steel Sourcing',
        status: 'todo',
        priority: 'medium',
        due: '2026-11-05',
        est: 6,
        act: 0,
        pct: 0,
        tags: 'procurement,stainlesssteel,rawmaterials',
        creator: userMap['Aarav Sharma'],
        assignees: [userMap['Ananya Iyer']],
      },
      {
        code: 'TASK-2026-0018',
        title: 'Setup Automated Vision Inspection for Stamped Bracket Line',
        desc: 'Mount Cognex In-Sight 2D smart camera over conveyor belt 4. Program deep learning classifier to spot punch hole misalignments and burrs.',
        project: 'Project Chetna: Stamping Line 4 IoT SCADA Modernization',
        dept: 'Industrial Automation & SCADA',
        status: 'in_progress',
        priority: 'medium',
        due: '2026-11-06',
        est: 8,
        act: 3,
        pct: 35,
        tags: 'machinevision,automation,ai,quality',
        creator: userMap['Arjun Singh'],
        assignees: [userMap['Arjun Singh']],
      },
      {
        code: 'TASK-2026-0019',
        title: 'Vendor Quality Audit: Bharat Forgings Sub-Tier Machined Blanks',
        desc: 'On-site QA audit of Bharat Forgings facility in Chakan. Audit heat treatment furnaces, quench oil temperatures, and hardness calibration logs.',
        project: 'Project Garuda: EV Powertrain Casings',
        dept: 'Quality Assurance & ISO 9001',
        status: 'todo',
        priority: 'medium',
        due: '2026-11-08',
        est: 8,
        act: 0,
        pct: 0,
        tags: 'vendoraudit,iatf16949,forgings,quality',
        creator: userMap['Priya Verma'],
        assignees: [userMap['Priya Verma']],
      },
      {
        code: 'TASK-2026-0020',
        title: 'Apprentice CNC Machinist Skill Certification & Safety Assessment',
        desc: 'Conduct hands-on assessment of 14 apprentice machinists on emergency stop drills, chip clearance safety, and micrometer accuracy.',
        project: 'Project Kaizen: Lean 5S & OEE 88% Throughput Target',
        dept: 'Plant HR & Workforce Governance',
        status: 'todo',
        priority: 'low',
        due: '2026-11-10',
        est: 8,
        act: 0,
        pct: 0,
        tags: 'hr,apprenticeship,safetytraining,skills',
        creator: userMap['Ritu Agarwal'],
        assignees: [userMap['Ritu Agarwal']],
      },
    ];

    // Add additional tasks up to 52 tasks
    const extraTasks = [
      { title: 'Reconcile Raw Material Inventory: 180T EN24 Steel Billets', dept: 'Supply Chain & Steel Sourcing', status: 'done', priority: 'medium', due: '2026-10-27', tags: 'inventory,steel,scm', creator: userMap['Aarav Sharma'], assignees: [userMap['Ananya Iyer']] },
      { title: 'Thermal Imaging & Hotspot Scan on 33kV Main Substation Transformers', dept: 'Preventive Maintenance & Reliability', status: 'done', priority: 'medium', due: '2026-10-25', tags: 'electrical,thermography,maintenance', creator: userMap['Arjun Singh'], assignees: [userMap['Suresh Nair']] },
      { title: 'Execute Emergency EHS Toxic Vapor & Gas Sensor Calibration in Forging Bay', dept: 'Environment, Health & Safety (EHS)', status: 'done', priority: 'urgent', due: '2026-10-24', tags: 'ehs,safety,sensors', creator: userMap['Aarav Sharma'], assignees: [userMap['Pooja Mehta']] },
      { title: 'Verify Laser Safety Guard Interlocks on Automated Stamping Line 2', dept: 'Environment, Health & Safety (EHS)', status: 'done', priority: 'urgent', due: '2026-10-23', tags: 'ehs,safety,interlock', creator: userMap['Pooja Mehta'], assignees: [userMap['Pooja Mehta']] },
      { title: 'Spectrographic Heat Analysis on Inbound 20MnCr5 Forging Bars', dept: 'Metallurgy & Materials Testing Lab', status: 'done', priority: 'high', due: '2026-10-25', tags: 'spectrometry,metallurgy,chemistry', creator: userMap['Sneha Gupta'], assignees: [userMap['Sneha Gupta']] },
      { title: 'Conduct Air Permeability & Oil Leak Test on Suspension Hubs', dept: 'Assembly & Heavy Fabrication', status: 'done', priority: 'high', due: '2026-10-24', tags: 'leaktesting,quality,assembly', creator: userMap['Rajesh Kumar'], assignees: [userMap['Kavya Nair']] },
      { title: 'Recalibrate Multi-Point Torque Guns for EV Battery Pack Frame Assembly', dept: 'Assembly & Heavy Fabrication', status: 'done', priority: 'high', due: '2026-10-27', tags: 'torque,assembly,calibration', creator: userMap['Rajesh Kumar'], assignees: [userMap['Amit Patel']] },
      { title: 'Vibration FFT Spectrum Analysis on Stamping Hydraulic Feed Pump #3', dept: 'Preventive Maintenance & Reliability', status: 'done', priority: 'medium', due: '2026-10-26', tags: 'vibration,fft,maintenance', creator: userMap['Arjun Singh'], assignees: [userMap['Suresh Nair']] },
      { title: 'Conduct Shift A vs Shift B Stamping Defect Pareto Analysis', dept: 'Plant Operations & Production', status: 'in_progress', priority: 'medium', due: '2026-10-30', tags: 'kaizen,lean,pareto', creator: userMap['Rajesh Kumar'], assignees: [userMap['Rohan Joshi']] },
      { title: 'Lean 5S Shop Floor Standardization Audit in Machining Cell B', dept: 'Plant Operations & Production', status: 'in_progress', priority: 'low', due: '2026-11-03', tags: 'lean,5s,standardization', creator: userMap['Rajesh Kumar'], assignees: [userMap['Rohan Joshi']] },
      { title: 'Environmental Wet Scrubber Dust Collector Efficiency Overhaul', dept: 'Environment, Health & Safety (EHS)', status: 'in_progress', priority: 'medium', due: '2026-11-04', tags: 'ehs,environmental,scrubber', creator: userMap['Pooja Mehta'], assignees: [userMap['Pooja Mehta']] },
      { title: 'Stamping Die Progressive Shear Edge Resharpening for Automotive Brackets', dept: 'Die Stamping & Forging', status: 'todo', priority: 'medium', due: '2026-10-31', tags: 'stamping,die,maintenance', creator: userMap['Manoj Deshmukh'], assignees: [userMap['Manoj Deshmukh']] },
      { title: 'Calibrate Laser Tracker for L&T Nuclear Nozzle Flange Alignment', dept: 'Quality Assurance & ISO 9001', status: 'todo', priority: 'urgent', due: '2026-10-29', tags: 'nuclear,lasertracker,metrology', creator: userMap['Priya Verma'], assignees: [userMap['Deepak Chauhan']] },
      { title: 'Re-zero Tool Center Point on Robotic Plasma Cutting Gantry #1', dept: 'Assembly & Heavy Fabrication', status: 'in_progress', priority: 'high', due: '2026-11-01', tags: 'robotics,plasma,cutting', creator: userMap['Rajesh Kumar'], assignees: [userMap['Amit Patel']] },
      { title: 'Hardness Profiling across Induction Hardened Pinion Gear Teeth', dept: 'Metallurgy & Materials Testing Lab', status: 'todo', priority: 'medium', due: '2026-11-07', tags: 'metallurgy,hardness,gears', creator: userMap['Sneha Gupta'], assignees: [userMap['Sunita Rao']] },
      { title: 'Inspect Hydraulic Manifold Block O-Ring Sealing Surfaces', dept: 'Preventive Maintenance & Reliability', status: 'todo', priority: 'low', due: '2026-11-09', tags: 'hydraulic,seals,maintenance', creator: userMap['Vikram Malhotra'], assignees: [userMap['Suresh Nair']] },
      { title: 'Safety Walkthrough: Hot Forging Press Noise Decibel Assessment', dept: 'Environment, Health & Safety (EHS)', status: 'done', priority: 'medium', due: '2026-10-26', tags: 'safety,noise,ehs', creator: userMap['Pooja Mehta'], assignees: [userMap['Pooja Mehta']] },
      { title: 'Implement Kanban Visual Bins for High-Speed Carbide Endmills', dept: 'CNC Machining & Tooling', status: 'in_progress', priority: 'low', due: '2026-11-08', tags: 'kanban,tooling,carbide', creator: userMap['Vikram Malhotra'], assignees: [userMap['Rahul Kumar']] },
      { title: 'Surface Roughness Ra Verification on Aerospace Turbine Shafts', dept: 'Quality Assurance & ISO 9001', status: 'in_review', priority: 'high', due: '2026-11-01', tags: 'quality,roughness,aerospace', creator: userMap['Priya Verma'], assignees: [userMap['Deepak Chauhan']] },
      { title: 'Verify Fire Hydrant Water Ring Pressure across All 3 Shopfloors', dept: 'Environment, Health & Safety (EHS)', status: 'done', priority: 'urgent', due: '2026-10-25', tags: 'safety,firehydrant,ehs', creator: userMap['Pooja Mehta'], assignees: [userMap['Pooja Mehta']] },
      { title: 'Setup High-Torque Nutrunner Controller Preset Profiles for Axles', dept: 'Assembly & Heavy Fabrication', status: 'todo', priority: 'medium', due: '2026-11-05', tags: 'assembly,nutrunner,torque', creator: userMap['Rajesh Kumar'], assignees: [userMap['Kavya Nair']] },
      { title: 'Cooling Tower Water Bio-Biocide Chemical Dosing & PH Balance Check', dept: 'Preventive Maintenance & Reliability', status: 'done', priority: 'low', due: '2026-10-26', tags: 'facility,coolingwater,maintenance', creator: userMap['Arjun Singh'], assignees: [userMap['Suresh Nair']] },
      { title: 'Validate Material Traceability Barcode Scanners in Raw Yard', dept: 'Supply Chain & Steel Sourcing', status: 'in_progress', priority: 'medium', due: '2026-11-03', tags: 'barcode,traceability,scm', creator: userMap['Ananya Iyer'], assignees: [userMap['Ananya Iyer']] },
      { title: 'Overhaul Hydraulic Proportioning Valves on Cold Extrusion Press #1', dept: 'Preventive Maintenance & Reliability', status: 'todo', priority: 'high', due: '2026-11-06', tags: 'hydraulic,extrusion,valves', creator: userMap['Aarav Sharma'], assignees: [userMap['Suresh Nair']] },
      { title: 'Annual Renewal of ISO 45001 Occupational Safety Accreditation', dept: 'Environment, Health & Safety (EHS)', status: 'in_review', priority: 'urgent', due: '2026-11-12', tags: 'iso45001,safety,certification', creator: userMap['Aarav Sharma'], assignees: [userMap['Pooja Mehta']] },
      { title: 'Pre-Shipment Rust Inhibitor Oil Immersion for Export Camshafts', dept: 'Dispatch & Finished Goods Logistics', status: 'in_progress', priority: 'medium', due: '2026-10-31', tags: 'dispatch,rustinhibitor,export', creator: userMap['Rajesh Kumar'], assignees: [userMap['Meera Nambiar']] },
      { title: 'Precision Broaching Tool Sharpening for Internal Spline Hubs', dept: 'CNC Machining & Tooling', status: 'done', priority: 'high', due: '2026-10-24', tags: 'tooling,broaching,splines', creator: userMap['Vikram Malhotra'], assignees: [userMap['Rahul Kumar']] },
      { title: 'Quarterly Air Compressor Dew Point & Desiccant Dryer Inspection', dept: 'Preventive Maintenance & Reliability', status: 'done', priority: 'low', due: '2026-10-27', tags: 'compressor,dewpoint,maintenance', creator: userMap['Arjun Singh'], assignees: [userMap['Suresh Nair']] },
      { title: 'Conduct Ergonomic Posture Assessment for Assembly Station 3', dept: 'Plant HR & Workforce Governance', status: 'in_progress', priority: 'low', due: '2026-11-08', tags: 'ergonomics,hr,safety', creator: userMap['Ritu Agarwal'], assignees: [userMap['Ritu Agarwal']] },
      { title: 'Evaluate Scrap Recovery Value for Titanium Turnings & Swarf', dept: 'Supply Chain & Steel Sourcing', status: 'todo', priority: 'medium', due: '2026-11-14', tags: 'scrap,recycling,titanium', creator: userMap['Ananya Iyer'], assignees: [userMap['Ananya Iyer']] },
      { title: 'Microscopic Grain Size & Inclusion Rating on ASTM A182 Forgings', dept: 'Metallurgy & Materials Testing Lab', status: 'in_review', priority: 'high', due: '2026-10-30', tags: 'metallurgy,microscopy,grainsize', creator: userMap['Sneha Gupta'], assignees: [userMap['Sunita Rao']] },
      { title: 'Update Shift Worker Digital Attendance & Overtime SCADA Terminal', dept: 'Plant HR & Workforce Governance', status: 'done', priority: 'medium', due: '2026-10-27', tags: 'attendance,hr,workforce', creator: userMap['Ritu Agarwal'], assignees: [userMap['Ritu Agarwal']] },
    ];

    let taskCounter = 21;
    for (const extra of extraTasks) {
      const code = `TASK-2026-${String(taskCounter++).padStart(4, '0')}`;
      manufacturingTasks.push({
        code,
        title: extra.title,
        desc: extra.title + ' in strict accordance with engineering tolerances and QA standards.',
        project: 'Project Kaizen: Lean 5S & OEE 88% Throughput Target',
        dept: extra.dept,
        status: extra.status,
        priority: extra.priority,
        due: extra.due,
        est: 6,
        act: extra.status === 'done' ? 6 : 2,
        pct: extra.status === 'done' ? 100 : 30,
        tags: extra.tags,
        creator: extra.creator,
        assignees: extra.assignees,
      });
    }

    // Insert all tasks
    for (const task of manufacturingTasks) {
      const projId = task.project ? projectMap[task.project] : null;
      const deptId = task.dept ? deptMap[task.dept] : null;
      const coreStatus = task.status === 'done' ? 'completed' : (task.status === 'in_progress' ? 'in-progress' : 'pending');
      const corePriority = task.priority === 'urgent' ? 'high' : task.priority;
      const completedAt = task.status === 'done' ? new Date(Date.now() - 2 * 86400000) : null;

      const res = await pool.query(
        `INSERT INTO tasks (
           organization_id, created_by, title, description, status, priority, due_date,
           task_code, project_id, department_id, crm_status, crm_priority, category,
           estimated_hours, actual_hours, completion_percentage, tags, completed_at, source
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Manufacturing', $13, $14, $15, $16, $17, 'TaskFlow')
         RETURNING id`,
        [
          orgId,
          task.creator || userMap['Aarav Sharma'],
          task.title,
          task.desc,
          coreStatus,
          corePriority,
          task.due,
          task.code,
          projId,
          deptId,
          task.status,
          task.priority,
          task.est,
          task.act,
          task.pct,
          task.tags,
          completedAt,
        ]
      );
      const createdId = res.rows[0].id;

      // Assign users
      if (task.assignees && task.assignees.length > 0) {
        for (const uid of task.assignees) {
          if (uid) {
            await pool.query(
              `INSERT INTO task_assignments (organization_id, task_id, user_id, assigned_by)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT DO NOTHING`,
              [orgId, createdId, uid, task.creator || userMap['Aarav Sharma']]
            );
          }
        }
      }

      // Add comments to select tasks
      if (task.code === 'TASK-2026-0001') {
        await pool.query(
          `INSERT INTO task_comments (task_id, user_id, comment)
           VALUES 
             ($1, $2, 'Tensile specimen 1 and 2 yielded at 894 MPa. Elongation at fracture is 14.2%, well above ASTM minimum.'),
             ($1, $3, 'Excellent results. Please upload full stress-strain curve for Godrej Aerospace review.')`,
          [createdId, userMap['Rahul Kumar'], userMap['Priya Verma']]
        );
      } else if (task.code === 'TASK-2026-0002') {
        await pool.query(
          `INSERT INTO task_comments (task_id, user_id, comment)
           VALUES ($1, $2, 'Vacuum pump seal inspected. Pressure reached 45 mbar. Chill-vent cleaned and ready for trial casting.')`,
          [createdId, userMap['Pooja Mehta']]
        );
      }
    }
  }

  console.log(`
======================================================
✅ Aulten Digital / TaskFlow CRM Seed Complete!
   Organization:   Aulten Digital Private Limited (${orgId})
   Departments:    12
   Employees:      18
   Clients (OEM):  7
   Projects:       7
   Tasks Seeded:   52
   Demo Password:  ${demoPassword}
   Demo Accounts:
     - Super Admin: aarav.sharma@example.com (VP of Engineering)
     - Admin:       priya.verma@example.com (Head of QA)
     - Manager:     sneha.gupta@example.com (DevOps & Cloud Lead)
     - Employee:    rahul.kumar@example.com (Senior Full Stack Developer)
======================================================
`);

  return { orgId };
}

if (require.main === module) {
  seedDatabase()
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exitCode = 1;
    })
    .finally(() => closeDatabasePool());
}

module.exports = { seedDatabase };
