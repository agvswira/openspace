import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

// Kunci cache React Query. Semua tampilan tugas membaca kunci ['tasks', projectId] yang sama.
export const keys = {
  projects: ['projects'],
  project: (id) => ['project', id],
  overview: (id) => ['overview', id],
  tasks: (id) => ['tasks', id],
  task: (id) => ['task', id],
  comments: (id) => ['comments', id],
  links: (id) => ['links', id],
  members: (id) => ['members', id],
  roles: (id) => ['roles', id],
  milestones: (id) => ['milestones', id],
  milestone: (id) => ['milestone', id],
  meetings: (id) => ['meetings', id],
  myTasks: (s) => ['myTasks', s],
  summary: ['summary'],
  notifications: ['notifications'],
  permissions: ['permissions'],
};

const get = (url, params) => api.get(url, { params }).then((r) => r.data);

export const useProjects = (archived = false) =>
  useQuery({ queryKey: [...keys.projects, archived], queryFn: () => get('/projects', { archived }) });
export const useProject = (id) =>
  useQuery({ queryKey: keys.project(id), queryFn: () => get(`/projects/${id}`), enabled: !!id });
export const useOverview = (id) =>
  useQuery({ queryKey: keys.overview(id), queryFn: () => get(`/projects/${id}/overview`), enabled: !!id });
export const useTasks = (id) =>
  useQuery({ queryKey: keys.tasks(id), queryFn: () => get(`/projects/${id}/tasks`), enabled: !!id });
export const useTask = (id) => useQuery({ queryKey: keys.task(id), queryFn: () => get(`/tasks/${id}`), enabled: !!id });
export const useComments = (id) =>
  useQuery({ queryKey: keys.comments(id), queryFn: () => get(`/tasks/${id}/comments`), enabled: !!id });
export const useLinks = (id) =>
  useQuery({ queryKey: keys.links(id), queryFn: () => get(`/tasks/${id}/links`), enabled: !!id });
export const useMembers = (id) =>
  useQuery({ queryKey: keys.members(id), queryFn: () => get(`/projects/${id}/members`), enabled: !!id });
export const useRoles = (id) =>
  useQuery({ queryKey: keys.roles(id), queryFn: () => get(`/projects/${id}/roles`), enabled: !!id });
export const usePermissionCatalog = (id) =>
  useQuery({
    queryKey: keys.permissions,
    queryFn: () => get(`/projects/${id}/permissions`),
    enabled: !!id,
    staleTime: Infinity,
  });
export const useMilestones = (id) =>
  useQuery({ queryKey: keys.milestones(id), queryFn: () => get(`/projects/${id}/milestones`), enabled: !!id });
export const useMilestone = (id) =>
  useQuery({ queryKey: keys.milestone(id), queryFn: () => get(`/milestones/${id}`), enabled: !!id });
export const useMeetings = (id) =>
  useQuery({ queryKey: keys.meetings(id), queryFn: () => get(`/projects/${id}/meetings`), enabled: !!id });
export const useMyTasks = (status = 'open') =>
  useQuery({ queryKey: keys.myTasks(status), queryFn: () => get('/me/tasks', { status }) });
export const useSummary = () => useQuery({ queryKey: keys.summary, queryFn: () => get('/me/summary') });
export const useNotifications = () =>
  useQuery({ queryKey: keys.notifications, queryFn: () => get('/notifications'), refetchInterval: 30000 });

/**
 * Mutasi generik: setelah berhasil, cache terkait proyek di-invalidate sehingga
 * Board, List, Calendar, Timeline, Overview, dan Milestone ikut diperbarui.
 */
export function useApiMutation(fn, { invalidate = [], onSuccess } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (data, vars) => {
      const list = typeof invalidate === 'function' ? invalidate(data, vars) : invalidate;
      await Promise.all(list.map((queryKey) => qc.invalidateQueries({ queryKey })));
      onSuccess?.(data, vars);
    },
  });
}

// Kunci yang terdampak bila data tugas sebuah proyek berubah.
export const projectTaskKeys = (projectId) => [
  keys.tasks(projectId),
  keys.overview(projectId),
  keys.milestones(projectId),
  keys.meetings(projectId),
  keys.members(projectId),
  keys.projects,
  ['myTasks'],
  keys.summary,
  ['task'],
  ['milestone'],
];
