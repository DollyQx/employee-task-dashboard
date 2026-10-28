import React, { useState } from 'react';

const PIPELINE_STAGES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];

export default function ClientsCrmView({
  clients = [],
  summary = {},
  onCreateClient,
}) {
  const [stageFilter, setStageFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);

  const filteredClients = clients.filter((c) => {
    const matchStage = stageFilter === 'all' || c.pipeline_stage === stageFilter;
    const matchSearch =
      !search ||
      c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.contact_person?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase());
    return matchStage && matchSearch;
  });

  const totalValue = Number(summary.total_deal_value || 0);

  return (
    <div className="crm-view">
      <div className="view-header">
        <div>
          <h2>Client CRM Pipeline</h2>
          <p>Indian & global enterprise accounts, deal stages, and account management</p>
        </div>
        {onCreateClient && (
          <button type="button" className="button button--primary" onClick={onCreateClient}>
            + Add Client Account
          </button>
        )}
      </div>

      <div className="crm-kpis">
        <div className="kpi-card">
          <span className="kpi-top"><span>Total Pipeline Value</span><span className="kpi-icon kpi-icon--green">₹</span></span>
          <strong>₹{totalValue.toLocaleString('en-IN')}</strong>
          <span className="kpi-note">{summary.total || clients.length} client accounts</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-top"><span>Won Deals</span><span className="kpi-icon kpi-icon--blue">✓</span></span>
          <strong>{summary.stage_won || 0}</strong>
          <span className="kpi-note">Active accounts</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-top"><span>In Negotiation / Proposal</span><span className="kpi-icon kpi-icon--amber">◷</span></span>
          <strong>{(parseInt(summary.stage_proposal || 0, 10)) + (parseInt(summary.stage_negotiation || 0, 10))}</strong>
          <span className="kpi-note">Active pipeline</span>
        </div>
      </div>

      <div className="crm-controls">
        <label className="filter-search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            placeholder="Search by company, contact person, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <div className="status-tabs scrollable">
          <button
            type="button"
            className={`tab-btn${stageFilter === 'all' ? ' is-active' : ''}`}
            onClick={() => setStageFilter('all')}
          >
            All ({clients.length})
          </button>
          {PIPELINE_STAGES.map((stage) => (
            <button
              key={stage}
              type="button"
              className={`tab-btn${stageFilter === stage ? ' is-active' : ''}`}
              onClick={() => setStageFilter(stage)}
            >
              {stage}
            </button>
          ))}
        </div>
      </div>

      <div className="clients-grid">
        {filteredClients.length === 0 ? (
          <div className="empty-state">
            <p>No client records match the current criteria.</p>
          </div>
        ) : (
          filteredClients.map((c) => {
            const isWon = c.pipeline_stage === 'Won';
            const isProposal = c.pipeline_stage === 'Proposal' || c.pipeline_stage === 'Negotiation';
            const badgeClass = isWon ? 'stage-pill--won' : (isProposal ? 'stage-pill--progress' : 'stage-pill--new');

            return (
              <div
                key={c.id}
                className="client-card"
                onClick={() => setSelectedClient(c)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedClient(c)}
              >
                <div className="client-card-top">
                  <div>
                    <h3>{c.company_name}</h3>
                    <p className="client-contact">👤 {c.contact_person}</p>
                  </div>
                  <span className={`stage-pill ${badgeClass}`}>{c.pipeline_stage}</span>
                </div>

                <div className="client-details-grid">
                  <div><strong>Email:</strong> {c.email}</div>
                  <div><strong>Phone:</strong> {c.phone || 'N/A'}</div>
                  <div><strong>Source:</strong> {c.lead_source || 'Direct'}</div>
                  <div><strong>Deal Value:</strong> ₹{Number(c.deal_value || 0).toLocaleString('en-IN')}</div>
                </div>

                {c.next_action && (
                  <div className="client-action-box">
                    <span>Next Action:</span>
                    <p>{c.next_action}</p>
                    {c.follow_up_date && <small>Due: {String(c.follow_up_date).split('T')[0]}</small>}
                  </div>
                )}

                <div className="client-card-footer">
                  <span className="client-owner">Lead Owner: <strong>{c.lead_owner_name || 'Assigned'}</strong></span>
                  <span className="client-projects-count">◫ {c.active_projects_count || 0} Projects</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedClient && (
        <div className="modal-overlay" onClick={() => setSelectedClient(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{selectedClient.company_name}</h3>
                <p>Contact: {selectedClient.contact_person} ({selectedClient.email})</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setSelectedClient(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div><strong>Pipeline Stage:</strong> {selectedClient.pipeline_stage}</div>
                <div><strong>Deal Value:</strong> ₹{Number(selectedClient.deal_value || 0).toLocaleString('en-IN')}</div>
                <div><strong>Phone:</strong> {selectedClient.phone || 'N/A'}</div>
                <div><strong>Lead Owner:</strong> {selectedClient.lead_owner_name || 'Assigned'}</div>
                <div><strong>Lead Source:</strong> {selectedClient.lead_source}</div>
                <div><strong>Follow-up Date:</strong> {selectedClient.follow_up_date ? String(selectedClient.follow_up_date).split('T')[0] : 'None scheduled'}</div>
              </div>

              {selectedClient.next_action && (
                <div className="detail-section">
                  <h4>Next Scheduled Action</h4>
                  <p>{selectedClient.next_action}</p>
                </div>
              )}

              {selectedClient.notes && (
                <div className="detail-section">
                  <h4>Account Notes & History</h4>
                  <p>{selectedClient.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
