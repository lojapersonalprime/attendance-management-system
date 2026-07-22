export function DetailsDisclosure({ title = "Ver detalhes", children }: { title?: string; children: React.ReactNode }) {
  return <details className="rounded-md border bg-slate-50 p-3 text-sm"><summary className="cursor-pointer font-semibold text-[var(--primary)]">{title}</summary><div className="mt-3">{children}</div></details>;
}
