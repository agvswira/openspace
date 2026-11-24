// Mode demo untuk landing page: aplikasi yang sama dijalankan di bawah /demo (di dalam iframe)
// dengan data contoh dari fixtures.json. Semua permintaan baca dijawab dari fixture tanpa
// menyentuh server, sedangkan semua perubahan ditolak, sehingga pengunjung hanya bisa melihat.

export const DEMO_BASE = '/demo';
export const IS_DEMO = typeof window !== 'undefined' && window.location.pathname.startsWith(DEMO_BASE);
export const DEMO_MESSAGE = 'Ini mode demo, jadi perubahan tidak disimpan. Masuk untuk mencoba Openspace sepenuhnya.';

// Tanggal saat fixture direkam. Semua tanggal digeser sejauh selisih hari ke hari ini,
// supaya Timeline, "hari ini", dan status terlambat tetap masuk akal kapan pun demo dibuka.
const CAPTURED_AT = Date.UTC(2026, 10, 18);
const DAY = 864e5;

// Kunci fixture = path + query terurut (sama dengan skrip perekam fixture).
export function fixtureKey(url, params = {}) {
  const path = url.split('?')[0];
  const q = Object.keys(params || {})
    .filter((k) => params[k] !== undefined && params[k] !== null)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return q ? `${path}?${q}` : path;
}

function shiftDates(raw, days) {
  if (!days) return JSON.parse(raw);
  return JSON.parse(raw, (_k, v) =>
    typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(v)
      ? new Date(Date.parse(v) + days * DAY).toISOString()
      : v,
  );
}

// Pencarian sederhana di atas data fixture, bentuknya sama dengan GET /search di backend.
function search(fx, q) {
  const needle = String(q || '')
    .trim()
    .toLowerCase();
  if (needle.length < 2) return { tasks: [], milestones: [], projects: [] };
  const has = (s) =>
    String(s || '')
      .toLowerCase()
      .includes(needle);
  const projects = fx['/projects?archived=false'] || [];
  const tasks = projects.flatMap((p) => fx[`/projects/${p.id}/tasks`] || []);
  const milestones = projects.flatMap((p) =>
    (fx[`/projects/${p.id}/milestones`] || []).map((m) => ({
      id: m.id,
      name: m.name,
      dueDate: m.dueDate,
      project: { id: p.id, name: p.name, color: p.color, icon: p.icon },
    })),
  );
  return {
    tasks: tasks.filter((t) => has(t.title) || has(t.description)).slice(0, 8),
    milestones: milestones.filter((m) => has(m.name)).slice(0, 5),
    projects: projects
      .filter((p) => has(p.name))
      .slice(0, 5)
      .map((p) => ({ id: p.id, name: p.name, color: p.color, icon: p.icon })),
  };
}

// Pasang adapter axios: GET dari fixture, selain itu ditolak dengan pesan demo.
export async function installDemo(api) {
  const { default: data } = await import('./fixtures.json');
  const today = new Date();
  const days = Math.round((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - CAPTURED_AT) / DAY);
  const fx = shiftDates(JSON.stringify(data), days);

  api.defaults.adapter = async (config) => {
    const respond = (status, body) => ({
      data: body,
      status,
      statusText: String(status),
      headers: {},
      config,
      request: {},
    });
    const fail = (status, message) => {
      const err = new Error(message);
      err.config = config;
      err.response = respond(status, { message });
      return Promise.reject(err);
    };
    // Sedikit jeda agar animasi memuat terasa seperti aplikasi sungguhan.
    await new Promise((r) => setTimeout(r, 120));
    if ((config.method || 'get').toLowerCase() !== 'get') return fail(403, DEMO_MESSAGE);
    if (config.url.startsWith('/search')) return respond(200, search(fx, config.params?.q));
    const key = fixtureKey(config.url, config.params);
    if (key in fx) return respond(200, fx[key]);
    return fail(404, 'Data ini tidak tersedia di mode demo.');
  };
}
