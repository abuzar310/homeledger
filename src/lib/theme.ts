/**
 * Appearance: follow the phone (default), or force Light / Dark on this device.
 *
 * The choice lives in localStorage only. <html data-theme="light|dark"> forces a palette
 * (see the dark blocks in globals.css); no attribute means follow prefers-color-scheme.
 * `themeScript` runs in <head> before first paint so a saved choice never flashes.
 */
export type ThemeChoice = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "homeledger-theme";
export const THEME_CHOICES: readonly ThemeChoice[] = ["system", "light", "dark"];

/** Status bar colours: light keeps the terracotta bar, dark matches the dark --bg so the bar melts into the page. */
export const THEME_COLOR = { light: "#b54a2a", dark: "#17110e" } as const;

/** A theme-color <meta> that wins over the media-query ones while Light or Dark is forced. */
const META_ID = "theme-color-choice";
const CHANGE_EVENT = "homeledger:theme";

type ThemeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function deviceStorage(): ThemeStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function parseTheme(value: unknown): ThemeChoice {
  return value === "light" || value === "dark" ? value : "system";
}

export function readTheme(storage: Pick<Storage, "getItem"> | null = deviceStorage()): ThemeChoice {
  try {
    return parseTheme(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

export function saveTheme(choice: ThemeChoice, storage: ThemeStorage | null = deviceStorage()): void {
  try {
    if (choice === "system") storage?.removeItem(THEME_STORAGE_KEY);
    else storage?.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Private mode or full storage: the choice still applies until the page reloads.
  }
}

export function applyTheme(choice: ThemeChoice, doc: Document = document): void {
  const root = doc.documentElement;
  let meta = doc.getElementById(META_ID) as HTMLMetaElement | null;
  if (choice === "system") {
    root.removeAttribute("data-theme");
    meta?.remove();
    return;
  }
  root.setAttribute("data-theme", choice);
  if (!meta) {
    meta = doc.createElement("meta");
    meta.id = META_ID;
    meta.name = "theme-color";
    // First theme-color meta that matches wins, so it goes ahead of Next's media-query pair.
    doc.head.insertBefore(meta, doc.head.firstChild);
  }
  meta.content = THEME_COLOR[choice];
}

/** Save, repaint now, and tell any open settings screen. Save first: the head script's guard reads storage. */
export function setTheme(choice: ThemeChoice): void {
  saveTheme(choice);
  applyTheme(choice);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** For useSyncExternalStore: changes from this tab (setTheme) and from other tabs (storage). */
export function subscribeTheme(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Inline <head> script (ES5, no imports): apply the saved choice before paint. The observer
 * puts data-theme back if something strips it while a choice is saved; React's dev-only
 * Strict Mode remount resets <html> attributes, and production never does.
 */
export const themeScript =
  `(function(){try{var d=document,r=d.documentElement,k=${JSON.stringify(THEME_STORAGE_KEY)},c=${JSON.stringify(THEME_COLOR)};` +
  `function a(){try{var t=localStorage.getItem(k);if(t!=="light"&&t!=="dark")return;` +
  `if(r.getAttribute("data-theme")!==t)r.setAttribute("data-theme",t);` +
  `var m=d.getElementById(${JSON.stringify(META_ID)});` +
  `if(!m){m=d.createElement("meta");m.id=${JSON.stringify(META_ID)};m.name="theme-color";d.head.insertBefore(m,d.head.firstChild)}` +
  `m.content=c[t]}catch(e){}}` +
  `a();new MutationObserver(function(){if(!r.hasAttribute("data-theme"))a()}).observe(r,{attributes:true,attributeFilter:["data-theme"]})` +
  `}catch(e){}})()`;
