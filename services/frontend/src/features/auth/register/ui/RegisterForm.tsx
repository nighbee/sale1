import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { userApi } from "../../../../entities/user/api";
import { useUserStore } from "../../../../entities/user/model/store";
import Button from "../../../../shared/ui/Button";
import Input from "../../../../shared/ui/Input";

export const RegisterForm: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setUser = useUserStore((state) => state.setUser);
  const [formData, setFormData] = useState({
    fullname: "",
    email: "",
    password: "",
    terms: false,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await userApi.register({
        email: formData.email,
        password: formData.password,
        full_name: formData.fullname,
      });
      const { user, tokens } = response.data;
      localStorage.setItem("token", tokens.access_token);
      localStorage.setItem("user_id", user.id);
      setUser(user);
      toast.success(t("auth.account_created"));
      navigate("/dashboard");
    } catch (_err: unknown) {
      const apiError = _err as { response?: { data?: { error?: string } } }; const msg = apiError.response?.data?.error || t("auth.registration_failed");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      <Input
        label={t("auth.full_name")}
        id="fullname"
        name="fullname"
        type="text"
        placeholder="e.g. Sarah Connor"
        required
        value={formData.fullname}
        onChange={handleChange}
      />

      <Input
        label={t("auth.work_email")}
        id="email"
        name="email"
        type="email"
        placeholder="name@company.com"
        required
        value={formData.email}
        onChange={handleChange}
      />

      <Input
        label={t("auth.password")}
        id="password"
        name="password"
        type="password"
        placeholder="Create a password"
        required
        value={formData.password}
        onChange={handleChange}
      />

      <div className="flex items-start gap-3">
        <div className="flex h-6 items-center">
          <input
            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-700 dark:ring-offset-slate-800"
            id="terms"
            name="terms"
            type="checkbox"
            required
            checked={formData.terms}
            onChange={handleChange}
          />
        </div>
        <div className="text-sm leading-6">
          <label
            className="font-medium text-slate-700 dark:text-slate-300"
            htmlFor="terms"
          >
            {t("auth.terms_agree")}{" "}
            <a
              className="font-semibold text-primary hover:text-blue-600 dark:hover:text-blue-400"
              href="#"
            >
              {t("auth.terms_service")}
            </a>{" "}
            {t("auth.and")}{" "}
            <a
              className="font-semibold text-primary hover:text-blue-600 dark:hover:text-blue-400"
              href="#"
            >
              {t("auth.privacy_policy")}
            </a>
            .
          </label>
        </div>
      </div>

      <Button
        className="w-full"
        type="submit"
        isLoading={loading}
      >
        {t("auth.continue")}
        <span className="material-icons text-sm ml-2">
          arrow_forward
        </span>
      </Button>
    </form>
  );
};
