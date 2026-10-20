"use client";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { barangays, type Profile } from "../domain/validation";
import { saveProfile } from "@/server/actions";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useRouter } from "next/navigation";
export function ProfileForm({ profile }: { profile: Profile }) {
  const {
    register,
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = useForm({
    defaultValues: {
      first: profile.first_name,
      middle: profile.middle_name,
      last: profile.last_name,
      barangay: profile.barangay_code || "Batasan Hills",
      other: profile.other_barangay || "",
      phone: profile.phone || "",
    },
  });
  const barangay = useWatch({ control, name: "barangay" });
  const [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <form
      className="form"
      onSubmit={handleSubmit(async (input) => {
        try {
          const result = await saveProfile(input);
          setMessage(result.message);
          if (result.ok) router.refresh();
        } catch {
          setMessage(
            "Your profile could not be saved. Your entries are still here; try again.",
          );
        }
      })}
    >
      <label className="field">
        First name
        <Input
          required
          maxLength={80}
          autoComplete="given-name"
          {...register("first")}
        />
      </label>
      <label className="field">
        Middle name (optional)
        <Input
          maxLength={80}
          autoComplete="additional-name"
          {...register("middle")}
        />
      </label>
      <label className="field">
        Last name
        <Input
          required
          maxLength={80}
          autoComplete="family-name"
          {...register("last")}
        />
      </label>
      <label className="field">
        Barangay
        <select {...register("barangay")}>
          {barangays.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </label>
      {barangay === "Others" && (
        <label className="field">
          Your barangay
          <Input required maxLength={100} {...register("other")} />
        </label>
      )}
      <label className="field">
        Mobile number
        <Input type="tel" required autoComplete="tel" {...register("phone")} />
      </label>
      <p>
        Phone numbers are contact details and are not automatically verified.
      </p>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
