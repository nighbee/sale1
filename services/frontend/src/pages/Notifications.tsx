import React from "react";
import { useNotifications } from "../entities/notification/model/hooks";
import { PageLayout } from "../widgets/PageLayout";
import { useTranslation } from "react-i18next";

const Notifications: React.FC = () => {
  const { t } = useTranslation();
  const { notifications, loading, markAsRead } = useNotifications();

  return (
    <PageLayout title={t("notifications.title")}>
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        {loading ? (
          <div>{t("common.loading")}</div>
        ) : notifications.length === 0 ? (
          <div>{t("notifications.no_notifications")}</div>
        ) : (
          <ul className="space-y-4">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`p-4 rounded border ${n.read ? "bg-slate-50" : "bg-white"}`}
              >
                <div className="flex justify-between items-center">
                  <span>{n.message}</span>
                  {!n.read && (
                    <button
                      className="text-primary font-medium text-sm"
                      onClick={() => markAsRead(n.id)}
                    >
                      {t("notifications.mark_as_read")}
                    </button>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageLayout>
  );
};

export default Notifications;
