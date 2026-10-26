"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { barangays, inspectDocument, profileSchema, type Profile } from "../domain/validation";
import { profileValues, signupAccountSchema } from "../domain/registration";
import { completeRegistration, resendRegistrationLink, saveRegistrationDetails, sendRegistrationLink, resumeRegistration } from "../application/registration-actions";
import { uploadVerification } from "../application/verification-actions";
import { deleteRegistrationDocument, readRegistrationDocument, saveRegistrationDocument } from "./registration-document-draft";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ContentTransition } from "@/shared/ui/content-transition";

export function RegistrationForm({ initialStep = 0, profile, verifiedEmail = "", uploadsConfigured, draft, documentDraftId, needsPassword = false }: {
  initialStep?: 0 | 2 | 3; draft?: ReturnType<typeof profileValues>; profile?: Profile; verifiedEmail?: string; uploadsConfigured: boolean; documentDraftId?: string; needsPassword?: boolean;
}) {
  const [step, setStep] = useState<number>(initialStep);
  const [details, setDetails] = useState(draft ?? profileValues(profile));
  const [email, setEmail] = useState(verifiedEmail);
  const [consent, setConsent] = useState(Boolean(verifiedEmail));
  const [linkSent, setLinkSent] = useState(false);
  const [qcIdDraftId, setQcIdDraftId] = useState(documentDraftId);
  const verified = Boolean(verifiedEmail);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const autoUploadAttempted = useRef(false);
  const [message, setMessage] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const steps = ["Name", "Barangay", "Mobile & QC ID", "Account"];
  const payload = { profile: details, email, consent };

  const navigate = useCallback((path: string) => {
    startNavigation(() => { router.replace(path); router.refresh(); });
  }, [router]);

  const run = useCallback(async (action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setMessage("");
    try { await action(); }
    catch { setMessage("Connection interrupted. Your entries are still here. Try again; if your email was already verified, reload to resume registration."); }
    finally { busy.current = false; setPending(false); }
  }, []);

  const finishRegistration = useCallback(async (input?: unknown) => {
    const result = await completeRegistration(input);
    setMessage(result.message);
    if (result.ok && result.redirectTo) navigate(result.redirectTo);
  }, [navigate]);

  function move(next: number) {
    setStep(next);
    setMessage("");
    requestAnimationFrame(() => heading.current?.focus());
  }

  async function saveDetails() {
    const result = await saveRegistrationDetails({ ...payload, consent: true });
    setMessage(result.message);
    if (result.ok && result.redirectTo) {
      if (result.redirectTo === "/register") { move(3); router.refresh(); }
      else navigate(result.redirectTo);
    }
  }

  useEffect(() => {
    if (!linkSent || verified) return;
    let stopped = false;
    let checking = false;
    async function check() {
      if (checking || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const result = await resumeRegistration();
        if (!stopped && result.ok && result.redirectTo) {
          stopped = true;
          router.replace(result.redirectTo);
          router.refresh();
        }
      } catch {}
      finally { checking = false; }
    }
    const interval = window.setInterval(() => { if (!stopped) void check(); }, 5000);
    const onFocus = () => { if (!stopped) void check(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    void check();
    return () => { stopped = true; clearInterval(interval); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, [linkSent, verified, router]);

  useEffect(() => {
    if (step !== 3 || !verified || (needsPassword && !qcIdDraftId) || autoUploadAttempted.current) return;
    autoUploadAttempted.current = true;
    void run(async () => {
      if (qcIdDraftId) {
        const file = await readRegistrationDocument(qcIdDraftId);
        if (!file) {
          setMessage("The selected QC ID could not be restored in this browser. You can skip it now and upload it later from your profile.");
          return;
        }
        const form = new FormData();
        form.set("document", file, file.name);
        form.set("key", qcIdDraftId);
        const result = await uploadVerification(form);
        setMessage(result.message);
        if (!result.ok) return;
        try { await deleteRegistrationDocument(qcIdDraftId); } catch {}
      }
      if (!needsPassword) await finishRegistration();
    });
  }, [step, verified, qcIdDraftId, needsPassword, run, finishRegistration]);

  return <ContentTransition className="registration-flow" changeKey={String(step)}>
    <ol className="registration-steps" aria-label="Registration progress">
      {steps.map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined} data-complete={index < step}>
        <span aria-hidden="true">{index < step ? "✓" : index + 1}</span>{label}
      </li>)}
    </ol>
    <h2 ref={heading} tabIndex={-1}>Step {step + 1} of {steps.length} · {steps[step]}</h2>
    <form className="form" onSubmit={event => {
      event.preventDefault();
      if (step < 2) { move(step + 1); return; }
      if (step === 2) {
        const parsed = profileSchema.safeParse(details);
        if (!parsed.success) { setMessage(parsed.error.issues[0].message); return; }
        if (verified) {
          void run(async () => { await saveDetails(); });
          return;
        }
        const form = event.currentTarget;
        const fileInput = form.elements.namedItem("document") as HTMLInputElement | null;
        const file = fileInput?.files?.[0];
        void run(async () => {
          if (file) {
            if (file.size === 0 || file.size > 5 * 1024 * 1024) {
              setMessage("Use a file between 1 byte and 5 MB.");
              return;
            }
            try {
              inspectDocument(new Uint8Array(await file.arrayBuffer()), file.name, file.type);
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Choose a valid QC ID file.");
              return;
            }
            const previousId = qcIdDraftId;
            const id = await saveRegistrationDocument(file);
            if (previousId) { try { await deleteRegistrationDocument(previousId); } catch {} }
            setQcIdDraftId(id);
          }
          move(3);
        });
        return;
      }
      if (verified) {
        const data = needsPassword ? new FormData(event.currentTarget) : null;
        const input = needsPassword ? { password: data?.get("password"), confirm: data?.get("confirm") } : undefined;
        void run(async () => { await finishRegistration(input); });
        return;
      }
      if (linkSent) {
        void run(async () => {
          const result = await resendRegistrationLink(email);
          setMessage(result.message);
        });
        return;
      }
      const data = new FormData(event.currentTarget);
      const parsed = signupAccountSchema.safeParse({
        ...payload,
        password: data.get("password"),
        confirm: data.get("confirm"),
        qcIdDraftId,
      });
      if (!parsed.success) { setMessage(parsed.error.issues[0].message); return; }
      void run(async () => {
        const result = await sendRegistrationLink(parsed.data);
        setMessage(result.message);
        if (result.ok) setLinkSent(true);
      });
    }}>
      <fieldset disabled={pending || navigating} className="registration-fields">
        {step === 0 && <>
          <p>Enter your name as it appears on your QC ID.</p>
          <label className="field">Last name<Input autoComplete="family-name" required maxLength={80} value={details.last} onChange={e => setDetails({ ...details, last: e.target.value })} /></label>
          <label className="field">First name<Input autoComplete="given-name" required maxLength={80} value={details.first} onChange={e => setDetails({ ...details, first: e.target.value })} /></label>
          <label className="field">Middle name (optional)<Input autoComplete="additional-name" maxLength={80} value={details.middle} onChange={e => setDetails({ ...details, middle: e.target.value })} /></label>
        </>}
        {step === 1 && <>
          <label className="field">Barangay<select required value={details.barangay} onChange={e => setDetails({ ...details, barangay: e.target.value, other: "" })}>
            <option value="">Choose your barangay</option>
            {barangays.map(barangay => <option key={barangay}>{barangay}</option>)}
          </select></label>
          {details.barangay === "Others" && <label className="field">Your barangay<Input required minLength={2} maxLength={100} value={details.other} onChange={e => setDetails({ ...details, other: e.target.value })} /></label>}
        </>}
        {step === 2 && <>
          <label className="field">Mobile number<Input type="tel" autoComplete="tel" required maxLength={30} value={details.phone} onChange={e => setDetails({ ...details, phone: e.target.value })} /></label>
          {!verified && <>
            <label className="field">QC ID photo or PDF (optional)<Input name="document" type="file" accept=".jpg,.jpeg,.png,.pdf" disabled={!uploadsConfigured} /></label>
            <p className="caption">{uploadsConfigured ? "A selected file stays in this browser until email confirmation, then uploads privately. Confirm using the same browser. You can skip it and upload it later from your profile. Appointment requests open after staff approval." : "Private uploads are temporarily unavailable. You can continue without the QC ID and contact staff or upload it later from your profile."}</p>
          </>}
          {verified && <p className="caption">Your mobile number is saved. Continue to your account details.</p>}
        </>}
        {step === 3 && <>
          {!verified ? <>
            <p>Set the email and password you’ll use to sign in.</p>
            <label className="field">Email address<Input type="email" autoComplete="email" required maxLength={254} readOnly={linkSent} value={email} onChange={e => setEmail(e.target.value)} /></label>
            {!linkSent && <>
              <label className="field">Password<Input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
              <label className="field">Confirm password<Input name="confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
              <p className="caption">Use at least 12 characters.</p>
              <label className="registration-consent"><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} /><span>I have read the <a href="/privacy" target="_blank" rel="noreferrer">privacy notice</a>.</span></label>
            </>}
            {linkSent && <p className="notice" role="status">Check your inbox and spam folder. Open the confirmation link in the same browser to finish. You can resend it below.</p>}
          </> : <>
            <p role="status">Email confirmed. Your password is ready for sign-in.</p>
            {needsPassword && <>
              <label className="field">Password<Input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
              <label className="field">Confirm password<Input name="confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
              <p className="caption">Use at least 12 characters.</p>
            </>}
            <p className="caption">You can sign in after email confirmation. Staff approval is required before appointment requests. If you skipped your QC ID, upload it later from your profile.</p>
          </>}
        </>}
        <div className="registration-actions">
          {step > 0 && step < 3 && <Button type="button" variant="outline" onClick={() => move(step - 1)}>Back</Button>}
          {step === 2 && !verified && <Button type="button" variant="outline" onClick={() => void run(async () => {
            if (qcIdDraftId) { try { await deleteRegistrationDocument(qcIdDraftId); } catch {} }
            setQcIdDraftId(undefined);
            move(3);
          })}>Skip QC ID for now</Button>}
          <Button type="submit">{pending ? "Please wait…" : step < 2 ? "Continue" : step === 2 ? "Continue" : verified ? "Finish registration" : linkSent ? "Resend confirmation email" : "Send confirmation email"}</Button>
        </div>
        {step === 3 && linkSent && !verified && <div className="registration-actions">
          <Button type="button" variant="ghost" onClick={() => { setLinkSent(false); setMessage(""); }}>Change email</Button>
        </div>}
      </fieldset>
    </form>
    {message && <p role="status" className="notice">{message}</p>}
  </ContentTransition>;
}
