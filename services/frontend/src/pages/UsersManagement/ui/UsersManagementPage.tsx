import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { PageLayout } from "../../../widgets/PageLayout";
import { userApi } from "../../../entities/user/api";
import { teamApi } from "../../../entities/team/api";
import type { User } from "../../../entities/user/types";
import type { Team } from "../../../entities/team/types";
import Button from "../../../shared/ui/Button";
import Skeleton from "../../../shared/ui/Skeleton";
import { toast } from "sonner";

export const UsersManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    username: "",
    phone: "",
    password: "",
    role: "sales_rep",
    team_id: "",
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await userApi.listUsers();
      setUsers(res.data.users || []);
    } catch (error) {
      console.error("Failed to fetch users", error);
      toast.error(t("users.fetch_failed"));
    } finally {
      setLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const res = await teamApi.list();
      setTeams(res.data.teams || []);
    } catch (error) {
      console.error("Failed to fetch teams", error);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchTeams();
  }, []);

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      email: user.email || "",
      username: user.username || "",
      phone: user.phone || "",
      password: "",
      role: user.role || "sales_rep",
      team_id: user.team_id || "none",
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const updateData: any = { ...formData };
      if (!updateData.password) delete updateData.password;

      await userApi.update(editingUser.id, updateData);
      toast.success(t("users.update_success"));
      setIsModalOpen(false);
      fetchUsers();
    } catch (error) {
      console.error("Update failed", error);
      toast.error(t("users.update_failed"));
    }
  };

  const getTeamName = (teamId?: string) => {
    if (!teamId) return t("common.no_team");
    const team = teams.find((t) => t.id === teamId);
    return team ? team.name : t("common.unknown_team");
  };

  return (
    <PageLayout title={t("users.management_title")}>
      <div className="p-4 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <p className="text-slate-500">{t("users.management_subtitle")}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-border-light dark:border-slate-800 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">{t("common.name")}</th>
                    <th className="px-6 py-4">{t("common.username")} / {t("common.email")}</th>
                    <th className="px-6 py-4">{t("common.phone")}</th>
                    <th className="px-6 py-4">{t("common.role")}</th>
                    <th className="px-6 py-4">{t("common.team")}</th>
                    <th className="px-6 py-4 text-right">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-slate-800">
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {user.first_name} {user.last_name}
                        </div>
                        <div className="text-xs text-slate-400">ID: {user.manager_id || "N/A"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {user.username || user.email}
                        </div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {user.phone || "-"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                          user.role === "super_admin"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-400"
                            : user.role === "tenant_admin"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400"
                            : "bg-slate-100 text-slate-800 dark:bg-slate-500/20 dark:text-slate-400"
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {getTeamName(user.team_id)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleEdit(user)}
                          className="text-primary font-bold text-sm hover:underline"
                        >
                          {t("common.edit")}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        {t("users.no_users")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border-light dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold">{t("users.edit_user")}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-icons">close</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t("common.first_name")}</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    value={formData.first_name}
                    onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t("common.last_name")}</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    value={formData.last_name}
                    onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t("common.email")}</label>
                  <input
                    type="email"
                    className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t("common.username")}</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t("common.phone")}</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t("common.password")} ({t("users.leave_blank_no_change")})</label>
                  <input
                    type="password"
                    className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t("common.role")}</label>
                  <select
                    className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                  >
                    <option value="sales_rep">{t("roles.sales_rep")}</option>
                    <option value="tenant_admin">{t("roles.tenant_admin")}</option>
                    <option value="super_admin">{t("roles.super_admin")}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t("common.team")}</label>
                  <select
                    className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    value={formData.team_id}
                    onChange={(e) => setFormData({...formData, team_id: e.target.value})}
                  >
                    <option value="none">{t("common.no_team")}</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit">
                  {t("common.save_changes")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageLayout>
  );
};
