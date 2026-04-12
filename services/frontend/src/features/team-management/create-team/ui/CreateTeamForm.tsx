import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { teamApi } from "../../../../entities/team/api";
import Button from "../../../../shared/ui/Button";
import Input from "../../../../shared/ui/Input";
import Textarea from "../../../../shared/ui/Textarea";
import Checkbox from "../../../../shared/ui/Checkbox";

const createTeamSchema = z.object({
  teamName: z.string().min(2, { message: "Team name must be at least 2 characters" }),
  description: z.string().optional(),
  autoAssign: z.boolean(),
});

type CreateTeamFormValues = z.infer<typeof createTeamSchema>;

export const CreateTeamForm: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateTeamFormValues>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: {
      teamName: "",
      description: "",
      autoAssign: false,
    },
  });

  const onSubmit = async (data: CreateTeamFormValues) => {
    try {
      await teamApi.create({
        name: data.teamName,
        description: data.description || "",
        auto_assign: data.autoAssign,
      });
      navigate("/script-upload");
    } catch (err) {
      console.error("Failed to create team", err);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Input
        label={t('setup.team_name_label')}
        id="team_name"
        placeholder={t('setup.team_name_placeholder')}
        {...register("teamName")}
        error={errors.teamName?.message}
        autoFocus
      />

      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <label
            className="block text-sm font-medium text-slate-700 dark:text-slate-300"
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
        <Textarea
          id="description"
          placeholder={t('setup.team_desc_placeholder')}
          rows={4}
          {...register("description")}
          error={errors.description?.message}
        />
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {t('setup.team_desc_hint')}
        </p>
      </div>

      <Checkbox
        id="auto_assign"
        label={t('setup.lead_routing_label')}
        {...register("autoAssign")}
      />
      <p className="text-slate-500 dark:text-slate-400 text-xs -mt-4 ml-7">
        {t('setup.lead_routing_hint')}
      </p>

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
            className="text-sm text-slate-500 dark:text-slate-400 hover:text-primary transition-colors hidden sm:block"
            onClick={() => navigate("/script-upload")}
          >
            {t('common.skip')}
          </button>
          <Button
            className="w-full sm:w-auto"
            type="submit"
            isLoading={isSubmitting}
          >
            {t('teams.create_team')}
          </Button>
        </div>
        <button
          type="button"
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-primary transition-colors sm:hidden mt-2"
          onClick={() => navigate("/script-upload")}
        >
          {t('common.skip')}
        </button>
      </div>
    </form>
  );
};
