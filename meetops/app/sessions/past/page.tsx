import { SessionsList } from "../page";

export default function PastSessionsPage() {
  return <SessionsList title="Past Sessions" subtitle="Completed and cancelled session history." filter="past" />;
}
