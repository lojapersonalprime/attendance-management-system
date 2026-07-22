export function StatusBadge({ tone = "neutral", children }: { tone?: "success" | "warning" | "danger" | "info" | "neutral"; children: React.ReactNode }) {
  const tones = { success: "bg-emerald-100 text-emerald-900", warning: "bg-amber-100 text-amber-900", danger: "bg-red-100 text-red-900", info: "bg-sky-100 text-sky-900", neutral: "bg-slate-100 text-slate-800" };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}
