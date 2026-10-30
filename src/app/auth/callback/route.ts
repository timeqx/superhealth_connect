import { NextResponse, type NextRequest } from "next/server";
import { serverClient } from "@/shared/supabase/server";
import { resumeRegistration } from "@/features/accounts/application/registration-actions";
import { needsRegistration } from "@/features/accounts/domain/registration";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedNext = request.nextUrl.searchParams.get("next");
  const isReset = requestedNext === "/reset-password" || requestedNext === "/staff/reset-password";
  const next = isReset ? requestedNext : "/patient";
  if (code) {
    const { data, error } = await (
      await serverClient()
    ).auth.exchangeCodeForSession(code);
    if (!error && !isReset && data.user && needsRegistration(data.user.user_metadata)) await resumeRegistration();
    if (!error) return NextResponse.redirect(new URL(!isReset && data.user && needsRegistration(data.user.user_metadata) ? "/register" : next, request.url));
  }
  return NextResponse.redirect(
    new URL(requestedNext === "/staff/reset-password" ? "/staff/sign-in?error=verification" : "/sign-in?error=verification", request.url),
  );
}
