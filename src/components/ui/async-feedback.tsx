"use client";

import { CheckCircle2, LoaderCircle, RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

export function InlineSpinner({ className }: { className?: string }) {
  return <LoaderCircle aria-hidden="true" className={cn("size-4 animate-spin motion-reduce:animate-none", className)} />;
}

export function LoadingButton({ children, loadingLabel = "Salvando…", className, disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { loadingLabel?: string }) {
  const { pending } = useFormStatus();
  const isDisabled = Boolean(disabled || pending);
  return <button aria-busy={pending} className={cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition-[background-color,border-color,color,opacity,transform] duration-200 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-px hover:bg-[var(--primary-hover)] active:translate-y-0 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:saturate-50", className)} disabled={isDisabled} {...props}>
    {pending ? <><InlineSpinner />{loadingLabel}</> : children}
  </button>;
}

export function ProgressBar({ value, label, className }: { value?: number; label?: string; className?: string }) {
  const determinate = typeof value === "number";
  const normalized = determinate ? Math.min(100, Math.max(0, value ?? 0)) : undefined;
  return <div aria-label={label} aria-valuemax={100} aria-valuemin={0} aria-valuenow={normalized} aria-valuetext={determinate ? `${normalized}%` : "Em andamento"} className={cn("h-2 overflow-hidden rounded-full bg-slate-100", className)} role="progressbar">
    <span className={cn("block h-full rounded-full bg-[var(--primary)] transition-[width] duration-300 motion-reduce:transition-none", determinate ? "" : "w-2/5 animate-pulse motion-reduce:animate-none")} style={determinate ? { width: `${normalized}%` } : undefined} />
  </div>;
}

export function ProgressStep({ index, title, description, state }: { index: number; title: string; description?: string; state: "complete" | "current" | "waiting" | "error" }) {
  const visual = state === "complete" ? "bg-emerald-600 text-white" : state === "current" ? "bg-[var(--primary)] text-white" : state === "error" ? "bg-red-700 text-white" : "bg-slate-100 text-slate-500";
  const stateLabel = state === "complete" ? "Concluída" : state === "current" ? "Em andamento" : state === "error" ? "Com erro" : "Aguardando";
  return <li aria-current={state === "current" ? "step" : undefined} className="flex min-w-0 items-start gap-3">
    <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold", visual)}>{state === "complete" ? <CheckCircle2 size={15} aria-hidden="true" /> : index}</span>
    <span className="min-w-0"><span className="block text-sm font-semibold text-slate-900">{title}</span>{description ? <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">{description}</span> : null}<span className="sr-only">{stateLabel}</span></span>
  </li>;
}

export function OperationProgress({ title, description, currentStep, steps, progress }: { title: string; description?: string; currentStep: number; steps: Array<{ title: string; description?: string; error?: boolean }>; progress?: number }) {
  return <section aria-busy={currentStep >= 0 && currentStep < steps.length} aria-live="polite" className="rounded-xl border bg-white p-5 shadow-sm">
    <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-orange-50 text-[var(--primary)]"><InlineSpinner /></span><div><h2 className="font-semibold">{title}</h2>{description ? <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p> : null}</div></div>
    <ol className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{steps.map((step, index) => <ProgressStep description={step.description} index={index + 1} key={step.title} state={step.error ? "error" : index < currentStep ? "complete" : index === currentStep ? "current" : "waiting"} title={step.title} />)}</ol>
    {currentStep >= 0 ? <ProgressBar className="mt-5" label="Progresso da operação" value={progress} /> : null}
  </section>;
}

export function SuccessState({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description?: string; children?: ReactNode }) {
  return <section aria-live="polite" className="feedback-success motion-feedback rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950" role="status"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" size={20} aria-hidden="true" /><div>{eyebrow ? <p className="eyebrow text-emerald-700">{eyebrow}</p> : null}<h2 className={cn("font-semibold", eyebrow && "mt-2")}>{title}</h2>{description ? <p className="mt-1 text-sm text-emerald-900">{description}</p> : null}{children ? <div className="mt-4">{children}</div> : null}</div></div></section>;
}

export function ErrorState({ eyebrow, title = "Não foi possível concluir a operação.", description, children }: { eyebrow?: string; title?: string; description?: string; children?: ReactNode }) {
  const reference = useRef<HTMLElement>(null);
  useEffect(() => { reference.current?.focus(); }, []);
  return <section aria-live="assertive" className="feedback-error motion-feedback rounded-xl border border-red-200 bg-red-50 p-5 text-red-950" ref={reference} role="alert" tabIndex={-1}><div className="flex gap-3"><TriangleAlert className="mt-0.5 shrink-0 text-red-700" size={20} aria-hidden="true" /><div>{eyebrow ? <p className="eyebrow text-red-700">{eyebrow}</p> : null}<h2 className={cn("font-semibold", eyebrow && "mt-2")}>{title}</h2>{description ? <p className="mt-1 text-sm text-red-900">{description}</p> : null}{children ? <div className="mt-4">{children}</div> : null}</div></div></section>;
}

export function AsyncFeedback({ status, success, error }: { status?: "success" | "error"; success?: string; error?: string }) {
  if (status === "success" && success) return <SuccessState title={success} />;
  if (status === "error" && error) return <ErrorState description={error} />;
  return null;
}

export function RetryButton({ children = "Tentar novamente", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn("inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-900 hover:bg-red-100 disabled:opacity-50", className)} type="button" {...props}><RotateCcw size={15} aria-hidden="true" />{children}</button>;
}

export function SkeletonCard({ className, lines = 3 }: { className?: string; lines?: number }) {
  return <div aria-busy="true" aria-label="Carregando conteúdo" className={cn("surface rounded-xl p-5 shadow-sm", className)}><div className="h-5 w-2/5 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />{Array.from({ length: lines }, (_, index) => <div className="mt-3 h-3 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" key={index} style={{ width: `${88 - index * 17}%` }} />)}</div>;
}

export function LoadingOverlay({ label = "Salvando alterações…" }: { label?: string }) {
  return <div aria-busy="true" aria-live="polite" className="absolute inset-0 grid place-items-center rounded-xl bg-white/75 p-4 backdrop-blur-[1px]" role="status"><span className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white"><InlineSpinner />{label}</span></div>;
}

export function ConfirmationDialog({ open, title, description, onCancel, children }: { open: boolean; title: string; description?: string; onCancel: () => void; children: ReactNode }) {
  if (!open) return null;
  return <div aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" role="dialog"><section className="motion-popover w-full max-w-lg rounded-xl border bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{title}</h2>{description ? <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p> : null}</div><button aria-label="Fechar confirmação" className="rounded-md px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100" onClick={onCancel} type="button">Fechar</button></div><div className="mt-5">{children}</div></section></div>;
}
