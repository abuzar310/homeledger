import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { THEME_COLOR, THEME_STORAGE_KEY, applyTheme, parseTheme, readTheme, saveTheme, themeScript } from "./theme";

type FakeMeta = { id: string; name: string; content: string; remove: () => void };

/** Just enough of document / MutationObserver for theme.ts and the head script. */
function fakePage() {
  const attrs = new Map<string, string>();
  const head: FakeMeta[] = [{ id: "", name: "charset", content: "", remove() {} }];
  const observers: (() => void)[] = [];
  const notify = () => observers.forEach((cb) => cb());
  const root = {
    getAttribute: (n: string) => attrs.get(n) ?? null,
    hasAttribute: (n: string) => attrs.has(n),
    setAttribute: (n: string, v: string) => {
      attrs.set(n, v);
      notify();
    },
    removeAttribute: (n: string) => {
      attrs.delete(n);
      notify();
    },
  };
  const doc = {
    documentElement: root,
    head: {
      get firstChild() {
        return head[0] ?? null;
      },
      insertBefore(node: FakeMeta, ref: FakeMeta | null) {
        const at = ref ? head.indexOf(ref) : -1;
        head.splice(at < 0 ? head.length : at, 0, node);
      },
    },
    getElementById: (id: string) => head.find((m) => m.id === id) ?? null,
    createElement: (): FakeMeta => {
      const meta: FakeMeta = {
        id: "",
        name: "",
        content: "",
        remove: () => {
          const i = head.indexOf(meta);
          if (i >= 0) head.splice(i, 1);
        },
      };
      return meta;
    },
  };
  class FakeObserver {
    constructor(private cb: () => void) {}
    observe() {
      observers.push(this.cb);
    }
  }
  return { doc, head, theme: () => attrs.get("data-theme") ?? null, Observer: FakeObserver };
}

function memoryStorage(initial?: string) {
  const map = new Map<string, string>(initial ? [[THEME_STORAGE_KEY, initial]] : []);
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const broken = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
};

function runHeadScript(page: ReturnType<typeof fakePage>, storage: unknown) {
  new Function("document", "localStorage", "MutationObserver", themeScript)(page.doc, storage, page.Observer);
}

describe("theme choice", () => {
  it("only accepts light or dark, everything else follows the phone", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    for (const value of [null, undefined, "", "system", "Dark", "blue", 1]) expect(parseTheme(value)).toBe("system");
  });

  it("reads and saves on this device, quietly surviving blocked storage", () => {
    const storage = memoryStorage();
    expect(readTheme(storage)).toBe("system");
    saveTheme("dark", storage);
    expect(readTheme(storage)).toBe("dark");
    saveTheme("system", storage);
    expect(storage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(readTheme(broken)).toBe("system");
    expect(readTheme(null)).toBe("system");
    expect(() => saveTheme("light", broken)).not.toThrow();
  });

  it("forces a palette and status bar colour, and System removes both", () => {
    const page = fakePage();
    const doc = page.doc as unknown as Document;
    applyTheme("dark", doc);
    expect(page.theme()).toBe("dark");
    expect(page.head[0]).toMatchObject({ name: "theme-color", content: THEME_COLOR.dark });
    applyTheme("light", doc);
    expect(page.theme()).toBe("light");
    expect(page.head.filter((m) => m.name === "theme-color")).toHaveLength(1);
    expect(page.head[0].content).toBe(THEME_COLOR.light);
    applyTheme("system", doc);
    expect(page.theme()).toBeNull();
    expect(page.head.some((m) => m.name === "theme-color")).toBe(false);
  });
});

describe("head script", () => {
  it("leaves the page alone when nothing is saved or storage is blocked", () => {
    for (const storage of [memoryStorage(), memoryStorage("sepia"), broken]) {
      const page = fakePage();
      expect(() => runHeadScript(page, storage)).not.toThrow();
      expect(page.theme()).toBeNull();
      expect(page.head).toHaveLength(1);
    }
  });

  it("applies a saved choice before paint, with the status bar meta first in <head>", () => {
    const page = fakePage();
    runHeadScript(page, memoryStorage("dark"));
    expect(page.theme()).toBe("dark");
    expect(page.head[0]).toMatchObject({ name: "theme-color", content: THEME_COLOR.dark });
  });

  it("puts the choice back if data-theme is stripped, but lets Settings switch to System", () => {
    const page = fakePage();
    const storage = memoryStorage("light");
    runHeadScript(page, storage);
    page.doc.documentElement.removeAttribute("data-theme");
    expect(page.theme()).toBe("light");

    saveTheme("system", storage);
    applyTheme("system", page.doc as unknown as Document);
    expect(page.theme()).toBeNull();
  });
});

describe("dark palette in globals.css", () => {
  const css = readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const block = (selector: RegExp) => {
    const body = css.match(selector)?.[1] ?? "";
    return body
      .split(";")
      .map((line) => line.trim())
      .filter(Boolean);
  };

  it("is the same for 'follow the phone' and a forced Dark", () => {
    const system = block(/:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/);
    const forced = block(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/);
    expect(system.length).toBeGreaterThan(10);
    expect(forced).toEqual(system);
  });

  it("overrides every colour token of the light theme", () => {
    const light = block(/:root\s*\{([^}]*)\}/);
    const dark = block(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/);
    const names = (lines: string[]) => lines.map((l) => l.split(":")[0].trim());
    const colours = names(light.filter((l) => /oklch\(|rgb\(/.test(l) && !/var\(/.test(l)));
    expect(colours).toContain("--primary");
    expect(names(dark)).toEqual(expect.arrayContaining([...colours, "color-scheme"]));
  });
});
