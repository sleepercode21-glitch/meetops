import { NextResponse } from "next/server";
import { getAppBaseUrl, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function GET() {
  return clearSession();
}

export async function POST() {
  return clearSession();
}

function clearSession() {
  const response = NextResponse.redirect(new URL("/", getAppBaseUrl()));
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
