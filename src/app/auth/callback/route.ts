import { NextResponse, type NextRequest } from "next/server";
import { serverClient } from "@/shared/supabase/server";
import { resumeRegistration } from "@/features/accounts/application/registration-actions";
import { needsRegistration } from "@/features/accounts/domain/registration";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next =
    request.nextUrl.searchParams.get("next") === "/reset-password"
      ? "/reset-password"
      : "/patient";
  if (code) {
    const { data, error } = await (
      await serverClient()
    ).auth.exchangeCodeForSession(code);
    if (!error && next !== "/reset-password" && data.user && needsRegistration(data.user.user_metadata)) await resumeRegistration();
    if (!error) return NextResponse.redirect(new URL(next !== "/reset-password" && data.user && needsRegistration(data.user.user_metadata) ? "/register" : next, request.url));
  }
  return NextResponse.redirect(
    new URL("/sign-in?error=verification", request.url),
  );
}
