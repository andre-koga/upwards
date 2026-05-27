const MAX_DIMENSION = 1280;
const WEBP_QUALITY = 0.82;

export class PhotoCompressionError extends Error {}

export async function compressPhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new PhotoCompressionError("Invalid image file.");
  });

  const { width, height } = getScaledDimensions(bitmap.width, bitmap.height);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new PhotoCompressionError("Canvas unavailable.");
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", WEBP_QUALITY)
  );

  if (!blob) {
    throw new PhotoCompressionError("Failed to encode image.");
  }

  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.webp`, { type: "image/webp" });
}

function getScaledDimensions(
  width: number,
  height: number
): { width: number; height: number } {
  if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
    return { width, height };
  }
  const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
  return {
    width: Math.floor(width * scale),
    height: Math.floor(height * scale),
  };
}
