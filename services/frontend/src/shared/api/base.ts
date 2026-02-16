import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';

const client: AxiosInstance = axios.create({
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

export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) => client.get<T>(url, config),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => client.post<T>(url, data, config),
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => client.put<T>(url, data, config),
  delete: <T>(url: string, config?: AxiosRequestConfig) => client.delete<T>(url, config),
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => client.patch<T>(url, data, config),
};

export default client;
