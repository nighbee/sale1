import React, { useEffect, useState } from "react";
import { userApi } from "../entities/user/api";
import { useParams, useNavigate } from "react-router-dom";

const UserProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "" });

  useEffect(() => {
    if (!id) return;
    userApi.get(id).then((res: any) => {
      setUser(res.data.user);
      setForm({ full_name: res.data.user.full_name || "", email: res.data.user.email });
      setLoading(false);
    });
  }, [id]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    await userApi.update(id!, form);
    setEdit(false);
    const res = await userApi.get(id!);
    setUser(res.data.user);
  };

  const handleDelete = async () => {
    await userApi.delete(id!);
    navigate("/users");
  };

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>User not found.</div>;

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-4">User Profile</h2>
      {edit ? (
        <form onSubmit={handleUpdate} className="space-y-4">
          <input
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            className="border p-2"
          />
          <input
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="border p-2"
          />
          <button
            type="submit"
            className="bg-primary text-white px-4 py-2 rounded"
          >
            Save
          </button>
          <button type="button" onClick={() => setEdit(false)} className="ml-2">
            Cancel
          </button>
        </form>
      ) : (
        <div>
          <div>Name: {user.full_name}</div>
          <div>Email: {user.email}</div>
          <button
            onClick={() => setEdit(true)}
            className="bg-primary text-white px-4 py-2 rounded mt-4"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="bg-red-500 text-white px-4 py-2 rounded mt-4 ml-2"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default UserProfile;
