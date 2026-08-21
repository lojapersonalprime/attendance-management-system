export function DetailsDisclosure({ title = "Ver detalhes", children }: { title?: string; children: React.ReactNode }) {
  return <details className="surface-elevated rounded-xl p-3 text-sm"><summary className="cursor-pointer font-semibold text-[var(--primary)]">{title}</summary><div className="mt-3">{children}</div></details>;
}
