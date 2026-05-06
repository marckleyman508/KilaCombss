import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nt_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('nt_token');
      localStorage.removeItem('nt_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
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

export default api;
