import { prisma } from "@/lib/prisma";

const googleTokenUrl = "https://oauth2.googleapis.com/token";
const googleUserInfoUrl = "https://openidconnect.googleapis.com/v1/userinfo";

type GoogleTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

type GoogleProfile = {
  sub: string;
  email: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

export async function exchangeGoogleCode({
  code,
  redirectUri,
}: {
  code: string;
  redirectUri: string;
}) {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch(googleTokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${response.status}`);
  }

  return (await response.json()) as GoogleTokenResponse;
}

export async function fetchGoogleProfile(accessToken: string) {
  const response = await fetch(googleUserInfoUrl, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Google profile fetch failed: ${response.status}`);
  }

  const profile = (await response.json()) as GoogleProfile;
  if (!profile.email || !profile.sub) {
    throw new Error("Google profile did not include required identity fields.");
  }

  return profile;
}

export async function upsertGoogleUserAndOAuthAccount({
  profile,
  tokens,
  timezone,
}: {
  profile: GoogleProfile;
  tokens: GoogleTokenResponse;
  timezone?: string;
}) {
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : null;
  const initialTimezone = validTimezone(timezone) ?? "America/Phoenix";

  const user = await prisma.user.upsert({
    where: { email: profile.email },
    create: {
      email: profile.email,
      firstname: profile.given_name,
      lastname: profile.family_name,
      profilePhoto: profile.picture,
      timezone: initialTimezone,
    },
    update: {
      firstname: profile.given_name,
      lastname: profile.family_name,
      profilePhoto: profile.picture,
    },
  });

  await prisma.oAuthAccount.upsert({
    where: {
      provider_providerAccountId: {
        provider: "google",
        providerAccountId: profile.sub,
      },
    },
    create: {
      userId: user.userId,
      provider: "google",
      providerAccountId: profile.sub,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessTokenExpiresAt: expiresAt,
      scope: tokens.scope,
      tokenType: tokens.token_type,
    },
    update: {
      userId: user.userId,
      accessToken: tokens.access_token,
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      accessTokenExpiresAt: expiresAt,
      scope: tokens.scope,
      tokenType: tokens.token_type,
    },
  });

  return user;
}

function validTimezone(value: string | undefined) {
  if (!value) return null;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return value;
  } catch {
    return null;
  }
}
