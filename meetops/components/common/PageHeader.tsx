export function PageHeader({
  title,
  subtitle,
  badge,
  breadcrumb,
  primaryAction,
  secondaryActions,
}: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryActions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 space-y-2">
        {breadcrumb ? <div className="text-sm text-zinc-500">{breadcrumb}</div> : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-normal text-zinc-950">
            {title}
          </h1>
          {badge}
        </div>
        {subtitle ? <p className="max-w-3xl text-sm text-zinc-600">{subtitle}</p> : null}
      </div>
      {(primaryAction || secondaryActions) && (
        <div className="flex flex-wrap gap-2">
          {secondaryActions}
          {primaryAction}
        </div>
      )}
    </header>
  );
}
