import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { teamApi } from "@entities/team";
import Button from "@shared/ui/Button";
import Input from "@shared/ui/Input";

export const CreateTeamForm: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    teamName: "",
    description: "",
    autoAssign: false,
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    const val =
      type === "checkbox" ? (e.target as HTMLInputElement).checked : value;
    setFormData((prev) => ({
      ...prev,
      [name]: val,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await teamApi.create({
        name: formData.teamName,
        description: formData.description,
        auto_assign: formData.autoAssign,
      });
      navigate("/script-upload");
    } catch (err) {
      console.error("Failed to create team", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Input
        label={t('setup.team_name_label')}
        id="team_name"
        name="teamName"
        placeholder={t('setup.team_name_placeholder')}
        required
        value={formData.teamName}
        onChange={handleChange}
        autoFocus
      />

      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            htmlFor="description"
          >
            {t('setup.team_desc_label')}
          </label>
          <span className="text-xs text-primary font-medium flex items-center gap-1">
            <span className="material-icons text-[14px]">
              auto_awesome
            </span>{" "}
            {t('setup.ai_context')}
          </span>
        </div>
        <textarea
          className="block w-full rounded-lg border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary focus:ring-primary sm:text-sm py-2.5 px-3 shadow-sm transition-colors resize-none"
          id="description"
          name="description"
          placeholder={t('setup.team_desc_placeholder')}
          rows={4}
          value={formData.description}
          onChange={handleChange}
        ></textarea>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {t('setup.team_desc_hint')}
        </p>
      </div>

      <div className="pt-2">
        <div className="flex items-start">
          <div className="flex h-5 items-center">
            <input
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-700 dark:bg-gray-800"
              id="auto_assign"
              name="autoAssign"
              type="checkbox"
              checked={formData.autoAssign}
              onChange={handleChange}
            />
          </div>
          <div className="ml-3 text-sm">
            <label
              className="font-medium text-gray-700 dark:text-gray-300"
              htmlFor="auto_assign"
            >
              {t('setup.lead_routing_label')}
            </label>
            <p className="text-gray-500 dark:text-gray-400 text-xs">
              {t('setup.lead_routing_hint')}
            </p>
          </div>
        </div>
      </div>

      <div className="pt-6 flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
        <Button
          variant="ghost"
          type="button"
          onClick={() => navigate(-1)}
          className="w-full sm:w-auto"
        >
          <span className="material-icons text-lg mr-2">arrow_back</span>
          {t('common.back')}
        </Button>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary transition-colors hidden sm:block"
            onClick={() => navigate("/script-upload")}
          >
            {t('common.skip')}
          </button>
          <Button
            className="w-full sm:w-auto"
            type="submit"
            isLoading={loading}
          >
            {t('teams.create_team')}
          </Button>
        </div>
        <button
          type="button"
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary transition-colors sm:hidden mt-2"
          onClick={() => navigate("/script-upload")}
        >
          {t('common.skip')}
        </button>
      </div>
    </form>
  );
};
