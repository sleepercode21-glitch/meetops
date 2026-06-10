import type { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api/errors";

export async function uniqueInviteCode(tx: Prisma.TransactionClient) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateInviteCode();
    const existing = await tx.group.findUnique({
      where: { inviteCode: code },
      select: { groupId: true },
    });
    if (!existing) return code;
  }

  throw new ApiError(
    "DATABASE_ERROR",
    "Could not generate a unique invite code.",
  );
}

function generateInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "TECHUP";
  for (let index = 0; index < 4; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
