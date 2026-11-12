// Aturan tugas Openspace (Tabel 2.6 laporan): penanda turunan, prasyarat, dan progres.

export function startOfToday(now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Terlambat: belum Done dan hari ini sudah melewati deadline. Tanpa deadline = tidak terlambat.
export function isOverdue(task, now = new Date()) {
  if (task.status === 'DONE' || !task.dueDate) return false;
  return new Date(task.dueDate) < startOfToday(now);
}

// Terhambat: masih ada prasyarat yang belum Done.
export function waitingFor(task) {
  return (task.prerequisites || []).map((p) => p.prerequisite).filter((pre) => pre && pre.status !== 'DONE');
}

export function isBlocked(task) {
  return waitingFor(task).length > 0;
}

// Progres = (jumlah tugas Done / seluruh tugas) x 100%, bobot setiap tugas sama.
export function progressOf(tasks) {
  const total = tasks.length;
  if (total === 0) return { total: 0, done: 0, percent: null };
  const done = tasks.filter((t) => t.status === 'DONE').length;
  return { total, done, percent: Math.round((done / total) * 100) };
}

/**
 * Prasyarat diperiksa sebagai graf berarah: sisi task -> prerequisite.
 * Menambah sisi (taskId -> prerequisiteId) membentuk siklus jika dari
 * prerequisiteId sudah ada jalur kembali ke taskId. Jalur dicari dengan DFS.
 * Mengembalikan jalur siklus (array id) atau null.
 */
export function findCyclePath(edges, taskId, prerequisiteId) {
  const graph = new Map();
  for (const e of edges) {
    if (!graph.has(e.taskId)) graph.set(e.taskId, []);
    graph.get(e.taskId).push(e.prerequisiteId);
  }

  const visited = new Set();
  const path = [];

  function dfs(node) {
    if (node === taskId) return true;
    if (visited.has(node)) return false;
    visited.add(node);
    path.push(node);
    for (const next of graph.get(node) || []) {
      if (dfs(next)) return true;
    }
    path.pop();
    return false;
  }

  return dfs(prerequisiteId) ? [taskId, ...path, taskId] : null;
}
