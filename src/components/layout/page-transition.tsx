"use client";

import { usePathname, useSearchParams } from "next/navigation";

export function PageTransition({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  return <div className="page-enter" key={routeKey}>{children}</div>;
}
