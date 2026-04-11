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
          id: "super-admin",
          icon: "admin_panel_settings",
          label: t("nav.super_admin"),
          path: "/super-admin",
        },
        {
          id: "settings",
          icon: "settings",
          label: t("nav.settings"),
          path: "/settings",
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
          "w-64 bg-slate-900 flex-shrink-0 flex flex-col text-white transition-all duration-300 z-50",
          "fixed inset-y-0 left-0 md:relative md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
                <span className="material-icons text-lg">insights</span>
              </div>
              <span className="font-bold text-lg tracking-tight">{t('common.system', 'SalesAI')}</span>
            </div>
            <button
              onClick={onClose}
              className="md:hidden text-slate-400 hover:text-white"
            >
              <span className="material-icons">close</span>
            </button>
          </div>

          <div className="space-y-4">
          {user?.role !== "super_admin" && (
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">
                {t("nav.active_team")}
              </label>
              <select
                className="w-full bg-slate-800 border-none rounded-lg text-sm p-2 focus:ring-1 focus:ring-primary transition-all"
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
            </div>
          )}
        </div>
      </div>
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium group transition-colors ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <span className="material-icons text-xl group-hover:text-primary-300">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto">
        <div className="px-4 py-2 border-t border-white/10">
          <LanguageSwitcher />
        </div>
        <ProfileCard />
      </div>
      </aside>
    </>
  );
};

export default Sidebar;
