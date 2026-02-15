import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { authApi } from "../api/client";
import { toast } from "sonner";
import LanguageSwitcher from "../components/LanguageSwitcher";

const Register: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
      const response = await authApi.register({
        email: formData.email,
        password: formData.password,
        full_name: formData.fullname,
      });
      localStorage.setItem("token", response.data.tokens.access_token);
      localStorage.setItem("company_id", response.data.user.company_id);
      localStorage.setItem("user_id", response.data.user.id);
      toast.success(t("auth.account_created"));
      navigate("/company-setup");
    } catch (err: any) {
      const msg = err.response?.data?.error || t("auth.registration_failed");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-blue-50 dark:bg-background-dark min-h-screen font-display flex flex-col">
      <header className="w-full py-6 px-8 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-lg">
            S
          </div>
          <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            SalesAI
          </span>
        </div>
        <div className="hidden sm:block text-sm font-medium text-slate-600 dark:text-slate-400">
          {t("auth.have_account")}{" "}
          <Link
            to="/login"
            className="text-primary hover:text-blue-700 dark:hover:text-blue-400 font-semibold transition-colors"
          >
            {t("auth.log_in")}
          </Link>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-slate-100 dark:bg-slate-800">
            <div className="h-full bg-primary w-2/3 transition-all duration-500 ease-out"></div>
          </div>
          <div className="p-8 sm:p-10">
            <div className="flex justify-center mb-6">
              <LanguageSwitcher />
            </div>
            <div className="flex items-center gap-2 mb-6">
              <span className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                Step 2 of 3
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Account Setup
              </span>
            </div>

            <div className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
                {t("auth.register_title")}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {t("auth.register_subtitle")}
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                  htmlFor="fullname"
                >
                  {t("auth.full_name")}
                </label>
                <div className="relative">
                  <input
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                    id="fullname"
                    name="fullname"
                    placeholder="e.g. Sarah Connor"
                    type="text"
                    required
                    value={formData.fullname}
                    onChange={handleChange}
                  />
                  <span className="material-icons absolute right-3 top-2.5 text-slate-400 text-[20px]">
                    person_outline
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                  htmlFor="email"
                >
                  {t("auth.work_email")}
                </label>
                <div className="relative">
                  <input
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                    id="email"
                    name="email"
                    placeholder="name@company.com"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                  />
                  <span className="material-icons absolute right-3 top-2.5 text-slate-400 text-[20px]">
                    mail_outline
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                  htmlFor="password"
                >
                  {t("auth.password")}
                </label>
                <div className="relative group">
                  <input
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                    id="password"
                    name="password"
                    placeholder="Create a password"
                    type="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                  />
                  <button
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none transition-colors"
                    type="button"
                  >
                    <span className="material-icons text-[20px]">
                      visibility_off
                    </span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50 space-y-2">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                  Password Strength
                </p>
                <div className="flex items-center gap-2">
                  <span className="material-icons text-[14px] text-green-500">
                    check_circle
                  </span>
                  <span className="text-xs text-slate-600 dark:text-slate-300">
                    At least 8 characters
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-icons text-[14px] text-slate-300 dark:text-slate-600">
                    radio_button_unchecked
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-500">
                    One uppercase letter
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-icons text-[14px] text-slate-300 dark:text-slate-600">
                    radio_button_unchecked
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-500">
                    One number
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 mt-6">
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

              <button
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-primary hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all mt-6 disabled:opacity-50"
                type="submit"
                disabled={loading}
              >
                {loading ? t("auth.creating_account") : t("auth.continue")}
                <span className="material-icons text-sm ml-2">
                  arrow_forward
                </span>
              </button>
            </form>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 px-8 py-4 text-center sm:hidden">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Already have an account?{" "}
              <Link
                className="font-medium text-primary hover:text-blue-500"
                to="/login"
              >
                Log in
              </Link>
            </p>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>SalesAI © 2024. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Register;
