import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../../shared/ui/Modal';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import { teamApi } from '../../../entities/team/api';
import { userApi } from '../../../entities/user/api';
import { scriptApi } from '../../../entities/script/api';
import type { Team } from '../../../entities/team/types';
import type { User } from '../../../entities/user/types';
import type { Script } from '../../../entities/script/types';
import { toast } from 'sonner';

interface TeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId?: string;
  onSuccess: () => void;
}

const TeamModal: React.FC<TeamModalProps> = ({ isOpen, onClose, teamId, onSuccess }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [autoAssign, setAutoAssign] = useState(false);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [script, setScript] = useState<Script | null>(null);
  const [uploadingScript, setUploadingScript] = useState(false);

  useEffect(() => {
    const fetchTeamDetails = async () => {
        try {
          const res = await teamApi.get(teamId!);
      const teamData: Team = res.data;
      setName(teamData.name);
      setDescription(teamData.description || '');
      setAutoAssign(teamData.auto_assign);
      setMembers(teamData.members || []);
      setScript(teamData.script || null);
        } catch {
          toast.error(t('teams.fetch_details_failed'));
        }
      };

      const fetchAllUsers = async () => {
          try {
              const res = await userApi.listUsers();
              setAllUsers(res.data.users || []);
          } catch {
              console.error("Failed to fetch users");
          }
      }

    if (isOpen && teamId) {
      fetchTeamDetails();
    } else {
      setName('');
      setDescription('');
      setAutoAssign(false);
      setMembers([]);
      setScript(null);
    }
    if (isOpen) {
        fetchAllUsers();
    }
  }, [isOpen, teamId, t]);

  const fetchTeamDetails = async () => {
    if (!teamId) return;
    try {
      const res = await teamApi.get(teamId);
      const teamData: Team = res.data;
      setName(teamData.name);
      setDescription(teamData.description || '');
      setAutoAssign(teamData.auto_assign);
      setMembers(teamData.members || []);
      setScript(teamData.script || null);
    } catch {
      toast.error(t('teams.fetch_details_failed'));
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (teamId) {
        await teamApi.update(teamId, { name, description, auto_assign: autoAssign });
        toast.success(t('settings.update_success'));
      } else {
        await teamApi.create({ name, description, auto_assign: autoAssign });
        toast.success(t('auth.account_created'));
      }
      onSuccess();
      onClose();
    } catch {
      toast.error(t('settings.update_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (userId: string) => {
      try {
          await teamApi.addMember(teamId!, userId);
          fetchTeamDetails();
      } catch {
          toast.error(t('teams.add_member_failed', 'Failed to add member'));
      }
  }

  const handleRemoveMember = async (userId: string) => {
      try {
          await teamApi.removeMember(teamId!, userId);
          fetchTeamDetails();
      } catch {
          toast.error(t('teams.remove_member_failed', 'Failed to remove member'));
      }
  }

  const handleScriptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !teamId) return;

      setUploadingScript(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', `${name} Script`);
      formData.append('team_id', teamId);

      try {
          await scriptApi.upload(formData);
          fetchTeamDetails();
          toast.success(t('setup.upload_success'));
      } catch {
          toast.error(t('setup.upload_failed'));
      } finally {
          setUploadingScript(false);
      }
  }

  const handleScriptDelete = async () => {
      if (!script) return;
      try {
          await scriptApi.delete(script.id);
          setScript(null);
          toast.success(t('common.delete_success'));
      } catch {
          toast.error(t('common.delete_failed'));
      }
  }

  const handleScriptDownload = async () => {
      if (!script) return;
      try {
          const res = await scriptApi.download(script.id);
          const url = window.URL.createObjectURL(new Blob([res.data as BlobPart]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', script.name || 'script');
          document.body.appendChild(link);
          link.click();
          link.remove();
      } catch {
          toast.error(t('scripts.download_failed', 'Failed to download script'));
      }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={teamId ? t('teams.edit_details') : t('teams.create_team')}>
      <div className="space-y-6">
        <Input label={t('setup.team_name_label')} value={name} onChange={(e) => setName(e.target.value)} />
        <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('setup.team_desc_label')}</label>
            <textarea
                className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm text-slate-900 dark:text-white"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
            />
        </div>
        <div className="flex items-center gap-2">
            <input type="checkbox" checked={autoAssign} onChange={(e) => setAutoAssign(e.target.checked)} id="autoAssign" className="h-4 w-4 text-primary" />
            <label htmlFor="autoAssign" className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('setup.lead_routing_label')}</label>
        </div>

        {teamId && (
            <>
                <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                    <h3 className="font-bold mb-4 text-slate-900 dark:text-white">{t('teams.team_members')}</h3>
                    <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                        {members.map(m => (
                            <div key={m.id} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <span className="text-sm text-slate-600 dark:text-slate-400">{m.email}</span>
                                <button onClick={() => handleRemoveMember(m.id)} className="text-red-500 hover:text-red-700 text-sm font-bold">{t('common.delete')}</button>
                            </div>
                        ))}
                    </div>
                    <select
                        className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-sm text-slate-900 dark:text-white"
                        onChange={(e) => e.target.value && handleAddMember(e.target.value)}
                        value=""
                    >
                        <option value="">{t('teams.invite_member')}...</option>
                        {allUsers.filter(u => !members.find(m => m.id === u.id)).map(u => (
                            <option key={u.id} value={u.id}>{u.email}</option>
                        ))}
                    </select>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                    <h3 className="font-bold mb-4 text-slate-900 dark:text-white">{t('teams.team_script')}</h3>
                    {script ? (
                        <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <span className="material-icons text-primary">description</span>
                                <span className="text-sm font-medium truncate text-slate-700 dark:text-slate-300">{script.name}</span>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                                <button onClick={handleScriptDownload} className="text-slate-500 hover:text-primary"><span className="material-icons text-sm">download</span></button>
                                <button onClick={handleScriptDelete} className="text-slate-500 hover:text-red-500"><span className="material-icons text-sm">delete</span></button>
                            </div>
                        </div>
                    ) : (
                        <div className="relative">
                            <input type="file" onChange={handleScriptUpload} className="hidden" id="script-upload" disabled={uploadingScript} />
                            <label
                                htmlFor="script-upload"
                                className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                <span className="material-icons text-slate-400 mb-2">cloud_upload</span>
                                <span className="text-sm text-slate-500">{uploadingScript ? t('setup.parsing') : t('setup.upload_drag_drop')}</span>
                            </label>
                        </div>
                    )}
                </div>
            </>
        )}

        <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} isLoading={loading}>{t('common.save')}</Button>
        </div>
      </div>
    </Modal>
  );
};

export default TeamModal;
