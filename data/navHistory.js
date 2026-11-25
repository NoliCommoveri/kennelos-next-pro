// navHistory.js — the shell's one back history across tabs (UI Redesign plan §1, Phase 1).
//
// Every screen after the first has a back arrow that returns where she came from, at the
// same scroll position. The app is multi-page, so the history is a list of the pages this
// browser tab has opened ({ u: path + query + hash, y: scroll, h: history.length when it
// opened }), kept in sessionStorage and brought up to date on each page load: a new page is
// pushed, the arrow pops, the browser's own back and forward find the page in the list, a
// reload keeps it, and a location.replace() (a saved form going to its record) replaces
// the top instead of stacking the form under it. At most 60 entries, like the prototype.
//
// The rules are pure (arrive, leave) so tests can drive them; load/save are the storage.

const KEY = 'kennelOS.shellHistory';
const BACK_KEY = 'kennelOS.shellBack';
export const MAX_ENTRIES = 60;
// Browsers stop growing history.length at 50, so past it a replace can't be told apart.
const LENGTH_CAP = 50;

const valid = (s) => (Array.isArray(s) ? s.filter((e) => e && typeof e.u === 'string') : []);

/**
 * The history once this page has loaded.
 *   here      this page's path + query + hash
 *   navType   'navigate' | 'reload' | 'back_forward' (PerformanceNavigationTiming.type)
 *   histLen   history.length now
 *   backing   the path the back arrow sent her to, or null
 * → { stack, restore }: restore is the scroll position to put back, or null for the top.
 */
export function arrive(stack, { here, navType = 'navigate', histLen = 0, backing = null }) {
  const s = valid(stack).slice();
  const top = s[s.length - 1];
  if (backing && top && top.u === backing) {
    if (top.u !== here) s[s.length - 1] = { ...top, u: here };
    return { stack: s, restore: top.y || 0 };
  }
  if (top && top.u === here && (navType === 'reload' || navType === 'back_forward')) {
    return { stack: s, restore: top.y || 0 };
  }
  if (navType === 'back_forward') {
    for (let i = s.length - 1; i >= 0; i--) {
      if (s[i].u === here) return { stack: s.slice(0, i + 1), restore: s[i].y || 0 };
    }
  }
  if (top && top.u === here) return { stack: s, restore: null };
  const entry = { u: here, y: 0, h: histLen };
  if (navType === 'navigate' && top && histLen && top.h === histLen && histLen < LENGTH_CAP) {
    s[s.length - 1] = entry; // location.replace(): the page she left is gone from the browser's history too
  } else {
    s.push(entry);
  }
  return { stack: s.slice(-MAX_ENTRIES), restore: null };
}

/** The history as she leaves this page: its entry gets its current address (a page may
 *  have rewritten it with history.replaceState) and scroll position. */
export function leave(stack, { here, y }) {
  const s = valid(stack).slice();
  if (!s.length) return [{ u: here, y, h: 0 }];
  s[s.length - 1] = { ...s[s.length - 1], u: here, y };
  return s;
}

/** The back arrow: the history without this page, and the page to open. */
export function goBack(stack) {
  const s = valid(stack).slice();
  if (s.length < 2) return { stack: s, target: null };
  s.pop();
  return { stack: s, target: s[s.length - 1].u };
}

// --- storage (sessionStorage: this browser tab only) --------------------------------------
const store = () => { try { return globalThis.sessionStorage || null; } catch { return null; } };

export function loadHistory() {
  try { return valid(JSON.parse(store()?.getItem(KEY) || '[]')); } catch { return []; }
}
export function saveHistory(stack) {
  try { store()?.setItem(KEY, JSON.stringify(valid(stack))); } catch { /* private mode: no back history */ }
}
/** Read once: the path the back arrow opened, set just before it navigated. */
export function takeBacking() {
  try {
    const v = store()?.getItem(BACK_KEY) || null;
    store()?.removeItem(BACK_KEY);
    return v;
  } catch { return null; }
}
export function setBacking(path) {
  try { store()?.setItem(BACK_KEY, path); } catch { /* the arrow still navigates */ }
}
