import React, { useEffect, useState } from "react";
import { userApi } from "../entities/user/api";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "../widgets/Sidebar";
import { useTranslation } from "react-i18next";
import Button from "../shared/ui/Button";
import Input from "../shared/ui/Input";
import { toast } from "sonner";
import { useUserStore } from "../entities/user/model/store";

const UserProfile: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setUser } = useUserStore();
  const [user, setUserData] = useState<any>(null);
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
    setSaving(true);
    try {
        const res = await userApi.update(user.id, form);
        setUserData(res.data.user);
        setUser(res.data.user); // Update store
        toast.success("Profile updated successfully");
    } catch {
        toast.error("Failed to update profile");
    } finally {
        setSaving(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!user) return <div className="p-8">User not found.</div>;

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex font-display">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">My Profile</h1>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-8">
            <form onSubmit={handleUpdate} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                        label="First Name"
                        value={form.first_name}
                        onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    />
                    <Input
                        label="Last Name"
                        value={form.last_name}
                        onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    />
                </div>
                <Input
                    label="Email Address"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                    <h3 className="font-bold mb-4">Change Password</h3>
                    <Input
                        label="New Password"
                        type="password"
                        placeholder="Leave blank to keep current"
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
      </main>
    </div>
  );
};

export default UserProfile;
