import { NextRequest, NextResponse } from "next/server";
import {
  createOAuthState,
  getGoogleRedirectUri,
  isPlaceholder,
  OAUTH_STATE_COOKIE_NAME,
} from "@/lib/auth/session";
import { ApiError, errorResponse } from "@/lib/api/errors";

const googleAuthUrl = "https://accounts.google.com/o/oauth2/v2/auth";
const googleScopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
];

export async function GET(request: NextRequest) {
  try {
    if (isPlaceholder(process.env.GOOGLE_CLIENT_ID)) {
      throw new ApiError(
        "VALIDATION_ERROR",
        "GOOGLE_CLIENT_ID must be configured before Google sign-in can start.",
      );
    }

    const redirectTo = request.nextUrl.searchParams.get("redirect_to") ?? "/dashboard";
    const state = createOAuthState(redirectTo);
    const authUrl = new URL(googleAuthUrl);

    authUrl.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "");
    authUrl.searchParams.set("redirect_uri", getGoogleRedirectUri());
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", googleScopes.join(" "));
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);

    const response = NextResponse.redirect(authUrl);
    response.cookies.set(OAUTH_STATE_COOKIE_NAME, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });

    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
