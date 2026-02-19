import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useUserStore } from '@entities/user';

export const useLogout = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const logout = useUserStore((state) => state.logout);

  const handleLogout = async () => {
    await logout();
    toast.success(t('auth.logout_success'));
    navigate('/login');
  };

  return {
    logout: handleLogout,
  };
};
