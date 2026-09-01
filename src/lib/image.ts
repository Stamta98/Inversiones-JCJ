/**
 * Browser side image preparation.
 *
 * A photo straight off a phone camera is 3-8 MB, which is slow to upload over
 * mobile data and pointless to store: nobody needs a 4000px wide picture of a
 * cédula. Downscaling before the upload keeps the field workflow usable on a
 * bad connection.
 */

/** Longest side, in pixels, of a stored photo. */
const MAX_DIMENSION = 1600;

const JPEG_QUALITY = 0.85;

export interface PreparedImage {
  file: File;
  /** Object URL for the preview. The caller must revoke it. */
  previewUrl: string;
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo leer la imagen"));
    image.src = source;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("No se pudo procesar la imagen")),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

/**
 * Downscales an image to fit MAX_DIMENSION and re-encodes it as JPEG.
 * A file the browser cannot decode (an unusual HEIC, say) is returned as is,
 * so the upload still goes through and the server decides.
 */
export async function prepareImage(input: File): Promise<PreparedImage> {
  const sourceUrl = URL.createObjectURL(input);

  try {
    const image = await loadImage(sourceUrl);
    const longestSide = Math.max(image.width, image.height);
    const scale = longestSide > MAX_DIMENSION ? MAX_DIMENSION / longestSide : 1;

    // Already small enough and already a web format: leave it alone.
    if (scale === 1 && input.type === "image/jpeg") {
      return { file: input, previewUrl: sourceUrl };
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);

    const draw = canvas.getContext("2d");
    if (!draw) return { file: input, previewUrl: sourceUrl };

    draw.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas);

    const fileName = input.name.replace(/\.[^.]+$/, "") || "foto";
    const file = new File([blob], `${fileName}.jpg`, { type: "image/jpeg" });

    URL.revokeObjectURL(sourceUrl);
    return { file, previewUrl: URL.createObjectURL(file) };
  } catch {
    return { file: input, previewUrl: sourceUrl };
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
