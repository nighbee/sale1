import { api } from "@shared/api/base";
import type { Call, CallTranscript, CallAnalysis } from './types';

export const callApi = {
  listCalls: (params?: unknown) => api.get<{ calls: Call[]; total?: number }>('/calls', { params }),
  getCall: (id: string) => api.get<Call>(`/calls/${id}`),
  getTranscript: (id: string) => api.get<CallTranscript>(`/calls/${id}/transcript`),
  getAnalysis: (id: string) => api.get<CallAnalysis>(`/calls/${id}/analysis`),
};
