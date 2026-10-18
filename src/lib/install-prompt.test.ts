import { describe, expect, it, vi } from "vitest";
import { createInstallStore, isInstalledDisplay, needsIosInstallTip, type InstallOutcome } from "./install-prompt";

function promptEvent(outcome: InstallOutcome, fail = false) {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  const prompt = vi.fn(() => (fail ? Promise.reject(new Error("used")) : Promise.resolve()));
  return Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome }) });
}

describe("install store", () => {
  it("keeps the browser's prompt for later instead of letting it show", () => {
    const target = new EventTarget();
    const store = createInstallStore(target);
    const changed = vi.fn();
    store.subscribe(changed);
    const event = promptEvent("accepted");
    target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(store.getSnapshot().prompt).toBe(event);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it("returns the same snapshot until something changes", () => {
    const store = createInstallStore(new EventTarget());
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it("prompts once and remembers an accepted install", async () => {
    const target = new EventTarget();
    const store = createInstallStore(target);
    const event = promptEvent("accepted");
    target.dispatchEvent(event);
    expect(await store.prompt()).toBe("accepted");
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toEqual({ prompt: null, installed: true });
    expect(await store.prompt()).toBeNull();
  });

  it("drops a dismissed prompt, since the browser will not show it twice", async () => {
    const target = new EventTarget();
    const store = createInstallStore(target);
    target.dispatchEvent(promptEvent("dismissed"));
    expect(await store.prompt()).toBe("dismissed");
    expect(store.getSnapshot()).toEqual({ prompt: null, installed: false });
  });

  it("drops a prompt that fails to open", async () => {
    const target = new EventTarget();
    const store = createInstallStore(target);
    target.dispatchEvent(promptEvent("accepted", true));
    await expect(store.prompt()).rejects.toThrow("used");
    expect(store.getSnapshot().prompt).toBeNull();
  });

  it("hides once the app is installed from the browser menu", () => {
    const target = new EventTarget();
    const store = createInstallStore(target);
    target.dispatchEvent(promptEvent("accepted"));
    target.dispatchEvent(new Event("appinstalled"));
    expect(store.getSnapshot()).toEqual({ prompt: null, installed: true });
  });

  it("stops telling a screen that has gone", () => {
    const target = new EventTarget();
    const store = createInstallStore(target);
    const changed = vi.fn();
    store.subscribe(changed)();
    target.dispatchEvent(promptEvent("accepted"));
    expect(changed).not.toHaveBeenCalled();
  });
});

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP_MODE =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";
const IPHONE_INSTAGRAM =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0";
const IPHONE_GOOGLE_APP =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/380.0.1 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; SM-A156E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";

describe("needsIosInstallTip", () => {
  it("shows on iPhone and iPad browsers", () => {
    expect(needsIosInstallTip({ userAgent: IPHONE_SAFARI })).toBe(true);
    expect(needsIosInstallTip({ userAgent: IPAD_DESKTOP_MODE, maxTouchPoints: 5 })).toBe(true);
  });

  it("stays away from Macs, Android and in-app browsers", () => {
    expect(needsIosInstallTip({ userAgent: IPAD_DESKTOP_MODE, maxTouchPoints: 0 })).toBe(false);
    expect(needsIosInstallTip({ userAgent: ANDROID_CHROME, maxTouchPoints: 5 })).toBe(false);
    expect(needsIosInstallTip({ userAgent: IPHONE_INSTAGRAM })).toBe(false);
    expect(needsIosInstallTip({ userAgent: IPHONE_GOOGLE_APP })).toBe(false);
  });
});

describe("isInstalledDisplay", () => {
  const media = (mode: string | null) => (query: string) => ({ matches: mode != null && query === `(display-mode: ${mode})` });

  it("spots the installed app", () => {
    expect(isInstalledDisplay(media("standalone"), { userAgent: ANDROID_CHROME })).toBe(true);
    expect(isInstalledDisplay(media("window-controls-overlay"), { userAgent: "" })).toBe(true);
    expect(isInstalledDisplay(undefined, { userAgent: IPHONE_SAFARI, standalone: true })).toBe(true);
  });

  it("treats a browser tab as not installed", () => {
    expect(isInstalledDisplay(media("browser"), { userAgent: ANDROID_CHROME })).toBe(false);
    expect(isInstalledDisplay(media(null), { userAgent: IPHONE_SAFARI, standalone: false })).toBe(false);
    expect(isInstalledDisplay(undefined, { userAgent: "" })).toBe(false);
  });
});
