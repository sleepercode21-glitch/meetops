import { ButtonLink } from "@/components/common/Buttons";

export function ActionRequiredBanner({
  title,
  body,
  href,
  actionLabel,
  tone = "amber",
}: {
  title: string;
  body: string;
  href: string;
  actionLabel: string;
  tone?: "amber" | "red" | "blue" | "green" | "neutral";
}) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    red: "border-rose-200 bg-rose-50 text-rose-950",
    blue: "border-blue-200 bg-blue-50 text-blue-950",
    green: "border-emerald-200 bg-emerald-50 text-emerald-950",
    neutral: "border-zinc-200 bg-zinc-50 text-zinc-950",
  };

  return (
    <section className={`rounded-lg border p-4 ${tones[tone]}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm opacity-80">{body}</p>
        </div>
        <ButtonLink href={href} tone="secondary" className="shrink-0">
          {actionLabel}
        </ButtonLink>
      </div>
    </section>
  );
}
