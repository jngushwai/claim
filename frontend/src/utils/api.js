import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('dit_token');
      localStorage.removeItem('dit_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
