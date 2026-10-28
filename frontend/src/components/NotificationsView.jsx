import React, { useState } from 'react';

export default function NotificationsView({
  notifications = [],
  onMarkRead,
  onMarkAllRead,
  onSelectNotification,
}) {
  const [filter, setFilter] = useState('all');

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.is_read;
    return true;
  });

  return (
    <div className="notifications-view">
      <div className="view-header">
        <div>
          <h2>Plant Dispatch & Shift Alerts</h2>
          <p>Machinery telemetry alarms, metrology sign-offs, and critical safety notifications</p>
        </div>
        {unreadCount > 0 && onMarkAllRead && (
          <button type="button" className="button button--secondary" onClick={onMarkAllRead}>
            ✓ Mark All as Read ({unreadCount})
          </button>
        )}
      </div>

      <div className="notifications-tabs">
        <button
          type="button"
          className={`tab-btn${filter === 'all' ? ' is-active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All Alerts ({notifications.length})
        </button>
        <button
          type="button"
          className={`tab-btn${filter === 'unread' ? ' is-active' : ''}`}
          onClick={() => setFilter('unread')}
        >
          Unread ({unreadCount})
        </button>
      </div>

      <div className="notifications-list">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <p>You're all caught up! No active alarms or unread alerts.</p>
          </div>
        ) : (
          filtered.map((notif) => {
            const isUnread = !notif.is_read;
            const typeIcon =
              notif.type === 'urgent' ? '🚨' :
              notif.type === 'warning' ? '⚠️' :
              notif.type === 'success' ? '✅' :
              notif.type === 'assignment' ? '📋' : '🔔';

            return (
              <div
                key={notif.id}
                className={`notification-card${isUnread ? ' notification-card--unread' : ''}`}
                onClick={() => {
                  if (isUnread && onMarkRead) onMarkRead(notif.id);
                  if (onSelectNotification) onSelectNotification(notif);
                }}
              >
                <span className="notif-icon">{typeIcon}</span>
                <div className="notif-content">
                  <div className="notif-top">
                    <h4>{notif.title}</h4>
                    <span className="notif-date">
                      {new Date(notif.created_at).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p>{notif.message}</p>
                </div>
                {isUnread && (
                  <span className="unread-dot" title="Unread" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
