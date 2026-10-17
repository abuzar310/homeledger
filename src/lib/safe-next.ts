const BASE = "https://app.invalid";

// Only same-origin paths survive. Control characters and backslashes are rejected
// outright because the URL parser strips or rewrites them (e.g. "/\t/evil.com"
// becomes "//evil.com"), then the parsed origin must still be ours.
export function safeNextPath(raw: string | null | undefined): string {
  // eslint-disable-next-line no-control-regex
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || /[\x00-\x1f\x7f\\]/.test(raw)) {
    return "/home";
  }
  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return "/home";
  }
  if (url.origin !== BASE) return "/home";
  return `${url.pathname}${url.search}${url.hash}`;
}
