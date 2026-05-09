"use client";

import { useEffect } from "react";

function isFacebookInAppBrowser(): boolean {
  const ua = navigator.userAgent || "";
  // FB app webview has multiple UA variants; include the common tokens.
  return /FBAN|FBAV|FB_IAB|FB4A|FBDV|FBIOS/i.test(ua);
}

/**
 * Facebook in-app browser occasionally fails to hydrate/attach event handlers on first load,
 * but succeed after a reload. This reproduces the user's manual fix automatically, once.
 */
export function InAppHydrationFix() {
  useEffect(() => {
    if (!isFacebookInAppBrowser()) return;

    // Don't rely on sessionStorage: FB can block it or make it flaky.
    // Use a URL flag so we never loop even if storage is unavailable.
    const url = new URL(window.location.href);
    const alreadyReloaded = url.searchParams.get("iabReload") === "1";
    if (alreadyReloaded) return;

    url.searchParams.set("iabReload", "1");
    window.location.replace(url.toString());
  }, []);

  return null;
}
