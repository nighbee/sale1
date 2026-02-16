import { create } from 'zustand';
import type { Integration } from '../types';

interface IntegrationState {
  integrations: Integration[];
  setIntegrations: (integrations: Integration[]) => void;
}

export const useIntegrationStore = create<IntegrationState>((set) => ({
  integrations: [],
  setIntegrations: (integrations) => set({ integrations }),
}));
