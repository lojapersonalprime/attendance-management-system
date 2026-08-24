export function PageHeader({ title, description, eyebrow = "OPERAÇÃO" }: { title: string; description: string; eyebrow?: string }) {
  return (
    <div className="mb-7">
      <p className="eyebrow text-[var(--primary)]">{eyebrow}</p>
      <h1 className="font-display mt-2 text-4xl font-semibold leading-none text-[var(--foreground)] sm:text-5xl">{title}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">{description}</p>
    </div>
  );
}
