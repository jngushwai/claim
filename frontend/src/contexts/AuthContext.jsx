import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('dit_token');
    const savedUser = localStorage.getItem('dit_user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      api.get('/auth/me')
        .then(res => {
          localStorage.setItem('dit_user', JSON.stringify(res.data));
          setUser(res.data);
        })
        .catch(() => {});
    }
    setLoading(false);
  }, []);

  const tryRequest = async (fn, retries = 2) => {
    for (let i = 0; i <= retries; i++) {
      try { return await fn(); }
      catch (err) {
        const status = err.response?.status;
        if (i < retries && (!status || status >= 500)) {
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        throw err;
      }
    }
  };

  const saveSession = (data) => {
    localStorage.setItem('dit_token', data.token);
    localStorage.setItem('dit_user', JSON.stringify(data.user));
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setUser(data.user);
    return data;
  };

  const login = async (email, password) => {
    const res = await tryRequest(() => api.post('/auth/login', { email, password }));
    return saveSession(res.data);
  };

  const register = async (name, email, password) => {
    const res = await tryRequest(() => api.post('/auth/register', { name, email, password }));
    return saveSession(res.data);
  };

  const loginWithGoogle = async (credential) => {
    const res = await tryRequest(() => api.post('/auth/google', { credential }));
    return saveSession(res.data);
  };

  const updateUser = (partial) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      localStorage.setItem('dit_user', JSON.stringify(next));
      return next;
    });
  };

  const logout = () => {
    localStorage.removeItem('dit_token');
    localStorage.removeItem('dit_user');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, loginWithGoogle, updateUser, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
