import React, { useEffect, useState } from "react";
import { scriptApi } from "../api/client";
import { Link } from "react-router-dom";

const ScriptsList: React.FC = () => {
  const [scripts, setScripts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScripts = async () => {
    setLoading(true);
    try {
      const res = await scriptApi.list();
      setScripts(res.data.scripts || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScripts();
  }, []);

  const handleDelete = async (id: string) => {
    await scriptApi.delete(id);
    fetchScripts();
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-4">Scripts</h2>
      {loading ? (
        <div>Loading...</div>
      ) : scripts.length === 0 ? (
        <div>No scripts found.</div>
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
