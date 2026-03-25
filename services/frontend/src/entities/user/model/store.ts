import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { userApi } from '../api';
import type { User } from '../types';

interface UserState {
  user: User | null;
  isLogged: boolean;
  currentTeamId: string | null;
  setUser: (user: User | null) => void;
  setCurrentTeam: (teamId: string | null) => void;
  logout: () => Promise<void>;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      isLogged: !!localStorage.getItem('token'),
      currentTeamId: null,
      setUser: (user) => set({ user, isLogged: !!user }),
      setCurrentTeam: (teamId) => set({ currentTeamId: teamId }),
      logout: async () => {
        try {
          await userApi.logout();
        } finally {
          localStorage.removeItem('token');
          localStorage.removeItem('user_id');
          set({
            user: null,
            isLogged: false,
            currentTeamId: null,
          });
        }
      },
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
