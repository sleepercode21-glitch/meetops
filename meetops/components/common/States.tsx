import { Button } from "@/components/common/Buttons";
import { Card } from "@/components/common/Card";

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="flex min-h-44 flex-col items-center justify-center text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-zinc-100 text-lg">
        +
      </div>
      <h2 className="text-base font-semibold text-zinc-950">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-zinc-600">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </Card>
  );
}

export function ErrorState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <Card className="border-rose-200 bg-rose-50">
      <div className="text-sm font-semibold text-rose-800">{title}</div>
      <p className="mt-1 text-sm text-rose-700">{message}</p>
      <Button className="mt-4" tone="secondary">
        Retry
      </Button>
    </Card>
  );
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-zinc-200 ${className}`} />;
}
