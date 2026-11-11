/** Talks to the service worker in public/sw.js, which saves pages for offline use. */

const LIST_SNAPSHOT_PREFIX = "shopping-list:";

function postToServiceWorker(message: unknown) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage(message)).catch(() => {});
}

/** Asks the service worker to save fresh copies of these pages (skipped if saved recently). */
export function refreshSavedPages(urls: string[]) {
  postToServiceWorker({ type: "refresh-pages", urls });
}

/**
 * On sign-out: forget saved pages and the saved shopping list, which hold this household's
 * data. Unsynced shopping changes are kept so they can still sync after signing back in.
 */
export function clearOfflineData() {
  postToServiceWorker({ type: "clear-pages" });
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(LIST_SNAPSHOT_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // Storage blocked: nothing was saved
  }
}

export const listSnapshotKey = (ownerId: string) => `${LIST_SNAPSHOT_PREFIX}${ownerId}`;
