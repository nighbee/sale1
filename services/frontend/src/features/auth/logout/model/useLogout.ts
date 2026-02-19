import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useUserStore } from '@entities/user';

export const useLogout = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const logout = useUserStore((state) => state.logout);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await logout();
      toast.success(t('auth.logout_success'));
    } catch {
      toast.error(t('auth.logout_failed'));
    } finally {
      setIsLoading(false);
      navigate('/login');
    }
  };

  return {
    logout: handleLogout,
    isLoading,
  };
};
