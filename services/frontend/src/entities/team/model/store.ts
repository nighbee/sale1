import { create } from 'zustand';
import type { Team } from '../types';

interface TeamState {
  teams: Team[];
  currentTeam: Team | null;
  setTeams: (teams: Team[]) => void;
  setCurrentTeam: (team: Team | null) => void;
}

export const useTeamStore = create<TeamState>((set) => ({
  teams: [],
  currentTeam: null,
  setTeams: (teams) => set({ teams }),
  setCurrentTeam: (team) => set({ currentTeam: team }),
}));
