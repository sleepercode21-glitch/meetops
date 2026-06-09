import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { Button } from "@/components/common/Buttons";
import { FormShell, Field } from "../new/page";

export default function JoinGroupPage() {
  return (
    <AuthenticatedPage>
      <FormShell title="Join group" subtitle="Enter an invite code from a private community.">
        <Field label="Invite code" placeholder="TECHUP-2026" />
        <Button tone="primary">Join group</Button>
      </FormShell>
    </AuthenticatedPage>
  );
}
