import React, { useState } from 'react';

const PIPELINE_STAGES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won'];

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
      c.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase());
    return matchStage && matchSearch;
  });

  const totalValue = Number(summary.total_deal_value || summary.totalPipelineValue || 174500000);
  const wonCount = summary.stage_won || summary.wonCount || clients.filter((c) => c.pipeline_stage === 'Won').length;

  return (
    <div className="crm-view">
      <div className="view-header">
        <div>
          <h2>OEM Clients & Heavy Industry Contracts</h2>
          <p>Automotive, aerospace, defense, and power sector enterprise client accounts</p>
        </div>
        {onCreateClient && (
          <button type="button" className="button button--primary" onClick={onCreateClient}>
            + Add Client Account
          </button>
        )}
      </div>

      <div className="crm-kpis">
        <div className="kpi-card">
          <span className="kpi-top">
            <span>Total Contract Value</span>
            <span className="kpi-icon kpi-icon--green">₹</span>
          </span>
          <strong>₹{(totalValue / 10000000).toFixed(2)} Cr</strong>
          <span className="kpi-note">{clients.length} OEM corporate accounts</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-top">
            <span>Active Won Contracts</span>
            <span className="kpi-icon kpi-icon--blue">✓</span>
          </span>
          <strong>{wonCount}</strong>
          <span className="kpi-note">Manufacturing under delivery</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-top">
            <span>In Negotiation / Proposal</span>
            <span className="kpi-icon kpi-icon--amber">⚡</span>
          </span>
          <strong>{clients.filter((c) => c.pipeline_stage === 'Negotiation' || c.pipeline_stage === 'Proposal').length}</strong>
          <span className="kpi-note">Strategic pipeline</span>
        </div>
      </div>

      <div className="crm-controls">
        <label className="filter-search">
          <span aria-hidden="true">🔍</span>
          <input
            type="search"
            placeholder="Search by OEM company, contact person, or email..."
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
            All Accounts ({clients.length})
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
            <p>No OEM client records match the current criteria.</p>
          </div>
        ) : (
          filteredClients.map((c) => {
            const isWon = c.pipeline_stage === 'Won';
            const isProposal = c.pipeline_stage === 'Proposal' || c.pipeline_stage === 'Negotiation';
            const badgeClass = isWon ? 'stage-pill--won' : (isProposal ? 'stage-pill--progress' : 'stage-pill--new');
            const contact = c.contact_person || c.contact_name || 'Account Lead';

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
                    <p className="client-contact">👤 {contact}</p>
                  </div>
                  <span className={`stage-pill ${badgeClass}`}>{c.pipeline_stage}</span>
                </div>

                <div className="client-details-grid">
                  <div><strong>Email:</strong> {c.email}</div>
                  <div><strong>Phone:</strong> {c.phone || '+91 20 6613 4000'}</div>
                  <div><strong>Sector:</strong> {c.lead_source || c.source || 'OEM Supply'}</div>
                  <div><strong>Contract Value:</strong> ₹{Number(c.deal_value || 0).toLocaleString('en-IN')}</div>
                </div>

                {(c.next_action || c.action_item) && (
                  <div className="client-action-box">
                    <span>Deliverable / Next Action:</span>
                    <p>{c.next_action || c.action_item}</p>
                    {(c.follow_up_date || c.next_follow_up_date) && (
                      <small>Due: {String(c.follow_up_date || c.next_follow_up_date).split('T')[0]}</small>
                    )}
                  </div>
                )}

                <div className="client-card-footer">
                  <span className="client-owner">Account Lead: <strong>{c.lead_owner_name || 'Rajesh Kumar'}</strong></span>
                  <span className="client-projects-count">📁 Active Deliverables</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedClient && (
        <div className="modal-backdrop" onClick={() => setSelectedClient(null)}>
          <div className="modal modal--emp-detail" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{selectedClient.company_name}</h3>
                <p>Primary Liaison: {selectedClient.contact_person || selectedClient.contact_name} ({selectedClient.email})</p>
              </div>
              <button type="button" className="close-button" onClick={() => setSelectedClient(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="emp-detail-grid">
                <div><strong>Contract Stage:</strong> {selectedClient.pipeline_stage}</div>
                <div><strong>Total Value:</strong> ₹{Number(selectedClient.deal_value || 0).toLocaleString('en-IN')}</div>
                <div><strong>Contact Phone:</strong> {selectedClient.phone || '+91 20 6613 4000'}</div>
                <div><strong>Account Lead:</strong> {selectedClient.lead_owner_name || 'Rajesh Kumar'}</div>
                <div><strong>Sector / Type:</strong> {selectedClient.lead_source || selectedClient.source}</div>
                <div><strong>Next Milestone:</strong> {selectedClient.follow_up_date || selectedClient.next_follow_up_date || '2026-11-15'}</div>
              </div>

              {(selectedClient.next_action || selectedClient.action_item) && (
                <div style={{ marginTop: '16px', padding: '12px', background: 'var(--surface-raised)', borderRadius: '6px' }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: '13px' }}>Next Scheduled Deliverable</h4>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
                    {selectedClient.next_action || selectedClient.action_item}
                  </p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="button button--secondary" onClick={() => setSelectedClient(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
