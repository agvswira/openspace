import axios from 'axios';

const TOKEN_KEY = 'openspace.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const api = axios.create({ baseURL: '/api' });

// Setiap request membawa JWT di header Authorization.
api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Sesi berakhir (401) -> hapus token dan kembali ke halaman login.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && tokenStore.get() && !error.config.url.startsWith('/auth/')) {
      tokenStore.clear();
      window.location.assign('/signin');
    }
    return Promise.reject(error);
  },
);

// Pesan galat dari backend ditampilkan apa adanya agar pengguna tahu alasan penolakan.
export function errorMessage(error) {
  return error?.response?.data?.message || error?.message || 'Terjadi kesalahan.';
}
