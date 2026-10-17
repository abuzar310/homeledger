import type { InsightInput, ReceiptDraft } from "@/lib/ai-types";
import type { CategorizeInput, CategorizeResult } from "@/lib/categorization/types";

async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function requestCategorize(input: CategorizeInput): Promise<CategorizeResult | null> {
  const data = await postJson<{ result?: CategorizeResult | null }>("/api/ai/categorize", input);
  return data?.result ?? null;
}

const RECEIPT_MAX_SIDE = 1600;
const RECEIPT_MAX_BYTES = 3_500_000;

async function decodeImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close() };
    } catch {
      /* fall back to an <img> */
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  try {
    img.src = url;
    await img.decode();
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
}

/**
 * Phone photos are often 4–12 MB. Shrinks a receipt photo to at most 1600px on the long side as
 * a JPEG, so it can be read and stored. Returns the original file if the browser cannot decode it.
 */
export async function shrinkReceiptPhoto(file: File): Promise<File> {
  if (typeof document === "undefined" || !file.type.startsWith("image/")) return file;
  try {
    const image = await decodeImage(file);
    try {
      const scale = Math.min(1, RECEIPT_MAX_SIDE / Math.max(image.width, image.height));
      if (scale === 1 && file.type === "image/jpeg" && file.size <= 1_000_000) return file;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image.source, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
      if (!blob) return file;
      const base = file.name.replace(/\.[^.]*$/, "") || "receipt";
      return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
    } finally {
      image.done();
    }
  } catch {
    return file;
  }
}

/** Pass a photo through `shrinkReceiptPhoto` first; anything still over the cap is skipped. */
export async function requestReceiptRead(file: File): Promise<ReceiptDraft | null> {
  if (file.size > RECEIPT_MAX_BYTES) return null;
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const comma = dataUrl.indexOf(",");
  const payload = await postJson<{ result?: ReceiptDraft | null }>("/api/ai/receipt", {
    mime: file.type || "image/jpeg",
    data: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl,
  });
  return payload?.result ?? null;
}

export async function requestMonthInsight(input: InsightInput): Promise<string | null> {
  const data = await postJson<{ text?: string | null }>("/api/ai/insight", input);
  return data?.text ?? null;
}
