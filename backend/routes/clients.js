const express = require('express');
const { getPool } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const PIPELINE_STAGES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];

function createClientsRoutes({ poolProvider = getPool } = {}) {
  const router = express.Router();

  // Protect client CRM routes - Managers, Admins, Super Admins only
  router.use(requireAuth);
  router.use(requireRole(['super_admin', 'admin', 'manager']));

  router.get('/', async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const { stage, search, lead_owner_id } = req.query;

      const where = ['c.organization_id = $1'];
      const values = [orgId];
      let pIdx = 2;

      if (stage && PIPELINE_STAGES.includes(stage)) {
        where.push(`c.pipeline_stage = $${pIdx}`);
        values.push(stage);
        pIdx++;
      }

      if (lead_owner_id) {
        where.push(`c.lead_owner_id = $${pIdx}`);
        values.push(lead_owner_id);
        pIdx++;
      }

      if (search && search.trim()) {
        where.push(`(c.company_name ILIKE $${pIdx} OR c.contact_person ILIKE $${pIdx} OR c.email ILIKE $${pIdx})`);
        values.push(`%${search.trim()}%`);
        pIdx++;
      }

      const query = `
        SELECT 
          c.*,
          owner.full_name AS lead_owner_name,
          owner.avatar AS lead_owner_avatar,
          (SELECT COUNT(*) FROM projects p WHERE p.client_id = c.id) AS active_projects_count
        FROM clients c
        LEFT JOIN users owner ON c.lead_owner_id = owner.id
        WHERE ${where.join(' AND ')}
        ORDER BY c.created_at DESC
      `;

      const { rows } = await pool.query(query, values);

      // Pipeline summary counts
      const countsQuery = `
        SELECT 
          COUNT(*) AS total,
          SUM(deal_value) AS total_deal_value,
          COUNT(*) FILTER (WHERE pipeline_stage = 'New') AS stage_new,
          COUNT(*) FILTER (WHERE pipeline_stage = 'Contacted') AS stage_contacted,
          COUNT(*) FILTER (WHERE pipeline_stage = 'Qualified') AS stage_qualified,
          COUNT(*) FILTER (WHERE pipeline_stage = 'Proposal') AS stage_proposal,
          COUNT(*) FILTER (WHERE pipeline_stage = 'Negotiation') AS stage_negotiation,
          COUNT(*) FILTER (WHERE pipeline_stage = 'Won') AS stage_won,
          COUNT(*) FILTER (WHERE pipeline_stage = 'Lost') AS stage_lost
        FROM clients
        WHERE organization_id = $1
      `;
      const countsRes = await pool.query(countsQuery, [orgId]);

      return res.json({ clients: rows, summary: countsRes.rows[0] });
    } catch (err) {
      console.error('List clients error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch clients.' });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const clientId = req.params.id;

      const query = `
        SELECT c.*, owner.full_name AS lead_owner_name
        FROM clients c
        LEFT JOIN users owner ON c.lead_owner_id = owner.id
        WHERE c.id = $1 AND c.organization_id = $2
      `;
      const { rows } = await pool.query(query, [clientId, orgId]);
      if (rows.length === 0) return res.status(404).json({ error: 'Client not found.' });

      // Fetch client projects
      const projectsRes = await pool.query(
        'SELECT id, name, status, health, budget FROM projects WHERE client_id = $1',
        [clientId]
      );

      return res.json({ client: rows[0], projects: projectsRes.rows });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch client details.' });
    }
  });

  router.post('/', async (req, res) => {
    const {
      company_name,
      contact_person,
      email,
      phone,
      lead_source = 'Direct',
      lead_owner_id,
      pipeline_stage = 'New',
      follow_up_date,
      next_action,
      deal_value = 0,
      notes,
    } = req.body || {};

    if (!company_name || !contact_person || !email) {
      return res.status(400).json({ error: 'Company name, contact person, and email are required.' });
    }

    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;

      const { rows } = await pool.query(
        `INSERT INTO clients (
           organization_id, company_name, contact_person, email, phone, lead_source,
           lead_owner_id, pipeline_stage, follow_up_date, next_action, deal_value, notes
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          orgId,
          company_name.trim(),
          contact_person.trim(),
          email.trim().toLowerCase(),
          phone || null,
          lead_source,
          lead_owner_id || req.user.id,
          PIPELINE_STAGES.includes(pipeline_stage) ? pipeline_stage : 'New',
          follow_up_date || null,
          next_action || null,
          Number(deal_value) || 0,
          notes || null,
        ]
      );

      await logAudit(pool, {
        organizationId: orgId,
        userId: req.user.id,
        actorName: req.user.full_name,
        action: 'CREATE_CLIENT',
        entityType: 'client',
        entityId: rows[0].id,
        details: { company: rows[0].company_name },
        ipAddress: req.ip,
      });

      return res.status(201).json({ message: 'Client created successfully.', client: rows[0] });
    } catch (err) {
      console.error('Create client error:', err.message);
      return res.status(500).json({ error: 'Failed to create client.' });
    }
  });

  router.put('/:id', async (req, res) => {
    const clientId = req.params.id;
    const {
      company_name,
      contact_person,
      email,
      phone,
      lead_source,
      lead_owner_id,
      pipeline_stage,
      follow_up_date,
      next_action,
      deal_value,
      notes,
    } = req.body || {};

    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;

      const { rows } = await pool.query(
        `UPDATE clients SET
           company_name = COALESCE($1, company_name),
           contact_person = COALESCE($2, contact_person),
           email = COALESCE($3, email),
           phone = $4,
           lead_source = COALESCE($5, lead_source),
           lead_owner_id = $6,
           pipeline_stage = COALESCE($7, pipeline_stage),
           follow_up_date = $8,
           next_action = $9,
           deal_value = COALESCE($10, deal_value),
           notes = $11,
           updated_at = now()
         WHERE id = $12 AND organization_id = $13
         RETURNING *`,
        [
          company_name ? company_name.trim() : null,
          contact_person ? contact_person.trim() : null,
          email ? email.trim().toLowerCase() : null,
          phone !== undefined ? phone : null,
          lead_source || null,
          lead_owner_id !== undefined ? (lead_owner_id || null) : null,
          pipeline_stage && PIPELINE_STAGES.includes(pipeline_stage) ? pipeline_stage : null,
          follow_up_date !== undefined ? (follow_up_date || null) : null,
          next_action !== undefined ? next_action : null,
          deal_value !== undefined ? Number(deal_value) : null,
          notes !== undefined ? notes : null,
          clientId,
          orgId,
        ]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Client not found.' });

      await logAudit(pool, {
        organizationId: orgId,
        userId: req.user.id,
        actorName: req.user.full_name,
        action: 'UPDATE_CLIENT',
        entityType: 'client',
        entityId: clientId,
        details: { company: rows[0].company_name, stage: rows[0].pipeline_stage },
        ipAddress: req.ip,
      });

      return res.json({ message: 'Client updated.', client: rows[0] });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update client.' });
    }
  });

  return router;
}

module.exports = { createClientsRoutes };
