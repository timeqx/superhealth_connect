"use client";
import { useSnackbar } from "@/shared/ui/snackbar";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { sendInquiry } from "@/server/actions";
export function InquiryForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm({
    defaultValues: { subject: "", category: "General", body: "" },
  });
  const notify = useSnackbar();
  const [request, setRequest] = useState<{
    payload: string;
    key: string;
  } | null>(null);
  return (
    <form
      className="form"
      onSubmit={handleSubmit(async (values) => {
        const payload = JSON.stringify(values);
        const attempt =
          request?.payload === payload
            ? request
            : { payload, key: crypto.randomUUID() };
        setRequest(attempt);
        try {
        const result = await sendInquiry({ ...values, key: attempt.key });
        notify(result.message, !result.ok);
        if (result.ok) {
          reset();
          setRequest(null);
        }
        } catch { notify("Connection interrupted. Retry unchanged to confirm your inquiry.", true); }
      })}
    >
      <label className="field">
        Subject
        <input
          required
          minLength={3}
          maxLength={120}
          {...register("subject")}
        />
      </label>
      <label className="field">
        Category
        <select {...register("category")}>
          {["General", "Appointments", "Account", "Services"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="field">
        Message
        <textarea required maxLength={4000} {...register("body")} />
      </label>
      <p>Do not include medical records or identity document numbers.</p>
      <button className="button" disabled={isSubmitting}>
        {isSubmitting ? "Sending…" : "Send inquiry"}
      </button>
    </form>
  );
}
