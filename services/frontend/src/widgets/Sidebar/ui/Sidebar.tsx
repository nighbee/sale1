import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUserStore } from "../../../entities/user/model/store";
import LanguageSwitcher from "../../../shared/ui/LanguageSwitcher";
import ProfileCard from "./ProfileCard";
import { teamApi } from "../../../entities/team/api";
import type { Team } from "../../../entities/team/types";
import { cn } from "../../../shared/utils/cn";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const {
    user,
    currentTeamId,
    setCurrentTeam,
  } = useUserStore();
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const res = await teamApi.list();
        setTeams(res.data.teams || []);
      } catch (err) {
        console.error("Failed to fetch teams", err);
      }
    };
    if (user) {
      fetchTeams();
    }
  }, [user]);

  const getNavItems = () => {
    if (user?.role === "super_admin") {
      return [
        {
          id: "companies",
          icon: "corporate_fare",
          label: t("superadmin.companies"),
          path: "/super-admin/companies",
        },
        {
          id: "users",
          icon: "groups",
          label: t("superadmin.global_users"),
          path: "/super-admin/users",
        },
        {
          id: "calls",
          icon: "call",
          label: t("superadmin.global_calls"),
          path: "/super-admin/calls",
        },
        {
          id: "redis",
          icon: "database",
          label: t("superadmin.redis_queue"),
          path: "/super-admin/redis",
        },
        {
          id: "system",
          icon: "health_and_safety",
          label: t("superadmin.system_performance"),
          path: "/super-admin/system",
        },
      ];
    }

    if (user?.role === "tenant_admin") {
      return [
        {
          id: "dashboard",
          icon: "dashboard",
          label: t("nav.dashboard"),
          path: "/dashboard",
        },
        { id: "teams", icon: "groups", label: t("nav.teams"), path: "/teams" },
        { id: "scripts", icon: "description", label: t("scripts.title"), path: "/scripts" },
        { id: "users", icon: "person", label: t("nav.users"), path: "/users" },
        { id: "calls", icon: "call", label: t("nav.calls"), path: "/calls" },
        {
          id: "leaderboard",
          icon: "leaderboard",
          label: t("nav.leaderboard"),
          path: "/leaderboard",
        },
        {
          id: "integrations",
          icon: "hub",
          label: t("nav.integrations"),
          path: "/integrations",
        },
        {
          id: "settings",
          icon: "settings",
          label: t("nav.settings"),
          path: "/settings",
        },
      ];
    }

    // Default for 'user' role
    return [
      {
        id: "user-dashboard",
        icon: "dashboard",
        label: t("nav.dashboard"),
        path: "/user-dashboard",
      },
      { id: "calls", icon: "call", label: t("nav.calls"), path: "/calls" },
      {
        id: "leaderboard",
        icon: "leaderboard",
        label: t("nav.leaderboard"),
        path: "/leaderboard",
      },
    ];
  };

  const navItems = getNavItems();

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "w-64 bg-slate-900 flex-shrink-0 flex flex-col text-slate-300 transition-all duration-300 z-50 border-r border-slate-800",
          "fixed inset-y-0 left-0 md:relative md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="material-icons text-xl text-white">insights</span>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg leading-none text-white tracking-tight">Call Analyzer for Sales</span>
                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">CRM Platform</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="md:hidden w-8 h-8 flex items-center justify-center rounded-md bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <span className="material-icons text-lg">close</span>
            </button>
          </div>

          <div className="space-y-4">
            {user?.role !== "super_admin" && (
              <div className="relative">
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2 ml-1">
                  {t("nav.active_team")}
                </label>
                <div className="relative">
                  <select
                    className="w-full bg-slate-800 border border-slate-700 rounded-md text-xs py-2 pl-3 pr-8 focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all appearance-none cursor-pointer text-slate-200"
                    value={currentTeamId || ""}
                    onChange={(e) => setCurrentTeam(e.target.value || null)}
                  >
                    <option value="">{t("nav.all_teams")}</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <span className="material-icons absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-base">
                    expand_more
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors group",
                  isActive
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                )
              }
            >
              <span className={cn(
                "material-symbols-outlined text-xl transition-colors",
                "text-inherit"
              )}>
                {item.icon}
              </span>
              <span>{item.label}</span>

              <div className={cn(
                "ml-auto w-1.5 h-1.5 rounded-full bg-primary transition-all duration-300",
                "opacity-0",
                "group-[.active]:opacity-100"
              )} />
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto p-4 border-t border-slate-800">
          <div className="space-y-4">
            <LanguageSwitcher />
            <ProfileCard />
          </div>
          <div className="mt-4 px-2">
             <p className="text-[10px] text-slate-600 font-medium uppercase tracking-widest text-center">
               v1.0.4 • Call Analyzer for Sales
             </p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
