import Link from "next/link";
import type { Route } from "next";

export function StatCard({ label, value, hint, href }: { label: string; value: string; hint: string; href?: Route }) {
  const content = <>
    <p className="text-sm font-medium text-[var(--muted-foreground)]">{label}</p>
    <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
    <p className="mt-2 text-xs text-[var(--muted-foreground)]">{hint}</p>
  </>;
  return href ? <Link className="block rounded-lg border bg-white p-5 shadow-sm transition hover:border-orange-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]" href={href}>{content}</Link> : (
    <article className="rounded-lg border bg-white p-5 shadow-sm">
      {content}
    </article>
  );
}
