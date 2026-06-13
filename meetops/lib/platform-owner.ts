import { prisma } from "@/lib/prisma";

const defaultPlatformOwnerEmail = "sleepercode21@gmail.com";

export function isPlatformOwnerEmail(email: string | null | undefined) {
  const ownerEmail = process.env.PLATFORM_OWNER_EMAIL ?? defaultPlatformOwnerEmail;
  return Boolean(email && email.toLowerCase() === ownerEmail.toLowerCase());
}

export async function isPlatformOwnerUserId(userId: bigint) {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { email: true },
  });
  return isPlatformOwnerEmail(user?.email);
}
