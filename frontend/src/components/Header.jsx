import React from 'react';

export default function Header({ taskCount, overdueCount }) {
  return (
    <header className="header" role="banner">
      <div className="container">
        <div className="header__inner">
          <div className="header__title-group">
            <div className="header__icon" aria-hidden="true">📋</div>
            <div>
              <h1 className="header__title">Employee Task Dashboard</h1>
              <p className="header__subtitle">
                Unified view of CRM &amp; Helpdesk tasks — sorted by priority
              </p>
            </div>
          </div>
          <span className="header__mock-badge" title="These are mock integrations — not real external APIs">
            ⚠️ Mock Integration
          </span>
        </div>
      </div>
    </header>
  );
}
