import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCode, fetchGoogleProfile, upsertGoogleUserAndOAuthAccount } from "@/lib/auth/google";
import {
  createSessionCookieValue,
  getAppBaseUrl,
  getGoogleRedirectUri,
  isPlaceholder,
  OAUTH_STATE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  verifyOAuthState,
} from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const appBaseUrl = getAppBaseUrl();

  try {
    if (
      isPlaceholder(process.env.GOOGLE_CLIENT_ID) ||
      isPlaceholder(process.env.GOOGLE_CLIENT_SECRET)
    ) {
      throw new Error("Google OAuth credentials are not configured.");
    }

    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const storedState = request.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value;

    if (!code || !state) {
      throw new Error("Google OAuth callback is missing required state.");
    }

    if (storedState && state !== storedState) {
      throw new Error("Google OAuth state did not match.");
    }
    const statePayload = verifyOAuthState(state);
    if (!statePayload) {
      throw new Error("Google OAuth state was invalid or expired.");
    }
    const redirectTo = statePayload.redirectTo;

    const tokens = await exchangeGoogleCode({
      code,
      redirectUri: getGoogleRedirectUri(),
    });
    const profile = await fetchGoogleProfile(tokens.access_token);
    const user = await upsertGoogleUserAndOAuthAccount({ profile, tokens });

    const response = NextResponse.redirect(new URL(redirectTo, appBaseUrl));
    response.cookies.set(
      SESSION_COOKIE_NAME,
      createSessionCookieValue({
        userId: user.userId.toString(),
        email: user.email,
      }),
      sessionCookieOptions(),
    );
    response.cookies.delete(OAUTH_STATE_COOKIE_NAME);

    return response;
  } catch (error) {
    console.error(error);
    const response = NextResponse.redirect(
      new URL("/auth/callback?error=google_sign_in_failed", appBaseUrl),
    );
    response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
    return response;
  }
}
