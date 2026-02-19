import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, UserCompany } from '../types';

interface UserState {
  user: User | null;
  isLogged: boolean;
  companies: UserCompany[];
  currentCompanyId: string | null;
  currentTeamId: string | null;
  setUser: (user: User | null) => void;
  setCompanies: (companies: UserCompany[]) => void;
  setCurrentCompany: (companyId: string) => void;
  setCurrentTeam: (teamId: string | null) => void;
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
      companies: [],
      currentCompanyId: localStorage.getItem('company_id'),
      currentTeamId: null,
      setUser: (user) => set({ user, isLogged: !!user }),
      setCompanies: (companies) => set({ companies }),
      setCurrentCompany: (companyId) => {
          localStorage.setItem('company_id', companyId);
          set({ currentCompanyId: companyId, currentTeamId: null });
          window.location.reload(); // Reload to refresh data for new company
      },
      setCurrentTeam: (teamId) => set({ currentTeamId: teamId }),
      logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('company_id');
        localStorage.removeItem('user_id');
        set({ user: null, isLogged: false, companies: [], currentCompanyId: null, currentTeamId: null });
      },
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
