import { useNavigate } from 'react-router-dom';
import { Bell, MessageSquare, UserPlus, Clock, CheckCheck } from 'lucide-react';
import { api } from '../../api/client';
import { keys, useApiMutation, useNotifications } from '../../api/hooks';
import { timeAgo } from '../../lib/format';
import { Menu } from '../ui';

const ICONS = { comment: MessageSquare, assign: UserPlus, deadline: Clock, invite: UserPlus };

// FR-17: penugasan, komentar baru, pengingat deadline, dan status undangan.
export default function NotificationsMenu({ trigger }) {
  const { data } = useNotifications();
  const navigate = useNavigate();
  const readAll = useApiMutation(() => api.post('/notifications/read-all'), { invalidate: [keys.notifications] });
  const readOne = useApiMutation((id) => api.post(`/notifications/${id}/read`), { invalidate: [keys.notifications] });
  const items = data?.items ?? [];

  return (
    <Menu width={360} trigger={({ toggle }) => trigger({ toggle, unread: data?.unread ?? 0 })}>
      <div className="row-between" style={{ padding: '8px 10px' }}>
        <strong className="sm">Notifications</strong>
        {data?.unread > 0 && (
          <button className="link xs" onClick={() => readAll.mutate()}>
            <CheckCheck size={12} /> Mark all read
          </button>
        )}
      </div>
      <div style={{ maxHeight: 380, overflow: 'auto' }}>
        {!items.length && (
          <div className="empty" style={{ padding: 24 }}>
            <Bell size={18} />
            <span className="sm">Belum ada notifikasi.</span>
          </div>
        )}
        {items.map((n) => {
          const Icon = ICONS[n.type] || Bell;
          return (
            <button
              key={n.id}
              className="menu-item"
              style={{
                height: 'auto',
                alignItems: 'flex-start',
                padding: 10,
                background: n.readAt ? undefined : 'var(--primary-soft)',
              }}
              onClick={() => {
                if (!n.readAt) readOne.mutate(n.id);
                if (n.link) navigate(n.link);
              }}
            >
              <Icon size={15} style={{ marginTop: 2, flexShrink: 0 }} className="faint" />
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="sm" style={{ display: 'block', fontWeight: 500 }}>
                  {n.title}
                </span>
                {n.body && (
                  <span className="xs muted" style={{ display: 'block' }}>
                    {n.body}
                  </span>
                )}
                <span className="xs faint">{timeAgo(n.createdAt)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Menu>
  );
}
