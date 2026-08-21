export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <section className="surface rounded-[1.5rem] border-dashed p-10 text-center">
      <p className="eyebrow text-[var(--primary)]">SEM RESULTADOS</p>
      <h2 className="font-display mt-2 text-3xl font-semibold leading-none">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--muted-foreground)]">{description}</p>
    </section>
  );
}
