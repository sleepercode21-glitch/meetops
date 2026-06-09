import { ButtonLink } from "@/components/common/Buttons";
import { Card } from "@/components/common/Card";
import { groups } from "@/lib/mock-data";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = await params;
  const group = groups.find((item) => item.inviteCode.toLowerCase() === inviteCode.toLowerCase());

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <Card className="w-full max-w-lg">
        <h1 className="text-xl font-semibold">{group ? `Join ${group.name}` : "This invite link is invalid."}</h1>
        <p className="mt-2 text-sm text-zinc-600">
          {group ? group.description : "Ask your group admin for a fresh invite code."}
        </p>
        {group ? <p className="mt-4 text-sm text-zinc-600">{group.memberCount} members · Invite active</p> : null}
        <ButtonLink href={group ? `/groups/${group.id}` : "/"} tone="primary" className="mt-6">
          {group ? "Join group" : "Back to sign in"}
        </ButtonLink>
      </Card>
    </main>
  );
}
