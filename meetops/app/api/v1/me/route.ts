import { NextRequest } from "next/server";
import { ApiError, dataResponse, errorResponse } from "@/lib/api/errors";
import { requireAuth } from "@/lib/auth/session";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    return dataResponse(toPublicUser(user));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = (await request.json()) as {
      firstname?: unknown;
      lastname?: unknown;
      timezone?: unknown;
    };

    const firstname = optionalString(body.firstname, 60);
    const lastname = optionalString(body.lastname, 60);
    const timezone = optionalTimezone(body.timezone);

    const updated = await prisma.user.update({
      where: { userId: user.userId },
      data: {
        ...(firstname !== undefined ? { firstname } : {}),
        ...(lastname !== undefined ? { lastname } : {}),
        ...(timezone !== undefined ? { timezone } : {}),
      },
    });

    return dataResponse(toPublicUser(updated));
  } catch (error) {
    return errorResponse(error);
  }
}

function toPublicUser(user: {
  userId: bigint;
  email: string;
  firstname: string | null;
  lastname: string | null;
  profilePhoto: string | null;
  timezone: string;
  joinedAt: Date;
  updatedAt: Date;
}) {
  return {
    user_id: Number(user.userId),
    email: user.email,
    firstname: user.firstname,
    lastname: user.lastname,
    profile_photo: user.profilePhoto,
    timezone: user.timezone,
    platform_owner: isPlatformOwnerEmail(user.email),
    joined_at: user.joinedAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
  };
}

function optionalString(value: unknown, maxLength: number) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new ApiError("VALIDATION_ERROR", "Expected string.");
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ApiError(
      "VALIDATION_ERROR",
      `String must be ${maxLength} characters or fewer.`,
    );
  }
  return trimmed.length ? trimmed : null;
}

function optionalTimezone(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "Timezone must be a valid IANA timezone string.",
    );
  }
  const timezone = value.trim();
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return timezone;
  } catch {
    throw new ApiError(
      "VALIDATION_ERROR",
      "Timezone must be a valid IANA timezone string.",
    );
  }
}
