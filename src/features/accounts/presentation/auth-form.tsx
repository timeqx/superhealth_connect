"use client";
import { useSnackbar } from "@/shared/ui/snackbar";
import { useForm } from "react-hook-form";
import { authenticate } from "../application/auth-actions";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
export function AuthForm({
  mode,
}: {
  mode: "sign-in" | "register" | "forgot" | "reset";
}) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm({ defaultValues: { email: "", password: "", consent: false } });
  const notify = useSnackbar();
  return (
    <form
      className="form"
      onSubmit={handleSubmit(async (values) => {
        try {
          const result = await authenticate(mode, values);
          notify(result.message, !result.ok);
          if (result.redirectTo) {
            try { sessionStorage.setItem("auth-feedback", mode === "reset" ? "password-updated" : "signed-in"); } catch { /* Storage may be disabled. */ }
            window.location.assign(result.redirectTo);
          }
        } catch { notify("Unable to connect. Please try signing in again.", true); }
      })}
    >
      {mode !== "reset" && (
        <label className="field">
          Email address
          <Input
            type="email"
            autoComplete="email"
            required
            {...register("email")}
          />
        </label>
      )}
      {mode !== "forgot" && (
        <label className="field">
          {mode === "reset" ? "New password" : "Password"}
          <Input
            type="password"
            autoComplete={
              mode === "sign-in" ? "current-password" : "new-password"
            }
            minLength={mode === "sign-in" ? 1 : 12}
            maxLength={128}
            required
            {...register("password")}
          />
        </label>
      )}
      {mode === "register" && (
        <label>
          <input
            style={{ width: 20, minHeight: 20, marginRight: 10 }}
            type="checkbox"
            required
            {...register("consent")}
          />
          I have read the <a href="/privacy">development privacy notice</a> and
          will use synthetic information.
        </label>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting
          ? "Please wait…"
          : {
              "sign-in": "Sign in",
              register: "Create account & verify email",
              forgot: "Send reset link",
              reset: "Update password",
            }[mode]}
      </Button>
    </form>
  );
}
