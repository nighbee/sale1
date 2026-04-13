import { api } from '../../shared/api/base';
import type { Call, CallTranscript, CallAnalysis, ListCallsResponse } from './types';

export const callApi = {
  listCalls: (params?: unknown) => api.get<ListCallsResponse>('/calls', { params }),
  listAllCalls: (params?: unknown) => api.get<{ calls: Call[]; total: number }>('/admin/calls', { params }),
  getCall: (id: string) => api.get<Call>(`/calls/${id}`),
  getTranscript: (id: string) => api.get<CallTranscript>(`/calls/${id}/transcript`),
  getAnalysis: (id: string) => api.get<CallAnalysis>(`/calls/${id}/analysis`),
  getAudio: (id: string) => api.get<Blob>(`/calls/${id}/audio`, { responseType: 'blob' }),
  reprocess: (id: string) => api.post(`/calls/${id}/reprocess`),

  // Queue Management
  getQueueStatus: () => api.get<{ paused: boolean; length: number }>('/calls/queue/status'),
  bulkReprocess: (data: { date_from: string; date_to: string }) => api.post('/calls/queue/bulk-reprocess', data),
  clearQueue: () => api.delete('/calls/queue'),
  stopQueue: () => api.post('/calls/queue/stop'),
  resumeQueue: () => api.post('/calls/queue/resume'),
  listQueueItems: () => api.get<{ items: any[] }>('/calls/queue/items'),
  deleteQueueItem: (raw: string) => api.delete('/calls/queue/items', { data: { raw } }),
};
