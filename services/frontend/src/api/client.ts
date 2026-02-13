import axios from 'axios';

const client = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add JWT token to requests
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  register: (data: any) => client.post('/auth/register', data),
  login: (data: any) => client.post('/auth/login', data),
};

export const companyApi = {
  updateSettings: (id: string, data: any) => client.put(`/companies/${id}/settings`, data),
  getCompany: (id: string) => client.get(`/companies/${id}`),
};

export const userApi = {
  invite: (data: any) => client.post('/users/invite', data),
  listUsers: () => client.get('/users'),
};

export const scriptApi = {
  upload: (formData: FormData) => client.post('/scripts', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
};

export const teamApi = {
  create: (data: any) => client.post('/teams', data),
  list: () => client.get('/teams'),
  get: (id: string) => client.get(`/teams/${id}`),
  update: (id: string, data: any) => client.put(`/teams/${id}`, data),
  delete: (id: string) => client.delete(`/teams/${id}`),
};

export const integrationApi = {
  save: (data: any) => client.post('/integrations', data),
  list: () => client.get('/integrations'),
  get: (type: string) => client.get(`/integrations/${type}`),
  delete: (type: string) => client.delete(`/integrations/${type}`),
};

export const callApi = {
  listCalls: (params: any) => client.get('/calls', { params }),
  getCall: (id: string) => client.get(`/calls/${id}`),
  getTranscript: (id: string) => client.get(`/calls/${id}/transcript`),
  getAnalysis: (id: string) => client.get(`/calls/${id}/analysis`),
};

export const analyticsApi = {
  getTeamPerformance: (period?: string) => client.get('/analytics/team-performance', { params: { period } }),
  getLeaderboard: () => client.get('/analytics/leaderboard'),
};

export default client;
