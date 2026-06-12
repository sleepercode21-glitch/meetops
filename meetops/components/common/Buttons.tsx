import Link from "next/link";

type ButtonTone = "primary" | "secondary" | "danger" | "ghost";

const tones: Record<ButtonTone, string> = {
  primary: "border-teal-900 bg-teal-900 text-white shadow-sm hover:bg-teal-800",
  secondary: "border-zinc-300 bg-white text-zinc-900 hover:border-zinc-400 hover:bg-zinc-50",
  danger: "border-rose-600 bg-rose-600 text-white hover:bg-rose-700",
  ghost: "border-transparent bg-transparent text-zinc-700 hover:bg-white/70",
};

export function Button({
  children,
  tone = "secondary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ButtonTone;
}) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  href,
  tone = "secondary",
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  href: string;
  tone?: ButtonTone;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition ${tones[tone]} ${className}`}
    >
      {children}
    </Link>
  );
}
