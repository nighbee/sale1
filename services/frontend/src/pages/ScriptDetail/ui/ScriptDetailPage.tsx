import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useScript } from "../../../entities/script/model/hooks";
import { PageLayout } from "../../../widgets/PageLayout";
import Button from "../../../shared/ui/Button";

const ScriptDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { script, content, loading, error } = useScript(id);

  if (loading) {
    return (
      <PageLayout title={t("scripts.title")}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </PageLayout>
    );
  }

  if (error || !script) {
    return (
      <PageLayout title={t("scripts.title")}>
        <div className="max-w-4xl mx-auto p-8 text-center">
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-6 rounded-2xl border border-red-100 dark:border-red-900/30">
            <span className="material-icons text-4xl mb-4">error_outline</span>
            <h2 className="text-xl font-bold mb-2">{t("common.not_found")}</h2>
            <p className="mb-6">{error || t("scripts.not_found")}</p>
            <Button onClick={() => navigate("/scripts")}>
              {t("common.back")}
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={script.name}>
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/scripts")}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <span className="material-icons">arrow_back</span>
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                {script.name}
              </h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="material-icons text-xs">calendar_today</span>
                  {new Date(script.created_at).toLocaleDateString()}
                </span>
                {script.team_id && (
                  <span className="flex items-center gap-1">
                    <span className="material-icons text-xs">group</span>
                    {t("common.team")}: {script.team_id}
                  </span>
                )}
                {script.version && (
                  <span className="flex items-center gap-1">
                    <span className="material-icons text-xs">history</span>
                    v{script.version}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => window.print()}
              className="flex items-center gap-2"
            >
              <span className="material-icons text-sm">print</span>
              {t("common.print", "Print")}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-icons text-primary text-lg">
                    description
                  </span>
                  {t("scripts.content", "Script Content")}
                </h3>
              </div>
              <div className="p-8 md:p-12 prose dark:prose-invert max-w-none">
                {content ? (
                  <div className="whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-300 font-serif text-lg">
                    {content}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400 italic">
                    {t("scripts.no_content", "No parsed content available for this script.")}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-primary/5 dark:bg-primary/10 rounded-2xl border border-primary/10 dark:border-primary/20 p-6">
              <h4 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-icons text-primary text-lg">info</span>
                {t("scripts.review_info", "Review Information")}
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                {t(
                  "scripts.review_desc",
                  "This is the parsed version of your sales script. Our AI uses this text to analyze your calls and provide coaching insights."
                )}
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{t("common.status")}</span>
                  <span className={`px-2 py-0.5 rounded-full ${script.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                    {script.is_active ? t("dashboard.active") : t("common.inactive")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default ScriptDetailPage;
