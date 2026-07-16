// SPDX-License-Identifier: MIT
// Image normalization: every incoming image (multipart upload or base64 JSON
// import) is validated by magic bytes then re-encoded with sharp into two
// WebP variants. The original is never stored, so nothing heavy is ever
// served: cards load the ~480 px thumb, the detail page the 1600 px display.

import { mkdirSync, unlinkSync } from "node:fs";
import { resolve, basename } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { config } from "../config.js";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DISPLAY_MAX_EDGE = 1600;
const THUMB_MAX_EDGE = 480;
const WEBP_QUALITY = 82;

export class ImageValidationError extends Error {
  code: "INVALID_IMAGE" | "IMAGE_TOO_LARGE";
  constructor(code: "INVALID_IMAGE" | "IMAGE_TOO_LARGE") {
    super(code);
    this.code = code;
  }
}

function sniffFormat(buf: Buffer): "jpeg" | "png" | "webp" | "avif" | "gif" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "png";
  }
  if (
    buf.length >= 12 &&
    buf.toString("latin1", 0, 4) === "RIFF" &&
    buf.toString("latin1", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  // ISO BMFF container with an AVIF brand ("avis" is the sequence variant).
  if (
    buf.length >= 12 &&
    buf.toString("latin1", 4, 8) === "ftyp" &&
    ["avif", "avis"].includes(buf.toString("latin1", 8, 12))
  ) {
    return "avif";
  }
  if (buf.length >= 6 && ["GIF87a", "GIF89a"].includes(buf.toString("latin1", 0, 6))) {
    return "gif";
  }
  return null;
}

export function thumbFileFor(imageFile: string): string {
  return imageFile.replace(/\.webp$/, ".thumb.webp");
}

/**
 * Validates and normalizes an image buffer. Returns the stored display
 * filename (`<uuid>.webp`); the thumb sits next to it (`<uuid>.thumb.webp`).
 * Throws ImageValidationError on bad input.
 */
export async function storeImage(buf: Buffer): Promise<string> {
  if (buf.length > MAX_IMAGE_BYTES) throw new ImageValidationError("IMAGE_TOO_LARGE");
  if (!sniffFormat(buf)) throw new ImageValidationError("INVALID_IMAGE");

  mkdirSync(config.uploadsDir, { recursive: true });
  const id = randomUUID();
  const displayFile = `${id}.webp`;

  // `rotate()` with no argument bakes in the EXIF orientation.
  // `failOn: "error"` keeps sharp tolerant of slightly malformed files while
  // still rejecting garbage; a decode failure surfaces as INVALID_IMAGE.
  try {
    // limitInputPixels: a 5 MB file can still decode into a huge raw bitmap
    // (pixel bomb); 50 MP comfortably covers real photos.
    const base = sharp(buf, { failOn: "error", limitInputPixels: 50_000_000 }).rotate();
    await base
      .clone()
      .resize({ width: DISPLAY_MAX_EDGE, height: DISPLAY_MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(resolve(config.uploadsDir, displayFile));
    await base
      .clone()
      .resize({ width: THUMB_MAX_EDGE, height: THUMB_MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(resolve(config.uploadsDir, `${id}.thumb.webp`));
  } catch (err) {
    deleteImageFiles(displayFile);
    if (err instanceof ImageValidationError) throw err;
    // Surface the decoder message: "INVALID_IMAGE" alone is undebuggable.
    console.error("[images] normalization failed:", (err as Error)?.message || err);
    throw new ImageValidationError("INVALID_IMAGE");
  }
  return displayFile;
}

/** Removes both variants; tolerates already-missing files. */
export function deleteImageFiles(imageFile: string | null | undefined): void {
  if (!imageFile) return;
  // basename() guards against a path ever sneaking into the column.
  const safe = basename(imageFile);
  for (const file of [safe, thumbFileFor(safe)]) {
    try {
      unlinkSync(resolve(config.uploadsDir, file));
    } catch {
      /* already gone */
    }
  }
}
