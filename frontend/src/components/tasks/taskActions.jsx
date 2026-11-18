import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ExternalLink,
  Pencil,
  CircleDot,
  Flag,
  UserPlus,
  UserMinus,
  Copy,
  Link2,
  EyeOff,
  Trash2,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { api, errorMessage, tokenStore } from '../../api/client';
import { projectTaskKeys } from '../../api/hooks';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../ui';
import { PRIORITY, STATUS, STATUS_ORDER } from '../../lib/status';
import { useCan } from './TaskDetailPanel';
import TaskFormModal from './TaskFormModal';

const UNDO_MS = 6000;

// Preferensi tampilan per proyek disimpan di perangkat (bukan di server).
function useStoredState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? initial : JSON.parse(raw);
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (next) =>
      setValue((prev) => {
        const v = typeof next === 'function' ? next(prev) : next;
        try {
          localStorage.setItem(key, JSON.stringify(v));
        } catch {
          /* abaikan: preferensi hanya berlaku selama sesi */
        }
        return v;
      }),
    [key],
  );
  return [value, set];
}

// Alasan sebuah tugas tidak boleh dihapus (aturan yang sama dengan backend, dicek lebih awal).
export function deleteBlocker(task) {
  if (task.dependents?.length)
    return `Tugas ini menjadi prasyarat bagi: ${task.dependents.map((d) => d.title).join(', ')}. Hapus hubungan prasyarat terlebih dahulu.`;
  if (task.fromMeeting)
    return `Tugas ini berasal dari action item rapat "${task.fromMeeting.title}" dan tidak dapat dihapus langsung.`;
  return null;
}

/**
 * Aksi tugas yang dipakai bersama oleh menu klik kanan, tombol "...", dan aksi massal:
 * buka, edit, ubah status/prioritas, ambil/lepas tugas, duplikat, salin tautan,
 * sembunyikan dari tampilan, dan hapus dengan Undo.
 */
export function useTaskActions(projectId, { onOpen } = {}) {
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const can = useCan(projectId);
  const [editing, setEditing] = useState(null);
  const [rejected, setRejected] = useState(null);
  const [hiddenIds, setHiddenIds] = useStoredState(`openspace-hidden-${projectId}`, []);
  const [hideDone, setHideDone] = useStoredState(`openspace-hidedone-${projectId}`, false);
  const [pending, setPending] = useState([]); // id tugas yang menunggu dihapus (masih bisa Undo)
  const timers = useRef(new Map());

  const refresh = useCallback(
    () => Promise.all(projectTaskKeys(projectId).map((queryKey) => qc.invalidateQueries({ queryKey }))),
    [qc, projectId],
  );
  const fail = (title) => (e) => setRejected({ title, message: errorMessage(e) });

  // ---- Hapus dengan Undo: tugas disembunyikan dulu, request DELETE dikirim setelah 6 detik ----
  const commitDelete = useCallback(
    async (ids) => {
      ids.forEach((id) => timers.current.delete(id));
      const results = await Promise.allSettled(ids.map((id) => api.delete(`/tasks/${id}`)));
      const failed = results.filter((r) => r.status === 'rejected');
      setPending((p) => p.filter((id) => !ids.includes(id)));
      await refresh();
      if (failed.length) setRejected({ title: 'Tugas tidak dapat dihapus', message: errorMessage(failed[0].reason) });
    },
    [refresh],
  );

  const scheduleDelete = useCallback(
    (tasks) => {
      const blocked = tasks.map(deleteBlocker).find(Boolean);
      if (blocked) return setRejected({ title: 'Tugas tidak dapat dihapus', message: blocked });
      const ids = tasks.map((t) => t.id);
      setPending((p) => [...p, ...ids]);
      const timer = setTimeout(() => commitDelete(ids), UNDO_MS);
      ids.forEach((id) => timers.current.set(id, timer));
      toast(tasks.length === 1 ? `"${tasks[0].title}" dihapus` : `${tasks.length} tugas dihapus`, 'success', {
        duration: UNDO_MS,
        action: {
          label: 'Undo',
          onClick: () => {
            clearTimeout(timer);
            ids.forEach((id) => timers.current.delete(id));
            setPending((p) => p.filter((id) => !ids.includes(id)));
            toast('Penghapusan dibatalkan');
          },
        },
      });
      return undefined;
    },
    [commitDelete, toast],
  );

  // Saat halaman ditinggalkan, penghapusan yang tertunda langsung dijalankan.
  useEffect(() => {
    const map = timers.current;
    const flush = () => {
      const ids = [...map.keys()];
      ids.forEach((id) =>
        fetch(`/api/tasks/${id}`, {
          method: 'DELETE',
          keepalive: true,
          headers: { Authorization: `Bearer ${tokenStore.get()}` },
        }),
      );
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      const ids = [...map.keys()];
      map.forEach((t) => clearTimeout(t));
      map.clear();
      if (ids.length) Promise.allSettled(ids.map((id) => api.delete(`/tasks/${id}`))).then(refresh);
    };
  }, [refresh]);

  // ---- Perubahan langsung ----
  const patch = (task, body, msg, title = 'Perubahan ditolak') =>
    api
      .patch(`/tasks/${task.id}`, body)
      .then(() => refresh())
      .then(() => msg && toast(msg))
      .catch(fail(title));

  const setStatusMany = async (tasks, status) => {
    const results = await Promise.allSettled(tasks.map((t) => api.patch(`/tasks/${t.id}`, { status })));
    await refresh();
    const failed = results.filter((r) => r.status === 'rejected');
    const ok = results.length - failed.length;
    if (ok) toast(`${ok} tugas dipindah ke ${STATUS[status].label}`);
    if (failed.length)
      setRejected({
        title: `${failed.length} tugas tidak dapat diubah`,
        message: errorMessage(failed[0].reason),
      });
  };

  const duplicate = async (task) => {
    try {
      const { data: copy } = await api.post(`/projects/${projectId}/tasks`, {
        title: `${task.title} (copy)`.slice(0, 140),
        description: task.description,
        status: 'TODO',
        priority: task.priority,
        startDate: task.startDate,
        dueDate: task.dueDate,
        milestoneId: task.milestone?.id ?? null,
        assigneeIds: task.assignees.map((a) => a.id),
      });
      // Prasyarat ikut disalin bila diizinkan; kegagalan tidak membatalkan duplikasi.
      if (can('MANAGE_DEPENDENCIES'))
        await Promise.allSettled(
          task.prerequisites.map((p) => api.post(`/tasks/${copy.id}/prerequisites`, { prerequisiteId: p.id })),
        );
      await refresh();
      toast('Tugas diduplikasi', 'success', { action: { label: 'Open', onClick: () => onOpen?.(copy.id) } });
    } catch (e) {
      fail('Tugas tidak dapat diduplikasi')(e);
    }
  };

  const hide = (tasks) => {
    const ids = tasks.map((t) => t.id);
    setHiddenIds((h) => [...new Set([...h, ...ids])]);
    toast(tasks.length === 1 ? 'Tugas disembunyikan dari tampilan' : `${tasks.length} tugas disembunyikan`, 'success', {
      action: { label: 'Undo', onClick: () => setHiddenIds((h) => h.filter((id) => !ids.includes(id))) },
    });
  };

  // ---- Isi menu untuk satu tugas ----
  const itemsFor = (task) => {
    const isAssignee = task.assignees.some((a) => a.id === user.id);
    const canEditAll = can('EDIT_ALL_TASKS');
    const canStatus = canEditAll || (isAssignee && can('OWN_TASKS'));
    const noEdit = 'Role Anda tidak memiliki izin Edit all tasks.';
    return [
      { label: 'Open details', icon: ExternalLink, onSelect: () => onOpen?.(task.id), shortcut: 'Enter' },
      { label: 'Edit task…', icon: Pencil, disabled: !canEditAll, hint: noEdit, onSelect: () => setEditing(task) },
      { separator: true },
      {
        label: 'Status',
        icon: CircleDot,
        disabled: !canStatus,
        hint: 'Anda hanya dapat mengubah status tugas milik Anda.',
        submenu: STATUS_ORDER.map((s) => ({
          label: STATUS[s].label,
          icon: STATUS[s].Icon,
          checked: task.status === s,
          onSelect: () =>
            task.status !== s && patch(task, { status: s }, `Status: ${STATUS[s].label}`, 'Status tidak dapat diubah'),
        })),
      },
      {
        label: 'Priority',
        icon: Flag,
        disabled: !canEditAll,
        hint: noEdit,
        submenu: Object.entries(PRIORITY).map(([k, p]) => ({
          label: p.label,
          checked: task.priority === k,
          onSelect: () => task.priority !== k && patch(task, { priority: k }, `Prioritas: ${p.label}`),
        })),
      },
      isAssignee
        ? {
            label: 'Unassign me',
            icon: UserMinus,
            disabled: !canEditAll,
            hint: noEdit,
            onSelect: () =>
              patch(task, { assigneeIds: task.assignees.filter((a) => a.id !== user.id).map((a) => a.id) }, 'Anda dilepas dari tugas'),
          }
        : {
            label: 'Assign to me',
            icon: UserPlus,
            disabled: !canEditAll,
            hint: noEdit,
            onSelect: () =>
              patch(task, { assigneeIds: [...task.assignees.map((a) => a.id), user.id] }, 'Tugas ditugaskan ke Anda'),
          },
      { separator: true },
      {
        label: 'Duplicate',
        icon: Copy,
        disabled: !can('CREATE_TASKS'),
        hint: 'Role Anda tidak memiliki izin Create tasks.',
        onSelect: () => duplicate(task),
      },
      {
        label: 'Copy link',
        icon: Link2,
        onSelect: () => {
          navigator.clipboard?.writeText(`${window.location.origin}/projects/${projectId}/tasks?task=${task.id}`);
          toast('Tautan disalin');
        },
      },
      { label: 'Hide from view', icon: EyeOff, onSelect: () => hide([task]) },
      { separator: true },
      {
        label: 'Delete task',
        icon: Trash2,
        danger: true,
        disabled: !canEditAll,
        hint: noEdit,
        shortcut: 'Del',
        onSelect: () => scheduleDelete([task]),
      },
    ];
  };

  // Daftar yang ditampilkan: tanpa tugas yang disembunyikan atau menunggu dihapus.
  const filterVisible = (list) =>
    list.filter((t) => !pending.includes(t.id) && !hiddenIds.includes(t.id) && !(hideDone && t.status === 'DONE'));

  const dialogs = (
    <>
      {editing && <TaskFormModal projectId={projectId} task={editing} onClose={() => setEditing(null)} />}
      {rejected && (
        <ConfirmDialog title={rejected.title} message={rejected.message} onClose={() => setRejected(null)} />
      )}
    </>
  );

  return {
    itemsFor,
    dialogs,
    filterVisible,
    hiddenIds,
    showHidden: () => setHiddenIds([]),
    hideDone,
    setHideDone,
    hide,
    rename: (task, title) =>
      title.trim() && title.trim() !== task.title
        ? patch(task, { title: title.trim() }, 'Judul diperbarui', 'Judul tidak dapat diubah')
        : Promise.resolve(),
    setStatusMany,
    // Timeline: geser/ubah durasi bar dan tarik garis prasyarat.
    setDates: (task, body) => patch(task, body, 'Jadwal diperbarui', 'Jadwal tidak dapat diubah'),
    link: (prerequisite, task) =>
      api
        .post(`/tasks/${task.id}/prerequisites`, { prerequisiteId: prerequisite.id })
        .then(() => refresh())
        .then(() =>
          toast(`"${task.title}" sekarang menunggu "${prerequisite.title}"`, 'success', {
            action: {
              label: 'Undo',
              onClick: () => api.delete(`/tasks/${task.id}/prerequisites/${prerequisite.id}`).then(refresh),
            },
          }),
        )
        .catch(fail('Prasyarat tidak dapat ditambahkan')),
    unlink: (task, prerequisite) =>
      api
        .delete(`/tasks/${task.id}/prerequisites/${prerequisite.id}`)
        .then(() => refresh())
        .then(() => toast('Hubungan prasyarat dihapus'))
        .catch(fail('Prasyarat tidak dapat dihapus')),
    canLink: can('MANAGE_DEPENDENCIES'),
    deleteMany: scheduleDelete,
    canEditAll: can('EDIT_ALL_TASKS'),
  };
}
