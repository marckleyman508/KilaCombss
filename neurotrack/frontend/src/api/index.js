import axios from 'axios';
import { getAccessToken, setAccessToken } from './tokenStore';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const isAuthEndpoint = original?.url?.startsWith('/auth/');
    if (err.response?.status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      try {
        const refreshed = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        setAccessToken(refreshed.data.accessToken);
        original.headers.Authorization = `Bearer ${refreshed.data.accessToken}`;
        return api(original);
      } catch (refreshErr) {
        setAccessToken(null);
        if (refreshErr.response?.status !== 429) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshErr);
      }
    } else if (err.response?.status === 401 || err.response?.status === 429) {
      setAccessToken(null);
      if (err.response?.status !== 429) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  refresh: () => api.post('/auth/refresh'),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

export const patientApi = {
  list: (params) => api.get('/patients', { params }),
  get: (id) => api.get(`/patients/${id}`),
  create: (data) => api.post('/patients', data),
  update: (id, data) => api.put(`/patients/${id}`, data),
  getTimeline: (id) => api.get(`/patients/${id}/timeline`),
  getProgress: (id) => api.get(`/patients/${id}/progress`),
  addProgress: (id, data) => api.post(`/patients/${id}/progress`, data),
  addMedication: (id, data) => api.post(`/patients/${id}/medications`, data),
  updateMedication: (id, medId, data) => api.put(`/patients/${id}/medications/${medId}`, data),
  addSurgery: (id, data) => api.post(`/patients/${id}/surgeries`, data),
};

export const analyticsApi = {
  overview: () => api.get('/analytics/overview'),
  cohortComparison: () => api.get('/analytics/cohort-comparison'),
  treatmentEffectiveness: () => api.get('/analytics/treatment-effectiveness'),
  riskFlags: () => api.get('/analytics/risk-flags'),
  patientProgress: (id) => api.get(`/analytics/patient/${id}/progress`),
};

export const researchApi = {
  list: (params) => api.get('/research', { params }),
  get: (id) => api.get(`/research/${id}`),
  create: (data) => api.post('/research', data),
  update: (id, data) => api.put(`/research/${id}`, data),
  delete: (id) => api.delete(`/research/${id}`),
  linkTreatment: (id, data) => api.post(`/research/${id}/link-treatment`, data),
};

export const treatmentApi = {
  list: (params) => api.get('/treatments', { params }),
  get: (id) => api.get(`/treatments/${id}`),
  create: (data) => api.post('/treatments', data),
};

export const searchApi = {
  search: (q) => api.get('/search', { params: { q } }),
};

export const aiApi = {
  cohortInsights:       ()             => api.get('/ai/cohort-insights'),
  trends:               (id, weeks)    => api.get(`/ai/patients/${id}/trends`, { params: { weeks } }),
  anomalies:            (id)           => api.get(`/ai/patients/${id}/anomalies`),
  summary:              (id)           => api.get(`/ai/patients/${id}/summary`),
  rehabEffectiveness:   (id)           => api.get(`/ai/patients/${id}/rehab-effectiveness`),
  researchMatch:        (id)           => api.get(`/ai/patients/${id}/research-match`),
};

export default api;
