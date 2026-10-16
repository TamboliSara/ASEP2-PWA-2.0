/**
 * retrievalStorage.ts — Centralized persistent tracking for retrieved lockers.
 * 
 * Ensures that once a locker/safe item is retrieved by a user or admin,
 * the locker remains strictly and permanently empty across:
 *   - React re-renders & navigation transitions
 *   - Browser tab changes & window reloads (F5 / Ctrl+R)
 *   - Offline / online reconnections & Firestore initial syncs
 */

const STORAGE_KEY = "safe_retrieved_lockers";

export function getRetrievedLockers(): Set<string> {
  const set = new Set<string>();
  if (typeof window === "undefined") return set;

  try {
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      const arr = JSON.parse(local);
      if (Array.isArray(arr)) {
        arr.forEach((id: string) => typeof id === "string" && set.add(id));
      }
    }
  } catch {}

  try {
    const session = sessionStorage.getItem(STORAGE_KEY);
    if (session) {
      const arr = JSON.parse(session);
      if (Array.isArray(arr)) {
        arr.forEach((id: string) => typeof id === "string" && set.add(id));
      }
    }
  } catch {}

  return set;
}

export function markLockerRetrieved(lockerId: string) {
  if (typeof window === "undefined" || !lockerId) return;
  try {
    const set = getRetrievedLockers();
    set.add(lockerId);
    const json = JSON.stringify(Array.from(set));
    localStorage.setItem(STORAGE_KEY, json);
    sessionStorage.setItem(STORAGE_KEY, json);
  } catch {}
}

export function unmarkLockerRetrieved(lockerId: string) {
  if (typeof window === "undefined" || !lockerId) return;
  try {
    const set = getRetrievedLockers();
    set.delete(lockerId);
    const json = JSON.stringify(Array.from(set));
    localStorage.setItem(STORAGE_KEY, json);
    sessionStorage.setItem(STORAGE_KEY, json);
  } catch {}
}

export function clearAllRetrievedLockers() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}
