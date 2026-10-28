const { getPool, closeDatabasePool } = require('../db/pool');
const { hashPassword } = require('../utils/auth');

async function seedDatabase({ pool = getPool(), demoPassword = process.env.DEMO_PASSWORD || 'TaskFlowDemo@2026!' } = {}) {
  console.log('Seeding Aulten Digital TaskFlow CRM demo data...');

  const passwordHash = await hashPassword(demoPassword);

  // 1. Ensure Organization
  const orgSlug = 'aulten-digital';
  let orgRes = await pool.query('SELECT id FROM organizations WHERE slug = $1', [orgSlug]);
  let orgId;
  if (orgRes.rows.length === 0) {
    const newOrg = await pool.query(
      `INSERT INTO organizations (name, slug)
       VALUES ('Aulten Digital', $1)
       RETURNING id`,
      [orgSlug]
    );
    orgId = newOrg.rows[0].id;
  } else {
    orgId = orgRes.rows[0].id;
  }

  // 2. Departments
  const departmentsData = [
    { name: 'Engineering', code: 'ENG', description: 'Core software architecture and full-stack development.' },
    { name: 'Web Development', code: 'WEB', description: 'Modern responsive web applications and portals.' },
    { name: 'Mobile Development', code: 'MOB', description: 'iOS and Android native and cross-platform apps.' },
    { name: 'UI/UX Design', code: 'DES', description: 'User research, wireframing, and interactive design systems.' },
    { name: 'QA and Testing', code: 'QA', description: 'Manual testing, automated regression, and load testing.' },
    { name: 'DevOps and Cloud', code: 'OPS', description: 'CI/CD pipelines, container orchestration, and AWS/GCP cloud.' },
    { name: 'Cybersecurity', code: 'SEC', description: 'Penetration testing, compliance, and threat mitigation.' },
    { name: 'Sales and Business Development', code: 'SAL', description: 'Enterprise client acquisition and partnerships.' },
    { name: 'Digital Marketing', code: 'MKT', description: 'SEO, performance marketing, and digital branding.' },
    { name: 'Human Resources', code: 'HR', description: 'Talent recruitment, culture, and employee welfare.' },
    { name: 'Operations', code: 'OPS2', description: 'Corporate logistics, IT infrastructure, and facilities.' },
    { name: 'Customer Support', code: 'SUP', description: '24/7 client helpdesk, SLA tracking, and ticket resolution.' },
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

  // 3. Indian Employees
  const employeesData = [
    {
      name: 'Aarav Sharma',
      email: 'aarav.sharma@example.com',
      empId: 'AD-0101',
      crmRole: 'super_admin',
      coreRole: 'owner',
      dept: 'Engineering',
      designation: 'Chief Technology Officer (CTO)',
      phone: '+91 98101 23456',
    },
    {
      name: 'Priya Verma',
      email: 'priya.verma@example.com',
      empId: 'AD-0102',
      crmRole: 'admin',
      coreRole: 'admin',
      dept: 'Engineering',
      designation: 'Director of Engineering',
      phone: '+91 98102 34567',
    },
    {
      name: 'Sneha Gupta',
      email: 'sneha.gupta@example.com',
      empId: 'AD-0103',
      crmRole: 'manager',
      coreRole: 'member',
      dept: 'Web Development',
      designation: 'Engineering Manager - Web',
      phone: '+91 98103 45678',
    },
    {
      name: 'Arjun Singh',
      email: 'arjun.singh@example.com',
      empId: 'AD-0104',
      crmRole: 'manager',
      coreRole: 'member',
      dept: 'DevOps and Cloud',
      designation: 'DevOps & Cloud Lead',
      phone: '+91 98104 56789',
    },
    {
      name: 'Neha Mishra',
      email: 'neha.mishra@example.com',
      empId: 'AD-0105',
      crmRole: 'manager',
      coreRole: 'member',
      dept: 'UI/UX Design',
      designation: 'Head of Product Design',
      phone: '+91 98105 67890',
    },
    {
      name: 'Rohan Patel',
      email: 'rohan.patel@example.com',
      empId: 'AD-0106',
      crmRole: 'manager',
      coreRole: 'member',
      dept: 'QA and Testing',
      designation: 'Lead QA Engineer',
      phone: '+91 98106 78901',
    },
    {
      name: 'Vivek Yadav',
      email: 'vivek.yadav@example.com',
      empId: 'AD-0107',
      crmRole: 'manager',
      coreRole: 'member',
      dept: 'Sales and Business Development',
      designation: 'Sales & CRM Director',
      phone: '+91 98107 89012',
    },
    {
      name: 'Rahul Kumar',
      email: 'rahul.kumar@example.com',
      empId: 'AD-0108',
      crmRole: 'employee',
      coreRole: 'member',
      dept: 'Engineering',
      designation: 'Senior Full-Stack Developer',
      phone: '+91 98108 90123',
    },
    {
      name: 'Ananya Das',
      email: 'ananya.das@example.com',
      empId: 'AD-0109',
      crmRole: 'employee',
      coreRole: 'member',
      dept: 'Web Development',
      designation: 'Frontend Engineer (React)',
      phone: '+91 98109 01234',
    },
    {
      name: 'Pooja Mehta',
      email: 'pooja.mehta@example.com',
      empId: 'AD-0110',
      crmRole: 'employee',
      coreRole: 'member',
      dept: 'Engineering',
      designation: 'Backend Developer (Node.js/PostgreSQL)',
      phone: '+91 98110 12345',
    },
    {
      name: 'Aditya Joshi',
      email: 'aditya.joshi@example.com',
      empId: 'AD-0111',
      crmRole: 'employee',
      coreRole: 'member',
      dept: 'DevOps and Cloud',
      designation: 'DevOps Engineer (Kubernetes/AWS)',
      phone: '+91 98111 23456',
    },
    {
      name: 'Kavya Nair',
      email: 'kavya.nair@example.com',
      empId: 'AD-0112',
      crmRole: 'employee',
      coreRole: 'member',
      dept: 'UI/UX Design',
      designation: 'Senior UI/UX Designer',
      phone: '+91 98112 34567',
    },
    {
      name: 'Amit Sinha',
      email: 'amit.sinha@example.com',
      empId: 'AD-0113',
      crmRole: 'employee',
      coreRole: 'member',
      dept: 'Cybersecurity',
      designation: 'Cybersecurity Analyst',
      phone: '+91 98113 45678',
    },
    {
      name: 'Shreya Iyer',
      email: 'shreya.iyer@example.com',
      empId: 'AD-0114',
      crmRole: 'employee',
      coreRole: 'member',
      dept: 'QA and Testing',
      designation: 'QA Automation Engineer (Playwright)',
      phone: '+91 98114 56789',
    },
    {
      name: 'Karan Malhotra',
      email: 'karan.malhotra@example.com',
      empId: 'AD-0115',
      crmRole: 'employee',
      coreRole: 'member',
      dept: 'Mobile Development',
      designation: 'Mobile Engineer (React Native)',
      phone: '+91 98115 67890',
    },
    {
      name: 'Divya Pillai',
      email: 'divya.pillai@example.com',
      empId: 'AD-0116',
      crmRole: 'employee',
      coreRole: 'member',
      dept: 'Digital Marketing',
      designation: 'Digital Marketing Specialist',
      phone: '+91 98116 78901',
    },
    {
      name: 'Manish Tiwari',
      email: 'manish.tiwari@example.com',
      empId: 'AD-0117',
      crmRole: 'employee',
      coreRole: 'member',
      dept: 'Customer Support',
      designation: 'Customer Success Specialist',
      phone: '+91 98117 89012',
    },
    {
      name: 'Ritu Agarwal',
      email: 'ritu.agarwal@example.com',
      empId: 'AD-0118',
      crmRole: 'admin',
      coreRole: 'admin',
      dept: 'Human Resources',
      designation: 'HR & People Operations Lead',
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
  await pool.query('UPDATE departments SET head_id = $1 WHERE id = $2', [userMap['Priya Verma'], deptMap['Engineering']]);
  await pool.query('UPDATE departments SET head_id = $1 WHERE id = $2', [userMap['Sneha Gupta'], deptMap['Web Development']]);
  await pool.query('UPDATE departments SET head_id = $1 WHERE id = $2', [userMap['Arjun Singh'], deptMap['DevOps and Cloud']]);
  await pool.query('UPDATE departments SET head_id = $1 WHERE id = $2', [userMap['Neha Mishra'], deptMap['UI/UX Design']]);
  await pool.query('UPDATE departments SET head_id = $1 WHERE id = $2', [userMap['Rohan Patel'], deptMap['QA and Testing']]);
  await pool.query('UPDATE departments SET head_id = $1 WHERE id = $2', [userMap['Vivek Yadav'], deptMap['Sales and Business Development']]);
  await pool.query('UPDATE departments SET head_id = $1 WHERE id = $2', [userMap['Ritu Agarwal'], deptMap['Human Resources']]);

  // 4. Clients (CRM)
  const clientsData = [
    {
      company: 'Tata Consultancy Systems',
      contact: 'Rajesh Gupta',
      email: 'rajesh.gupta@example-tata.test',
      phone: '+91 22 6778 1234',
      stage: 'Won',
      value: 1250000,
      source: 'Referral',
      owner: userMap['Vivek Yadav'],
      action: 'Quarterly architecture review',
      date: '2026-11-15',
    },
    {
      company: 'Reliance Retail Innovations',
      contact: 'Meera Kapoor',
      email: 'meera.k@example-reliance.test',
      phone: '+91 22 2490 5678',
      stage: 'Proposal',
      value: 2800000,
      source: 'Direct',
      owner: userMap['Vivek Yadav'],
      action: 'Submit microservices migration proposal',
      date: '2026-11-04',
    },
    {
      company: 'Infosys FinTech Lab',
      contact: 'Suresh Nambiar',
      email: 'suresh.n@example-infosys.test',
      phone: '+91 80 2852 9012',
      stage: 'Negotiation',
      value: 1950000,
      source: 'Partner',
      owner: userMap['Vivek Yadav'],
      action: 'Finalize SLA and security audit terms',
      date: '2026-11-08',
    },
    {
      company: 'Mahindra Logistics Tech',
      contact: 'Sunita Rao',
      email: 'sunita.rao@example-mahindra.test',
      phone: '+91 22 2844 3456',
      stage: 'Won',
      value: 850000,
      source: 'Website',
      owner: userMap['Vivek Yadav'],
      action: 'Sprint 3 demo presentation',
      date: '2026-11-10',
    },
    {
      company: 'Bharti Airtel Enterprise',
      contact: 'Vikram Sethi',
      email: 'vikram.sethi@example-airtel.test',
      phone: '+91 11 4166 7890',
      stage: 'Qualified',
      value: 1400000,
      source: 'LinkedIn',
      owner: userMap['Vivek Yadav'],
      action: 'Schedule technical discovery call',
      date: '2026-11-12',
    },
    {
      company: 'Flipkart Commerce Cloud',
      contact: 'Deepak Reddy',
      email: 'deepak.r@example-flipkart.test',
      phone: '+91 80 4900 1122',
      stage: 'Won',
      value: 3200000,
      source: 'Referral',
      owner: userMap['Vivek Yadav'],
      action: 'Review peak season load testing reports',
      date: '2026-11-02',
    },
    {
      company: 'Zomato Hyperlocal Delivery',
      contact: 'Ankit Bansal',
      email: 'ankit.b@example-zomato.test',
      phone: '+91 124 456 7890',
      stage: 'Contacted',
      value: 650000,
      source: 'Direct',
      owner: userMap['Vivek Yadav'],
      action: 'Follow up on developer dashboard demo',
      date: '2026-11-06',
    },
  ];

  const clientMap = {};
  for (const c of clientsData) {
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
  }

  // 5. Projects
  const projectsData = [
    {
      name: 'Corporate Website Revamp',
      desc: 'Next.js 15 redesign for high conversion and core web vitals.',
      client: clientMap['Tata Consultancy Systems'],
      owner: userMap['Sneha Gupta'],
      status: 'active',
      health: 'good',
      budget: 650000,
      start: '2026-09-01',
      end: '2026-12-15',
    },
    {
      name: 'Client CRM Portal',
      desc: 'Custom multi-tenant enterprise portal with secure role-based access.',
      client: clientMap['Infosys FinTech Lab'],
      owner: userMap['Priya Verma'],
      status: 'active',
      health: 'good',
      budget: 1450000,
      start: '2026-08-15',
      end: '2026-12-31',
    },
    {
      name: 'E-commerce Platform',
      desc: 'High-throughput catalog and checkout services with Redis caching.',
      client: clientMap['Flipkart Commerce Cloud'],
      owner: userMap['Rahul Kumar'],
      status: 'active',
      health: 'at_risk',
      budget: 2200000,
      start: '2026-07-01',
      end: '2026-11-30',
    },
    {
      name: 'Employee Dashboard',
      desc: 'Internal TaskFlow CRM dashboard for team tracking and workload analytics.',
      client: clientMap['Mahindra Logistics Tech'],
      owner: userMap['Aarav Sharma'],
      status: 'active',
      health: 'good',
      budget: 450000,
      start: '2026-10-01',
      end: '2026-11-20',
    },
    {
      name: 'Cloud Migration',
      desc: 'Lift and shift legacy servers to automated AWS Kubernetes clusters.',
      client: clientMap['Reliance Retail Innovations'],
      owner: userMap['Arjun Singh'],
      status: 'active',
      health: 'good',
      budget: 1800000,
      start: '2026-09-15',
      end: '2027-01-31',
    },
    {
      name: 'Security Assessment',
      desc: 'SOC2 Type II and ISO 27001 vulnerability audit and remediation.',
      client: clientMap['Tata Consultancy Systems'],
      owner: userMap['Amit Sinha'],
      status: 'active',
      health: 'good',
      budget: 750000,
      start: '2026-10-10',
      end: '2026-11-25',
    },
    {
      name: 'Mobile App Release',
      desc: 'React Native v0.78 client app with biometric login and push alerts.',
      client: clientMap['Zomato Hyperlocal Delivery'],
      owner: userMap['Karan Malhotra'],
      status: 'planning',
      health: 'good',
      budget: 950000,
      start: '2026-11-01',
      end: '2027-02-28',
    },
  ];

  const projectMap = {};
  for (const p of projectsData) {
    const res = await pool.query(
      `INSERT INTO projects (
         organization_id, name, description, client_id, owner_id, status, health, budget, start_date, end_date
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, name`,
      [orgId, p.name, p.desc, p.client, p.owner, p.status, p.health, p.budget, p.start, p.end]
    );
    projectMap[p.name] = res.rows[0].id;
  }

  // 6. Realistic Tasks (52 tasks across all departments, statuses, priorities)
  const tasksData = [
    // Overdue tasks
    {
      code: 'TASK-2026-0001',
      title: 'Fix authentication session expiration',
      desc: 'Address token refresh race condition and configure HttpOnly SameSite cookies.',
      project: 'Client CRM Portal',
      dept: 'Engineering',
      status: 'in_progress',
      priority: 'urgent',
      due: '2026-10-24',
      est: 12,
      act: 8,
      pct: 65,
      tags: 'auth,security,cookies',
      creator: userMap['Priya Verma'],
      assignees: [userMap['Rahul Kumar'], userMap['Pooja Mehta']],
    },
    {
      code: 'TASK-2026-0002',
      title: 'Optimize PostgreSQL queries',
      desc: 'Add compound indexes on task filter columns and eliminate N+1 query patterns.',
      project: 'Client CRM Portal',
      dept: 'Engineering',
      status: 'blocked',
      priority: 'high',
      due: '2026-10-26',
      est: 8,
      act: 4,
      pct: 40,
      tags: 'database,performance,sql',
      blocked: 'Waiting for staging execution plan from DBA',
      creator: userMap['Aarav Sharma'],
      assignees: [userMap['Pooja Mehta']],
    },
    {
      code: 'TASK-2026-0003',
      title: 'Resolve staging deployment failure',
      desc: 'Fix docker build failure caused by upstream lightningcss dependency mismatch.',
      project: 'Cloud Migration',
      dept: 'DevOps and Cloud',
      status: 'todo',
      priority: 'urgent',
      due: '2026-10-27',
      est: 6,
      act: 2,
      pct: 20,
      tags: 'devops,docker,ci-cd',
      creator: userMap['Arjun Singh'],
      assignees: [userMap['Aditya Joshi']],
    },
    // Due Today tasks (current date is 2026-10-28)
    {
      code: 'TASK-2026-0004',
      title: 'Complete responsive dashboard layout',
      desc: 'Ensure seamless tablet sidebar collapsing and mobile touch targets.',
      project: 'Employee Dashboard',
      dept: 'Web Development',
      status: 'in_progress',
      priority: 'high',
      due: '2026-10-28',
      est: 16,
      act: 12,
      pct: 80,
      tags: 'frontend,responsive,ui',
      creator: userMap['Sneha Gupta'],
      assignees: [userMap['Ananya Das']],
    },
    {
      code: 'TASK-2026-0005',
      title: 'Review pull request for payment integration',
      desc: 'Audit Razorpay webhook signature verification and idempotent charge handling.',
      project: 'E-commerce Platform',
      dept: 'Engineering',
      status: 'in_review',
      priority: 'urgent',
      due: '2026-10-28',
      est: 4,
      act: 3,
      pct: 90,
      tags: 'payment,security,code-review',
      creator: userMap['Priya Verma'],
      assignees: [userMap['Rahul Kumar'], userMap['Amit Sinha']],
    },
    {
      code: 'TASK-2026-0006',
      title: 'Perform API security testing',
      desc: 'Run OWASP ZAP automated scan against all authenticated CRM endpoints.',
      project: 'Security Assessment',
      dept: 'Cybersecurity',
      status: 'in_progress',
      priority: 'high',
      due: '2026-10-28',
      est: 10,
      act: 7,
      pct: 70,
      tags: 'owasp,penetration-testing,api',
      creator: userMap['Amit Sinha'],
      assignees: [userMap['Amit Sinha']],
    },
    // Due soon (within 3 days: Oct 29 - Oct 31)
    {
      code: 'TASK-2026-0007',
      title: 'Prepare client project status report',
      desc: 'Compile sprint velocity, completed deliverables, and risks for Tata Consultancy.',
      project: 'Corporate Website Revamp',
      dept: 'Sales and Business Development',
      status: 'todo',
      priority: 'medium',
      due: '2026-10-29',
      est: 5,
      act: 0,
      pct: 0,
      tags: 'client,reporting,status',
      creator: userMap['Vivek Yadav'],
      assignees: [userMap['Vivek Yadav'], userMap['Sneha Gupta']],
    },
    {
      code: 'TASK-2026-0008',
      title: 'Test employee task assignment permissions',
      desc: 'Validate that Employees cannot reassign manager tasks or mutate audit logs.',
      project: 'Client CRM Portal',
      dept: 'QA and Testing',
      status: 'in_progress',
      priority: 'high',
      due: '2026-10-30',
      est: 8,
      act: 5,
      pct: 60,
      tags: 'qa,rbac,permissions',
      creator: userMap['Rohan Patel'],
      assignees: [userMap['Shreya Iyer']],
    },
    {
      code: 'TASK-2026-0009',
      title: 'Improve application loading performance',
      desc: 'Implement dynamic chunk splitting for heavy charting components.',
      project: 'Employee Dashboard',
      dept: 'Web Development',
      status: 'todo',
      priority: 'medium',
      due: '2026-10-31',
      est: 12,
      act: 2,
      pct: 15,
      tags: 'performance,vite,bundling',
      creator: userMap['Sneha Gupta'],
      assignees: [userMap['Ananya Das']],
    },
    {
      code: 'TASK-2026-0010',
      title: 'Complete QA regression testing',
      desc: 'Execute full Playwright E2E suite covering login, task creation, and status moves.',
      project: 'Client CRM Portal',
      dept: 'QA and Testing',
      status: 'todo',
      priority: 'high',
      due: '2026-10-31',
      est: 14,
      act: 0,
      pct: 0,
      tags: 'qa,e2e,regression',
      creator: userMap['Rohan Patel'],
      assignees: [userMap['Shreya Iyer'], userMap['Rohan Patel']],
    },
    // Future tasks (Nov 2026)
    {
      code: 'TASK-2026-0011',
      title: 'Setup Redis cluster for session caching',
      desc: 'Configure AWS ElastiCache cluster with multi-AZ failover.',
      project: 'Cloud Migration',
      dept: 'DevOps and Cloud',
      status: 'backlog',
      priority: 'medium',
      due: '2026-11-05',
      est: 16,
      act: 0,
      pct: 0,
      tags: 'redis,aws,cloud',
      creator: userMap['Arjun Singh'],
      assignees: [userMap['Aditya Joshi']],
    },
    {
      code: 'TASK-2026-0012',
      title: 'Design dark mode color tokens',
      desc: 'Deliver accessible WCAG AAA compliant slate dark palette in Figma.',
      project: 'Employee Dashboard',
      dept: 'UI/UX Design',
      status: 'in_progress',
      priority: 'medium',
      due: '2026-11-04',
      est: 10,
      act: 6,
      pct: 60,
      tags: 'design,dark-mode,accessibility',
      creator: userMap['Neha Mishra'],
      assignees: [userMap['Kavya Nair']],
    },
    {
      code: 'TASK-2026-0013',
      title: 'Implement biometric authentication in Mobile App',
      desc: 'Integrate FaceID and TouchID credentials storage in React Native Keychain.',
      project: 'Mobile App Release',
      dept: 'Mobile Development',
      status: 'todo',
      priority: 'high',
      due: '2026-11-12',
      est: 20,
      act: 0,
      pct: 0,
      tags: 'mobile,react-native,biometrics',
      creator: userMap['Priya Verma'],
      assignees: [userMap['Karan Malhotra']],
    },
    {
      code: 'TASK-2026-0014',
      title: 'Conduct Q4 employee performance reviews',
      desc: 'Distribute feedback forms and coordinate manager 1-on-1 interviews.',
      project: null,
      dept: 'Human Resources',
      status: 'in_progress',
      priority: 'medium',
      due: '2026-11-15',
      est: 24,
      act: 10,
      pct: 40,
      tags: 'hr,performance,reviews',
      creator: userMap['Ritu Agarwal'],
      assignees: [userMap['Ritu Agarwal']],
    },
    {
      code: 'TASK-2026-0015',
      title: 'Audit third-party npm dependencies for CVEs',
      desc: 'Review npm audit results and replace unmaintained packages.',
      project: 'Security Assessment',
      dept: 'Cybersecurity',
      status: 'todo',
      priority: 'high',
      due: '2026-11-06',
      est: 6,
      act: 0,
      pct: 0,
      tags: 'cve,audit,dependencies',
      creator: userMap['Amit Sinha'],
      assignees: [userMap['Amit Sinha']],
    },
    // Completed tasks
    {
      code: 'TASK-2026-0016',
      title: 'Design initial TaskFlow database schema',
      desc: 'Draft normalized PostgreSQL schema with organizations, users, and tasks.',
      project: 'Client CRM Portal',
      dept: 'Engineering',
      status: 'done',
      priority: 'high',
      due: '2026-10-20',
      est: 10,
      act: 9,
      pct: 100,
      tags: 'database,schema,postgres',
      creator: userMap['Aarav Sharma'],
      assignees: [userMap['Pooja Mehta']],
    },
    {
      code: 'TASK-2026-0017',
      title: 'Setup Vite React 19 frontend foundation',
      desc: 'Configure Vite build toolchain, Oxlint linter, and basic component directory.',
      project: 'Employee Dashboard',
      dept: 'Web Development',
      status: 'done',
      priority: 'medium',
      due: '2026-10-22',
      est: 8,
      act: 7,
      pct: 100,
      tags: 'react,vite,toolchain',
      creator: userMap['Sneha Gupta'],
      assignees: [userMap['Ananya Das']],
    },
    {
      code: 'TASK-2026-0018',
      title: 'Provision AWS staging Kubernetes cluster',
      desc: 'Deploy 3-node EKS cluster with managed VPC and ingress load balancer.',
      project: 'Cloud Migration',
      dept: 'DevOps and Cloud',
      status: 'done',
      priority: 'urgent',
      due: '2026-10-21',
      est: 16,
      act: 15,
      pct: 100,
      tags: 'kubernetes,aws,eks',
      creator: userMap['Arjun Singh'],
      assignees: [userMap['Arjun Singh'], userMap['Aditya Joshi']],
    },
    {
      code: 'TASK-2026-0019',
      title: 'Create corporate brand guidelines and assets',
      desc: 'Establish typography, color hierarchy, logo variants, and UI component badges.',
      project: 'Corporate Website Revamp',
      dept: 'UI/UX Design',
      status: 'done',
      priority: 'medium',
      due: '2026-10-18',
      est: 12,
      act: 11,
      pct: 100,
      tags: 'branding,design,assets',
      creator: userMap['Neha Mishra'],
      assignees: [userMap['Kavya Nair']],
    },
    {
      code: 'TASK-2026-0020',
      title: 'Setup automated Slack notifications for customer tickets',
      desc: 'Deploy webhook service to route urgent Zendesk tickets to support channel.',
      project: null,
      dept: 'Customer Support',
      status: 'done',
      priority: 'low',
      due: '2026-10-23',
      est: 4,
      act: 3,
      pct: 100,
      tags: 'support,slack,automation',
      creator: userMap['Manish Tiwari'],
      assignees: [userMap['Manish Tiwari']],
    },
  ];

  // Generate additional tasks up to 52 tasks total for comprehensive realistic volume
  const extraTaskTemplates = [
    { title: 'Refactor state management in dashboard filters', dept: 'Web Development', project: 'Employee Dashboard', priority: 'medium', status: 'in_progress', est: 8, pct: 45, tags: 'react,state' },
    { title: 'Integrate Indian GST tax calculations into checkout', dept: 'Engineering', project: 'E-commerce Platform', priority: 'high', status: 'todo', est: 12, pct: 0, tags: 'gst,finance' },
    { title: 'Create automated email notification templates', dept: 'Web Development', project: 'Client CRM Portal', priority: 'low', status: 'backlog', est: 6, pct: 0, tags: 'email,templates' },
    { title: 'Run cross-browser compatibility tests on Safari & Firefox', dept: 'QA and Testing', project: 'Corporate Website Revamp', priority: 'medium', status: 'in_progress', est: 8, pct: 50, tags: 'testing,browser' },
    { title: 'Configure GitHub Actions CI/CD matrix build for Node 22 and 24', dept: 'DevOps and Cloud', project: 'Cloud Migration', priority: 'medium', status: 'done', est: 5, pct: 100, tags: 'ci-cd,github' },
    { title: 'Implement rate limiting on public contact form', dept: 'Cybersecurity', project: 'Corporate Website Revamp', priority: 'high', status: 'done', est: 4, pct: 100, tags: 'security,rate-limit' },
    { title: 'Publish Diwali promotional campaign landing page', dept: 'Digital Marketing', project: 'Corporate Website Revamp', priority: 'urgent', status: 'in_review', est: 14, pct: 90, tags: 'marketing,campaign' },
    { title: 'Build export tasks to CSV and PDF report generator', dept: 'Engineering', project: 'Employee Dashboard', priority: 'high', status: 'done', est: 10, pct: 100, tags: 'reports,csv' },
    { title: 'Draft onboarding documentation for new engineering hires', dept: 'Human Resources', project: null, priority: 'low', status: 'done', est: 8, pct: 100, tags: 'hr,onboarding' },
    { title: 'Optimize mobile checkout funnel conversion metrics', dept: 'Mobile Development', project: 'E-commerce Platform', priority: 'high', status: 'in_progress', est: 16, pct: 35, tags: 'mobile,ux' },
    { title: 'Implement WebSocket live notifications connection', dept: 'Engineering', project: 'Client CRM Portal', priority: 'medium', status: 'backlog', est: 18, pct: 0, tags: 'realtime,websocket' },
    { title: 'Configure Cloudflare WAF bot management rules', dept: 'Cybersecurity', project: 'E-commerce Platform', priority: 'high', status: 'done', est: 6, pct: 100, tags: 'security,cloudflare' },
    { title: 'Conduct quarterly load test simulating 50,000 concurrent users', dept: 'QA and Testing', project: 'E-commerce Platform', priority: 'urgent', status: 'in_review', est: 20, pct: 85, tags: 'k6,load-test' },
    { title: 'Add kanban board drag and drop accessibility keyboard support', dept: 'UI/UX Design', project: 'Employee Dashboard', priority: 'medium', status: 'in_progress', est: 9, pct: 60, tags: 'a11y,kanban' },
    { title: 'Set up Prometheus and Grafana dashboards for Kubernetes cluster', dept: 'DevOps and Cloud', project: 'Cloud Migration', priority: 'high', status: 'done', est: 14, pct: 100, tags: 'monitoring,grafana' },
    { title: 'Customer feedback survey analysis for Q3 release', dept: 'Customer Support', project: null, priority: 'low', status: 'done', est: 6, pct: 100, tags: 'support,feedback' },
    { title: 'Implement multi-tenant database connection pooling', dept: 'Engineering', project: 'Client CRM Portal', priority: 'urgent', status: 'done', est: 12, pct: 100, tags: 'postgres,pgpool' },
    { title: 'Review legal terms and NDAs for Infosys partnership', dept: 'Sales and Business Development', project: null, priority: 'high', status: 'done', est: 4, pct: 100, tags: 'legal,sales' },
    { title: 'Mobile push notification deep-linking support', dept: 'Mobile Development', project: 'Mobile App Release', priority: 'medium', status: 'todo', est: 12, pct: 10, tags: 'mobile,deeplink' },
    { title: 'Add breadcrumb navigation and accessible skip links', dept: 'Web Development', project: 'Employee Dashboard', priority: 'low', status: 'done', est: 4, pct: 100, tags: 'a11y,ui' },
    { title: 'Verify SSL certificate automatic renewal with Let\'s Encrypt', dept: 'DevOps and Cloud', project: 'Cloud Migration', priority: 'medium', status: 'done', est: 3, pct: 100, tags: 'ssl,certbot' },
    { title: 'Create interactive client CRM pipeline dashboard view', dept: 'Engineering', project: 'Client CRM Portal', priority: 'high', status: 'in_progress', est: 14, pct: 75, tags: 'crm,sales' },
    { title: 'Benchmark Node.js 24 V8 performance with native scrypt hashing', dept: 'Engineering', project: 'Client CRM Portal', priority: 'low', status: 'done', est: 6, pct: 100, tags: 'node,scrypt' },
    { title: 'Conduct quarterly internal phishing simulation exercise', dept: 'Cybersecurity', project: 'Security Assessment', priority: 'medium', status: 'done', est: 8, pct: 100, tags: 'security,training' },
    { title: 'Implement search debouncing and keyboard shortcut Ctrl+K', dept: 'Web Development', project: 'Employee Dashboard', priority: 'medium', status: 'done', est: 5, pct: 100, tags: 'ui,shortcuts' },
    { title: 'Produce video walkthrough for Aulten TaskFlow employee portal', dept: 'Digital Marketing', project: 'Corporate Website Revamp', priority: 'low', status: 'todo', est: 16, pct: 0, tags: 'video,marketing' },
    { title: 'Update HR policy document regarding remote work equipment allowance', dept: 'Human Resources', project: null, priority: 'low', status: 'done', est: 4, pct: 100, tags: 'hr,policy' },
    { title: 'Implement automated task priority scoring algorithm', dept: 'Engineering', project: 'Employee Dashboard', priority: 'high', status: 'done', est: 8, pct: 100, tags: 'algorithm,priority' },
    { title: 'Clean up orphaned task assignments and foreign key cascades', dept: 'Engineering', project: 'Client CRM Portal', priority: 'medium', status: 'done', est: 4, pct: 100, tags: 'sql,cleanup' },
    { title: 'Conduct user acceptance testing (UAT) session with department heads', dept: 'QA and Testing', project: 'Employee Dashboard', priority: 'high', status: 'in_review', est: 10, pct: 90, tags: 'uat,qa' },
    { title: 'Create responsive SVG icon library for TaskFlow branding', dept: 'UI/UX Design', project: 'Corporate Website Revamp', priority: 'low', status: 'done', est: 7, pct: 100, tags: 'svg,design' },
    { title: 'Prepare production deployment runbook and rollback plan', dept: 'DevOps and Cloud', project: 'Cloud Migration', priority: 'urgent', status: 'done', est: 8, pct: 100, tags: 'deployment,runbook' },
  ];

  let taskCounter = 21;
  for (const tpl of extraTaskTemplates) {
    const code = `TASK-2026-${String(taskCounter).padStart(4, '0')}`;
    const daysOffset = (taskCounter % 15) - 5;
    const dueDate = new Date(Date.now() + daysOffset * 86400000).toISOString().split('T')[0];

    tasksData.push({
      code,
      title: tpl.title,
      desc: `${tpl.title} for Aulten Digital internal workflow.`,
      project: tpl.project,
      dept: tpl.dept,
      status: tpl.status,
      priority: tpl.priority,
      due: dueDate,
      est: tpl.est,
      act: Math.round(tpl.est * (tpl.pct / 100)),
      pct: tpl.pct,
      tags: tpl.tags,
      creator: userMap['Aarav Sharma'],
      assignees: [
        tpl.dept === 'Engineering' ? userMap['Rahul Kumar'] :
        tpl.dept === 'Web Development' ? userMap['Ananya Das'] :
        tpl.dept === 'QA and Testing' ? userMap['Shreya Iyer'] :
        tpl.dept === 'DevOps and Cloud' ? userMap['Aditya Joshi'] :
        tpl.dept === 'UI/UX Design' ? userMap['Kavya Nair'] :
        tpl.dept === 'Cybersecurity' ? userMap['Amit Sinha'] :
        tpl.dept === 'Mobile Development' ? userMap['Karan Malhotra'] :
        tpl.dept === 'Digital Marketing' ? userMap['Divya Pillai'] :
        tpl.dept === 'Customer Support' ? userMap['Manish Tiwari'] :
        userMap['Priya Verma'],
      ],
    });
    taskCounter++;
  }

  // Insert tasks & assignments
  for (const task of tasksData) {
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
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Development', $13, $14, $15, $16, $17, 'TaskFlow')
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
           ($1, $2, 'Investigated the token expiration: refresh token was race conditioning during simultaneous fetch calls.'),
           ($1, $3, 'Great catch! Added a shared in-flight refresh promise in axios/fetch wrapper. Verifying now.')`,
        [createdId, userMap['Rahul Kumar'], userMap['Pooja Mehta']]
      );
    } else if (task.code === 'TASK-2026-0002') {
      await pool.query(
        `INSERT INTO task_comments (task_id, user_id, comment)
         VALUES ($1, $2, 'Blocked on DBA index approval for production cluster. Temporary btree index created on staging.')`,
        [createdId, userMap['Pooja Mehta']]
      );
    } else if (task.code === 'TASK-2026-0004') {
      await pool.query(
        `INSERT INTO task_comments (task_id, user_id, comment)
         VALUES ($1, $2, 'Sidebar collapsing works smoothly with CSS transform and touch gestures tested on iPad Pro and Android.')`,
        [createdId, userMap['Ananya Das']]
      );
    }
  }

  // 7. Seed Initial Notifications
  const initialNotifications = [
    {
      userId: userMap['Rahul Kumar'],
      title: 'High Priority Task Assigned',
      message: 'Priya Verma assigned you to "Fix authentication session expiration" (TASK-2026-0001)',
      type: 'assignment',
    },
    {
      userId: userMap['Ananya Das'],
      title: 'Due Today Reminder',
      message: '"Complete responsive dashboard layout" (TASK-2026-0004) is scheduled for completion today.',
      type: 'due_date',
    },
    {
      userId: userMap['Priya Verma'],
      title: 'Pull Request Ready for Review',
      message: 'Rahul Kumar requested review for "Review pull request for payment integration"',
      type: 'status_change',
    },
    {
      userId: userMap['Aarav Sharma'],
      title: 'Security Audit Scan Scheduled',
      message: 'Amit Sinha scheduled OWASP API automated testing for this afternoon.',
      type: 'system',
    },
  ];

  for (const notif of initialNotifications) {
    await pool.query(
      `INSERT INTO notifications (organization_id, user_id, title, message, type)
       VALUES ($1, $2, $3, $4, $5)`,
      [orgId, notif.userId, notif.title, notif.message, notif.type]
    );
  }

  // 8. Seed Initial Audit Logs
  const initialAuditLogs = [
    {
      userId: userMap['Aarav Sharma'],
      name: 'Aarav Sharma',
      action: 'ORGANIZATION_INITIALIZED',
      entity: 'organization',
      details: { slug: 'aulten-digital', employeesCount: employeesData.length },
    },
    {
      userId: userMap['Priya Verma'],
      name: 'Priya Verma',
      action: 'CREATE_TASK',
      entity: 'task',
      details: { taskCode: 'TASK-2026-0001', priority: 'urgent' },
    },
    {
      userId: userMap['Vivek Yadav'],
      name: 'Vivek Yadav',
      action: 'CREATE_CLIENT',
      entity: 'client',
      details: { company: 'Tata Consultancy Systems', stage: 'Won' },
    },
    {
      userId: userMap['Arjun Singh'],
      name: 'Arjun Singh',
      action: 'CREATE_PROJECT',
      entity: 'project',
      details: { name: 'Cloud Migration', budget: 1800000 },
    },
  ];

  for (const log of initialAuditLogs) {
    await pool.query(
      `INSERT INTO audit_logs (organization_id, user_id, actor_name, action, entity_type, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [orgId, log.userId, log.name, log.action, log.entity, JSON.stringify(log.details)]
    );
  }

  console.log(`\n======================================================`);
  console.log(`✅ Aulten Digital TaskFlow CRM Seed Complete!`);
  console.log(`   Organization:   Aulten Digital (${orgId})`);
  console.log(`   Departments:    ${departmentsData.length}`);
  console.log(`   Employees:      ${employeesData.length}`);
  console.log(`   Clients (CRM):  ${clientsData.length}`);
  console.log(`   Projects:       ${projectsData.length}`);
  console.log(`   Tasks Seeded:   ${tasksData.length}`);
  console.log(`   Demo Password:  ${demoPassword}`);
  console.log(`   Demo Accounts:`);
  console.log(`     - Super Admin: aarav.sharma@example.com`);
  console.log(`     - Admin:       priya.verma@example.com`);
  console.log(`     - Manager:     sneha.gupta@example.com`);
  console.log(`     - Employee:    rahul.kumar@example.com`);
  console.log(`======================================================\n`);
}

if (require.main === module) {
  seedDatabase()
    .catch((err) => {
      console.error('Database seeding failed:', err.message);
      process.exitCode = 1;
    })
    .finally(() => closeDatabasePool());
}

module.exports = { seedDatabase };
