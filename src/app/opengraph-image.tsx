import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#fffaf7",
          color: "#3a2418",
          padding: 80,
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 700 }}>{SITE_NAME}</div>
        <div style={{ marginTop: 16, fontSize: 36, color: "#b54a2a" }}>{SITE_TAGLINE}</div>
        <div style={{ marginTop: 28, fontSize: 24, color: "#6b5344" }}>Household expenses in rupees</div>
      </div>
    ),
    size,
  );
}
