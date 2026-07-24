import { SkeletonCard } from "@/components/ui/async-feedback";

export function PageSkeleton({ variant = "list" }: { variant?: "dashboard" | "list" | "detail" | "form" | "import" }) {
  const cards = variant === "dashboard" ? 4 : variant === "import" ? 2 : 3;
  return <div aria-label="Carregando página" className="space-y-5"><div className="space-y-2"><div className="h-8 w-64 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" /><div className="h-4 w-96 max-w-full animate-pulse rounded bg-slate-100 motion-reduce:animate-none" /></div><div className={`grid gap-4 ${variant === "dashboard" ? "md:grid-cols-2 xl:grid-cols-4" : variant === "detail" || variant === "form" ? "" : "md:grid-cols-2 xl:grid-cols-3"}`}>{Array.from({ length: cards }, (_, index) => <SkeletonCard className={variant === "detail" || variant === "form" ? "mb-4" : ""} key={index} lines={variant === "import" ? 5 : 3} />)}</div>{variant === "detail" || variant === "form" ? <SkeletonCard className="min-h-80" lines={7} /> : null}</div>;
}
