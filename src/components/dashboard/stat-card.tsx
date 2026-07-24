import Link from "next/link";
import type { Route } from "next";
import type { LucideIcon } from "lucide-react";

export function StatCard({ label, value, hint, href, icon: Icon, tone = "neutral" }: { label: string; value: string; hint: string; href?: Route; icon?: LucideIcon; tone?: "neutral" | "primary" | "warning" | "danger" | "success" }) {
  const toneClass = {
    neutral: "bg-slate-100 text-slate-700",
    primary: "bg-orange-100 text-[var(--primary)]",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-700",
    success: "bg-emerald-100 text-emerald-700",
  }[tone];
  const content = <>
    <div className="flex items-start justify-between gap-3"><p className="text-sm font-medium text-[var(--muted-foreground)]">{label}</p>{Icon ? <span className={`grid size-9 place-items-center rounded-lg ${toneClass}`}><Icon size={18} aria-hidden="true" /></span> : null}</div>
    <p className="mt-4 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
    <p className="mt-2 min-h-8 text-xs leading-4 text-[var(--muted-foreground)]">{hint}</p>
  </>;
  return href ? <Link className="block rounded-xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]" href={href}>{content}</Link> : (
    <article className="rounded-xl border bg-white p-5 shadow-sm">
      {content}
    </article>
  );
}
