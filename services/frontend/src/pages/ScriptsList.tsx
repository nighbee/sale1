import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useScripts } from "../entities/script/model/hooks";
import { BaseScripts } from "../widgets/BaseScripts/ui/BaseScripts";
import { PageLayout } from "../widgets/PageLayout";
import Button from "../shared/ui/Button";
import { toast } from "sonner";

const ScriptsList: React.FC = () => {
  const { t } = useTranslation();
  const { scripts, loading, deleteScript, uploadScript, updateScript } = useScripts();
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleDelete = async (id: string) => {
    if (window.confirm(t("common.delete_confirm"))) {
      try {
        await deleteScript(id);
        toast.success(t("scripts.delete_success"));
      } catch (err) {
        toast.error(t("scripts.delete_failed"));
      }
    }
  };

  const handleRename = async (id: string, currentName: string) => {
    const newName = window.prompt(t("scripts.new_name"), currentName);
    if (newName && newName !== currentName) {
      try {
        await updateScript(id, newName);
        toast.success(t("scripts.rename_success"));
      } catch (err) {
        toast.error(t("scripts.rename_failed"));
      }
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
    } catch (err) {
      toast.error(t("setup.upload_failed"));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filteredScripts = scripts.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <PageLayout title={t("scripts.title")}>
      <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              {t("scripts.title")}
            </h2>
            <p className="text-slate-500 dark:text-slate-400">
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
              className="flex items-center gap-2"
            >
              <span className="material-icons text-sm">cloud_upload</span>
              {t("scripts.upload")}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-4">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <span className="material-icons text-lg">search</span>
                  </span>
                  <input
                    type="text"
                    placeholder={t("scripts.search")}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {loading && scripts.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
                  <p>{t("common.loading")}</p>
                </div>
              ) : filteredScripts.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <span className="material-icons text-4xl mb-2 opacity-20">
                    description
                  </span>
                  <p>{t("scripts.no_scripts")}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/30">
                        <th className="px-6 py-4">{t("common.name")}</th>
                        <th className="px-6 py-4">{t("superadmin.created_at")}</th>
                        <th className="px-6 py-4 text-right">
                          {t("common.actions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filteredScripts.map((s) => (
                        <tr
                          key={s.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-primary">
                                <span className="material-icons text-lg">
                                  description
                                </span>
                              </div>
                              <span className="font-medium text-slate-900 dark:text-white">
                                {s.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                            {new Date(s.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleRename(s.id, s.name)}
                                className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                title={t("common.edit")}
                              >
                                <span className="material-icons text-lg">
                                  edit
                                </span>
                              </button>
                              <button
                                onClick={() => handleDelete(s.id)}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                title={t("common.delete")}
                              >
                                <span className="material-icons text-lg">
                                  delete
                                </span>
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

          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <BaseScripts />
            </div>

            <div className="bg-primary/5 dark:bg-primary/10 rounded-xl border border-primary/10 dark:border-primary/20 p-6">
              <div className="flex items-start gap-3">
                <span className="material-icons text-primary text-xl mt-0.5">
                  info
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {t("setup.why_scripts_title")}
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {t("setup.why_scripts_desc")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default ScriptsList;
