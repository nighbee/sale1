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
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "w-72 bg-slate-950 flex-shrink-0 flex flex-col text-white transition-all duration-500 z-50 shadow-2xl border-r border-white/5",
          "fixed inset-y-0 left-0 md:relative md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-8">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-blue-400 flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform duration-300">
                <span className="material-icons text-2xl text-white">insights</span>
              </div>
              <div className="flex flex-col">
                <span className="font-black text-xl tracking-tight text-white uppercase italic">SalesAI</span>
                <span className="text-[10px] text-primary font-bold tracking-[0.2em] uppercase -mt-1 opacity-80">Intelligence</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="md:hidden w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <span className="material-icons text-lg">close</span>
            </button>
          </div>

          <div className="space-y-6">
            {user?.role !== "super_admin" && (
              <div className="relative group">
                <label className="block text-[10px] uppercase tracking-[0.15em] text-slate-500 font-black mb-3 ml-1">
                  {t("nav.active_team")}
                </label>
                <div className="relative">
                  <select
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl text-sm py-2.5 pl-4 pr-10 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all appearance-none cursor-pointer hover:bg-slate-900"
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
                  <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-sm">
                    unfold_more
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto scrollbar-hide py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all duration-300 group relative overflow-hidden",
                  isActive
                    ? "bg-primary text-white shadow-lg shadow-primary/20"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )
              }
            >
              <span className={cn(
                "material-symbols-outlined text-2xl transition-transform duration-300 group-hover:scale-110",
                "text-inherit"
              )}>
                {item.icon}
              </span>
              <span className="tracking-tight text-sm uppercase">{item.label}</span>

              {/* Active Indicator Pin */}
              <div className={cn(
                "absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full transition-all duration-500",
                "opacity-0",
                "group-[.active]:opacity-100"
              )} />
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto p-4 space-y-4">
          <div className="bg-slate-900/50 rounded-2xl p-4 border border-white/5 backdrop-blur-sm">
            <LanguageSwitcher />
            <div className="h-px bg-white/5 my-4" />
            <ProfileCard />
          </div>

          <div className="px-4 py-2 text-center">
             <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest leading-none">
               Powered by SalesAI OS
             </p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
