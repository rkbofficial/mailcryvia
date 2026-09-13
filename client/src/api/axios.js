import axios from 'axios';

const apiOrigin = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:4000' : '');

const api = axios.create({
  baseURL: `${apiOrigin.replace(/\/$/, '')}/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    if (error.response?.status === 401 && !url.includes('/auth/session')) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;