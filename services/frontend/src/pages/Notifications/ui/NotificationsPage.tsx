import React, { useEffect, useState } from "react";
import { notificationApi, type Notification } from "@entities/notification";
import { Sidebar } from "@widgets/Sidebar";

const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await notificationApi.list();
      setNotifications(res.data.notifications || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkRead = async (id: string) => {
    await notificationApi.markRead(id);
    fetchNotifications();
  };

  return (
    <div className="flex">
      <Sidebar />
      <div className="p-8 flex-1">
        <h2 className="text-2xl font-bold mb-4">Notifications</h2>
        {loading ? (
          <div>Loading...</div>
        ) : notifications.length === 0 ? (
          <div>No notifications.</div>
        ) : (
          <ul className="space-y-4">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`p-4 rounded border ${n.read ? "bg-gray-100" : "bg-white"}`}
              >
                <div className="flex justify-between items-center">
                  <span>{n.message}</span>
                  {!n.read && (
                    <button
                      className="text-primary"
                      onClick={() => handleMarkRead(n.id)}
                    >
                      Mark as read
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
    </div>
  );
};

export default NotificationsPage;
