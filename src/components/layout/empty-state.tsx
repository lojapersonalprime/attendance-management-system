export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded-lg border border-dashed bg-white p-10 text-center">
      <h2 className="font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--muted-foreground)]">{description}</p>
    </section>
  );
}
