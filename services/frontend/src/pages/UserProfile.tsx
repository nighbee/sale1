import React, { useEffect, useState } from "react";
import { userApi } from "../entities/user/api";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "../widgets/PageLayout";
import { useTranslation } from "react-i18next";
import type { User } from "../entities/user/types";
import Button from "../shared/ui/Button";
import Input from "../shared/ui/Input";
import { toast } from "sonner";
import { useUserStore } from "../entities/user/model/store";

const UserProfile: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setUser } = useUserStore();
  const [user, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", password: "" });

  useEffect(() => {
    fetchMe();
  }, []);

  const fetchMe = async () => {
      try {
          const res = await userApi.getMe();
          setUserData(res.data);
          setForm({
              first_name: res.data.first_name || "",
              last_name: res.data.last_name || "",
              email: res.data.email || "",
              password: ""
          });
      } catch (err) {
          console.error("Failed to fetch user", err);
      } finally {
          setLoading(false);
      }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
        const res = await userApi.update(user.id, form);
        setUserData(res.data.user);
        setUser(res.data.user); // Update store
        toast.success(t('profile.update_success'));
    } catch {
        toast.error(t('profile.update_failed'));
    } finally {
        setSaving(false);
    }
  };

  if (loading) return (
    <PageLayout title={t('profile.title')}>
        <div className="p-8">{t('common.loading')}</div>
    </PageLayout>
  );
  if (!user) return (
    <PageLayout title={t('profile.title')}>
        <div className="p-8">{t('profile.not_found')}</div>
    </PageLayout>
  );

  return (
    <PageLayout title={t('profile.title')}>
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-8">
            <form onSubmit={handleUpdate} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                        label={t('profile.first_name')}
                        value={form.first_name}
                        onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    />
                    <Input
                        label={t('profile.last_name')}
                        value={form.last_name}
                        onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    />
                </div>
                <Input
                    label={t('profile.email_address')}
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                    <h3 className="font-bold mb-4">{t('profile.change_password')}</h3>
                    <Input
                        label={t('profile.new_password')}
                        type="password"
                        placeholder={t('profile.leave_blank_hint')}
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                    <Button variant="ghost" type="button" onClick={() => navigate(-1)}>{t('common.cancel')}</Button>
                    <Button type="submit" isLoading={saving}>{t('common.save')}</Button>
                </div>
            </form>
        </div>
      </div>
    </PageLayout>
  );
};

export default UserProfile;
