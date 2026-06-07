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

// Interceptor to handle 401 Unauthorized errors
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user_id');
      // We don't use useUserStore.getState().logout() here to avoid circular dependencies
      // but we clear the local storage which will trigger logout state on next reload or store check
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) => client.get<T>(url, config),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => client.post<T>(url, data, config),
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => client.put<T>(url, data, config),
  delete: <T>(url: string, config?: AxiosRequestConfig) => client.delete<T>(url, config),
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => client.patch<T>(url, data, config),
};

export default client;
