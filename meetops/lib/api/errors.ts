import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "INVALID_INVITE_CODE"
  | "INVITE_DISABLED"
  | "INVITE_EXPIRED"
  | "INVITE_MAX_USES_REACHED"
  | "ALREADY_MEMBER"
  | "NOT_GROUP_MEMBER"
  | "HOST_OR_ADMIN_REQUIRED"
  | "GROUP_ADMIN_REQUIRED"
  | "INVALID_SESSION_STATUS"
  | "INVALID_POLL_STATUS"
  | "POLL_EXPIRED"
  | "POLL_HAS_NO_OPTIONS"
  | "INVALID_POLL_OPTION"
  | "DUPLICATE_VOTE"
  | "SCHEDULING_ALREADY_IN_PROGRESS"
  | "NO_VALID_MEETING_OWNER"
  | "GOOGLE_TOKEN_MISSING"
  | "GOOGLE_TOKEN_REFRESH_FAILED"
  | "GOOGLE_CALENDAR_CREATE_FAILED"
  | "GOOGLE_CALENDAR_UPDATE_FAILED"
  | "GOOGLE_MEET_LINK_MISSING"
  | "DATABASE_ERROR";

const statusByCode: Record<ApiErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  INVALID_INVITE_CODE: 404,
  INVITE_DISABLED: 403,
  INVITE_EXPIRED: 410,
  INVITE_MAX_USES_REACHED: 409,
  ALREADY_MEMBER: 409,
  NOT_GROUP_MEMBER: 403,
  HOST_OR_ADMIN_REQUIRED: 403,
  GROUP_ADMIN_REQUIRED: 403,
  INVALID_SESSION_STATUS: 409,
  INVALID_POLL_STATUS: 409,
  POLL_EXPIRED: 409,
  POLL_HAS_NO_OPTIONS: 422,
  INVALID_POLL_OPTION: 400,
  DUPLICATE_VOTE: 409,
  SCHEDULING_ALREADY_IN_PROGRESS: 409,
  NO_VALID_MEETING_OWNER: 422,
  GOOGLE_TOKEN_MISSING: 422,
  GOOGLE_TOKEN_REFRESH_FAILED: 502,
  GOOGLE_CALENDAR_CREATE_FAILED: 502,
  GOOGLE_CALENDAR_UPDATE_FAILED: 502,
  GOOGLE_MEET_LINK_MISSING: 502,
  DATABASE_ERROR: 500,
};

export class ApiError extends Error {
  code: ApiErrorCode;
  details: Record<string, unknown>;
  status: number;

  constructor(
    code: ApiErrorCode,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.code = code;
    this.details = details;
    this.status = statusByCode[code];
  }
}

export function dataResponse<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function listResponse<T>(
  data: T[],
  page: { limit: number; offset: number; total: number },
  init?: ResponseInit,
) {
  return NextResponse.json({ data, page }, init);
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status },
    );
  }

  console.error(error);
  return NextResponse.json(
    {
      error: {
        code: "DATABASE_ERROR",
        message: "Unexpected server error.",
        details: {},
      },
    },
    { status: 500 },
  );
}
