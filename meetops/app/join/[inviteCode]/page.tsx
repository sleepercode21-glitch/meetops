import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { JoinGroupForm } from "@/components/groups/GroupForms";
import { FormShell } from "../../groups/new/page";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = await params;

  return (
    <AuthenticatedPage>
      <FormShell
        title="Join group"
        subtitle="Review the invite code and join the private group."
      >
        <JoinGroupForm initialCode={inviteCode} />
      </FormShell>
    </AuthenticatedPage>
  );
}
