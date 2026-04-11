import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { userApi } from "../../../../entities/user/api";
import { useUserStore } from "../../../../entities/user/model/store";
import Button from "../../../../shared/ui/Button";
import Input from "../../../../shared/ui/Input";
import Checkbox from "../../../../shared/ui/Checkbox";

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const LoginForm: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setUser = useUserStore((state) => state.setUser);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      const response = await userApi.login({
        email: data.email,
        password: data.password,
      });
      const { user, tokens } = response.data;
      localStorage.setItem("token", tokens.access_token);
      localStorage.setItem("user_id", user.id);
      setUser(user);
      toast.success(t("auth.welcome_back"));

      if (user.role === "super_admin") {
        navigate("/super-admin");
      } else if (user.role === "tenant_admin") {
        navigate("/dashboard");
      } else {
        navigate("/user-dashboard");
      }
    } catch (_err: unknown) {
      const apiError = _err as { response?: { data?: { error?: string } } };
      const msg = apiError.response?.data?.error || t("auth.login_failed");
      setError("root", { message: msg });
      toast.error(msg);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {errors.root && (
        <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
          {errors.root.message}
        </div>
      )}

      <Input
        label={t("auth.email")}
        id="email"
        type="email"
        placeholder="name@company.com"
        autoComplete="email"
        {...register("email")}
        error={errors.email?.message}
      />

      <Input
        label={t("auth.password")}
        id="password"
        type="password"
        placeholder="••••••••"
        autoComplete="current-password"
        {...register("password")}
        error={errors.password?.message}
      />

      <div className="flex items-center justify-between">
        <Checkbox
          label={t("auth.remember_me")}
          id="remember-me"
          {...register("rememberMe")}
        />
        <div className="text-sm">
          <a
            className="font-medium text-primary hover:text-primary/80 transition-colors"
            href="#"
          >
            {t("auth.forgot_password")}
          </a>
        </div>
      </div>

      <Button className="w-full" type="submit" isLoading={isSubmitting}>
        {t("auth.sign_in")}
      </Button>
    </form>
  );
};
