import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api/errors";

export const SESSION_COOKIE_NAME = "meetops_session";
export const OAUTH_STATE_COOKIE_NAME = "meetops_oauth_state";

type SessionPayload = {
  userId: string;
  email: string;
  exp: number;
};

type OAuthStatePayload = {
  nonce: string;
  redirectTo: string;
  exp: number;
};

export type AuthUser = {
  userId: bigint;
  email: string;
  firstname: string | null;
  lastname: string | null;
  profilePhoto: string | null;
  timezone: string;
  joinedAt: Date;
  updatedAt: Date;
};

export function getAppBaseUrl() {
  const explicit = process.env.APP_BASE_URL;
  if (explicit && !looksLikeUnexpandedEnv(explicit) && !isPlaceholder(explicit)) {
    return normalizeBaseUrl(explicit);
  }
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl && !looksLikeUnexpandedEnv(vercelUrl)) {
    return normalizeBaseUrl(vercelUrl);
  }
  return "http://localhost:3000";
}

export function getGoogleRedirectUri() {
  return (
    process.env.GOOGLE_REDIRECT_URI ??
    `${getAppBaseUrl()}/api/auth/google/callback`
  );
}

export function isPlaceholder(value: string | undefined) {
  return !value || value.includes("replace_me") || value.includes("REPLACE_ME");
}

export function safeRedirectUrl(redirectTo: string, origin: string) {
  if (!redirectTo || redirectTo.startsWith("//")) return new URL("/dashboard", origin);
  const url = new URL(redirectTo, origin);
  if (url.origin !== origin) return new URL("/dashboard", origin);
  return url;
}

function normalizeBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function looksLikeUnexpandedEnv(value: string) {
  return value.includes("{") || value.includes("}") || value.includes("$") || value.includes("VERCEL_URL");
}

export function createOAuthState(redirectTo: string) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 10;
  const encodedPayload = Buffer.from(
    JSON.stringify({
      nonce: crypto.randomBytes(32).toString("base64url"),
      redirectTo,
      exp,
    } satisfies OAuthStatePayload),
  ).toString("base64url");
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyOAuthState(value: string): OAuthStatePayload | null {
  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) return null;

  const expected = sign(encodedPayload);
  if (!constantTimeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as OAuthStatePayload;
    if (!payload.nonce || !payload.redirectTo || !payload.exp) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createSessionCookieValue(payload: Omit<SessionPayload, "exp">) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 14;
  const encodedPayload = Buffer.from(
    JSON.stringify({ ...payload, exp } satisfies SessionPayload),
  ).toString("base64url");
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function getAuthUserFromRequest(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) return null;

  const payload = verifySessionCookie(cookie);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { userId: BigInt(payload.userId) },
  });

  return user;
}

export async function requireAuth(request: NextRequest) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    throw new ApiError("UNAUTHENTICATED", "Authentication required.");
  }
  return user;
}

function verifySessionCookie(value: string): SessionPayload | null {
  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) return null;

  const expected = sign(encodedPayload);
  if (!constantTimeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (!payload.userId || !payload.email || !payload.exp) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function sign(value: string) {
  const secret = process.env.SESSION_SECRET ?? process.env.CRON_SECRET;
  if (isPlaceholder(secret)) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "SESSION_SECRET must be configured before auth can run.",
    );
  }
  if (!secret) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "SESSION_SECRET must be configured before auth can run.",
    );
  }
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  };
}
