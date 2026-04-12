import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PageLayout } from "../../../widgets/PageLayout";
import { userApi } from "../../../entities/user/api";
import { teamApi } from "../../../entities/team/api";
import type { User } from "../../../entities/user/types";
import type { Team } from "../../../entities/team/types";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import Select from "../../../shared/ui/Select";
import Skeleton from "../../../shared/ui/Skeleton";
import Modal from "../../../shared/ui/Modal";
import { toast } from "sonner";

const userSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  phone: z.string().optional(),
  password: z.string().optional(),
  role: z.string(),
  team_id: z.string(),
  line_id: z.string().optional(),
  src_num: z.string().optional(),
  manager_id: z.string().optional(),
});

type UserFormValues = z.infer<typeof userSchema>;

export const UsersManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
  });

  const fetchUsers = useCallback(async () => {
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
  }, [t]);

  const fetchTeams = useCallback(async () => {
    try {
      const res = await teamApi.list();
      setTeams(res.data.teams || []);
    } catch (error) {
      console.error("Failed to fetch teams", error);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchTeams();
  }, [fetchUsers, fetchTeams]);

  const handleEdit = (user: User) => {
    setEditingUser(user);
    reset({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      email: user.email || "",
      username: user.username || "",
      phone: user.phone || "",
      password: "",
      role: user.role || "sales_rep",
      team_id: user.team_id || "none",
      line_id: user.line_id || "",
      src_num: user.src_num || "",
      manager_id: user.manager_id || "",
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data: UserFormValues) => {
    if (!editingUser) return;

    try {
      const updateData: Record<string, unknown> = { ...data };
      if (!updateData.password) delete updateData.password;
      if (updateData.team_id === "none") updateData.team_id = null;

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

  const roleOptions = [
    { value: "sales_rep", label: t("roles.sales_rep") },
    { value: "tenant_admin", label: t("roles.tenant_admin") },
    { value: "super_admin", label: t("roles.super_admin") },
  ];

  const teamOptions = [
    { value: "none", label: t("common.no_team") },
    ...teams.map((team) => ({ value: team.id, label: team.name })),
  ];

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
                    <th className="px-6 py-4">Line ID / Src Num</th>
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
                        {user.initial_password && (
                          <div className="text-xs text-amber-600 font-medium">
                            Initial: {user.initial_password}
                          </div>
                        )}
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
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        <div className="font-medium">{user.line_id || "-"}</div>
                        <div className="text-xs text-slate-500">{user.src_num || "-"}</div>
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
                        colSpan={7}
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

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t("users.edit_user")}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t("common.first_name")}
              {...register("first_name")}
              error={errors.first_name?.message}
            />
            <Input
              label={t("common.last_name")}
              {...register("last_name")}
              error={errors.last_name?.message}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t("common.email")}
              type="email"
              {...register("email")}
              error={errors.email?.message}
            />
            <Input
              label={t("common.username")}
              {...register("username")}
              error={errors.username?.message}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t("common.phone")}
              {...register("phone")}
              error={errors.phone?.message}
            />
            <Input
              label={`${t("common.password")} (${t("users.leave_blank_no_change")})`}
              type="password"
              {...register("password")}
              error={errors.password?.message}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Manager ID (Extension)"
              {...register("manager_id")}
              error={errors.manager_id?.message}
            />
            <Select
              label={t("common.role")}
              options={roleOptions}
              {...register("role")}
              error={errors.role?.message}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Line ID"
              {...register("line_id")}
              error={errors.line_id?.message}
            />
            <Input
              label="Source Number (Src Num)"
              {...register("src_num")}
              error={errors.src_num?.message}
            />
          </div>

          <Select
            label={t("common.team")}
            options={teamOptions}
            {...register("team_id")}
            error={errors.team_id?.message}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {t("common.save_changes")}
            </Button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  );
};
