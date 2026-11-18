import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, Kanban, Flag, CalendarDays, Users, Settings, Link2, Archive, Navigation } from 'lucide-react';
import { api, errorMessage } from '../../api/client';
import { keys } from '../../api/hooks';
import { useToast } from '../../context/ToastContext';

// Menu proyek untuk sidebar dan kartu proyek di Home. "Archive" menyembunyikan proyek
// dari daftar aktif (hanya Owner) dan dapat dibatalkan lewat Undo atau dari Settings.
export function useProjectMenu() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  const setArchived = async (p, on) => {
    try {
      await api.post(`/projects/${p.id}/archive`, { archive: on });
      await qc.invalidateQueries({ queryKey: keys.projects });
      return true;
    } catch (e) {
      toast(errorMessage(e), 'error');
      return false;
    }
  };

  return (p) => {
    const go = (to) => () => navigate(`/projects/${p.id}/${to}`);
    const isOwner = p.role?.isOwner;
    return [
      { label: 'Open overview', icon: LayoutGrid, onSelect: go('overview') },
      {
        label: 'Go to',
        icon: Navigation,
        submenu: [
          { label: 'Tasks', icon: Kanban, onSelect: go('tasks') },
          { label: 'Milestones', icon: Flag, onSelect: go('milestones') },
          { label: 'Meetings', icon: CalendarDays, onSelect: go('meetings') },
          { label: 'Members', icon: Users, onSelect: go('members') },
        ],
      },
      {
        label: 'Copy link',
        icon: Link2,
        onSelect: () => {
          navigator.clipboard?.writeText(`${window.location.origin}/projects/${p.id}/overview`);
          toast('Tautan proyek disalin');
        },
      },
      { separator: true },
      { label: 'Project settings', icon: Settings, onSelect: go('settings') },
      {
        label: 'Archive (hide)',
        icon: Archive,
        disabled: !isOwner,
        hint: 'Hanya Owner yang dapat mengarsipkan proyek.',
        onSelect: async () => {
          if (!(await setArchived(p, true))) return;
          if (window.location.pathname.startsWith(`/projects/${p.id}`)) navigate('/');
          toast(`"${p.name}" diarsipkan`, 'success', {
            action: { label: 'Undo', onClick: () => setArchived(p, false) },
          });
        },
      },
    ];
  };
}
