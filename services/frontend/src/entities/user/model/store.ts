import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '../types';

interface UserState {
  user: User | null;
  isLogged: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
}

/**
 * Security Rules for Frontend State:
 * 1. Role-Based Access Control (RBAC): Always verify user roles on the backend for sensitive operations.
 * 2. Token Security: Consider using HttpOnly cookies for storing JWTs to mitigate XSS risks.
 * 3. Data Integrity: Validate and sanitize all user data before rendering to prevent DOM-based XSS.
 * 4. Resource Ownership: Ensure that API requests are scoped to the authenticated user's company_id on the backend.
 */

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
