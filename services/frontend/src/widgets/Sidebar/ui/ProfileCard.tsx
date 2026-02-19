import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUserStore } from '@entities/user';
import { useLogout } from '@features/auth/logout';
import Modal from '@shared/ui/Modal';
import Button from '@shared/ui/Button';

const ProfileCard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useUserStore();
  const { logout, isLoading } = useLogout();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!user) return null;

  const initials = user.first_name?.charAt(0) || user.email?.charAt(0) || 'U';
  const fullName = user.full_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;

  return (
    <>
      <div className="flex flex-col gap-4 p-4 mt-auto border-t border-white/10">
        <div className="flex items-center gap-3 group">
          <button
            onClick={() => navigate('/profile')}
            className="flex items-center gap-3 flex-1 min-w-0 hover:bg-white/5 p-1 rounded-lg transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full border-2 border-primary bg-primary/20 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {fullName}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {user.email}
              </p>
            </div>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
            title={t('auth.log_out')}
          >
            <span className="material-icons text-xl">logout</span>
          </button>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('auth.logout_confirm_title')}
        maxWidth="md"
      >
        <div className="space-y-6">
          <p>
            {t('auth.logout_confirm_message')}
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={isLoading}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={logout}
              isLoading={isLoading}
              className="min-w-[100px]"
            >
              {t('auth.log_out')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default ProfileCard;
