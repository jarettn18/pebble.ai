const STORAGE_KEY = "pebble_demo";

/** Pure predicate: is demo mode active given the URL search string and stored flag? */
export function resolveDemoMode(
  search: string | undefined,
  stored: string | null
): boolean {
  if (search) {
    const params = new URLSearchParams(search);
    if (params.get("demo") === "1") return true;
  }
  return stored === "1";
}

/**
 * Web-only. True if `?demo=1` is in the URL or the session flag is set.
 * Activating via the URL persists the flag so demo mode survives client-side
 * navigation (expo-router drops the query param on later route changes).
 */
export function isDemoMode(): boolean {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return false;
  }
  const search = window.location?.search;
  const stored = sessionStorage.getItem(STORAGE_KEY);
  const active = resolveDemoMode(search, stored);
  if (active && stored !== "1") {
    sessionStorage.setItem(STORAGE_KEY, "1");
  }
  return active;
}
