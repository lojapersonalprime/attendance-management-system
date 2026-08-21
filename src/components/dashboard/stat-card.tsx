import Link from "next/link";
import type { Route } from "next";
import type { LucideIcon } from "lucide-react";

export function StatCard({ label, value, hint, href, icon: Icon, tone = "neutral" }: { label: string; value: string; hint: string; href?: Route; icon?: LucideIcon; tone?: "neutral" | "primary" | "warning" | "danger" | "success" }) {
  const toneClass = {
    neutral: "bg-[var(--surface-elevated)] text-[var(--muted-foreground)]",
    primary: "bg-[rgb(244_122_32_/_14%)] text-[var(--primary)]",
    warning: "bg-[rgb(245_158_11_/_14%)] text-[var(--warning)]",
    danger: "bg-[rgb(239_68_68_/_14%)] text-[var(--danger)]",
    success: "bg-[rgb(34_197_94_/_14%)] text-[var(--success)]",
  }[tone];
  const content = <>
    <div className="flex items-start justify-between gap-3"><p className="eyebrow text-[var(--muted-foreground)]">{label}</p>{Icon ? <span className={`grid size-9 place-items-center rounded-xl ${toneClass}`}><Icon size={17} aria-hidden="true" /></span> : null}</div>
    <p className="numeric font-display mt-5 text-5xl font-semibold leading-none tracking-tight text-[var(--foreground)]">{value}</p>
    <p className="mt-3 min-h-10 text-xs leading-5 text-[var(--muted-foreground)]">{hint}</p>
  </>;
  return href ? <Link className="surface group block rounded-[1.35rem] p-5 transition hover:-translate-y-0.5 hover:border-[rgb(244_122_32_/_45%)] hover:bg-[var(--surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]" href={href}>{content}</Link> : (
    <article className="surface rounded-[1.35rem] p-5">
      {content}
    </article>
  );
}
