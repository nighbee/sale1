import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useScripts } from "../entities/script/model/hooks";
import { BaseScripts } from "../widgets/BaseScripts/ui/BaseScripts";
import { PageLayout } from "../widgets/PageLayout";
import Button from "../shared/ui/Button";
import { toast } from "sonner";

const ScriptsList: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    scripts,
    loading,
    error,
    fetchScripts,
    deleteScript,
    uploadScript,
    updateScript,
    downloadScript,
  } = useScripts();
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm(t("common.delete_confirm"))) {
      try {
        await deleteScript(id);
        toast.success(t("scripts.delete_success"));
      } catch {
        toast.error(t("scripts.delete_failed"));
      }
    }
  };

  const handleRename = async (e: React.MouseEvent, id: string, currentName: string) => {
    e.stopPropagation();
    const newName = window.prompt(t("scripts.new_name"), currentName);
    if (newName && newName !== currentName) {
      try {
        await updateScript(id, newName);
        toast.success(t("scripts.rename_success"));
      } catch {
        toast.error(t("scripts.rename_failed"));
      }
    }
  };

  const handleDownload = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    try {
      await downloadScript(id, name);
    } catch {
      toast.error(t("scripts.download_failed", "Download failed"));
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", file.name);

    try {
      await uploadScript(formData);
      toast.success(t("setup.upload_success"));
    } catch {
      toast.error(t("setup.upload_failed"));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filteredScripts = scripts.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <PageLayout title={t("scripts.title")}>
      <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
        {/** show error from hook if exists */}
        {loading === false && error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-700 dark:text-red-400 rounded-2xl text-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-icons">error_outline</span>
              {error}
            </div>
            <button
              onClick={() => fetchScripts()}
              className="text-sm font-bold underline px-3 py-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors"
            >
              {t("common.retry")}
            </button>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {t("scripts.title")}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              {t("scripts.management_subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf,.docx"
            />
            <Button
              onClick={handleUploadClick}
              isLoading={isUploading}
              className="flex items-center gap-2 px-6 shadow-lg shadow-primary/20"
            >
              <span className="material-icons">cloud_upload</span>
              {t("scripts.upload")}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <span className="material-icons text-xl">search</span>
                  </span>
                  <input
                    type="text"
                    placeholder={t("scripts.search")}
                    className="w-full pl-12 pr-4 py-3 border-none bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary rounded-xl text-sm transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {loading && scripts.length === 0 ? (
                <div className="p-20 text-center">
                  <div className="animate-spin inline-block w-10 h-10 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
                  <p className="text-slate-500 font-medium">{t("common.loading")}</p>
                </div>
              ) : filteredScripts.length === 0 ? (
                <div className="p-20 text-center">
                  <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="material-icons text-4xl text-slate-300">
                      description
                    </span>
                  </div>
                  <p className="text-slate-500 font-medium">{t("scripts.no_scripts")}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-50/30 dark:bg-slate-800/20">
                        <th className="px-6 py-4">{t("common.name")}</th>
                        <th className="px-6 py-4">{t("superadmin.created_at")}</th>
                        <th className="px-6 py-4 text-right">{t("common.actions")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredScripts.map((s) => (
                        <tr
                          key={s.id}
                          className="group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all cursor-pointer"
                          onClick={() => navigate(`/scripts/${s.id}`)}
                        >
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-primary transition-transform group-hover:scale-110">
                                <span className="material-icons">description</span>
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 dark:text-white block">
                                  {s.name}
                                </span>
                                {s.version && (
                                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 uppercase font-bold">
                                    v{s.version}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                              {new Date(s.created_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/scripts/${s.id}`);
                                }}
                                className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                title={t("common.view", "Review")}
                              >
                                <span className="material-icons text-xl">visibility</span>
                              </button>
                              <button
                                onClick={(e) => handleDownload(e, s.id, s.name)}
                                className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                title={t("common.download")}
                              >
                                <span className="material-icons text-xl">download</span>
                              </button>
                              <button
                                onClick={(e) => handleRename(e, s.id, s.name)}
                                className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                title={t("common.edit")}
                              >
                                <span className="material-icons text-xl">edit</span>
                              </button>
                              <button
                                onClick={(e) => handleDelete(e, s.id)}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                title={t("common.delete")}
                              >
                                <span className="material-icons text-xl">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <BaseScripts />
            </div>

            <div className="bg-gradient-to-br from-primary to-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-primary/20">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <span className="material-icons text-white">lightbulb</span>
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-2">
                    {t("setup.why_scripts_title")}
                  </h4>
                  <p className="text-sm text-white/80 leading-relaxed">
                    {t("setup.why_scripts_desc")}
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </PageLayout>
  );
};

export default ScriptsList;
