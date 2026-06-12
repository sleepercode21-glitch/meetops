"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/common/Buttons";

type Tone = "primary" | "secondary" | "danger" | "ghost";

type ConfirmCopy = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export function ConfirmButton({
  children,
  confirm,
  tone = "secondary",
  className = "",
  disabled,
  onConfirm,
}: {
  children: React.ReactNode;
  confirm: ConfirmCopy;
  tone?: Tone;
  className?: string;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" tone={tone} className={className} disabled={disabled} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <ConfirmDialog
        open={open}
        confirm={confirm}
        tone={tone === "danger" ? "danger" : "primary"}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          onConfirm();
        }}
      />
    </>
  );
}

export function ConfirmLink({
  children,
  href,
  confirm,
  tone = "secondary",
  className = "",
}: {
  children: React.ReactNode;
  href: string;
  confirm: ConfirmCopy;
  tone?: Tone;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <ButtonLink
        href={href}
        tone={tone}
        className={className}
        onClick={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
      >
        {children}
      </ButtonLink>
      <ConfirmDialog
        open={open}
        confirm={confirm}
        tone={tone === "danger" ? "danger" : "primary"}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          router.push(href);
        }}
      />
    </>
  );
}

function ConfirmDialog({
  open,
  confirm,
  tone,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  confirm: ConfirmCopy;
  tone: "primary" | "danger";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
        <h2 className="text-base font-semibold text-zinc-950">{confirm.title ?? "Confirm action"}</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">{confirm.message}</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" onClick={onCancel} className="w-full sm:w-auto">
            {confirm.cancelLabel ?? "Keep editing"}
          </Button>
          <Button type="button" tone={tone} onClick={onConfirm} className="w-full sm:w-auto">
            {confirm.confirmLabel ?? "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
