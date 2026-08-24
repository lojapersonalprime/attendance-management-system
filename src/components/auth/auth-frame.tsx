import type { ReactNode } from "react";
import { BrandSymbol } from "@/components/brand/brand-symbol";

export function AuthFrame({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <main className="prime-theme auth-shell grid min-h-screen place-items-center"><section className="auth-panel"><div className="flex items-center gap-3"><div className="overflow-hidden rounded-[1.15rem] shadow-[0_0.75rem_2rem_rgb(244_122_32_/_18%)]"><BrandSymbol priority size={72} variant="orange" /></div><div><p className="font-display text-xl font-semibold leading-none text-[var(--foreground)]">Personal Prime</p><p className="mt-1 text-xs font-medium text-[var(--muted-foreground)]">Gestão de ponto</p></div></div><div className="mt-10"><p className="eyebrow text-[var(--primary)]">{eyebrow}</p><h1 className="font-display mt-3 max-w-sm text-4xl font-semibold leading-[0.92] text-[var(--foreground)] sm:text-5xl">{title}</h1><p className="mt-4 max-w-sm text-sm leading-6 text-[var(--muted-foreground)]">{description}</p></div><div className="mt-8">{children}</div></section></main>;
}
