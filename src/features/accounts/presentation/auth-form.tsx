"use client";
import { useSnackbar } from "@/shared/ui/snackbar";
import { useForm } from "react-hook-form";
import { authenticate } from "../application/auth-actions";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
export function AuthForm({
  mode,
}: {
  mode: "sign-in" | "forgot" | "reset";
}) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm({ defaultValues: { email: "", password: "", consent: false } });
  const notify = useSnackbar();
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  return (
    <form
      className="form"
      onSubmit={handleSubmit(async (values) => {
        try {
          const result = await authenticate(mode, values);
          notify(result.message, !result.ok);
          if (result.redirectTo) {
            startNavigation(() => { router.replace(result.redirectTo!); router.refresh(); });
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
      <Button type="submit" disabled={isSubmitting || navigating}>
        {isSubmitting || navigating
          ? "Please wait…"
          : {
              "sign-in": "Sign in",

              forgot: "Send reset link",
              reset: "Update password",
            }[mode]}
      </Button>
      
    </form>
  );
}
