import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { userApi } from "../../../../entities/user/api";
import { useUserStore } from "../../../../entities/user/model/store";
import Button from "../../../../shared/ui/Button";
import Input from "../../../../shared/ui/Input";

export const LoginForm: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setUser = useUserStore((state) => state.setUser);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
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
      const response = await userApi.login({
        email: formData.email,
        password: formData.password,
      });
      const { user, tokens } = response.data;
      localStorage.setItem("token", tokens.access_token);
      localStorage.setItem("company_id", user.company_id);
      localStorage.setItem("user_id", user.id);
      setUser(user);
      toast.success(t("auth.welcome_back"));
      navigate("/dashboard");
    } catch (_err: unknown) {
      const apiError = _err as { response?: { data?: { error?: string } } };
      const msg = apiError.response?.data?.error || t("auth.login_failed");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      <Input
        label={t("auth.email")}
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
        placeholder="••••••••"
        required
        value={formData.password}
        onChange={handleChange}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <input
            className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded cursor-pointer"
            id="remember-me"
            name="rememberMe"
            type="checkbox"
            checked={formData.rememberMe}
            onChange={handleChange}
          />
          <label
            className="ml-2 block text-sm text-slate-600 dark:text-slate-400 cursor-pointer select-none"
            htmlFor="remember-me"
          >
            {t("auth.remember_me")}
          </label>
        </div>
        <div className="text-sm">
          <a
            className="font-medium text-primary hover:text-primary/80 transition-colors"
            href="#"
          >
            {t("auth.forgot_password")}
          </a>
        </div>
      </div>

      <Button
        className="w-full"
        type="submit"
        isLoading={loading}
      >
        {t("auth.sign_in")}
      </Button>
    </form>
  );
};
