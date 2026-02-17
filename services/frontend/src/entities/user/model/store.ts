import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '../types';

interface UserState {
  user: User | null;
  isLogged: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      isLogged: !!localStorage.getItem('token'),
      setUser: (user) => set({ user, isLogged: !!user }),
      logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('company_id');
        localStorage.removeItem('user_id');
        set({ user: null, isLogged: false });
      },
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
