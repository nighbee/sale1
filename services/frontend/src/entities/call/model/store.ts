import { create } from 'zustand';
import type { Call } from '../types';

interface CallState {
  calls: Call[];
  currentCall: Call | null;
  setCalls: (calls: Call[]) => void;
  setCurrentCall: (call: Call | null) => void;
}

export const useCallStore = create<CallState>((set) => ({
  calls: [],
  currentCall: null,
  setCalls: (calls) => set({ calls }),
  setCurrentCall: (call) => set({ currentCall: call }),
}));
