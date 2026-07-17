export function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="rounded-lg border bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-2 text-xs text-[var(--muted-foreground)]">{hint}</p>
    </article>
  );
}
