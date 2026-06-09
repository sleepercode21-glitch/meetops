import { SessionsList } from "../page";

export default function HostedSessionsPage() {
  return <SessionsList title="My Hosted Sessions" subtitle="Sessions where you are the host." filter="hosted" />;
}
