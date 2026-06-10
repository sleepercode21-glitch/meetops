import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { JoinGroupForm } from "@/components/groups/GroupForms";
import { FormShell } from "../new/page";

export default function JoinGroupPage() {
  return (
    <AuthenticatedPage>
      <FormShell title="Join a Group" subtitle="Enter the invite code shared by your group admin.">
        <JoinGroupForm />
      </FormShell>
    </AuthenticatedPage>
  );
}
