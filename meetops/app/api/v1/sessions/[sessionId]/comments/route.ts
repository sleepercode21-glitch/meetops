import { NextRequest } from "next/server";
import { ApiError, dataResponse, errorResponse } from "@/lib/api/errors";
import { requireSessionAccess } from "@/lib/api/guards";
import { optionalString, parseBigIntParam } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ sessionId: string }> };

type SessionCommentRow = {
  session_comment_id: bigint;
  session_id: bigint;
  user_id: bigint;
  author_firstname: string | null;
  author_lastname: string | null;
  author_email: string;
  body: string;
  created_at: Date;
};

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { sessionId: id } = await context.params;
    const sessionId = parseBigIntParam(id, "sessionId");
    await requireSessionAccess(user.userId, sessionId);

    const comments = await prisma.$queryRaw<SessionCommentRow[]>`
      select
        sc.session_comment_id,
        sc.session_id,
        sc.user_id,
        u.firstname as author_firstname,
        u.lastname as author_lastname,
        u.email as author_email,
        sc.body,
        sc.created_at
      from session_comments sc
      join users u on u.user_id = sc.user_id
      where sc.session_id = ${sessionId}
      order by sc.created_at asc, sc.session_comment_id asc
      limit 100
    `;

    return dataResponse(comments.map(commentResponse));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { sessionId: id } = await context.params;
    const sessionId = parseBigIntParam(id, "sessionId");
    const { session } = await requireSessionAccess(user.userId, sessionId);

    if (session.status === "cancelled" || session.status === "completed") {
      throw new ApiError("INVALID_SESSION_STATUS", "Comments are closed for this session.");
    }

    const body = (await request.json()) as { body?: unknown };
    const text = optionalString(body.body, "comment", 1000, { required: true });
    if (!text) {
      throw new ApiError("VALIDATION_ERROR", "Comment is required.");
    }

    const [created] = await prisma.$queryRaw<SessionCommentRow[]>`
      insert into session_comments (session_id, user_id, body)
      values (${sessionId}, ${user.userId}, ${text})
      returning
        session_comment_id,
        session_id,
        user_id,
        (select firstname from users where user_id = ${user.userId}) as author_firstname,
        (select lastname from users where user_id = ${user.userId}) as author_lastname,
        (select email from users where user_id = ${user.userId}) as author_email,
        body,
        created_at
    `;

    return dataResponse(commentResponse(created), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

function commentResponse(row: SessionCommentRow) {
  const authorName = [row.author_firstname, row.author_lastname].filter(Boolean).join(" ") || row.author_email;
  return {
    comment_id: Number(row.session_comment_id),
    session_id: Number(row.session_id),
    user_id: Number(row.user_id),
    author_name: authorName,
    body: row.body,
    created_at: row.created_at.toISOString(),
  };
}
