import React from "react";
import { useScripts } from "../entities/script/model/hooks";
import { Link } from "react-router-dom";
import { BaseScripts } from "../widgets/BaseScripts/ui/BaseScripts";
import { useTranslation } from "react-i18next";

const ScriptsList: React.FC = () => {
  const { t } = useTranslation();
  const { scripts, loading, deleteScript } = useScripts();

  const handleDelete = async (id: string) => {
    if (window.confirm(t("common.delete_confirm"))) {
      await deleteScript(id);
    }
  };

  return (
    <div className="p-8 space-y-8">
      <h2 className="text-2xl font-bold mb-4">{t("scripts.title")}</h2>

      <BaseScripts />

      {loading ? (
        <div>{t("common.loading")}</div>
      ) : scripts.length === 0 ? (
        <div>{t("common.not_found")}</div>
      ) : (
        <table className="min-w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {scripts.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{new Date(s.created_at).toLocaleDateString()}</td>
                <td>
                  <Link to={`/scripts/${s.id}`} className="text-primary mr-2">
                    View
                  </Link>
                  <Link
                    to={`/scripts/${s.id}/edit`}
                    className="text-primary mr-2"
                  >
                    Edit
                  </Link>
                  <button
                    className="text-red-500"
                    onClick={() => handleDelete(s.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ScriptsList;
