import React from 'react';
import { useTranslation } from 'react-i18next';
import { useCallActions } from '../../../entities/call/model/hooks';
import Button from '../../../shared/ui/Button';
import { toast } from 'sonner';

interface ReprocessButtonProps {
  callId: string;
}

export const ReprocessButton: React.FC<ReprocessButtonProps> = ({ callId }) => {
  const { t } = useTranslation();
  const { reprocessCall, loading } = useCallActions();

  const handleReprocess = async () => {
    try {
      await reprocessCall(callId);
      toast.success(t('scripts.reprocess_success'));
    } catch (err) {
      toast.error(t('scripts.reprocess_failed'));
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleReprocess}
      disabled={loading}
    >
      {loading ? t('common.loading') : t('scripts.reprocess')}
    </Button>
  );
};
