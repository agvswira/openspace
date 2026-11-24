import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, tokenStore } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, workspace: null, loading: !!tokenStore.get() });
  const queryClient = useQueryClient();

  const loadMe = useCallback(async function load() {
    if (!tokenStore.get()) return setState({ user: null, workspace: null, loading: false });
    try {
      const { data } = await api.get('/auth/me');
      setState({ user: data.user, workspace: data.workspace, loading: false });
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 404) {
        tokenStore.clear();
        setState({ user: null, workspace: null, loading: false });
      } else {
        // API belum siap (misalnya baru dinyalakan): coba lagi tanpa mengeluarkan pengguna.
        setTimeout(load, 1500);
      }
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = useCallback(
    async (email, password) => {
      const { data } = await api.post('/auth/login', { email, password });
      tokenStore.set(data.token);
      await loadMe();
    },
    [loadMe],
  );

  const register = useCallback(
    async (payload) => {
      const { data } = await api.post('/auth/register', payload);
      tokenStore.set(data.token);
      await loadMe();
    },
    [loadMe],
  );

  const logout = useCallback(() => {
    tokenStore.clear();
    queryClient.clear();
    setState({ user: null, workspace: null, loading: false });
  }, [queryClient]);

  const value = useMemo(
    () => ({ ...state, login, register, logout, reload: loadMe }),
    [state, login, register, logout, loadMe],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
