"use client";

import { useEffect } from "react";

/**
 * Legacy server actions still redirect after a failure so that the page can
 * render its accessible inline feedback. Keep that transient state out of the
 * address bar once the message is visible. Error details never travel in this
 * parameter: actions use a short, mapped code only.
 */
export function ActionFeedbackUrlCleaner() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("erro")) return;

    url.searchParams.delete("erro");
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, []);

  return null;
}
