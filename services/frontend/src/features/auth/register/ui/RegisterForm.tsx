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

const registerSchema = z.object({
  fullname: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
  terms: z.boolean().refine(val => val === true, {
    message: "You must agree to the terms and conditions",
  }),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export const RegisterForm: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setUser = useUserStore((state) => state.setUser);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullname: "",
      email: "",
      password: "",
      terms: false,
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    try {
      const response = await userApi.register({
        email: data.email,
        password: data.password,
        full_name: data.fullname,
      });
      const { user, tokens } = response.data;
      localStorage.setItem("token", tokens.access_token);
      localStorage.setItem("user_id", user.id);
      setUser(user);
      toast.success(t("auth.account_created"));
      navigate("/dashboard");
    } catch (_err: unknown) {
      const apiError = _err as { response?: { data?: { error?: string } } };
      const msg = apiError.response?.data?.error || t("auth.registration_failed");
      setError("root", { message: msg });
      toast.error(msg);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {errors.root && (
        <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
          {errors.root.message}
        </div>
      )}

      <Input
        label={t("auth.full_name")}
        id="fullname"
        type="text"
        placeholder="e.g. Sarah Connor"
        {...register("fullname")}
        error={errors.fullname?.message}
      />

      <Input
        label={t("auth.work_email")}
        id="email"
        type="email"
        placeholder="name@company.com"
        {...register("email")}
        error={errors.email?.message}
      />

      <Input
        label={t("auth.password")}
        id="password"
        type="password"
        placeholder="Create a password"
        {...register("password")}
        error={errors.password?.message}
      />

      <Checkbox
        id="terms"
        {...register("terms")}
        error={errors.terms?.message}
        label={
          <>
            {t("auth.terms_agree")}{" "}
            <a
              className="font-semibold text-primary hover:text-blue-600 dark:hover:text-blue-400"
              href="#"
              onClick={(e) => e.stopPropagation()}
            >
              {t("auth.terms_service")}
            </a>{" "}
            {t("auth.and")}{" "}
            <a
              className="font-semibold text-primary hover:text-blue-600 dark:hover:text-blue-400"
              href="#"
              onClick={(e) => e.stopPropagation()}
            >
              {t("auth.privacy_policy")}
            </a>
            .
          </>
        }
      />

      <Button
        className="w-full"
        type="submit"
        isLoading={isSubmitting}
      >
        {t("auth.continue")}
        <span className="material-icons text-sm ml-2">
          arrow_forward
        </span>
      </Button>
    </form>
  );
};
