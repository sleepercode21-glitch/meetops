import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/", request.nextUrl.origin));
}

export async function POST(request: NextRequest) {
  return clearSession(request);
}

function clearSession(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.nextUrl.origin));
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
