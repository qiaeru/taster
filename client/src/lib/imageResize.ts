// SPDX-License-Identifier: MIT
// Client-side downscale before upload: saves upstream bandwidth. The server
// re-validates and re-encodes regardless, so this is an optimization, not a
// security boundary.

const MAX_EDGE = 1600;
const QUALITY = 0.85;

export async function resizeForUpload(file: File): Promise<{ blob: Blob; filename: string }> {
  try {
    // imageOrientation bakes in the EXIF rotation.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", QUALITY)
    );
    if (blob) return { blob, filename: "image.webp" };
  } catch {
    /* fall through to the original */
  }
  return { blob: file, filename: file.name };
}
