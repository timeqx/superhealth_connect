"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { barangays, type Profile } from "../domain/validation";
import { profileValues, signupContactSchema } from "../domain/registration";
import { completeRegistration, saveRegistrationDetails, sendRegistrationLink, resumeRegistration } from "../application/registration-actions";
import { VerificationUpload } from "./verification-upload";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ContentTransition } from "@/shared/ui/content-transition";

const steps = ["Name", "Barangay", "Contact", "QC ID", "Password"];

export function RegistrationForm({ initialStep = 0, profile, verifiedEmail = "", uploadsConfigured, draft }: {
  initialStep?: 0 | 2 | 3 | 4; draft?: ReturnType<typeof profileValues>; profile?: Profile; verifiedEmail?: string; uploadsConfigured: boolean;
}) {
  const [step, setStep] = useState<number>(initialStep);
  const [details, setDetails] = useState(draft ?? profileValues(profile));
  const [email, setEmail] = useState(verifiedEmail);
  const [consent, setConsent] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const verified = Boolean(verifiedEmail);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [message, setMessage] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
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
      } catch { /* Keep the form available while offline; retry on focus. */ }
      finally { checking = false; }
    }
    const interval = window.setInterval(() => { if (!stopped) void check(); }, 5000);
    const onFocus = () => { if (!stopped) void check(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    void check();
    return () => { stopped = true; clearInterval(interval); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, [linkSent, verified, router]);
  function navigate(path: string) {
    startNavigation(() => { router.replace(path); router.refresh(); });
  }
  const payload = { profile: details, email, consent };

  function move(next: number) {
    setStep(next);
    setMessage("");
    requestAnimationFrame(() => heading.current?.focus());
  }

  async function run(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setMessage("");
    try { await action(); }
    catch { setMessage("Connection interrupted. Your entries are still here. Try again; if your email was already verified, reload to resume registration."); }
    finally { busy.current = false; setPending(false); }
  }

  async function saveDetails() {
    const result = await saveRegistrationDetails(payload);
    setMessage(result.message);
    if (result.ok && result.redirectTo) {
      if (result.redirectTo === "/register") { move(3); router.refresh(); }
      else navigate(result.redirectTo);
    }
  }

  return <ContentTransition className="registration-flow" changeKey={String(step)}>
    <ol className="registration-steps" aria-label="Registration progress">
      {steps.map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined} data-complete={index < step}>
        <span aria-hidden="true">{index < step ? "✓" : index + 1}</span>{label}
      </li>)}
    </ol>
    <h2 ref={heading} tabIndex={-1}>Step {step + 1} of 5 · {steps[step]}</h2>
    {step === 3 ? <>
      <p role="status">Email verified. Continue with your QC ID.</p>
      <VerificationUpload configured={uploadsConfigured} onComplete={() => { move(4); router.refresh(); }} submitLabel="Upload QC ID & continue" />
      <p className="caption">Next, create the password you’ll use to sign in. Staff review is separate from registration.</p>
    </> : <form className="form" onSubmit={event => {
      event.preventDefault();
      if (step < 2) { move(step + 1); return; }
      if (step === 4) {
        const data = new FormData(event.currentTarget);
        void run(async () => {
          const result = await completeRegistration({ password: data.get("password"), confirm: data.get("confirm") });
          setMessage(result.message);
          if (result.ok && result.redirectTo) navigate(result.redirectTo);
        });
        return;
      }
      void run(async () => {
        const parsed = signupContactSchema.safeParse(payload);
        if (!parsed.success) { setMessage(parsed.error.issues[0].message); return; }
        if (verified) { await saveDetails(); return; }
        const result = await sendRegistrationLink(payload);
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
          <label className="field">Email address<Input type="email" autoComplete="email" required maxLength={254} readOnly={verified || linkSent} value={email} onChange={e => setEmail(e.target.value)} /></label>
          <p className="caption">Open the verification link in your email using this browser. Your mobile number is saved for contact and is not SMS-verified.</p>
          <label className="registration-consent"><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} /><span>I have read the <a href="/privacy" target="_blank" rel="noreferrer">privacy notice</a>.</span></label>

          {verified && <p role="status">Email verified.</p>}
        </>}
        {step === 4 && <>
          <p>Your QC ID has been received. Use your verified email as your username.</p>
          <label className="field">Verified email<Input type="email" autoComplete="username" value={verifiedEmail || email} readOnly /></label>
          <label className="field">Password<Input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
          <label className="field">Confirm password<Input name="confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
          <p className="caption">Use at least 12 characters. Completing registration does not approve your account for appointments.</p>
        </>}
        <div className="registration-actions">
          {step > 0 && step < 3 && <Button type="button" variant="outline" onClick={() => move(step - 1)}>Back</Button>}
          <Button type="submit">{pending ? "Please wait…" : step < 2 ? "Continue" : step === 4 ? "Complete registration" : verified ? "Save details & continue" : linkSent ? "Resend verification email" : "Send verification email"}</Button>
        </div>
        {step === 2 && linkSent && !verified && <div className="registration-actions">
          <Button type="button" variant="ghost" onClick={() => { setLinkSent(false); setMessage(""); }}>Change email</Button>
        </div>}
        {step === 2 && linkSent && !verified && <p className="notice" role="status">Check your inbox and spam folder. Open the link in the same browser. This page will continue automatically when you return.</p>}
      </fieldset>
    </form>}
    {message && <p role="status" className="notice">{message}</p>}
  </ContentTransition>;
}
