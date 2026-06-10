import { NextRequest } from "next/server";
import { ApiError, dataResponse, errorResponse } from "@/lib/api/errors";
import { optionalInteger } from "@/lib/api/validation";
import { closeExpiredPolls } from "@/lib/poll-expiration";

export async function POST(request: NextRequest) {
  try {
    assertJobAuth(request);
    const body = (await request.json().catch(() => ({}))) as { limit?: unknown };
    const limit = optionalInteger(body.limit, "limit", { min: 1, max: 500 }) ?? 50;
    return dataResponse(await closeExpiredPolls(limit, "cron"));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    assertJobAuth(request);
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = optionalInteger(limitParam ? Number(limitParam) : undefined, "limit", { min: 1, max: 500 }) ?? 50;
    return dataResponse(await closeExpiredPolls(limit, "cron"));
  } catch (error) {
    return errorResponse(error);
  }
}

function assertJobAuth(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    throw new ApiError("FORBIDDEN", "Invalid job authorization.");
  }
}
