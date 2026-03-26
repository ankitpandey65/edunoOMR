import jsQR from "jsqr";
import sharp from "sharp";

/**
 * Decode QR payload (JSON) from a full-page scan. Tries full frame, then top-right crop.
 */
export async function decodeQrPayloadFromScan(buffer: Buffer): Promise<string | null> {
  const tryDecode = async (buf: Buffer) => {
    const { data, info } = await sharp(buf)
      .rotate()
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const rgba = new Uint8ClampedArray(data);
    const code = jsQR(rgba, info.width, info.height, { inversionAttempts: "attemptBoth" });
    return code?.data ?? null;
  };

  const tryVariant = async (buf: Buffer) => {
    const rotations = [0, 90, 180, 270];
    for (const deg of rotations) {
      const rotated = deg === 0 ? buf : await sharp(buf).rotate(deg).png().toBuffer();
      const raw = await tryDecode(rotated);
      if (raw) return raw;
    }
    return null;
  };

  const fullVariants = [
    buffer,
    await sharp(buffer).rotate().grayscale().normalize().png().toBuffer(),
    await sharp(buffer).rotate().grayscale().normalize().threshold(170).png().toBuffer(),
  ];
  for (const v of fullVariants) {
    const raw = await tryVariant(v);
    if (raw) return raw;
  }

  const meta = await sharp(buffer).rotate().metadata();
  const w = meta.width ?? 1200;
  const h = meta.height ?? 1700;
  /** OMR sheet: QR is embedded in the blue header, top-right */
  const cropW = Math.floor(w * 0.38);
  const cropH = Math.floor(h * 0.24);
  const left = Math.floor(w * 0.58);
  const top = Math.floor(h * 0.02);

  const cropped = await sharp(buffer)
    .rotate()
    .extract({
      left: Math.min(left, w - 40),
      top: Math.min(top, h - 40),
      width: Math.min(cropW, w - left),
      height: Math.min(cropH, h - top),
    })
    .png()
    .toBuffer();

  const cropVariants = [
    cropped,
    await sharp(cropped).grayscale().normalize().png().toBuffer(),
    await sharp(cropped).grayscale().normalize().threshold(170).png().toBuffer(),
  ];
  for (const v of cropVariants) {
    const raw = await tryVariant(v);
    if (raw) return raw;
  }

  return null;
}

export function parseOmrQrJson(raw: string): { sid: string; e: string; sh?: string } | null {
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const sid = j.sid;
    const e = j.e;
    if (typeof sid === "string" && typeof e === "string") {
      const sh = j.sh;
      return {
        sid,
        e,
        ...(typeof sh === "string" ? { sh } : {}),
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}
