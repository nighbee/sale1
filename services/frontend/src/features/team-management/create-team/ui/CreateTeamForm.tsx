import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { teamApi } from "../../../../entities/team/api";
import Button from "../../../../shared/ui/Button";
import Input from "../../../../shared/ui/Input";

export const CreateTeamForm: React.FC = () => {
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
        label="Team Name"
        id="team_name"
        name="teamName"
        placeholder="Inbound Sales Team"
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
            Description
          </label>
          <span className="text-xs text-primary font-medium flex items-center gap-1">
            <span className="material-icons text-[14px]">
              auto_awesome
            </span>{" "}
            AI Context
          </span>
        </div>
        <textarea
          className="block w-full rounded-lg border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary focus:ring-primary sm:text-sm py-2.5 px-3 shadow-sm transition-colors resize-none"
          id="description"
          name="description"
          placeholder="e.g., Handles all incoming leads from marketing campaigns and website inquiries..."
          rows={4}
          value={formData.description}
          onChange={handleChange}
        ></textarea>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Optional. This helps our AI suggest relevant KPIs and coaching
          templates.
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
              Enable AI Lead Routing
            </label>
            <p className="text-gray-500 dark:text-gray-400 text-xs">
              Automatically assign leads based on rep performance.
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
          Back
        </Button>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary transition-colors hidden sm:block"
            onClick={() => navigate("/script-upload")}
          >
            Skip for now
          </button>
          <Button
            className="w-full sm:w-auto"
            type="submit"
            isLoading={loading}
          >
            Create Team
          </Button>
        </div>
        <button
          type="button"
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary transition-colors sm:hidden mt-2"
          onClick={() => navigate("/script-upload")}
        >
          Skip for now
        </button>
      </div>
    </form>
  );
};
